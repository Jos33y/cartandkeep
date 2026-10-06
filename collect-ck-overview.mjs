#!/usr/bin/env node
// Collects the Overview page (its Amazon suppliers panel and what feeds it) and how the eBay queue is scheduled.
// Run from the repo root:  node collect-ck-overview.mjs
// Writes ck-collect-overview-<date>.zip with a MANIFEST of what was found,
// what was missing and what was left out. Never .env, never a file that looks
// like it holds a secret. Read only: nothing in the repo is changed.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const WHAT = 'overview';
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

// 1. The Overview page and anything that draws or feeds the Amazon suppliers panel
const EXACT = [
  ['src/lib/supplierWatch.js', 'supplier warnings'],
  ['src/hooks/useApproved.js', "Approved's hook (the eBay queue line)"],
];
for (const [p, why] of EXACT) exists(p) ? add(p, why) : missing.push(`${p} (${why})`);
for (const f of walk('src').filter((f) => /\.(jsx?|tsx?|css)$/.test(f))) {
  const t = read(f);
  if (/Overview/i.test(path.posix.basename(f))) add(f, 'the Overview page');
  else if (/Amazon suppliers today|supplierWarnings|STOCK\.unknown/.test(t)) add(f, 'the Amazon suppliers panel or its warnings');
}

// 2. Portal imports of those files, followed through (@lib, @hooks, @components, @utils, and relative)
const ALIAS = { '@lib/': 'src/lib/', '@hooks/': 'src/hooks/', '@components/': 'src/components/', '@utils/': 'src/utils/' };
const resolveJs = (from, spec) => {
  let base = null;
  for (const [a, dir] of Object.entries(ALIAS)) if (spec.startsWith(a)) base = dir + spec.slice(a.length);
  if (!base && spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  if (!base) return null;
  for (const ext of ['', '.js', '.jsx', '.ts', '/index.js', '/index.jsx']) if (exists(base + ext) && fs.statSync(path.join(ROOT, base + ext)).isFile()) return base + ext;
  return undefined;
};
const FOLLOW = walk('src').filter((f) => /Overview/i.test(path.posix.basename(f)) && /\.(jsx?|tsx?)$/.test(f));
const seenJs = new Set();
const qJs = FOLLOW.filter(exists);
while (qJs.length) {
  const f = qJs.shift();
  if (seenJs.has(f)) continue;
  seenJs.add(f);
  if (!f.startsWith('src/lib/') && !f.startsWith('src/hooks/') && !FOLLOW.includes(f)) continue;
  for (const m of read(f).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (m[1].includes('@styles') || m[1].endsWith('.css')) continue;
    const t = resolveJs(f, m[1]);
    if (t === null) continue;
    if (t === undefined) { if (!m[1].startsWith('@components/')) missing.push(`${m[1]} (imported by ${f})`); continue; }
    if (t.startsWith('src/lib/') || t.startsWith('src/hooks/')) { add(t, `imported by ${f}`); qJs.push(t); }
  }
}

// 3. The eBay functions, with every shared file they import (followed through)
const FN = ['ebay-queue', 'supplier-read'];
const ENTRY = FN.flatMap((n) => walk(`supabase/functions/${n}`)).filter((f) => /\.ts$/.test(f) && exists(f));
for (const n of FN) if (!walk(`supabase/functions/${n}`).length) missing.push(`supabase/functions/${n} (an eBay function, if it exists)`);
ENTRY.forEach((f) => add(f, 'an eBay function'));
for (const h of [].filter(exists)) for (const m of read(h).matchAll(/invoke\(['"]([a-z0-9-]+)['"]/g)) {
  if (!FN.includes(m[1])) for (const f of walk(`supabase/functions/${m[1]}`)) if (/\.ts$/.test(f)) { add(f, `called from ${h}`); ENTRY.push(f); }
}
// Functions that change a shop product's price.
for (const f of walk('supabase/functions').filter((f) => /\.ts$/.test(f) && !f.includes('_test'))) {
  if (/from\(['"](store_products|products|product_variants)['"]\)[\s\S]{0,200}\.update\(/.test(read(f))) { add(f, 'updates a shop product'); ENTRY.push(f); }
}
const seen = new Set();
const queue = [...ENTRY];
while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  seen.add(f);
  if (!ENTRY.includes(f)) add(f, 'imported by a function above');
  for (const m of read(f).matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
    if (exists(target)) queue.push(target);
    else missing.push(`${target} (imported by ${f})`);
  }
}

// 4. Migrations behind Keeper's runs, the card draft and the photo checks
const migs = walk('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
const BY_CONTENT = [
  [/cron\.schedule/i, 'scheduled jobs (the eBay queue, the 7am check)'],
  [/\bclaim_listing_jobs\b/i, 'how the eBay queue claims its jobs'],
  [/\boverview\b/i, 'anything named for the Overview'],
];
for (const [re, why] of BY_CONTENT) {
  const hits = migs.filter((f) => re.test(read(f)));
  hits.length ? hits.forEach((f) => add(f, why)) : missing.push(`a migration for: ${why}`);
}

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
  'The Overview page and its Amazon suppliers panel; how the eBay queue is scheduled.',
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
