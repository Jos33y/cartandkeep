/*
 * What sells on Google in the UK, kept when a UK shop is seen selling it, which proves it can be sourced here.
 * The shop is evidence, not the supplier: she buys wherever is cheapest. No eBay calls, no network.
 *
 *   node scripts/store/store-picks.mjs --google=research/google/best-sellers-home-garden-2026-08.csv
 *   node scripts/store/store-picks.mjs --google=research/google --skip-shops=lakeland
 *
 * One export, or a folder of them: a product in several months is one row, with every month it ranked in.
 * Writes research/picks/<export name>.csv, or research/picks/all.csv for a folder. buy_under is the most she
 * can pay for it and still make her target profit selling at Google's lowest price.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { digits, modelsIn, needOf, queryOf, sameProduct, seasonOf, squash, wordCounts } from './match.mjs';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const googlePath = arg('google');
const skipShops = new Set(String(arg('skip-shops', '')).toLowerCase().split(',').filter(Boolean));
const shelfDir = arg('shelves', 'research/shelf');
const minPrice = Number(arg('min', 8));
const maxPrice = Number(arg('max', 60));
// Her costs per order on her own store. Card fee is Stripe's UK card rate; the rest are her own figures to set.
const COST = { cardPct: Number(arg('card-pct', 1.5)) / 100, cardFixed: Number(arg('card-fixed', 0.2)), packaging: Number(arg('packaging', 0.5)), postage: Number(arg('postage', 0)), target: Number(arg('target', 2)) };
if (!googlePath) { console.error('\n  Pass --google= a Merchant Center best sellers export.\n'); process.exit(1); }

// Shops that sell their own label: she cannot buy it for less than the owner sells it.
const OWN_LABEL = /^(dusk|procook|b&q|m&s|wilko|dunelm|john lewis|habitat|the white company|the range|lakeland|wickes|halfords|ikea|next|george|h&m|shein|argos|jysk|la redoute|oliver bonas|living and home|livingandhome|cookology|asda|sainsbury's|primark|very|debenhams|homebase|robert dyas|menkind|cotton traders|laura ashley|papier|photobox|printerpix|optimalprint|soufeel|zazzle|displate|simmer eats)$/i;
// Made to measure, personalised, living plants, furniture and large appliances: not a shelf product she can post.
const NOT_SHELF = /\b(blinds?|made to measure|personali[sz]ed|photo ?book|print|poster|wallpaper|mural|plant|tree|bulbs? for planting|seeds?|shed|sofa|mattress|bed frame|wardrobe|fridge|freezer|washing machine|dishwasher|oven|hob|cooker|boiler|radiator|meal plan|gift card)\b/i;

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
const ctx = { df: wordCounts(google.map((g) => g.Title)), brands: new Set(google.map((g) => squash(g.Brand)).filter(Boolean)) };
// A brand with many best sellers is one the big shops all stock and fight over on price.
const bigAt = Number(arg('big-brand', 30));
const brandCount = new Map();
for (const g of google) { const b = squash(g.Brand); if (b) brandCount.set(b, (brandCount.get(b) ?? 0) + 1); }
const tally = { exports: exports.length, best_sellers: google.length, own_label: 0, not_shelf: 0, outside_price: 0, considered: 0, only_a_part_seen: 0 };
const wanted = [];
for (const g of google) {
  const min = Number(g['Price Range Min']);
  if (OWN_LABEL.test(String(g.Brand).trim())) { tally.own_label += 1; continue; }
  if (NOT_SHELF.test(g.Title)) { tally.not_shelf += 1; continue; }
  if (!(min >= minPrice && min <= maxPrice)) { tally.outside_price += 1; continue; }
  tally.considered += 1;
  wanted.push({ ...g, min, max: Number(g['Price Range Max']) || min, gtins: String(g.GTINs ?? '').split(/\s+/).map(digits).filter(Boolean), brand: squash(g.Brand), models: modelsIn(g.Title) });
}

/*
 * Weight in grams, for the postage band. Shopify shelves carry grams; other readers may write "1.2 kg" or "500g".
 * A bare number is grams, unless it has a decimal point and is under 100, which is kilograms. Nought is unknown.
 */
