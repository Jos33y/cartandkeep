/*
 * The brands behind the store picks, ranked by how many Google best sellers each one covers.
 * The top of this list is where a trade account pays back most: one account, many best sellers.
 *
 *   node scripts/store/brand-rank.mjs
 *   node scripts/store/brand-rank.mjs --picks=research/picks/checked.csv
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const picksPath = arg('picks', 'research/picks/all.csv');
const out = arg('out', 'research/picks/brands.csv');

const rows = parseCsv(fs.readFileSync(picksPath, 'utf8'))
  // A row the check has shown to be a different product is not evidence for its brand.
  .filter((r) => !/^wrong/.test(r.verdict ?? ''));

const brands = new Map();
for (const r of rows) {
  const key = String(r.brand).trim().toLowerCase();
  const b = brands.get(key) ?? { brand: String(r.brand).trim(), products: 0, months: 0, best_rank: Infinity, shops: new Set(), prices: [], examples: [] };
  b.products += 1;
  b.months += Number(r.months) || 0;
  b.best_rank = Math.min(b.best_rank, Number(r.rank) || Infinity);
  for (const s of String(r.seen_at).split(/\s+/).filter(Boolean)) b.shops.add(s);
  if (Number(r.google_min) > 0) b.prices.push(Number(r.google_min));
  if (b.examples.length < 3) b.examples.push(r.title);
  brands.set(key, b);
}

const ranked = [...brands.values()]
  .map((b) => ({
    brand: b.brand,
    products: b.products,
    months: b.months,
    best_rank: b.best_rank,
    typical_price: b.prices.length ? b.prices.sort((x, y) => x - y)[Math.floor(b.prices.length / 2)] : '',
    shops: [...b.shops].join(' '),
    examples: b.examples.join(' | '),
  }))
  .sort((a, b) => b.products - a.products || b.months - a.months || a.best_rank - b.best_rank);

const cols = Object.keys(ranked[0] ?? { brand: '' });
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.writeFileSync(out, [cols.join(','), ...ranked.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n', 'utf8');

console.log(`\n  ${picksPath}: ${rows.length} products, ${ranked.length} brands\n`);
console.log(`  ${'brand'.padEnd(24)}products  months  best rank  typical £`);
for (const r of ranked.slice(0, 25)) {
  console.log(`  ${r.brand.slice(0, 23).padEnd(24)}${String(r.products).padStart(8)}${String(r.months).padStart(8)}${String(r.best_rank).padStart(11)}${String(r.typical_price).padStart(11)}`);
}
console.log(`\n  ${out}\n`);
