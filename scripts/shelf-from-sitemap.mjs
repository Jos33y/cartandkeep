// A shelf from a shop's published sitemap alone: the product name is in each URL, so no page is fetched.
//   node scripts/shelf-from-sitemap.mjs --tag=wickes --match="/p/[0-9]+$"
//   node scripts/shelf-from-sitemap.mjs --tag=hartsofstur --base=https://www.hartsofstur.com --match="^https://www\.hartsofstur\.com/[a-z0-9-]+\.html$"
// With --base and no cached url list, the sitemaps are read here (sitemaps only, never a product page).

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

// Sitemap index and its children, nothing else. Gzipped sitemaps (John Lewis) are unpacked here.
// --maps=<text> follows only child sitemaps whose address contains it, so a shop's category and
// guide sitemaps are not fetched.
async function readSitemaps(base) {
  const only = args.maps ? String(args.maps).toLowerCase() : null;
  // --sitemap=<url> starts from that sitemap alone (John Lewis' product index), skipping robots.txt.
  if (args.sitemap) return readFrom([String(args.sitemap)], only);
  const queue = [`${base.replace(/\/$/, '')}/sitemap.xml`];
  try {
    const robots = await (await fetch(`${base.replace(/\/$/, '')}/robots.txt`, { headers: { 'user-agent': UA } })).text();
    for (const m of robots.matchAll(/^sitemap:\s*(\S+)/gim)) queue.push(m[1]);
  } catch { /* robots is optional */ }
  return readFrom(queue, only);
}

async function readFrom(queue, only) {
  const seen = new Set();
  const found = [];
  while (queue.length) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const res = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (!res?.ok) { console.log(`  sitemap ${res?.status ?? 'failed'}: ${u}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const xml = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8');
    const list = locs(xml);
    // A 200 with no <loc> is usually a bot-check page, not an empty sitemap; say so instead of counting it as read.
    if (!list.length) console.log(`  sitemap ${res.status}, no <loc> (${res.headers.get('content-type') ?? '?'}): ${u}\n    starts: ${xml.replace(/\s+/g, ' ').slice(0, 120)}`);
    else if (/<sitemapindex/i.test(xml)) {
      const next = list.filter((c) => !only || c.toLowerCase().includes(only));
      queue.push(...next);
      if (args.verbose) console.log(`  index ${u}: ${list.length} children, following ${next.length}`);
    } else {
      found.push(...list);
      if (args.verbose) console.log(`  ${list.length} urls: ${u}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`  ${seen.size} sitemaps read`);
  return found;
}

if (!await exists(urlFile)) {
  if (!args.base) { console.error(`\n  ${urlFile} not found. Pass --base=<shop> to read its sitemaps here.\n`); process.exit(1); }
  const urls = await readSitemaps(String(args.base));
  // Nothing read: leave no cache behind, so a retry with --maps or --sitemap reads the sitemaps again.
  if (!urls.length) { console.log(`\n  0 urls read from ${args.base}, nothing cached. Rerun with --verbose to see each sitemap.\n`); process.exit(1); }
  await writeFile(urlFile, urls.join('\n'));
  console.log(`\n  ${urls.length} urls read from ${args.base}'s sitemaps, cached in ${urlFile}`);
}

const cap = (w) => (w.length <= 3 && /\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));

// Wickes: /Evo-Stik-Gripfill-Grab-Adhesive---350ml/p/101260. Toolstation: /dewalt-dch133p1-gb-sds-drill/p10646.
function nameOf(url) {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  // The last "p" marker: City Plumbing links read /p/<name>/p/<number>, so the first "p" is not the one.
  const at = parts.findLastIndex((p, i) => /^p$/i.test(p) || (i === parts.length - 1 && /^p[A-Z]{0,3}\d+$/i.test(p)));
  // Otherwise the name is the last part of the link: "saucepan-with-lid-em05.html", "gel-pen-3-pack-850001",
  // Debenhams' "…-book_p-<code>". When the last part is only a number (Very's "1600123456.prd"),
  // the name is the part before it.
  const last = (parts[parts.length - 1] ?? '').replace(/\.(html?|prd)$/i, '');
  const slug = at > 0 ? parts[at - 1]
    : /^\d{5,}[a-z]?$/i.test(last) ? (parts[parts.length - 2] ?? '')
      : last.replace(/_p-[0-9a-f-]+$/i, '').replace(/-\d{5,}$/, '');
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
