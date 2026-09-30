import { mkdir, writeFile, appendFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const base = String(args.base || '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/shelf-shopify.mjs --base=https://www.qdstores.co.uk [--tag=qdstores] [--sample] [--pause=1000]');
  process.exit(1);
}
const tag = args.tag || new URL(base).hostname.replace(/^www\./, '').split('.')[0];
const pause = Number(args.pause || 1000);
const perPage = 250;

const dir = join('research', 'shelf');
const outFile = join(dir, `shelf-${tag}.jsonl`);
const stateFile = join(dir, `shelf-${tag}.state`);
const csvFile = join(dir, `shelf-${tag}.csv`);
const probeUrls = join('research', 'probes', tag, 'sitemap-urls.tsv');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);
const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

class Stop extends Error {}

async function page(n) {
  const url = `${base}/products.json?limit=${perPage}&page=${n}`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', 'accept-language': 'en-GB' } });
  const text = await res.text();
  if (res.status === 429) throw new Stop(`rate limited (429) on page ${n}`);
  if (res.status !== 200) throw new Stop(`status ${res.status} on page ${n}: ${text.slice(0, 120)}`);
  let body;
  try { body = JSON.parse(text); } catch { throw new Stop(`page ${n} is not JSON, products.json is probably disabled: ${text.slice(0, 120)}`); }
  if (!Array.isArray(body.products)) throw new Stop(`page ${n} has no products array: ${Object.keys(body).join(', ')}`);
  return body.products;
}

const strip = html => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function rows(p) {
  const now = new Date().toISOString();
  const single = p.variants.length === 1 && /^default title$/i.test(p.variants[0].title || '');
  return p.variants.map(v => ({
    shop: tag,
    url: `${base}/products/${p.handle}${single ? '' : `?variant=${v.id}`}`,
    name: single ? p.title : `${p.title} - ${v.title}`,
    brand: p.vendor || null,
    price: num(v.price),
    was: num(v.compare_at_price) > num(v.price) ? num(v.compare_at_price) : null,
    available: v.available ?? null,
    sku: v.sku || null,
    gtin: v.barcode || null,
    grams: v.grams ?? null,
    category: p.product_type || null,
    tags: [].concat(p.tags || []).join('|') || null,
    image: v.featured_image?.src || p.images?.[0]?.src || null,
    description: strip(p.body_html).slice(0, 300) || null,
    product_id: p.id,
    variant_id: v.id,
    published_at: p.published_at || null,
    collected_at: now
  }));
}

const COLS = ['shop', 'url', 'name', 'brand', 'price', 'was', 'available', 'sku', 'gtin', 'grams', 'category', 'tags', 'image', 'description', 'product_id', 'variant_id', 'published_at', 'collected_at'];
const cell = v => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Festive Lights publishes 2437200 for £2,437.20: prices a thousand times too large. A shop whose median
// price is in the thousands is read at that scale; --price-scale=1 keeps prices exactly as published.
function scaleOf(all) {
  if (args['price-scale']) return Number(args['price-scale']);
  const prices = all.map(r => Number(r.price)).filter(v => v > 0).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)] ?? 0;
  return median > 2000 ? 1000 : 1;
}

async function finish() {
  if (!await exists(outFile)) return { products: 0, variants: 0 };
  const raw = (await readFile(outFile, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
  const scale = scaleOf(raw);
  const fix = v => (v == null || v === '' ? v : Math.round((Number(v) / scale) * 100) / 100);
  // products.json carries no barcode; shelf-barcodes.mjs reads them from each product's .js and keeps them here.
  const codes = new Map();
  const cacheFile = join(dir, `${tag}-barcodes.csv`);
  if (await exists(cacheFile)) {
    for (const l of (await readFile(cacheFile, 'utf8')).split('\n').slice(1)) {
      const [, variant, code] = l.split(',');
      if (variant && code) codes.set(variant.trim(), code.trim());
    }
  }
  const all = raw.map(r => ({
    ...r,
    ...(scale === 1 ? {} : { price: fix(r.price), was: fix(r.was) }),
    gtin: r.gtin || codes.get(String(r.variant_id)) || null,
  }));
  if (scale !== 1) console.log(`\nPrices read at 1/${scale}: this shop publishes them ${scale} times too large. --price-scale=1 to keep them as published.`);
  await writeFile(csvFile, [COLS.join(','), ...all.map(r => COLS.map(c => cell(r[c])).join(','))].join('\n'));
  return { products: new Set(all.map(r => r.product_id)).size, variants: all.length };
}

async function sitemapCount() {
  if (!await exists(probeUrls)) return null;
  return (await readFile(probeUrls, 'utf8')).split('\n').filter(l => /sitemap_products/.test(l.split('\t')[0])).length;
}

await mkdir(dir, { recursive: true });

try {
  if (args.sample) {
    const first = await page(1);
    console.log(`page 1: ${first.length} products`);
    if (!first.length) throw new Stop('page 1 is empty');
    console.log('\nRAW FIRST PRODUCT, variants trimmed to 2:');
    console.log(JSON.stringify({ ...first[0], body_html: strip(first[0].body_html).slice(0, 200), variants: first[0].variants.slice(0, 2) }, null, 2));
    console.log('\nAS ROWS:');
    console.log(JSON.stringify(rows(first[0]).slice(0, 2), null, 2));
    const second = await page(2);
    const repeat = second.length && second[0].id === first[0].id;
    console.log(`\npage 2: ${second.length} products, ${repeat ? 'SAME AS PAGE 1, paging is ignored' : 'different from page 1, paging works'}`);
    console.log(`\nSample only, nothing written.`);
    process.exit(0);
  }

  let n = await exists(stateFile) ? Number((await readFile(stateFile, 'utf8')).trim()) + 1 : 1;
  const seen = new Set();
  if (n > 1 && await exists(outFile)) {
    for (const l of (await readFile(outFile, 'utf8')).split('\n')) if (l) seen.add(JSON.parse(l).product_id);
    console.log(`resuming at page ${n}, ${seen.size} products already collected`);
  }

  let lastFirst = null;
  while (true) {
    await sleep(pause);
    const products = await page(n);
    if (!products.length) break;
    if (products[0].id === lastFirst) throw new Stop(`page ${n} repeats page ${n - 1}, paging is being ignored`);
    lastFirst = products[0].id;
    const fresh = products.filter(p => !seen.has(p.id));
    fresh.forEach(p => seen.add(p.id));
    if (fresh.length) await appendFile(outFile, fresh.flatMap(rows).map(r => JSON.stringify(r)).join('\n') + '\n');
    await writeFile(stateFile, String(n));
    console.log(`page ${String(n).padStart(3)}  ${products.length} products, ${fresh.length} new, ${seen.size} total`);
    if (products.length < perPage) break;
    n++;
  }

  const { products, variants } = await finish();
  const expected = await sitemapCount();
  console.log(`\n${products} products, ${variants} variant rows in ${csvFile}`);
  if (expected) {
    const share = products / expected;
    console.log(`sitemap lists ${expected} product urls, collected ${(share * 100).toFixed(1)}%`);
    if (share < 0.9) console.log('Under 90% of the sitemap. products.json may cap its pages; tell me before using this as the whole shelf.');
  } else {
    console.log(`No probe sitemap list at ${probeUrls} to check coverage against.`);
  }
} catch (e) {
  const { products } = await finish();
  console.error(`\nSTOPPED: ${e.message}\n${products} products kept. Re-run the same command to resume.`);
  process.exit(2);
}
