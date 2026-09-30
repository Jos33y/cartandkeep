/*
 * Finds query keys that lump different products together, before store-picks runs. Every Google product gets its
 * key (queryOf); a key shared by titles that name different models, versions or numbers ("Omron M2" and "Omron M3"
 * both becoming "omron blood pressure monitor") is listed, worst first. One key is one card and one eBay search,
 * so a lumped key hides products and mixes eBay results. Reads only.
 *
 *   node scripts/store/key-check.mjs --google=research/google/health-beauty
 *   node scripts/store/key-check.mjs --google=research/google/health-beauty --show=40 --out=research/key-check-hb.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';
import { queryOf, squash } from './match.mjs';
import { stopOf } from './rules/index.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const dir = arg('google');
const show = Number(arg('show', 25));
const outPath = arg('out');
const minPrice = Number(arg('min', 8));
const maxPrice = Number(arg('max', 60));
if (!dir || !fs.existsSync(dir)) { console.error('\n  Pass --google= a folder of best-sellers-*.csv exports.\n'); process.exit(1); }

const files = fs.statSync(dir).isDirectory()
  ? fs.readdirSync(dir).filter((f) => /^best-sellers-.*\.csv$/i.test(f)).map((f) => path.join(dir, f))
  : [dir];
const seen = new Map();
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const category = lines[1]?.match(/Category = ([^;"]+)/)?.[1]?.trim() ?? '';
  for (const g of parseCsv(lines.slice(2).join('\n'))) {
    const k = `${squash(g.Brand)}|${squash(g.Title)}`;
    const prior = seen.get(k);
    if (!prior || Number(g['Popularity rank']) < prior.rank) seen.set(k, { title: g.Title, brand: g.Brand, rank: Number(g['Popularity rank']), min: Number(g['Price Range Min']), category });
  }
}
// Only what store-picks would consider: not stopped by the rules, inside the price range.
const products = [...seen.values()].filter((g) => !stopOf(g) && g.min >= minPrice && g.min <= maxPrice);

// The words that tell one model from another: anything with a digit that is not a plain size or count.
const SIZE = /^(\d+(\.\d+)?(ml|l|cl|g|kg|mg|mm|cm|m|oz|pcs?|pk|pack|x|w|v|mah|tog|in|inch|ft|pc|caps?|tabs?|s|k|d|cct|pa)?|\d+x\d+(cm|mm)?|a\d|ip\d{2}|gu\d{1,2}|e\d{2}|x\d+|\d+in\d|spf\d+)$/;
const markers = (title, brand) => {
  const bw = new Set(squash(brand).split(' '));
  // Pack and supply sizes (x30, 2 month supply) are one product in different packs, which one card covers.
  return squash(title).split(' ').filter((w) => /\d/.test(w) && !SIZE.test(w) && !bw.has(w));
};

const byKey = new Map();
for (const g of products) {
  const key = queryOf(g.title, g.brand);
  const l = byKey.get(key) ?? [];
  l.push({ ...g, markers: markers(g.title, g.brand) });
  byKey.set(key, l);
}

const lumped = [];
for (const [key, list] of byKey) {
  if (list.length < 2) continue;
  // Different products under one key: two titles whose model words differ (one may have none).
  const sets = new Set(list.map((g) => g.markers.sort().join(' ')));
  const withModel = list.filter((g) => g.markers.length).length;
  if (sets.size < 2 || !withModel) continue;
  lumped.push({ key, titles: list.length, variants: sets.size, best: Math.min(...list.map((g) => g.rank)), list: list.sort((a, b) => a.rank - b.rank) });
}
lumped.sort((a, b) => b.variants - a.variants || a.best - b.best);

const shared = [...byKey.values()].filter((l) => l.length > 1).length;
console.log(`\n  ${products.length} products store-picks would consider, ${byKey.size} keys; ${shared} keys shared by more than one title`);
console.log(`  ${lumped.length} keys lump titles with different model words (worst first):\n`);
for (const x of lumped.slice(0, show)) {
  console.log(`  "${x.key}"  ${x.titles} titles, ${x.variants} different`);
  for (const g of x.list.slice(0, 4)) console.log(`      #${String(g.rank).padEnd(6)} [${g.markers.join(' ') || '-'}]  ${g.title.slice(0, 80)}`);
  if (x.list.length > 4) console.log(`      ... ${x.list.length - 4} more`);
}
if (outPath) {
  const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const rows = lumped.flatMap((x) => x.list.map((g) => ({ key: x.key, rank: g.rank, brand: g.brand, markers: g.markers.join(' '), title: g.title })));
  fs.writeFileSync(outPath, ['key,rank,brand,markers,title', ...rows.map((r) => [r.key, r.rank, r.brand, r.markers, r.title].map(cell).join(','))].join('\n') + '\n');
  console.log(`\n  ${outPath}`);
}
console.log('');
