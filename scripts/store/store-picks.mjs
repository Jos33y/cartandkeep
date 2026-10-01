/*
 * What sells on Google in the UK, kept when a UK shop is seen selling it, which proves it can be sourced here.
 * The shop is evidence, not the supplier: she buys wherever is cheapest. No eBay calls, no network.
 *
 *   node scripts/store/store-picks.mjs --google=research/google/best-sellers-home-garden-2026-08.csv
 *   node scripts/store/store-picks.mjs --google=research/google --skip-shops=lakeland
 *
 * One export, or a folder of them: a product in several months is one row, with every month it ranked in.
 * Writes research/picks/<export name>.csv, or research/picks/<folder>/all.csv for a category folder. cost_seen is the price where
 * it was seen and store_floor the lowest store price that pays her profit on it, from src/lib/pricing.js, the
 * same figures the import and her card use.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { digits, modelsIn, needOf, queryOf, sameProduct, seasonOf, squash, wordCounts } from './match.mjs';
import { loadShelves, normShop, titleGrams } from './shelf.mjs';
import { postCheckOf, stopOf } from './rules/index.mjs';
import { PROFIT, floorFor, storeBandFor, storeCosts } from '../../src/lib/pricing.js';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const googlePath = arg('google');
const skipShops = new Set(String(arg('skip-shops', '')).split(',').map(normShop).filter(Boolean));
const shelfDir = arg('shelves', 'research/shelf');
const minPrice = Number(arg('min', 8));
const maxPrice = Number(arg('max', 60));
if (!googlePath) { console.error('\n  Pass --google= a Merchant Center best sellers export.\n'); process.exit(1); }


const exports = fs.statSync(googlePath).isDirectory()
  ? fs.readdirSync(googlePath).filter((f) => /^best-sellers-.*\.csv$/i.test(f)).map((f) => path.join(googlePath, f))
  : [googlePath];
// One row per product across every export, keeping its best rank and each period it ranked in.
const merged = new Map();
for (const file of exports) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const period = lines[1]?.match(/Time period = (\w+)/)?.[1] ?? path.basename(file);
  const category = lines[1]?.match(/Category = ([^;"]+)/)?.[1]?.trim() ?? '';
  for (const g of parseCsv(lines.slice(2).join('\n'))) {
    const key = `${squash(g.Brand)}|${squash(g.Title)}`;
    const rank = Number(g['Popularity rank']);
    const prior = merged.get(key);
    if (!prior) { merged.set(key, { ...g, periods: [period], category }); continue; }
    if (!prior.periods.includes(period)) prior.periods.push(period);
    if (rank < Number(prior['Popularity rank'])) Object.assign(prior, { ...g, periods: prior.periods, category: prior.category });
  }
}
const google = [...merged.values()];
const exportedPeriods = [...new Set(google.flatMap((g) => g.periods))];
const ctx = { df: wordCounts(google.map((g) => g.Title)), brands: new Set(google.map((g) => squash(g.Brand)).filter(Boolean)) };
// A brand with many best sellers is one the big shops all stock and fight over on price.
const bigAt = Number(arg('big-brand', 30));
const brandCount = new Map();
for (const g of google) { const b = squash(g.Brand); if (b) brandCount.set(b, (brandCount.get(b) ?? 0) + 1); }
const tally = { exports: exports.length, best_sellers: google.length, own_label: 0, not_shelf: 0, restricted: 0, cant_post: 0, outside_price: 0, considered: 0, only_a_part_seen: 0, bigger_pack_seen: 0 };
const wanted = [];
// Where each best seller stopped, for the coverage file: every product Google ranked, not only the picks.
const keyOf = (g) => `${squash(g.Brand)}|${squash(g.Title)}`;
const stopped = new Map();
const stopRules = {};
for (const g of google) {
  const min = Number(g['Price Range Min']);
  // Own label, not a shelf product, restricted, cannot be posted: rules/, shared by every category.
  const stop = stopOf({ title: g.Title, brand: g.Brand, category: g.category });
  if (stop) { tally[stop.stop] += 1; stopped.set(keyOf(g), stop.stop); stopRules[stop.rule] = (stopRules[stop.rule] ?? 0) + 1; continue; }
  if (!(min >= minPrice && min <= maxPrice)) { tally.outside_price += 1; stopped.set(keyOf(g), 'outside_price'); continue; }
  tally.considered += 1;
  wanted.push({ ...g, min, max: Number(g['Price Range Max']) || min, gtins: String(g.GTINs ?? '').split(/\s+/).map(digits).filter(Boolean), brand: squash(g.Brand), models: modelsIn(g.Title) });
}

// Only shelf products that could match a wanted best seller are kept: its barcode, or its brand's key.
const shelf = loadShelves({
  dir: shelfDir,
  wantGtins: new Set(wanted.flatMap((g) => g.gtins)),
  wantKeys: new Set(wanted.flatMap((g) => [g.brand, g.brand.split(' ')[0]]).filter(Boolean)),
  wantBrands: new Set(wanted.map((g) => g.brand).filter(Boolean)),
  skipShops,
});
const { byGtin, byBrand, weighed } = shelf;
const shelfFiles = shelf.files;
const shelfRows = shelf.rows;
const shelfKept = shelf.kept;

// A shop whose median product weighs over 4kg is writing a placeholder or the wrong unit (Towsure 27kg, Miller
// Care 38.7kg for wrist supports): its weights are ignored, so a real product is never dropped as over 20kg.
const med = (xs) => { const s2 = [...xs].sort((a, b) => a - b); return s2[Math.floor(s2.length / 2)]; };
const MAX_SHOP_MEDIAN = Number(arg('max-shop-median', 4000));
const badWeights = new Set([...weighed].filter(([, v]) => med(v) > MAX_SHOP_MEDIAN).map(([k]) => k));

// Best sellers no collected shop was seen selling: the gap, and where to look next.
const unseen = [];

const RANK = { barcode: 0, model: 1, 'name': 2, 'name, check it': 3 };
const picks = [];
for (const g of wanted) {
  const hits = [];
  for (const code of g.gtins) for (const s of byGtin.get(code) ?? []) hits.push({ s, via: 'barcode' });
  if (!hits.length) {
    for (const s of byBrand.get(g.brand) ?? byBrand.get(g.brand.split(' ')[0]) ?? []) {
      const model = g.models.find((m) => squash(s.name).split(' ').includes(m));
      if (model) { hits.push({ s, via: `model ${model}` }); continue; }
      const v = sameProduct(g.Title, g.Brand, s.name, ctx);
      if (v.startsWith('confirmed')) hits.push({ s, via: 'name' });
      else if (v.startsWith('unsure')) hits.push({ s, via: 'name, check it' });
    }
  }
  if (!hits.length) { unseen.push(g); stopped.set(keyOf(g), 'not_seen'); continue; }
  // A match priced under 40% of Google's lowest is a refill, part or cover, which proves nothing about the product.
  const real = hits.filter((h) => h.s.price == null || h.s.price >= g.min * 0.4);
  if (!real.length) { tally.only_a_part_seen += 1; stopped.set(keyOf(g), 'part_only'); continue; }
  // Over twice Google's highest price is a bigger pack or another model (a 5L sprayer for a 500ml spray), not a cost.
  const sane = real.filter((h) => h.s.price == null || h.s.price <= g.max * 2);
  if (!sane.length) { tally.bigger_pack_seen += 1; stopped.set(keyOf(g), 'bigger_pack'); continue; }
  real.splice(0, real.length, ...sane);
  const shops = [...new Set(real.map((h) => h.s.shop))];
  // The surest match first; among equally sure matches, the cheapest price, since that is the cost she can get.
  const rankOf = (h) => RANK[h.via] ?? RANK[h.via.split(' ')[0]];
  const first = real.sort((a, b) => rankOf(a) - rankOf(b) || (a.s.price ?? 1e9) - (b.s.price ?? 1e9))[0];
  const weight = (() => {
    // The surest match's weight, not the heaviest of every name match (one wrong 27kg row sank a wrist brace).
    const shelfG = real.find((h) => h.s.grams && !badWeights.has(h.s.shop))?.s.grams;
    if (shelfG) return { grams: shelfG, weight_from: 'shop' };
    const t = titleGrams(g.Title);
    return t ? { grams: t, weight_from: 'title' } : { grams: '', weight_from: '' };
  })();
  const seenPrice = first.s.price ?? null;
  const band = storeBandFor(weight.grams);
  const storeFloor = seenPrice != null && band ? floorFor(seenPrice, storeCosts(band), PROFIT.store)?.floor ?? '' : '';
  picks.push({
    // The one key: the store card's reference and the eBay query are the same short string (match.mjs).
    query: queryOf(g.Title, g.Brand),
    rank: Number(g['Popularity rank']), months: g.periods.length, periods: g.periods.join(' '), category: g.category,
    title: g.Title, brand: g.Brand, gtin: g.gtins[0] ?? '', google_min: g.min, google_max: g.max,
    cost_seen: seenPrice ?? '', store_floor: storeFloor, season: seasonOf(g.Title, g.periods, exportedPeriods), need: needOf(g.Title, g.category), big_brand: (brandCount.get(g.brand) ?? 0) >= bigAt ? 'yes' : '',
    brand_best_sellers: brandCount.get(g.brand) ?? 0, seen_at: shops.join(' '), shops: shops.length,
    matched_by: first.via, seen_as: first.s.name, seen_link: first.s.url, seen_price: first.s.price ?? '',
    // For recognising it on her review card only; never published on the shop.
    seen_image: real.find((h) => h.s.image)?.s.image ?? '',
    // Royal Mail limits it passes with (aerosol, perfume, batteries), for a note on her card.
    post: postCheckOf(g.Title),
    // The heaviest weight any matching shop gives, so postage is never under-costed; else the title's.
    ...weight,
  });
}
// Where she can win first: searched for by need, then brands the big shops do not all carry, then steadiest, then rank.
picks.sort((a, b) => (!a.need) - (!b.need) || (a.big_brand === 'yes') - (b.big_brand === 'yes') || b.months - a.months || a.rank - b.rank);

// A category folder (research/google/hardware) gets its own picks folder (research/picks/hardware), so one
// category's picks, checks and coverage never overwrite another's.
const isDir = fs.statSync(googlePath).isDirectory();
const category = isDir ? path.basename(path.resolve(googlePath)) : null;
const outDir = arg('out-dir', category && category !== 'google' ? path.join('research/picks', category) : 'research/picks');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, fs.statSync(googlePath).isDirectory() ? 'all.csv' : path.basename(googlePath));
const cols = Object.keys(picks[0] ?? { rank: 0 });
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(out, [cols.join(','), ...picks.map((p) => cols.map((c) => cell(p[c])).join(','))].join('\n') + '\n', 'utf8');

// The same picks as an eBay query file, one line per product, so scan and gate can say which also work on eBay.
const qDir = arg('queries-dir', 'research/queries');
fs.mkdirSync(qDir, { recursive: true });
const qOut = path.join(qDir, `queries-store-${category && category !== 'google' ? category : path.basename(out, '.csv')}.txt`);

const seenQ = new Set();
const qLines = [];
for (const p of picks) {
  const q = p.query;
  if (!q || seenQ.has(q)) continue;
  seenQ.add(q);
  qLines.push(`${q.padEnd(46)}# ${p.title}, Google £${p.google_min}${p.need ? `, ${p.need}` : ''}`);
}
fs.writeFileSync(qOut, qLines.join('\n') + '\n', 'utf8');

// Two products drafting the same short query become one card; the better placed one keeps it.
const shared = picks.length - seenQ.size;

const by = (k) => picks.filter((p) => p.matched_by.startsWith(k)).length;
console.log(`\n  ${googlePath}`);
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.replace(/_/g, ' ').padEnd(20)}${v}`);
console.log(`  stopped by rule      ${Object.entries(stopRules).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}`);
const postN = picks.filter((p) => p.post).length;
if (postN) console.log(`  post limits          ${postN} picks carry a Royal Mail limit for her card`);
console.log(`  shelf products read  ${shelfRows} from ${shelfFiles.length} files; ${shelfKept} could match a best seller, ${byGtin.size} barcodes among them`);
const needs = picks.reduce((o, p) => { if (p.need) o[p.need] = (o[p.need] ?? 0) + 1; return o; }, {});
console.log(`\n  searched by need     ${picks.filter((p) => p.need).length}  (${Object.entries(needs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')})`);
const seasons = picks.reduce((o, p) => { o[p.season] = (o[p.season] ?? 0) + 1; return o; }, {});
console.log(`  by season            ${Object.entries(seasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  big brands           ${picks.filter((p) => p.big_brand).length}  (${bigAt}+ best sellers each: the big shops' ground)`);
const checkIt = picks.filter((p) => p.matched_by === 'name, check it').length;
console.log(`\n  seen in a UK shop    ${picks.length}  (barcode ${by('barcode')}, model ${by('model')}, name ${by('name') - checkIt}, name to check ${checkIt})\n`);
for (const p of picks.slice(0, 30)) {
  console.log(`  ${(p.need || (p.big_brand ? 'big' : '')).padEnd(9)} ${String(p.months).padStart(2)} mo  #${String(p.rank).padEnd(6)} Google £${p.google_min.toFixed(2).padStart(6)}  seen ${p.cost_seen !== '' ? `£${Number(p.cost_seen).toFixed(2)}`.padStart(7) : '     - '}  floor ${p.store_floor !== '' ? `£${Number(p.store_floor).toFixed(2)}`.padStart(7) : '     - '}  ${p.title.slice(0, 44).padEnd(44)}  ${p.seen_at.slice(0, 30)}  (${p.matched_by})`);
}
/*
 * Coverage: every best seller in the exports and where it stopped before the page check, with its months and
 * season, so the portal can show what Google ranked, what a UK shop stocks, and what was picked.
 * store-coverage.mjs adds the page check and the import, and writes it to her portal.
 */
