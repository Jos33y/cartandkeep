// A shelf from a shop's published sitemap alone: the product name is in each URL, so no page is fetched.
//   node scripts/shelf-from-sitemap.mjs --tag=wickes --match="/p/[0-9]+$"
//   node scripts/shelf-from-sitemap.mjs --tag=toolstation --match="/p[A-Z]{0,3}[0-9]+$"

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true])
);
const tag = args.tag;
if (!tag) { console.error('\n  Needs --tag, and research/shelf/<tag>-urls.txt from shelf-range.mjs\n'); process.exit(1); }
const match = args.match ? new RegExp(args.match, 'i') : null;
const dir = join('research', 'shelf');
const urlFile = join(dir, `${tag}-urls.txt`);
const outFile = join(dir, `shelf-${tag}-names.csv`);
const exists = (p) => access(p).then(() => true, () => false);

if (!await exists(urlFile)) { console.error(`\n  ${urlFile} not found. Run shelf-range.mjs --sample once to cache the sitemap.\n`); process.exit(1); }

const cap = (w) => (w.length <= 3 && /\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

// Wickes: /Evo-Stik-Gripfill-Grab-Adhesive---350ml/p/101260. Toolstation: /dewalt-dch133p1-gb-sds-drill/p10646.
function nameOf(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  const at = parts.findIndex((p, i) => /^p$/i.test(p) || (i === parts.length - 1 && /^p[A-Z]{0,3}\d+$/i.test(p)));
  const slug = at > 0 ? parts[at - 1] : parts[parts.length - 2];
  if (!slug) return null;
  let text;
  try { text = decodeURIComponent(slug); } catch { text = slug; }
  return text.replace(/---/g, ' - ').replace(/\+/g, ' & ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(cap).join(' ');
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const urls = (await readFile(urlFile, 'utf8')).split('\n').filter(Boolean).filter((u) => !match || match.test(u));
const seen = new Set();
const rows = [];
for (const u of urls) {
  const name = nameOf(u);
  if (!name || seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  rows.push({ shop: tag, url: u, name, brand: '', price: '', category: '', availability: '' });
}

const cols = ['shop', 'url', 'name', 'brand', 'price', 'category', 'availability'];
await writeFile(outFile, [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n'));
console.log(`\n  ${rows.length} products named from ${urls.length} sitemap urls, no pages fetched`);
console.log(`  ${outFile}\n`);
for (const r of rows.slice(0, 8)) console.log(`  ${r.name}`);
console.log();
