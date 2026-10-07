import { mkdir, writeFile, appendFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const base = String(args.base || '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/shelf-shopify.mjs --base=https://www.qdstores.co.uk [--tag=qdstores] [--sample] [--pause=1000] [--brand="Core Balance"] [--any-currency]');
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
/*
 * Prices in pounds. A shop with international markets prices products.json for the visitor's country: on
 * 4 October Yogamatters served a bra at 89000.00 (naira) to a request from Nigeria. The cookies ask for the UK
 * market, and checkCurrency() reads the shop's own cart before anything is kept, so a shop that still answers in
 * another currency stops instead of filling the shelf with wrong costs. --any-currency skips the check.
 */
const HEADERS = { 'user-agent': UA, accept: 'application/json', 'accept-language': 'en-GB', cookie: 'localization=GB; cart_currency=GBP' };
// Some shops (Cult Pens, Papersmiths, Scribble & Dot on 7 October) ignore the cookies and price for the visitor's IP.
// So every request also names the UK market in its address, and checkCurrency() first chooses the UK the way the
// shop's own country selector does (POST /localization) and keeps the cookies the shop sends back.
const UK = 'currency=GBP&country=GB';
const withUk = (url) => `${url}${url.includes('?') ? '&' : '?'}${UK}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exists = p => access(p).then(() => true, () => false);
const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

class Stop extends Error {}
// Shopify serves at most 25,000 products through /products.json (page x limit); past that, go by collection.
class Cap extends Error {}

async function page(n, from = '') {
  const url = withUk(`${base}${from}/products.json?limit=${perPage}&page=${n}`);
  const res = await fetch(url, { headers: HEADERS });
  const text = await res.text();
  if (res.status === 429) throw new Stop(`rate limited (429) on page ${n}`);
  if (res.status === 400 && /25000/.test(text)) throw new Cap(text.slice(0, 120));
  if (res.status !== 200) throw new Stop(`status ${res.status} on page ${n}: ${text.slice(0, 120)}`);
  let body;
  try { body = JSON.parse(text); } catch { throw new Stop(`page ${n} is not JSON, products.json is probably disabled: ${text.slice(0, 120)}`); }
  if (!Array.isArray(body.products)) throw new Stop(`page ${n} has no products array: ${Object.keys(body).join(', ')}`);
  return body.products;
}

const strip = html => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// The shop's own currency for a UK visitor, from its cart. null when the cart can't be read (some shops block it).
// The shop's answer to "ship to the United Kingdom": its localization and currency cookies, added to every request.
async function chooseUk() {
  const res = await fetch(`${base}/localization`, {
    method: 'POST',
    redirect: 'manual',
    headers: { ...HEADERS, 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' },
    body: 'form_type=localization&utf8=%E2%9C%93&_method=put&country_code=GB&return_to=%2F',
  }).catch(() => null);
  if (!res) return false;
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : String(res.headers.get('set-cookie') ?? '').split(/,(?=\s*[A-Za-z0-9_]+=)/);
  const got = raw.map((c) => c.split(';')[0].trim()).filter((c) => c.includes('='));
  if (!got.length) return false;
  const jar = new Map(HEADERS.cookie.split(/;\s*/).map((c) => [c.split('=')[0], c]));
  for (const c of got) jar.set(c.split('=')[0], c);
  HEADERS.cookie = [...jar.values()].join('; ');
  return true;
}

async function checkCurrency() {
  const chose = await chooseUk();
  if (chose) console.log('UK market chosen through the shop\'s country selector');
  const res = await fetch(withUk(`${base}/cart.js`), { headers: HEADERS }).catch(() => null);
  if (!res?.ok) return null;
  const cur = await res.json().then((c) => c?.currency ?? null, () => null);
  if (cur && cur !== 'GBP' && !args['any-currency']) {
    throw new Stop(`the shop prices in ${cur} for this request, not GBP, so its costs would be wrong. Nothing kept. --any-currency to collect anyway.`);
  }
  return cur;
}

/*
 * The maker, as Google's Brand column names it, so store-picks finds the shop's rows under the right brand.
 * - --brand= names it for a single-brand shop whose vendor field differs ("Corebalance" for Core Balance).
 * - A "Brand:" or "Manufacturer:" tag names the maker where the vendor is a distributor (Reptile Centre's
 *   Peregrine) or a code (Yogamatters' VARLEY01).
 * - Otherwise the vendor, without a shop trailer ("RDX Sports | UK") or a stock-code number ("VARLEY01").
 */
function brandOf(p) {
  if (args.brand && args.brand !== true) return String(args.brand);
  const tagged = [].concat(p.tags || []).map((t) => String(t).match(/^\s*(?:brand|manufacturer)\s*:\s*(.+?)\s*$/i)?.[1]).find(Boolean);
  const name = tagged || p.vendor || null;
  if (!name) return null;
  return String(name)
    .replace(/\s*[|\-\u2013]\s*(?:uk|gb|united kingdom|official(?: store| shop)?|store|shop|online)\s*$/i, '')
    .replace(/\s+(?:uk|ltd|limited)\.?$/i, '')
    .replace(/^([a-z][a-z &'.]*?[a-z])\d{2,}$/i, '$1')
    .trim() || null;
}

function rows(p) {
  const now = new Date().toISOString();
  const single = p.variants.length === 1 && /^default title$/i.test(p.variants[0].title || '');
  return p.variants.map(v => ({
    shop: tag,
    url: `${base}/products/${p.handle}${single ? '' : `?variant=${v.id}`}`,
    name: single ? p.title : `${p.title} - ${v.title}`,
    brand: brandOf(p),
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

// Every collection's own products.json, each under the 25,000 cap; products already kept are skipped.
async function byCollection(seen) {
  const handles = [];
  for (let k = 1; ; k++) {
    await sleep(pause);
    const res = await fetch(withUk(`${base}/collections.json?limit=250&page=${k}`), { headers: HEADERS });
    if (res.status === 429) throw new Stop(`rate limited (429) on collections page ${k}`);
    if (!res.ok) throw new Stop(`collections.json status ${res.status}`);
    const list = (await res.json()).collections ?? [];
    if (!list.length) break;
    handles.push(...list.map((c) => c.handle));
  }
  console.log(`${handles.length} collections`);
  for (const [i, h] of handles.entries()) {
    let added = 0;
    for (let n = 1; n <= 100; n++) {
      await sleep(pause);
      let products;
      try { products = await page(n, `/collections/${h}`); } catch (e) { if (e instanceof Cap) break; throw e; }
      if (!products.length) break;
      const fresh = products.filter((p) => !seen.has(p.id));
      fresh.forEach((p) => seen.add(p.id));
      added += fresh.length;
      if (fresh.length) await appendFile(outFile, fresh.flatMap(rows).map((r) => JSON.stringify(r)).join('\n') + '\n');
      // Collections are small; a short page is taken as the last, which halves the requests across thousands.
      if (products.length < perPage) break;
    }
    if (added) console.log(`collection ${i + 1}/${handles.length}  ${h}: ${added} new, ${seen.size} total`);
  }
}

async function sitemapCount() {
  if (!await exists(probeUrls)) return null;
  return (await readFile(probeUrls, 'utf8')).split('\n').filter(l => /sitemap_products/.test(l.split('\t')[0])).length;
}

await mkdir(dir, { recursive: true });

// Ctrl+C still writes the csv from everything collected so far, so a long run can be stopped and used.
process.on('SIGINT', async () => {
  const { products } = await finish();
  console.log(`\nStopped by hand. ${products} products written to ${csvFile}.`);
  process.exit(130);
});

try {
  const currency = await checkCurrency();
  console.log(`currency: ${currency ?? 'not shown (cart.js unreadable); check the prices in the sample'}`);
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
  try {
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
    // Only an empty page ends the shelf: some shops serve 248 on a full page (Decorating Centre Online).
    n++;
  }
  } catch (e) {
    if (!(e instanceof Cap)) throw e;
    console.log(`\nproducts.json stops at 25,000. Reading the rest collection by collection.`);
    await byCollection(seen);
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