const covCols = ['key', 'query', 'title', 'brand', 'gtin', 'rank', 'months', 'periods', 'season', 'need', 'google_min', 'google_max', 'category', 'stop'];
const covRows = google.map((g) => ({
  key: keyOf(g), query: queryOf(g.Title, g.Brand), title: g.Title, brand: g.Brand,
  gtin: String(g.GTINs ?? '').split(/\s+/).map(digits).find(Boolean) ?? '', rank: Number(g['Popularity rank']) || '',
  months: g.periods.length, periods: g.periods.join(' '), season: seasonOf(g.Title, g.periods, exportedPeriods), need: needOf(g.Title, g.category),
  google_min: Number(g['Price Range Min']) || '', google_max: Number(g['Price Range Max']) || '', category: g.category,
  stop: stopped.get(keyOf(g)) ?? 'picked',
}));
const covOut = path.join(outDir, 'coverage.csv');
fs.writeFileSync(covOut, [covCols.join(','), ...covRows.map((r) => covCols.map((c) => cell(r[c])).join(','))].join('\n') + '\n', 'utf8');

// The gap by brand: brands with the most best sellers no shop on file was seen selling.
const gap = new Map();
for (const g of unseen) {
  const b = String(g.Brand ?? '').trim() || '(no brand)';
  const e = gap.get(b) ?? { brand: b, best_sellers: 0, months: 0, best_rank: Infinity, need: 0, example: g.Title };
  e.best_sellers += 1;
  e.months += g.periods.length;
  e.best_rank = Math.min(e.best_rank, Number(g['Popularity rank']) || Infinity);
  if (needOf(g.Title, g.category)) e.need += 1;
  gap.set(b, e);
}
const gapRows = [...gap.values()].sort((a, b) => b.best_sellers - a.best_sellers || a.best_rank - b.best_rank);
const gapOut = path.join(outDir, 'gap-brands.csv');
const gapCols = ['brand', 'best_sellers', 'months', 'best_rank', 'need', 'example'];
fs.writeFileSync(gapOut, [gapCols.join(','), ...gapRows.map((r) => gapCols.map((c) => cell(r[c])).join(','))].join('\n') + '\n', 'utf8');
console.log(`\n  not seen in any shop on file  ${unseen.length}, from ${gapRows.length} brands; most missed:`);
console.log(`  ${gapRows.slice(0, 15).map((r) => `${r.brand} ${r.best_sellers}`).join(', ')}`);
console.log(`  ${gapOut}`);

console.log(`\n  ${out}`);
console.log(`  ${covOut}  every best seller and where it stopped`);
console.log(`  ${qOut}  ${qLines.length} eBay queries, same order${shared ? `; ${shared} picks share a query with a better placed one and ride on its card` : ''}`);
const withW = picks.filter((p) => p.grams).length;
console.log(`\n  weight known         ${withW} of ${picks.length} picks (shop ${picks.filter((p) => p.weight_from === 'shop').length}, title ${picks.filter((p) => p.weight_from === 'title').length}); the rest are costed as a small parcel`);
// Median weight per shop, so a shop writing kilograms as grams (like Festive Lights' prices) shows up here.
if (badWeights.size) console.log(`  weights ignored from  ${[...badWeights].join(', ')} (median over ${MAX_SHOP_MEDIAN / 1000}kg)`);
if (weighed.size) console.log(`  median weight by shop ${[...weighed].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} ${med(v)}g (${v.length})`).join(', ')}\n`);
else console.log('  no shop file carries a weight column the reader knows (grams, weight_g, weight)\n');
