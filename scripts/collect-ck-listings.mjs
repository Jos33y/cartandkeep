/*
 * Collects the Listings page and its data: the page, its hook, and every migration behind live_listings.
 *   node scripts/collect-ck-listings.mjs
 * Run from the repo root. Writes ck-collect-listings-<date>.zip there, with a MANIFEST.txt saying what was
 * found and what was missing. Secrets are never collected: no .env files, no keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const stamp = new Date().toISOString().slice(0, 10);
const name = `ck-collect-listings-${stamp}`;
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

const files = new Set([
  'src/hooks/useLiveListings.js',
  'src/pages/portal/ListingsPage.jsx',
  'src/styles/pages/portal/listings-page.module.css',
  'src/lib/listingInsight.js',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}
const has = (p, re) => { try { return re.test(fs.readFileSync(p, 'utf8')); } catch { return false; } };

// Every migration that builds or changes the view, its counts, and what it reads.
for (const p of walk('supabase/migrations')) {
  if (/\.sql$/.test(p) && has(p, /live_listings|live_listing_counts|listing_averages/)) files.add(rel(path.resolve(p)));
}
// Every portal file that reads the view or its hook.
for (const p of walk('src')) {
  if (/\.(js|jsx)$/.test(p) && has(p, /useLiveListings|useLiveCounts|live_listings|live_listing_counts/)) files.add(rel(path.resolve(p)));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-collect-'));
const out = path.join(tmp, name);
fs.mkdirSync(out);
const manifest = [name, `Collected ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from ${root}`, ''];
let ok = 0; let missing = 0;
for (const f of [...files].sort()) {
  if (/(^|\/)\.env/.test(f)) continue;
  if (!fs.existsSync(f)) { manifest.push(`MISSING  ${f}`); missing += 1; continue; }
  const dest = path.join(out, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
  manifest.push(`ok       ${f}  (${fs.statSync(f).size} bytes)`);
  ok += 1;
}
fs.writeFileSync(path.join(out, 'MANIFEST.txt'), manifest.join('\n') + '\n');

const zip = path.join(root, `${name}.zip`);
fs.rmSync(zip, { force: true });
// Windows 10 and later ship tar that writes zip (-a picks the format from the name); elsewhere, zip.
if (process.platform === 'win32') execFileSync('tar', ['-a', '-cf', zip, '-C', out, '.']);
else execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n  ${zip}\n  ${ok} files, ${missing} missing (see MANIFEST.txt)\n`);
