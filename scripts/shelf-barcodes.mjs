/*
 * Barcodes for a Shopify shelf. products.json (what shelf-shopify.mjs reads) has no barcode field; each
 * product's own /products/<handle>.js does. Fetching that for a whole shop is tens of thousands of requests,
 * so only shelf products that could be one of the category's best sellers are read: the same brand as a best
 * seller store-picks would look for (not own label, a shelf product, inside the price range), and a name the
 * match rule does not already call wrong.
 *
 *   node scripts/shelf-barcodes.mjs --tag=lakeland --google=research/google/health-beauty --dry
 *   node scripts/shelf-barcodes.mjs --tag=lakeland --google=research/google/health-beauty
 *
 * Barcodes are kept in research/shelf/<tag>-barcodes.csv (variant id, barcode), so a rerun reads only what is
 * new, and shelf-shopify.mjs fills them back in when it rebuilds the shelf. The shelf CSV is rewritten with its
 * gtin column filled. Stops on a 429 and keeps what it has; the same command resumes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './lib/sources.js';
import { sameProduct, squash, wordCounts } from './store/match.mjs';
import { NOT_SHELF, OWN_LABEL } from './store/shelf.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const tag = arg('tag');
const googleDir = arg('google', 'research/google');
const pause = Number(arg('pause', 700));
const limit = Number(arg('limit', Infinity));
const dry = args.includes('--dry');
if (!tag) { console.error('\n  Pass --tag= the shelf, e.g. --tag=lakeland (reads research/shelf/shelf-lakeland.csv).\n'); process.exit(1); }

const shelfFile = path.join('research', 'shelf', `shelf-${tag}.csv`);
const cacheFile = path.join('research', 'shelf', `${tag}-barcodes.csv`);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

if (!fs.existsSync(googleDir) || !fs.readdirSync(googleDir).some((x) => /^best-sellers-.*\.csv$/i.test(x))) {
  console.error(`\n  No best-sellers-*.csv in ${googleDir}. Save the category's Google exports there first.\n`);
  process.exit(1);
}

// The best sellers store-picks would look for, by brand key, and the word counts its match rule uses.
const minPrice = Number(arg('min', 8));
const maxPrice = Number(arg('max', 60));
const byBrand = new Map();
const titles = [];
const brands = new Set();
for (const f of fs.readdirSync(googleDir).filter((x) => /^best-sellers-.*\.csv$/i.test(x))) {
  for (const g of parseCsv(fs.readFileSync(path.join(googleDir, f), 'utf8').split(/\r?\n/).slice(2).join('\n'))) {
    titles.push(g.Title);
    const b = squash(g.Brand);
    if (b) brands.add(b);
    const min = Number(g['Price Range Min']);
    if (!b || OWN_LABEL.test(String(g.Brand).trim()) || NOT_SHELF.test(g.Title) || !(min >= minPrice && min <= maxPrice)) continue;
    for (const k of new Set([b, b.split(' ')[0]])) {
      const list = byBrand.get(k) ?? [];
      list.push({ title: g.Title, brand: g.Brand });
      byBrand.set(k, list);
    }
  }
}
const ctx = { df: wordCounts(titles), brands };
const couldBe = (r, list) => list.some((g) => !sameProduct(g.title, g.brand, r.name, ctx).startsWith('wrong'));

const text = fs.readFileSync(shelfFile, 'utf8');
const rows = parseCsv(text);
const cache = new Map();
if (fs.existsSync(cacheFile)) for (const r of parseCsv(fs.readFileSync(cacheFile, 'utf8'))) cache.set(String(r.variant_id), r.barcode ?? '');
const done = new Set(fs.existsSync(cacheFile) ? parseCsv(fs.readFileSync(cacheFile, 'utf8')).map((r) => r.handle) : []);

const handleOf = (url) => { try { return new URL(url).pathname.match(/\/products\/([^/?#]+)/)?.[1] ?? null; } catch { return null; } };
const keyOf = (r) => { const b = squash(r.brand); return b || squash(r.name).split(' ')[0]; };
const todo = new Map();
for (const r of rows) {
  if (r.gtin || cache.has(String(r.variant_id))) continue;
  const k = keyOf(r);
  const list = byBrand.get(k) ?? byBrand.get(k.split(' ')[0]);
  if (!list || !couldBe(r, list)) continue;
  const h = handleOf(r.url);
  if (h && !done.has(h)) todo.set(h, new URL(r.url).origin);
}
const list = [...todo].slice(0, limit);
console.log(`\n  ${shelfFile}: ${rows.length} rows, ${cache.size} barcodes already read; ${todo.size} products to read that could be a best seller`);
console.log(`  at one every ${pause}ms, about ${Math.ceil((list.length * (pause + 300)) / 60000)} minutes`);
if (dry) { console.log('\n  Dry run, nothing fetched.\n'); process.exit(0); }

if (!fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, 'handle,variant_id,barcode\n');
let read = 0; let found = 0; let stopped = null;
let buffer = [];
const flush = () => { if (buffer.length) fs.appendFileSync(cacheFile, buffer.join('\n') + '\n'); buffer = []; };
for (const [handle, origin] of list) {
  const res = await fetch(`${origin}/products/${handle}.js`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(30000) }).catch(() => null);
  if (res?.status === 429) { stopped = 'rate limited (429)'; break; }
  if (res?.ok) {
    try {
      const p = await res.json();
      for (const v of p.variants ?? []) {
        const code = String(v.barcode ?? '').replace(/\D/g, '');
        cache.set(String(v.id), code);
        buffer.push([handle, v.id, code].map(cell).join(','));
        if (code) found += 1;
      }
    } catch { buffer.push([handle, '', ''].map(cell).join(',')); }
  } else buffer.push([handle, '', ''].map(cell).join(','));
  read += 1;
  if (read % 50 === 0) { flush(); console.log(`  ${read}/${list.length} read, ${found} barcodes`); }
  await sleep(pause);
}
flush();

// The shelf with its gtin column filled from everything read so far.
let filled = 0;
// Column names as the CSV reader parsed them, never a raw split of the first line: a quoted header ("gtin")
// read raw kept its quotes, matched no column, and wrote every cell of Festive Lights' shelf empty.
const header = Object.keys(rows[0] ?? {});
const cols = header.includes('gtin') ? header : [...header, 'gtin'];

const out = rows.map((r) => {
  const code = r.gtin || cache.get(String(r.variant_id)) || '';
  if (code && !r.gtin) filled += 1;
  return cols.map((c) => cell(c === 'gtin' ? code : r[c])).join(',');
});
if (!filled) { console.log(`\n  ${read} products read, ${found} barcodes; no shelf row changed, ${shelfFile} left as it was\n`); process.exit(0); }
// The shelf as it was is kept once, beside it, before the first rewrite.
if (!fs.existsSync(`${shelfFile}.before-barcodes`)) fs.copyFileSync(shelfFile, `${shelfFile}.before-barcodes`);
fs.writeFileSync(`${shelfFile}.part`, [cols.map(cell).join(','), ...out].join('\n'));
fs.renameSync(`${shelfFile}.part`, shelfFile);
console.log(`\n  ${read} products read, ${found} barcodes; ${filled} shelf rows gained a barcode${stopped ? `. STOPPED: ${stopped}; rerun to resume` : ''}`);
console.log(`  ${shelfFile}\n  ${cacheFile}\n`);
