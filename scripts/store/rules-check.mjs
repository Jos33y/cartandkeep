/*
 * Tries the rules on a category's Google exports before store-picks runs, so a new category is tuned in minutes:
 * what each rule stops, with examples, what passes with a postage limit, and the need words it finds.
 * Reads only; no shelves, no network.
 *
 *   node scripts/store/rules-check.mjs --google=research/google/sports
 *   node scripts/store/rules-check.mjs --google=research/google/sports --show=20 --out=research/rules-check-sports.csv
 *
 * A wrong stop is fixed in rules/ (one line in the list that caught it, named in the output), a missing one the
 * same way, and a category-only rule in rules/categories/<category>.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { needOf } from './match.mjs';
import { postCheckOf, stopOf } from './rules/index.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const dir = arg('google');
const show = Number(arg('show', 8));
const outPath = arg('out');
if (!dir || !fs.existsSync(dir)) { console.error('\n  Pass --google= a folder of best-sellers-*.csv exports.\n'); process.exit(1); }

const files = fs.statSync(dir).isDirectory()
  ? fs.readdirSync(dir).filter((f) => /^best-sellers-.*\.csv$/i.test(f)).map((f) => path.join(dir, f))
  : [dir];
const seen = new Map();
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const category = lines[1]?.match(/Category = ([^;"]+)/)?.[1]?.trim() ?? '';
  for (const g of parseCsv(lines.slice(2).join('\n'))) {
    const k = `${g.Brand}|${g.Title}`.toLowerCase();
    const prior = seen.get(k);
    if (!prior || Number(g['Popularity rank']) < Number(prior.rank)) seen.set(k, { title: g.Title, brand: g.Brand, rank: g['Popularity rank'], category });
  }
}
const rows = [...seen.values()].sort((a, b) => Number(a.rank) - Number(b.rank));
const byRule = new Map();
const posts = new Map();
const needs = {};
const out = [];
for (const r of rows) {
  const s = stopOf(r);
  const post = s ? '' : postCheckOf(r.title);
  const need = s ? '' : needOf(r.title, r.category);
  if (s) { const l = byRule.get(`${s.stop}: ${s.rule}`) ?? []; l.push({ ...r, hit: s.hit }); byRule.set(`${s.stop}: ${s.rule}`, l); }
  if (post) { const l = posts.get(post) ?? []; l.push(r); posts.set(post, l); }
  if (need) needs[need] = (needs[need] ?? 0) + 1;
  out.push({ rank: r.rank, brand: r.brand, title: r.title, stop: s?.stop ?? '', rule: s?.rule ?? '', hit: s?.hit ?? '', post, need });
}

const cat = rows[0]?.category || dir;
console.log(`\n  ${cat}: ${rows.length} Google products from ${files.length} exports\n`);
console.log('  STOPPED (best ranked first; check the examples are really not hers)');
for (const [k, l] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${k}  ${l.length}`);
  for (const x of l.slice(0, show)) console.log(`    #${String(x.rank).padEnd(6)} [${x.hit}]  ${x.title.slice(0, 80)}`);
}
if (posts.size) {
  console.log('\n  PASSES WITH A POSTAGE NOTE');
  for (const [k, l] of [...posts].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${k}  ${l.length}`);
    for (const x of l.slice(0, show)) console.log(`    #${String(x.rank).padEnd(6)} ${x.title.slice(0, 80)}`);
  }
}
console.log(`\n  NEED WORDS  ${Object.entries(needs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none: this category has no needs file yet, Home & Garden words were used'}`);
if (outPath) {
  const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const cols = Object.keys(out[0] ?? { rank: 0 });
  fs.writeFileSync(outPath, [cols.join(','), ...out.map((o) => cols.map((c) => cell(o[c])).join(','))].join('\n') + '\n');
  console.log(`  ${outPath}`);
}
console.log('');
