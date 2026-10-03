#!/usr/bin/env node
// Collects what task 02, pass 1 (Amazon sourcing by barcode) needs to be designed.
// Run from the repo root:  node scripts/collect-ck-amazon-sourcing.mjs
// Writes ck-collect-amazon-sourcing-<date>.zip with a MANIFEST of what was found,
// what was missing and what was left out. Never .env, never a file that looks
// like it holds a secret. Read only: nothing in the repo is changed.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const WHAT = 'amazon-sourcing';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vite', 'coverage', '.idea']);

if (!fs.existsSync(path.join(ROOT, 'package.json')) || !fs.existsSync(path.join(ROOT, 'supabase'))) {
  console.error('Run this from the repo root (the folder with package.json and supabase/).');
  process.exit(1);
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out);
    } else out.push(rel(path.join(abs, e.name)));
  }
  return out;
}

const picked = new Map(); // path -> reason
const missing = [];
const left = [];
const add = (p, why) => { if (!picked.has(p)) picked.set(p, why); };

// 1. Exact paths
const EXACT = [
  ['src/lib/golive.js', 'gtinOf and the go-live checks'],
  ['src/lib/pricing.js', 'the price model'],
  ['supabase/functions/_shared/same-product.ts', 'same-product rules'],
  ['supabase/functions/_shared/match.ts', 'match rules (Part 11)'],
  ['supabase/functions/ebay-match/index.ts', "Keeper's match (Part 11)"],
  ['supabase/functions/supplier-read/index.ts', 'the Amazon reader and costFollow (fix 1)'],
];
for (const [p, why] of EXACT) exists(p) ? add(p, why) : missing.push(`${p} (${why})`);

// 2. Portal files by name, anywhere under src/, with their CSS modules
const BY_NAME = ['useCandidates.js', 'CandidatesPage.jsx', 'CandidateRow.jsx'];
const srcFiles = walk('src');
for (const name of BY_NAME) {
  const hits = srcFiles.filter((f) => path.posix.basename(f) === name);
  if (!hits.length) { missing.push(`${name} (searched src/)`); continue; }
  for (const h of hits) {
    add(h, 'Candidates page and hook');
    const css = h.replace(/\.jsx?$/, '.module.css');
    if (css !== h && exists(css)) add(css, 'its styles');
  }
}

// 3. keeper-run, whole folder
const keeperRun = walk('supabase/functions/keeper-run');
keeperRun.length ? keeperRun.forEach((f) => add(f, 'keeper-run')) : missing.push('supabase/functions/keeper-run/');

// 4. Migrations: by number, and by what they hold
const MIG_DIR = 'supabase/migrations';
const migs = walk(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
const NUMBERS = ['0123', '0124', '0125', '0126', '0127', '0128', '0132'];
for (const n of NUMBERS) {
  const hits = migs.filter((f) => path.posix.basename(f).startsWith(n));
  hits.length ? hits.forEach((f) => add(f, n === '0132' ? 'supplier cost, cost_by' : 'Keeper runs')) : missing.push(`migration ${n}*`);
}
const T = String.raw`(create|alter)\s+table\s+(if\s+(not\s+)?exists\s+)?(only\s+)?(public\.)?"?`;
const BY_CONTENT = [
  [new RegExp(T + String.raw`decisions"?\b`, 'i'), 'decisions table'],
  [/\binsert\s+into\s+(public\.)?"?decisions"?\b/i, 'writes a decision (who made it)'],
  [new RegExp(T + String.raw`candidates"?\b`, 'i'), 'candidates table'],
  [new RegExp(T + String.raw`\w*suppliers?"?\b`, 'i'), 'suppliers table (fix 2)'],
  [/\bcost_by\b/i, 'cost_by'],
];
for (const [re, why] of BY_CONTENT) {
  const hits = migs.filter((f) => re.test(read(f)));
  hits.length ? hits.forEach((f) => add(f, why)) : missing.push(`a migration for: ${why}`);
}

// 5. Shared files that call Apify (the Part 14 reader)
const shared = walk('supabase/functions/_shared').filter((f) => /\.(ts|js)$/.test(f));
const apify = shared.filter((f) => /axesso|apify/i.test(read(f)));
apify.length ? apify.forEach((f) => add(f, 'Apify / Axesso reader')) : missing.push('a _shared file calling Apify');

// Secrets guard
const SECRET = /sk-ant-[A-Za-z0-9_-]{10,}|sk_live_[A-Za-z0-9]{10,}|rk_live_[A-Za-z0-9]{10,}|apify_api_[A-Za-z0-9]{10,}|\bre_[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}/;
for (const p of [...picked.keys()]) {
  if (/(^|\/)\.env/.test(p)) { picked.delete(p); left.push(`${p} (env file)`); continue; }
  if (SECRET.test(read(p))) { picked.delete(p); left.push(`${p} (looks like it holds a key; send it with the key removed)`); }
}

// Names only, for context
const fnDirs = fs.existsSync(path.join(ROOT, 'supabase/functions'))
  ? fs.readdirSync(path.join(ROOT, 'supabase/functions'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];

// MANIFEST
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const files = [...picked.entries()].sort(([a], [b]) => a.localeCompare(b));
const lines = [
  `ck-collect-${WHAT}-${date}`,
  'Task 02, pass 1: the files to design the barcode-only Amazon match.',
  '',
  `FOUND (${files.length})`,
  ...files.map(([p, why]) => `  ${p}  [${fs.statSync(path.join(ROOT, p)).size} bytes]  ${why}`),
  '',
  `MISSING (${missing.length})`,
  ...(missing.length ? missing.map((m) => `  ${m}`) : ['  none']),
  '',
  `LEFT OUT (${left.length})`,
  ...(left.length ? left.map((m) => `  ${m}`) : ['  none']),
  '',
  `FUNCTIONS, names only (${fnDirs.length})`,
  ...fnDirs.map((n) => `  ${n}`),
  '',
  `MIGRATIONS, names only (${migs.length})`,
  ...migs.map((m) => `  ${path.posix.basename(m)}`),
  '',
];
const manifest = lines.join('\n');

// Zip (deflate, no dependencies)
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const dosTime = (t) => ((t.getHours() << 11) | (t.getMinutes() << 5) | (t.getSeconds() >> 1)) & 0xffff;
const dosDate = (t) => (((t.getFullYear() - 1980) << 9) | ((t.getMonth() + 1) << 5) | t.getDate()) & 0xffff;

function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data, mtime } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(dosTime(mtime), 10); local.writeUInt16LE(dosDate(mtime), 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10); cen.writeUInt16LE(dosTime(mtime), 12); cen.writeUInt16LE(dosDate(mtime), 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

const entries = [
  { name: 'MANIFEST.txt', data: Buffer.from(manifest, 'utf8'), mtime: d },
  ...files.map(([p]) => ({ name: p, data: fs.readFileSync(path.join(ROOT, p)), mtime: fs.statSync(path.join(ROOT, p)).mtime })),
];
const out = `ck-collect-${WHAT}-${date}.zip`;
fs.writeFileSync(path.join(ROOT, out), zip(entries));

console.log(manifest);
console.log(`Wrote ${out}: ${files.length} files, ${missing.length} missing, ${left.length} left out.`);
