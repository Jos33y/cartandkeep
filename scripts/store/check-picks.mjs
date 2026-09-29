/*
 * Opens the shop page behind each store pick and checks it is the same product Google ranks.
 * A pick is proof the product can be sourced only if the shop really sells that product.
 * Reads one page per pick, slowly; stops on a block rather than pushing through it. No eBay calls.
 *
 *   node scripts/store/check-picks.mjs --top=100
 *   node scripts/store/check-picks.mjs --recheck   re-judges the pages already read, no fetching
 *
 * A page already read in an earlier run is reused, not fetched again, so a rerun after new shelves or a
 * stopped run only reads what is new. Progress is saved every 25 picks, so stopping loses at most 25.
 *
 * Writes research/picks/checked.csv: every column of all.csv plus verdict, page_name, page_price, page_stock, page_image.
 * page_image is for her review card only, to recognise the product; it is never published on the shop.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import path from 'node:path';
import { sameProduct, squash, wordCounts } from './match.mjs';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const picksPath = arg('picks', 'research/picks/all.csv');
const out = arg('out', 'research/picks/checked.csv');
const top = arg('top', '100') === 'all' ? Infinity : Number(arg('top', 100));
const pause = Number(arg('pause', 1500));
const googleDir = arg('google', 'research/google');
const recheck = process.argv.includes('--recheck');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) => String(s ?? '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

const ogImage = (html) => decode(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? '');

// The product's own name, price and stock as the page states them: structured data first, then the page title.
function readPage(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const nodes = [data].flat().flatMap((d) => (d?.['@graph'] ? d['@graph'] : [d]));
    const p = nodes.find((n) => [n?.['@type']].flat().includes('Product'));
    if (!p) continue;
    const offer = [p.offers].flat()[0] ?? {};
    const img = [p.image].flat()[0];
    return {
      name: decode(p.name), price: offer.price ?? offer.lowPrice ?? '', stock: String(offer.availability ?? '').replace(/.*\//, ''),
      image: decode(typeof img === 'string' ? img : img?.url ?? '') || ogImage(html),
    };
  }
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)/i)?.[1];
  return { name: decode(og ?? title ?? ''), price: '', stock: '', image: ogImage(html) };
}

// The same word counts and brand list store-picks sees, so a page is judged by the rule that picked it.
const titles = [];
const brands = new Set();
for (const f of fs.readdirSync(googleDir).filter((x) => /^best-sellers-.*\.csv$/i.test(x))) {
  for (const g of parseCsv(fs.readFileSync(path.join(googleDir, f), 'utf8').split(/\r?\n/).slice(2).join('\n'))) {
    titles.push(g.Title);
    if (g.Brand) brands.add(squash(g.Brand));
  }
}
const ctx = { df: wordCounts(titles), brands };
const verdictOf = (pick, page) => (page.name ? sameProduct(pick.title, pick.brand, page.name, ctx) : 'no product name on the page');

const rows = parseCsv(fs.readFileSync(recheck ? out : picksPath, 'utf8'));
const chosen = rows.slice(0, top);
const blockedHosts = new Set();
const checked = [];
const tally = {};

// Pages read in earlier runs, by link. A gone page stays gone; a blocked or failed one is tried again.
const cache = new Map();
if (!recheck && fs.existsSync(out)) {
  for (const r of parseCsv(fs.readFileSync(out, 'utf8'))) {
    const link = String(r.seen_link ?? '').trim();
    if (!link) continue;
    if (r.page_name) cache.set(link, { name: decode(r.page_name), price: r.page_price, stock: r.page_stock, image: r.page_image ?? '' });
    else if (/^page gone/.test(r.verdict ?? '')) cache.set(link, { gone: r.verdict });
  }
}
let reused = 0;

const cols = [...new Set([...Object.keys(rows[0] ?? {}), 'verdict', 'page_name', 'page_price', 'page_stock', 'page_image'])];
const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
// The picks done so far, then the rest unchecked, so the file is always the whole list. Written to a side file first.
function save() {
  const rest = rows.slice(checked.length).map((pick) => ({ verdict: '', page_name: '', page_price: '', page_stock: '', page_image: '', ...pick }));
  const all = [...checked, ...rest];
  fs.writeFileSync(`${out}.part`, [cols.join(','), ...all.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n', 'utf8');
  fs.renameSync(`${out}.part`, out);
}

for (const [i, pick] of chosen.entries()) {
  const url = String(pick.seen_link ?? '').trim();
  let verdict;
  let page = { name: '', price: '', stock: '', image: '' };
  const host = /^https?:\/\//.test(url) ? new URL(url).host : null;
  if (recheck && pick.page_name) { page = { name: decode(pick.page_name), price: pick.page_price, stock: pick.page_stock, image: pick.page_image ?? '' }; verdict = verdictOf(pick, page); }
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
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CartAndKeepResearch/1.0', 'Accept-Language': 'en-GB' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if ([403, 429, 503].includes(res.status)) { blockedHosts.add(host); verdict = `shop blocked (${res.status}), not checked`; }
      else if (!res.ok) verdict = `page gone (${res.status})`;
      else { page = readPage(await res.text()); verdict = verdictOf(pick, page); }
    } catch (e) {
      verdict = `could not read (${e.name})`;
    }
    await sleep(pause);
  }
  tally[verdict.split(',')[0].split(' (')[0]] = (tally[verdict.split(',')[0].split(' (')[0]] ?? 0) + 1;
  checked.push({ ...pick, verdict, page_name: page.name, page_price: page.price, page_stock: page.stock, page_image: page.image ?? '' });
  console.log(`  ${String(i + 1).padStart(3)}/${chosen.length}  ${verdict.padEnd(30)} ${String(pick.title).slice(0, 40).padEnd(40)}  ${page.name.slice(0, 40)}`);
  if (!recheck && (i + 1) % 25 === 0) save();
}

save();

console.log(`\n  ${chosen.length} checked${reused ? `, ${reused} from pages already read` : ''}: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (blockedHosts.size) console.log(`  Blocked, so left unchecked: ${[...blockedHosts].join(', ')}`);
console.log(`\n  ${out}\n`);