function gramsOf(r) {
  const raw = String([r.grams, r.weight_g, r.weight].find((v) => String(v ?? '').trim() !== '') ?? '').trim().toLowerCase();
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(kg|g|grams?|lb|lbs)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const g = m[2] === 'kg' ? n * 1000 : /^lb/.test(m[2] ?? '') ? n * 453.6 : !m[2] && m[1].includes('.') && n < 100 ? n * 1000 : n;
  return g > 0 ? Math.round(g) : null;
}
// A weight in the title ("Paving Sand 20kg") when no shop gave one; a capacity ("holds up to 150kg") is not its weight.
function titleGrams(title) {
  let best = null;
  for (const m of String(title).matchAll(/(up to|max(?:imum)?|capacity|holds|supports|load|user weight)?\s*(\d+(?:\.\d+)?)\s?(kg|g)\b/gi)) {
    if (m[1]) continue;
    const g = Number(m[2]) * (m[3].toLowerCase() === 'kg' ? 1000 : 1);
    if (g > 0 && (best == null || g > best)) best = g;
  }
  return best;
}
const weighed = new Map();

// Names-only shelves count: seeing the product listed is the proof, a price is not needed.
const shelfFiles = fs.readdirSync(shelfDir).filter((f) => /^shelf-.*\.csv$/.test(f));
const byGtin = new Map();
const byBrand = new Map();
let shelfRows = 0;
const OWN_SHOP_BRAND = /^(b and m|home bargains|savers|poundland|the works|home discount|monstershop)$/;
for (const f of shelfFiles) {
  const tag = f.replace(/^shelf-|(-names)?\.csv$/g, '');
  for (const r of parseCsv(fs.readFileSync(path.join(shelfDir, f), 'utf8'))) {
    const name = String(r.name ?? r.product ?? r.title ?? '').trim();
    if (!name) continue;
    const shop = r.shop || tag;
    if (skipShops.has(String(shop).toLowerCase())) continue;
    shelfRows += 1;
    const price = Number(r.price);
    const grams = gramsOf(r);
    if (grams) { const w = weighed.get(shop) ?? []; w.push(grams); weighed.set(shop, w); }
    const s = { shop, name, brand: squash(r.brand), price: price > 0 ? price : null, url: r.url ?? '', image: String(r.image ?? r.image_url ?? '').split(/[|\s]/)[0], grams };
    const g = digits(r.gtin);
    if (g) byGtin.set(g, [...(byGtin.get(g) ?? []), s]);
    const key = s.brand && !OWN_SHOP_BRAND.test(s.brand) ? s.brand : squash(name).split(' ')[0];
    if (key) byBrand.set(key, [...(byBrand.get(key) ?? []), s]);
  }
}

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
  if (!hits.length) { unseen.push(g); continue; }
  // A match priced under 40% of Google's lowest is a refill, part or cover, which proves nothing about the product.
  const real = hits.filter((h) => h.s.price == null || h.s.price >= g.min * 0.4);
  if (!real.length) { tally.only_a_part_seen += 1; continue; }
  const shops = [...new Set(real.map((h) => h.s.shop))];
  const first = real.sort((a, b) => (RANK[a.via] ?? RANK[a.via.split(' ')[0]]) - (RANK[b.via] ?? RANK[b.via.split(' ')[0]]))[0];
  const buyUnder = g.min - g.min * COST.cardPct - COST.cardFixed - COST.packaging - COST.postage - COST.target;
  picks.push({
    // The one key: the store card's reference and the eBay query are the same short string (match.mjs).
    query: queryOf(g.Title, g.Brand),
    rank: Number(g['Popularity rank']), months: g.periods.length, periods: g.periods.join(' '), category: g.category,
    title: g.Title, brand: g.Brand, gtin: g.gtins[0] ?? '', google_min: g.min, google_max: g.max,
    buy_under: Math.round(buyUnder * 100) / 100, season: seasonOf(g.Title, g.periods), need: needOf(g.Title), big_brand: (brandCount.get(g.brand) ?? 0) >= bigAt ? 'yes' : '',
    brand_best_sellers: brandCount.get(g.brand) ?? 0, seen_at: shops.join(' '), shops: shops.length,
    matched_by: first.via, seen_as: first.s.name, seen_link: first.s.url, seen_price: first.s.price ?? '',
    // For recognising it on her review card only; never published on the shop.
    seen_image: real.find((h) => h.s.image)?.s.image ?? '',
    // The heaviest weight any matching shop gives, so postage is never under-costed; else the title's.
    ...(() => {
      const shelfG = Math.max(0, ...real.map((h) => h.s.grams ?? 0));
      if (shelfG) return { grams: shelfG, weight_from: 'shop' };
      const t = titleGrams(g.Title);
      return t ? { grams: t, weight_from: 'title' } : { grams: '', weight_from: '' };
    })(),
  });
}
// Where she can win first: searched for by need, then brands the big shops do not all carry, then steadiest, then rank.
picks.sort((a, b) => (!a.need) - (!b.need) || (a.big_brand === 'yes') - (b.big_brand === 'yes') || b.months - a.months || a.rank - b.rank);

