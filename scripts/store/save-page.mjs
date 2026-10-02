/*
 * Saves one shop page exactly as check-picks reads it (same request headers), so a page whose price the reader
 * misses can be looked at. curl gets a different answer from some shops (The Entertainer's Akamai refuses it).
 *
 *   node scripts/store/save-page.mjs <url> <file>
 */
import fs from 'node:fs';
import { readPage } from './page.mjs';

const [url, file = 'page.html'] = process.argv.slice(2);
if (!url) { console.error('\n  node scripts/store/save-page.mjs <url> <file>\n'); process.exit(1); }
const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CartAndKeepResearch/1.0', 'Accept-Language': 'en-GB' },
  redirect: 'follow',
  signal: AbortSignal.timeout(30000),
});
const html = await res.text();
fs.writeFileSync(file, html);
const p = readPage(html);
console.log(`\n  ${res.status}, ${html.length} characters, saved to ${file}`);
console.log(`  read as: name "${p.name}", price "${p.price}", stock "${p.stock}", gtin "${p.gtin}"\n`);
