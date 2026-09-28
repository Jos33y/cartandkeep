/*
 * Shelf products sold below their own previous price, turned into a query file for scan and gate.
 * The pattern behind the two products that checked out on 28 September: a named brand, marked down at B&M,
 * sold new on eBay for about twice the price. No eBay calls; it only reads a shelf file.
 *
 *   node scripts/markdowns.mjs --csv=research/shelf/shelf-bmstores.csv --out=research/queries/queries-bm-markdown.txt
 */
import fs from 'node:fs';
import { parseCsv } from './lib/sources.js';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const csv = arg('csv', 'research/shelf/shelf-bmstores.csv');
const out = arg('out', 'research/queries/queries-bm-markdown.txt');
const minPrice = Number(arg('min-price', 8));
const minCut = Number(arg('min-cut', 20)) / 100;

const OWN_BRANDS = /^(b&m|b and m|home bargains|bargain buys|savers|poundland|the works|pep&co)$/i;
const UNIT = /^\d+(\.\d+)?(w|v|l|ml|cl|g|kg|mm|cm|m|in|pk|pc|pcs|x|mah|gb|tb|hz)$/i;

// A model or set number in the name: letters and digits together (D5305), or four to six digits (21277).
function modelOf(name, sku) {
  for (const raw of String(name).split(/[\s,()/]+/)) {
    const t = raw.replace(/[^a-z0-9-]/gi, '');
    if (!t || t === sku || UNIT.test(t) || /^(19|20)\d{2}$/.test(t)) continue;
    if (/^\d{4,6}$/.test(t) || (/\d/.test(t) && /[a-z]/i.test(t) && t.length >= 4)) return t;
  }
  return null;
}

const rows = parseCsv(fs.readFileSync(csv, 'utf8'));
const tally = { read: rows.length, marked_down: 0, too_cheap: 0, small_cut: 0, out_of_stock: 0, kept: 0, with_model: 0 };
const brands = new Map();
const seen = new Set();
const lines = [];

for (const r of rows) {
  const price = Number(r.price);
  const was = Number(r.was);
  if (!(was > price)) continue;
  tally.marked_down += 1;
  if (!(price >= minPrice)) { tally.too_cheap += 1; continue; }
  if ((was - price) / was < minCut) { tally.small_cut += 1; continue; }
  if (r.availability && !/instock/i.test(r.availability)) { tally.out_of_stock += 1; continue; }

  const name = String(r.name ?? '').trim();
  const brandCol = String(r.brand ?? '').trim();
  const brand = brandCol && !OWN_BRANDS.test(brandCol) ? brandCol : null;
  const model = modelOf(name, String(r.sku ?? ''));
  // Own-brand lines are kept: the scan refuses a name eBay does not carry for one call, cheaper than guessing brands here.
  brands.set(brandCol || '(none)', (brands.get(brandCol || '(none)') ?? 0) + 1);

  const lead = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ` : '';
  const query = (model ? `${lead}${name.split(/\s+/).slice(0, 2).join(' ')} ${model}` : `${lead}${name}`)
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
  if (seen.has(query)) continue;
  seen.add(query);
  tally.kept += 1;
  if (model) tally.with_model += 1;
  lines.push({ query, cut: (was - price) / was, text: `${query.padEnd(46)}# ${name}, £${price.toFixed(2)} was £${was.toFixed(2)}${model ? `, model ${model}` : ''}` });
}

lines.sort((a, b) => b.cut - a.cut);
fs.writeFileSync(out, lines.map((l) => l.text).join('\n') + '\n', 'utf8');

console.log(`\n  ${csv}`);
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.replace(/_/g, ' ').padEnd(22)}${v}`);
console.log(`\n  Brand column on kept rows: ${[...brands].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b} ${n}`).join(', ')}`);
console.log(`\n  ${out}  ${lines.length} queries, deepest cut first`);
console.log(`  Scan costs ${lines.length} calls; the gate about 7 per survivor.\n`);
