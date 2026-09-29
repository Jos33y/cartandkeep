/*
 * Shows what the eBay-to-Google mapping does to the cards, before anything is written anywhere.
 *   node scripts/categories/preview.mjs
 * Reads research/categories/ebay-categories.csv and research/google/taxonomy-with-ids.en-GB.txt.
 * Writes research/categories/preview.csv: one row per card with its Google ID and path.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { loadTaxonomy } from './taxonomy.mjs';
import { makeMapper, EBAY_TO_GOOGLE } from './ebay-to-google.mjs';

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const tax = loadTaxonomy(arg('taxonomy', 'research/google/taxonomy-with-ids.en-GB.txt'));
const map = makeMapper(tax);
const cards = parseCsv(fs.readFileSync(arg('ebay', 'research/categories/ebay-categories.csv'), 'utf8'));

const out = cards.map((c) => {
  const m = map(c.query, c.category_path);
  return { query: c.query, ebay_path: c.category_path, google_id: m.id, google_path: tax.pathOf(m.id), top_id: tax.topOf(m.id), level2_id: tax.level2Of(m.id) ?? '', by: m.by, clash: m.clash ? 'check' : '', row: m.row ?? '' };
});

const count = (key) => out.reduce((o, r) => { const k = r[key] || '(top only)'; o[k] = (o[k] ?? 0) + 1; return o; }, {});
const name = (id) => (id === '(top only)' ? '(no level two)' : tax.pathOf(Number(id)));

console.log(`\n  ${tax.size} Google categories read; ${EBAY_TO_GOOGLE.length} mapping rows; ${cards.length} cards\n`);
console.log('  By tab (Google top category)');
for (const [id, n] of Object.entries(count('top_id')).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${String(id).padStart(6)}  ${name(id)}`);
console.log('\n  By level two, with examples');
const byL2 = {};
for (const r of out) (byL2[`${r.top_id}|${r.level2_id || '(top only)'}`] ??= []).push(r);
for (const [k, rs] of Object.entries(byL2).sort((a, b) => b[1].length - a[1].length)) {
  const [top, l2] = k.split('|');
  console.log(`  ${String(rs.length).padStart(5)}  ${l2 === '(top only)' ? `${tax.pathOf(Number(top))} (top only)` : name(l2)}`);
  console.log(`         ${rs.slice(0, 4).map((r) => r.query).join(' · ')}`);
}
const how = count('by');
console.log(`\n  How placed: ${Object.entries(how).map(([k, v]) => `${k} ${v}`).join(', ')}`);
const clashes = out.filter((r) => r.clash);
console.log(`  Flagged "check this is the same product": ${clashes.length}`);
for (const r of clashes) console.log(`         ${r.query}  <  ${r.ebay_path}`);
const unused = EBAY_TO_GOOGLE.filter(([e]) => !out.some((r) => r.row === e)).map(([e]) => e);
if (unused.length) console.log(`\n  Rows no card used yet (kept for future gates): ${unused.length}`);

const cols = Object.keys(out[0]);
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
fs.mkdirSync('research/categories', { recursive: true });
fs.writeFileSync('research/categories/preview.csv', [cols.join(','), ...out.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
console.log('\n  research/categories/preview.csv\n');
