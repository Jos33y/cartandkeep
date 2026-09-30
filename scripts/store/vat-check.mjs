/*
 * Does a shop show prices with VAT, without it, or with disability VAT relief taken off? Reads a few product pages
 * from each shelf and prints every line that mentions VAT, the shelf's price, and the prices on the page, so the
 * answer is plain. A shop that shows prices without VAT goes in page.mjs (EX_VAT_HOSTS or VAT_RELIEF_HOSTS).
 *
 *   node scripts/store/vat-check.mjs --tags=completecareshop,manageathome,millercare,abilitysuperstore,medisave
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../lib/sources.js';

const arg = (k, d = null) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const tags = String(arg('tags', '')).split(',').map((t) => t.trim()).filter(Boolean);
const per = Number(arg('pages', 3));
if (!tags.length) { console.error('\n  Pass --tags= the shelves to check, e.g. --tags=completecareshop,manageathome\n'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&pound;/g, '£').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

for (const tag of tags) {
  const file = path.join('research', 'shelf', `shelf-${tag}.csv`);
  if (!fs.existsSync(file)) { console.log(`\n  ${tag}: no shelf file`); continue; }
  const rows = parseCsv(fs.readFileSync(file, 'utf8')).filter((r) => r.url && Number(r.price) > 0);
  console.log(`\n  ${tag}`);
  for (const r of rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / per)) === 0).slice(0, per)) {
    const res = await fetch(r.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CartAndKeepResearch/1.0', 'Accept-Language': 'en-GB' } }).catch(() => null);
    if (!res?.ok) { console.log(`    ${r.name.slice(0, 50)}: page not read (${res?.status ?? 'failed'})`); continue; }
    const t = text(await res.text());
    const vat = [...new Set([...t.matchAll(/[^.£]{0,50}\bVAT\b[^.]{0,50}/gi)].map((m) => m[0].trim()))].slice(0, 5);
    const prices = [...new Set([...t.matchAll(/£\s?(\d+(?:\.\d{2})?)/g)].map((m) => m[1]))].slice(0, 8);
    const shelf = Number(r.price);
    const hint = prices.some((p) => Math.abs(Number(p) - shelf * 1.2) < 0.02) ? `  (the page also shows ${(shelf * 1.2).toFixed(2)}, the shelf price plus VAT)` : '';
    console.log(`    ${r.name.slice(0, 50)}  shelf £${shelf.toFixed(2)}  page £${prices.join(', £')}${hint}`);
    for (const v of vat) console.log(`      "${v}"`);
    await sleep(1200);
  }
}
console.log('');
