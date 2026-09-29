// Cards gated before 29 September carry no eBay category: the gate fetched it with every listing and
// threw it away. This asks eBay once per card, for the listing that proved it, and keeps the answer.
//
//   node scripts/backfill-categories.mjs                 everything still missing
//   node scripts/backfill-categories.mjs --max=160       a night's share
//
// One Browse call per card. Re-running skips cards already answered, so it can be spread over nights.

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFiles, pickCredentials } from './lib/env.js';
import { token, getItem } from './lib/ebay.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, ...v]) => [k, v.join('=') || true]));
const GATES = path.join('research', 'gates');
const OUT_DIR = path.join('research', 'categories');
const OUT = path.join(OUT_DIR, 'ebay-categories.csv');
const max = args.max ? Number(args.max) : Infinity;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const clean = (q) => String(q ?? '').replace(/^"|"$/g, '').trim().toLowerCase();

// Every query that became a card, with the listing that proved it (or the first listing sampled).
const wanted = new Map();
for (const name of (await readdir(GATES)).filter((n) => n.endsWith('.csv'))) {
  for (const r of parseCsv(await readFile(path.join(GATES, name), 'utf8'))) {
    if (!['pass', 'review'].includes(r.outcome)) continue;
    const q = clean(r.query);
    if (!q || wanted.has(q)) continue;
    let itemId = r.entry_item_id;
    if (!itemId && r.listings) { try { itemId = JSON.parse(r.listings)[0]?.item_id; } catch { /* no listings */ } }
    if (itemId) wanted.set(q, itemId);
  }
}

const done = new Map();
if (existsSync(OUT)) for (const r of parseCsv(await readFile(OUT, 'utf8'))) done.set(r.query, r);
const todo = [...wanted.entries()].filter(([q]) => !done.has(q)).slice(0, max);

console.log(`\n  ${wanted.size} carded queries in the gate files, ${done.size} already answered, ${todo.length} to ask now (one call each)`);
if (!todo.length) process.exit(0);

await loadEnvFiles(args.env);
const cred = pickCredentials(process.env, args['id-key'], args['secret-key']);
if (!cred.clientId || !cred.clientSecret) { console.error('\n  No eBay credentials found.\n'); process.exit(1); }
const access = await token(cred);

let asked = 0, failed = 0;
const save = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const cols = ['query', 'item_id', 'category_id', 'category_path'];
  await writeFile(OUT, [cols.join(','), ...[...done.values()].map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
};
process.on('SIGINT', async () => { await save(); console.log(`\n  Stopped. ${asked} asked, saved.`); process.exit(0); });

for (const [q, itemId] of todo) {
  try {
    const d = await getItem({ access, marketplace: 'EBAY_GB', itemId });
    asked += 1;
    // An ended listing has no category to give; recorded empty so it is not asked again.
    done.set(q, { query: q, item_id: itemId, category_id: d?.categoryId ?? '', category_path: d?.categoryPath ?? '' });
  } catch (e) {
    if (/429/.test(String(e?.message))) { console.log('\n  eBay says slow down (429). Saved; run again later.'); break; }
    failed += 1;
    done.set(q, { query: q, item_id: itemId, category_id: '', category_path: '' });
  }
  if (asked % 25 === 0) { await save(); process.stdout.write(`  ${asked}/${todo.length}\r`); }
}
await save();

const filled = [...done.values()].filter((r) => r.category_id).length;
console.log(`\n  ${asked} asked, ${failed} failed. ${filled} of ${done.size} carded queries now have an eBay category.`);
console.log(`  ${OUT}\n`);
