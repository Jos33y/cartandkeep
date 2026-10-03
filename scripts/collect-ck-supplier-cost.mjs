/*
 * Collects what decides a supplier's cost and the Amazon daily read, plus the writer (draft) function.
 *   node scripts/collect-ck-supplier-cost.mjs
 * Run from the repo root. Writes ck-collect-supplier-cost-<date>.zip there, with a MANIFEST.txt saying what was
 * found and what was missing. Secrets are never collected: no .env files, no keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const stamp = new Date().toISOString().slice(0, 10);
const name = `ck-collect-supplier-cost-${stamp}`;
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

const files = new Set([
  'supabase/functions/_shared/amazon.ts',
  'supabase/functions/supplier-read/index.ts',
  'supabase/migrations/0118_supplier_checks.sql',
  'src/lib/supplierWatch.js',
  'src/components/ui/portal/SupplierWatch.jsx',
  'src/hooks/useSupplierWatch.js',
  'src/pages/portal/ApprovedPage.jsx',
  'src/hooks/useApproved.js',
  'src/components/ui/portal/SourceList.jsx',
  'src/components/ui/portal/CostTry.jsx',
  'src/lib/pricing.js',
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}
const has = (p, re) => { try { return re.test(fs.readFileSync(p, 'utf8')); } catch { return false; } };

// Every migration and shared function that reads or writes the supplier reading or a source's cost.
for (const p of [...walk('supabase/migrations'), ...walk('supabase/functions/_shared')]) {
  if (/\.(sql|ts)$/.test(p) && has(p, /supplier_read|supplier_checks|landed_unit_cost/)) files.add(rel(path.resolve(p)));
}
// The writer: the draft function, and the shared files that hold its questions.
for (const p of walk('supabase/functions/draft')) files.add(rel(path.resolve(p)));
for (const p of walk('supabase/functions/_shared')) {
  if (/\.ts$/.test(p) && has(p, /\bdecide\b|\bflags\b/)) files.add(rel(path.resolve(p)));
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
