/*
 * Opens the shop page behind each store pick and checks it is the same product Google ranks.
 * A pick is proof the product can be sourced only if the shop really sells that product.
 * Reads one page per pick, slowly; stops on a block rather than pushing through it. No eBay calls.
 *
 *   node scripts/store/check-picks.mjs --top=100
 *   node scripts/store/check-picks.mjs --recheck   re-judges the pages already read, no fetching
 *   node scripts/store/check-picks.mjs --top=all --refetch   reads every page again, to pick up barcodes
 *
 * A page already read in an earlier run is reused, not fetched again, so a rerun after new shelves or a
 * stopped run only reads what is new. Progress is saved every 25 picks, so stopping loses at most 25.
 *
 * Writes research/picks/checked.csv: every column of all.csv plus verdict, page_name, page_price, page_vat, page_stock, page_image, page_gtin.
 * The barcode decides first: the page's GTIN against every GTIN Google lists for the product. Only when a side has
 * none does the name rule judge, and a name alone no longer confirms a page that adds "kids", "refills" or "tray".
 * page_price carries VAT: trade shops that price without it (CPC, Farnell) gain 20%, and page_vat says so.
 * page_image is for her review card only, to recognise the product; it is never published on the shop.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import path from 'node:path';
import { barcodeVerdict, digits, sameProduct, squash, wordCounts } from './match.mjs';
import { decode, fetchPage, paidPrice } from './page.mjs';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const picksPath = arg('picks', 'research/picks/all.csv');
const out = arg('out', 'research/picks/checked.csv');
const top = arg('top', '100') === 'all' ? Infinity : Number(arg('top', 100));
const pause = Number(arg('pause', 1500));
const googleDir = arg('google', 'research/google');
const recheck = process.argv.includes('--recheck');
const refetch = process.argv.includes('--refetch');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The same word counts and brand list store-picks sees, so a page is judged by the rule that picked it.
const titles = [];
const brands = new Set();
// Every GTIN Google lists for a product, by brand and title; the picks file keeps only the first.
const gtinsBy = new Map();
const keyOf = (brand, title) => `${squash(brand)}|${squash(title)}`;
for (const f of fs.readdirSync(googleDir).filter((x) => /^best-sellers-.*\.csv$/i.test(x))) {
  for (const g of parseCsv(fs.readFileSync(path.join(googleDir, f), 'utf8').split(/\r?\n/).slice(2).join('\n'))) {
    titles.push(g.Title);
    if (g.Brand) brands.add(squash(g.Brand));
    const codes = String(g.GTINs ?? '').split(/\s+/).map(digits).filter(Boolean);
    if (codes.length) gtinsBy.set(keyOf(g.Brand, g.Title), [...new Set([...(gtinsBy.get(keyOf(g.Brand, g.Title)) ?? []), ...codes])]);
  }
}
const ctx = { df: wordCounts(titles), brands };
const gtinsOf = (pick) => gtinsBy.get(keyOf(pick.brand, pick.title)) ?? [pick.gtin].filter(Boolean);
function verdictOf(pick, page) {
  const byCode = barcodeVerdict(gtinsOf(pick), page.gtin);
  if (byCode) return byCode;
  return page.name ? sameProduct(pick.title, pick.brand, page.name, ctx) : 'no product name on the page';
}

const rows = parseCsv(fs.readFileSync(recheck ? out : picksPath, 'utf8'));
const chosen = rows.slice(0, top);
const blockedHosts = new Set();
const checked = [];
const tally = {};

// Pages read in earlier runs, by link. A gone page stays gone; a blocked, failed or priceless one is tried again.
const cache = new Map();
if (!recheck && !refetch && fs.existsSync(out)) {
  for (const r of parseCsv(fs.readFileSync(out, 'utf8'))) {
    const link = String(r.seen_link ?? '').trim();
    if (!link) continue;
    // A page read without a price is read again: the reader has learned more places a price is kept.
    if (r.page_name && r.page_price) cache.set(link, { name: decode(r.page_name), price: r.page_price, vat: r.page_vat ?? '', stock: r.page_stock, image: r.page_image ?? '', gtin: r.page_gtin ?? '' });
    else if (/^page gone/.test(r.verdict ?? '')) cache.set(link, { gone: r.verdict });
  }
}
let reused = 0;

const cols = [...new Set([...Object.keys(rows[0] ?? {}), 'verdict', 'page_name', 'page_price', 'page_vat', 'page_stock', 'page_image', 'page_gtin'])];
const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
// The picks done so far, then the rest unchecked, so the file is always the whole list. Written to a side file first.
function save() {
  const rest = rows.slice(checked.length).map((pick) => ({ verdict: '', page_name: '', page_price: '', page_vat: '', page_stock: '', page_image: '', page_gtin: '', ...pick }));
  const all = [...checked, ...rest];
  fs.writeFileSync(`${out}.part`, [cols.join(','), ...all.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n', 'utf8');
  fs.renameSync(`${out}.part`, out);
}

for (const [i, pick] of chosen.entries()) {
  const url = String(pick.seen_link ?? '').trim();
  let verdict;
  let page = { name: '', price: '', stock: '', image: '', gtin: '' };
  const host = /^https?:\/\//.test(url) ? new URL(url).host : null;
  if (recheck && pick.page_name) { page = { name: decode(pick.page_name), price: pick.page_price, stock: pick.page_stock, image: pick.page_image ?? '', gtin: pick.page_gtin ?? '' }; verdict = verdictOf(pick, page); }
  else if (recheck) verdict = pick.verdict;
  else if (cache.has(url)) {
    const hit = cache.get(url);
    reused += 1;
    if (hit.gone) verdict = hit.gone;
    else { page = hit; verdict = verdictOf(pick, page); }
  }
  else if (!host) verdict = 'no link to check';
  else if (blockedHosts.has(host)) verdict = 'shop blocked, not checked';
  else {
    const got = await fetchPage(url);
    if (got.blocked) { blockedHosts.add(host); verdict = `shop blocked (${got.blocked}), not checked`; }
    else if (got.gone) verdict = `page gone (${got.gone})`;
    else if (got.failed) verdict = `could not read (${got.failed})`;
    else {
      // The price she would pay: trade shops that show prices without VAT gain 20%.
      const paid = paidPrice(got.page, url);
      page = { ...got.page, price: paid?.price ?? '', vat: paid?.vatAdded ? 'added' : '' };
      verdict = verdictOf(pick, page);
    }
    await sleep(pause);
  }
  tally[verdict.split(',')[0].split(' (')[0]] = (tally[verdict.split(',')[0].split(' (')[0]] ?? 0) + 1;
  checked.push({ ...pick, verdict, page_name: page.name, page_price: page.price, page_vat: page.vat ?? '', page_stock: page.stock, page_image: page.image ?? '', page_gtin: page.gtin ?? '' });
  console.log(`  ${String(i + 1).padStart(3)}/${chosen.length}  ${verdict.padEnd(30)} ${String(pick.title).slice(0, 40).padEnd(40)}  ${page.name.slice(0, 40)}`);
  if (!recheck && (i + 1) % 25 === 0) save();
}

save();

console.log(`\n  ${chosen.length} checked${reused ? `, ${reused} from pages already read` : ''}: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (blockedHosts.size) console.log(`  Blocked, so left unchecked: ${[...blockedHosts].join(', ')}`);
console.log(`\n  ${out}\n`);
