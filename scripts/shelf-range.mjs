import { mkdir, writeFile, appendFile, readFile, access } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const base = String(args.base || 'https://www.therange.co.uk').replace(/\/$/, '');
const tag = args.tag || new URL(base).hostname.replace(/^www\./, '').split('.')[0];
const workers = Number(args.concurrency || 4);
const pause = Number(args.pause || 400);
const limit = args.limit ? Number(args.limit) : Infinity;
const sample = args.sample ? Number(args.sample === true ? 3 : args.sample) : 0;
const urlMatch = args.match ? new RegExp(args.match, 'i') : null;
const refreshUrls = Boolean(args.refresh);
const useBrowser = Boolean(args.browser);

const dir = join('research', 'shelf');
const urlFile = join(dir, `${tag}-urls.txt`);
const outFile = join(dir, `shelf-${tag}.jsonl`);
const skipFile = join(dir, `shelf-${tag}.skip`);
const csvFile = join(dir, `shelf-${tag}.csv`);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const exists = p => access(p).then(() => true, () => false);

class Stop extends Error {}

const CHALLENGE_TITLE = /Just a moment|Attention Required|Verifying you are human/i;
let browser = null;

async function openBrowser() {
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Stop('playwright is not installed: npm i -D playwright, then npx playwright install chromium'); }
  const profile = join('.browser', tag);
  const opts = { headless: false, viewport: { width: 1280, height: 800 }, locale: 'en-GB' };
  let ctx;
  // Installed Chrome clears Cloudflare more often than bundled Chromium.
  try { ctx = await chromium.launchPersistentContext(profile, { ...opts, channel: 'chrome' }); }
  catch { ctx = await chromium.launchPersistentContext(profile, opts); }
  const page = ctx.pages()[0] || await ctx.newPage();

  async function clear() {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const until = Date.now() + 180000;
    let told = false;
    while (Date.now() < until) {
      const title = await page.title().catch(() => '');
      if (title && !CHALLENGE_TITLE.test(title)) return;
      if (!told) { console.log('Waiting on the Cloudflare check. Tick the box in the browser window if one shows.'); told = true; }
      await sleep(2000);
    }
    throw new Stop('Cloudflare check not cleared within 3 minutes');
  }

  let recovering = null;
  await clear();
  console.log('check cleared, fetching from inside the page');

  return {
    fetch: url => page.evaluate(async u => {
      try {
        const r = await fetch(u, { credentials: 'include' });
        let bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          bytes = new Uint8Array(await new Response(ds).arrayBuffer());
        }
        return { status: r.status, text: new TextDecoder().decode(bytes), final: r.url };
      } catch (e) { return { error: String(e) }; }
    }, url),
    recover: () => (recovering ||= clear().finally(() => { recovering = null; })),
    close: () => ctx.close()
  };
}

function wall(status, text) {
  if (status === 429) return 'rate limited (429)';
  if (/cf-chl|challenge-platform|Just a moment/i.test(text)) return 'cloudflare challenge';
  if (/px-captcha|perimeterx/i.test(text)) return 'perimeterx';
  if (/_Incapsula_|incap_ses/i.test(text)) return 'incapsula';
  if (status === 403) return '403';
  if (status === 503) return '503';
  return null;
}

async function get(url, retried = false) {
  if (browser) {
    const r = await browser.fetch(url);
    // Usually a cross-origin sitemap the page is not allowed to read.
    if (r.error) throw new Error(`${r.error} on ${url}`);
    const blocked = wall(r.status, r.text);
    if (blocked) {
      if (retried) throw new Stop(`${blocked} on ${url}, again after re-clearing`);
      await browser.recover();
      return get(url, true);
    }
    return r;
  }
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-GB,en;q=0.9', accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'follow'
  });
  let buf = Buffer.from(await res.arrayBuffer());
  // .xml.gz sitemaps arrive as raw gzip, not content-encoded.
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const text = buf.toString('utf8');
  const blocked = wall(res.status, text);
  if (blocked) throw new Stop(`${blocked} on ${url}`);
  return { status: res.status, text, final: res.url };
}