const outDir = arg('out-dir', 'research/picks');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, fs.statSync(googlePath).isDirectory() ? 'all.csv' : path.basename(googlePath));
const cols = Object.keys(picks[0] ?? { rank: 0 });
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(out, [cols.join(','), ...picks.map((p) => cols.map((c) => cell(p[c])).join(','))].join('\n') + '\n', 'utf8');

// The same picks as an eBay query file, one line per product, so scan and gate can say which also work on eBay.
const qDir = arg('queries-dir', 'research/queries');
fs.mkdirSync(qDir, { recursive: true });
const qOut = path.join(qDir, `queries-store-${path.basename(out, '.csv')}.txt`);

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
console.log(`  shelf products read  ${shelfRows} from ${shelfFiles.length} files, ${byGtin.size} with a barcode`);
const needs = picks.reduce((o, p) => { if (p.need) o[p.need] = (o[p.need] ?? 0) + 1; return o; }, {});
console.log(`\n  searched by need     ${picks.filter((p) => p.need).length}  (${Object.entries(needs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')})`);
const seasons = picks.reduce((o, p) => { o[p.season] = (o[p.season] ?? 0) + 1; return o; }, {});
console.log(`  by season            ${Object.entries(seasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  big brands           ${picks.filter((p) => p.big_brand).length}  (${bigAt}+ best sellers each: the big shops' ground)`);
const checkIt = picks.filter((p) => p.matched_by === 'name, check it').length;
console.log(`\n  seen in a UK shop    ${picks.length}  (barcode ${by('barcode')}, model ${by('model')}, name ${by('name') - checkIt}, name to check ${checkIt})\n`);
for (const p of picks.slice(0, 30)) {
  console.log(`  ${(p.need || (p.big_brand ? 'big' : '')).padEnd(9)} ${String(p.months).padStart(2)} mo  #${String(p.rank).padEnd(6)} £${p.google_min.toFixed(2).padStart(6)}  buy under £${p.buy_under.toFixed(2).padStart(6)}  ${p.title.slice(0, 44).padEnd(44)}  ${p.seen_at.slice(0, 30)}  (${p.matched_by})`);
}
// The gap by brand: brands with the most best sellers no shop on file was seen selling.
const gap = new Map();
for (const g of unseen) {
  const b = String(g.Brand ?? '').trim() || '(no brand)';
  const e = gap.get(b) ?? { brand: b, best_sellers: 0, months: 0, best_rank: Infinity, need: 0, example: g.Title };
  e.best_sellers += 1;
  e.months += g.periods.length;
  e.best_rank = Math.min(e.best_rank, Number(g['Popularity rank']) || Infinity);
  if (needOf(g.Title)) e.need += 1;
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
console.log(`  ${qOut}  ${qLines.length} eBay queries, same order${shared ? `; ${shared} picks share a query with a better placed one and ride on its card` : ''}`);
const withW = picks.filter((p) => p.grams).length;
console.log(`\n  weight known         ${withW} of ${picks.length} picks (shop ${picks.filter((p) => p.weight_from === 'shop').length}, title ${picks.filter((p) => p.weight_from === 'title').length}); the rest are costed as a small parcel`);
// Median weight per shop, so a shop writing kilograms as grams (like Festive Lights' prices) shows up here.
const med = (xs) => { const s2 = [...xs].sort((a, b) => a - b); return s2[Math.floor(s2.length / 2)]; };
if (weighed.size) console.log(`  median weight by shop ${[...weighed].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} ${med(v)}g (${v.length})`).join(', ')}\n`);
else console.log('  no shop file carries a weight column the reader knows (grams, weight_g, weight)\n');