async function robots() {
  const r = await get(`${base}/robots.txt`).catch(e => { if (e instanceof Stop) throw e; return { status: 0, text: '' }; });
  const lines = r.text.split(/\r?\n/);
  const disallow = [];
  let star = false;
  for (const l of lines) {
    const ua = l.match(/^\s*user-agent:\s*(.+)/i);
    if (ua) { star = ua[1].trim() === '*'; continue; }
    const d = l.match(/^\s*disallow:\s*(\S+)/i);
    if (star && d) disallow.push(d[1]);
  }
  const maps = [...r.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  return { disallow, maps: maps.length ? maps : [`${base}/sitemap.xml`] };
}

const allowed = (url, disallow) => {
  const path = new URL(url).pathname + new URL(url).search;
  return !disallow.some(d => {
    const re = new RegExp('^' + d.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    return re.test(path);
  });
};

async function productUrls(rules) {
  const pick = list => {
    const kept = urlMatch ? list.filter(u => urlMatch.test(u)) : list;
    if (urlMatch) console.log(`urls            ${kept.length} of ${list.length} match ${urlMatch}`);
    return kept;
  };
  if (!refreshUrls && await exists(urlFile)) {
    const cached = (await readFile(urlFile, 'utf8')).split('\n').filter(Boolean);
    if (cached.length) {
      console.log(`urls            ${cached.length} from ${urlFile} (--refresh to re-read sitemaps)`);
      return pick(cached);
    }
  }
  const queue = [...rules.maps];
  const seen = new Set();
  const sets = [];
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    await sleep(pause);
    let r;
    try { r = await get(url); } catch (e) { if (e instanceof Stop) throw e; console.log(`ERR sitemap ${url} ${e.message}`); continue; }
    const found = [...r.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => decode(m[1]));
    if (/<sitemapindex/i.test(r.text)) queue.push(...found);
    else sets.push({ url, found });
    console.log(`sitemap ${String(found.length).padStart(6)} ${url}`);
  }
  const productSets = sets.filter(s => /product|pdp/i.test(s.url));
  const chosen = productSets.length ? productSets : sets;
  const urls = [...new Set(chosen.flatMap(s => s.found))].filter(u => allowed(u, rules.disallow));
  console.log(`urls            ${urls.length} from ${productSets.length ? 'product sitemaps' : 'all sitemaps, no product sitemap named'}`);
  // Cached before --match so a different filter needs no sitemap re-read.
  if (urls.length) await writeFile(urlFile, urls.join('\n'));
  return pick(urls);
}

const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// A valid EAN-13 or UPC-12 checksum. Eight digits is left out: one internal code in ten passes it.
function validGtin(d) {
  if (!/^(\d{12}|\d{13})$/.test(d)) return false;
  const digits = d.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((t, n, i) => t + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function gtinFrom(...texts) {
  for (const t of texts) {
    for (const m of String(t || '').matchAll(/\d{12,13}/g)) if (validGtin(m[0])) return m[0];
  }
  return null;
}

// Some shops carry no breadcrumb; the first path segment usually names the department.
function categoryFromPath(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean).slice(0, -1)
    .filter(p => !/^(p|product|products|[a-z]{2})$/i.test(p));
  return parts.length > 1 ? decodeURIComponent(parts[0]).replace(/[-_]+/g, ' ') : null;
}

function extract(html, url) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m => {
    try {
      const j = JSON.parse(m[1].trim());
      return (Array.isArray(j) ? j : j['@graph'] || [j]);
    } catch { return []; }
  });
  const types = b => [].concat(b['@type'] || []);
  const crumbs = blocks.find(b => types(b).includes('BreadcrumbList'));
  const category = crumbs
    ? [].concat(crumbs.itemListElement || []).sort((a, b) => (a.position || 0) - (b.position || 0)).map(i => i.name || i.item?.name).filter(Boolean).map(n => decode(String(n))).join(' > ')
    : null;

  const products = [];
  for (const b of blocks) {
    if (types(b).includes('ProductGroup')) products.push(...[].concat(b.hasVariant || []).map(v => ({ ...v, brand: v.brand || b.brand })));
    else if (types(b).includes('Product')) products.push(b);
  }

  const unitPrice = html.match(/£\s?\d+(?:\.\d{1,2})?\s*(?:per|\/)\s*(?:\d+\s*)?(?:kg|g|ml|l|litre|m|each|100g|100ml)\b/i)?.[0] || null;
  const soldByText = html.match(/(?:sold|dispatched|fulfilled) by\s*(?:<[^>]+>\s*)*([^<]{2,60})/i)?.[1]?.trim() || null;
  const now = new Date().toISOString();

  return products.map(p => {
    const offers = [].concat(p.offers || []);
    const o = offers[0] || {};
    const price = num(o.price ?? o.lowPrice ?? o.priceSpecification?.price);
    return {
      shop: tag,
      url: p.url ? new URL(p.url, url).href : url,
      name: p.name ? decode(String(p.name)) : null,
      brand: typeof p.brand === 'string' ? p.brand : p.brand?.name || null,
      price,
      was: num(o.highPrice) && num(o.highPrice) !== price ? num(o.highPrice) : null,
      currency: o.priceCurrency || null,
      unit_price: unitPrice,
      gtin: p.gtin13 || p.gtin || p.gtin14 || p.gtin12 || p.gtin8 || gtinFrom(p.sku, p.mpn, url),
      sku: p.sku || p.productID || null,
      mpn: p.mpn || null,
      availability: o.availability ? String(o.availability).replace(/^https?:\/\/schema\.org\//, '') : null,
      seller: o.seller?.name || soldByText,
      offers: offers.length,
      category: category || categoryFromPath(url),
      image: [].concat(p.image || [])[0]?.url || [].concat(p.image || [])[0] || null,
      weight: p.weight?.value ? `${p.weight.value} ${p.weight.unitCode || p.weight.unitText || ''}`.trim() : p.weight || null,
      collected_at: now
    };
  });
}

const COLS = ['shop', 'url', 'name', 'brand', 'price', 'was', 'currency', 'unit_price', 'gtin', 'sku', 'mpn', 'availability', 'seller', 'offers', 'category', 'image', 'weight', 'collected_at'];
const cell = v => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function writeCsv() {
  if (!await exists(outFile)) return 0;
  const rows = (await readFile(outFile, 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
  await writeFile(csvFile, [COLS.join(','), ...rows.map(r => COLS.map(c => cell(r[c])).join(','))].join('\n'));
  return rows.length;
}

await mkdir(dir, { recursive: true });

try {
  if (useBrowser) browser = await openBrowser();
  const rules = await robots();
  const urls = await productUrls(rules);
  if (!urls.length) throw new Stop('no product urls found in sitemaps; send research/probes output');

  if (sample) {
    const picks = [urls[0], urls[Math.floor(urls.length / 2)], urls[urls.length - 1]].slice(0, sample);
    for (const u of picks) {
      await sleep(pause);
      const r = await get(u);
      const rows = extract(r.text, u);
      console.log(`\n${r.status} ${u}`);
      console.log(rows.length ? JSON.stringify(rows, null, 2) : 'NO PRODUCT DATA ON PAGE');
      await writeFile(join(dir, `${tag}-sample-${picks.indexOf(u) + 1}.html`), r.text);
    }
    console.log(`\nSample only, nothing written to ${outFile}. Pages saved beside it.`);
    await browser?.close();
    process.exit(0);
  }

  const done = new Set();
  for (const f of [outFile, skipFile]) {
    if (!await exists(f)) continue;
    for (const l of (await readFile(f, 'utf8')).split('\n')) {
      if (!l) continue;
      done.add(f === skipFile ? l.split('\t')[0] : JSON.parse(l).source);
    }
  }
  const todo = urls.filter(u => !done.has(u)).slice(0, limit);
  console.log(`to fetch        ${todo.length} (${done.size} already done), ${workers} workers`);

  let next = 0, ok = 0, empty = 0, failed = 0, streak = 0, stopped = null;
  const started = Date.now();

  async function worker() {
    while (!stopped && next < todo.length) {
      const u = todo[next++];
      await sleep(pause);
      try {
        const r = await get(u);
        const rows = extract(r.text, u);
        streak = 0;
        if (!rows.length) {
          empty++;
          await appendFile(skipFile, `${u}\t${r.status === 200 ? 'no product data' : 'status ' + r.status}\n`);
          continue;
        }
        ok++;
        await appendFile(outFile, rows.map(row => JSON.stringify({ ...row, source: u })).join('\n') + '\n');
      } catch (e) {
        if (e instanceof Stop) { stopped = e.message; return; }
        failed++;
        // Network errors are not written, so a resume retries them.
        if (++streak >= 20) { stopped = `20 fetch errors in a row, last: ${e.message}`; return; }
      }
      const n = ok + empty + failed;
      if (n % 250 === 0) {
        const rate = n / ((Date.now() - started) / 1000);
        console.log(`${n}/${todo.length}  products ${ok}  no data ${empty}  errors ${failed}  ${rate.toFixed(1)}/s  ~${Math.round((todo.length - n) / rate / 60)} min left`);
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
  const rows = await writeCsv();
  console.log(`\npages with product ${ok}, without ${empty}, errors ${failed}. ${rows} rows in ${csvFile}`);
  if (empty > ok && ok + empty > 200) console.log('More pages without product data than with. Stop and send a sample page before going further.');
  await browser?.close();
  if (stopped) {
    console.error(`\nSTOPPED: ${stopped}\nRe-run the same command to resume. Wait before retrying a block.`);
    process.exit(2);
  }
} catch (e) {
  await writeCsv();
  await browser?.close().catch(() => {});
  console.error(`\nSTOPPED: ${e.message}`);
  process.exit(2);
}
