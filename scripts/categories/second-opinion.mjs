/*
 * A second opinion on every product's Google category, before the sort groups by it. Writes nothing on its own:
 *   node scripts/categories/second-opinion.mjs
 *       reads each title against its category, about 3 calls for her 215 products, and writes
 *       research/categories/second-opinion.csv (every product it disagrees with, "apply" set to yes)
 *       research/categories/duplicates.csv     (products on the shop more than once under the same title)
 *   node scripts/categories/second-opinion.mjs --apply=research/categories/second-opinion.csv
 *       writes the rows still marked yes, as source "checked". Change a row's apply to no to leave it.
 *
 * Only a disagreement that would move a product to another section counts: a different top-level category, or a
 * different second level. A deeper or sibling leaf in the same place is left alone. Her own choices (manual) and
 * the ones already checked by hand are never asked about.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { envKey } from '../lib/shops.js';
import { loadTaxonomy } from './taxonomy.mjs';

const TAXONOMY = 'research/google/taxonomy-with-ids.en-GB.txt';
const OUT = 'research/categories/second-opinion.csv';
const DUPES = 'research/categories/duplicates.csv';
const CACHE = 'research/categories/second-opinion-cache.json';
const BATCH = 80;

const args = process.argv.slice(2);
const applyFrom = args.find((a) => a.startsWith('--apply='))?.split('=').slice(1).join('=');
const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';

const tax = loadTaxonomy(TAXONOMY);
const level = (id, n) => (tax.pathOf(id) ?? '').split(' > ').slice(0, n).join(' > ');
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

if (applyFrom) {
  const rows = parseCsv(fs.readFileSync(applyFrom, 'utf8')).filter((r) => String(r.apply).trim().toLowerCase() === 'yes');
  let done = 0;
  for (const r of rows) {
    const gid = Number(r.suggested_id);
    if (!tax.has(gid)) { console.error(`  ${r.title}: ${r.suggested_id} is not a Google category, left`); continue; }
    const { data, error } = await db.from('store_products').update({ google_category_id: gid, google_category_source: 'checked' })
      .eq('tenant_id', tenant.id).eq('id', r.id).not('google_category_source', 'in', '(manual,checked)').select('id');
    if (error) console.error(`  ${r.title}: not saved, ${error.message}`);
    else if (!data?.length) console.error(`  ${r.title}: set by hand since the list was made, left`);
    else done += 1;
  }
  console.log(`\n  Written: ${done} of ${rows.length} marked yes, as checked.\n`);
  process.exit(0);
}

const products = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('store_products')
    .select('id, title, slug, status, section, google_category_id, google_category_source')
    .eq('tenant_id', tenant.id).neq('status', 'archived').eq('is_sample', false).order('id').range(from, from + 999);
  if (error) { console.error(`Products not read: ${error.message}`); process.exit(1); }
  products.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

// Duplicates: the same title once case, spacing and punctuation are set aside.
const key = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const groups = new Map();
for (const p of products) groups.set(key(p.title), [...(groups.get(key(p.title)) ?? []), p]);
const dupes = [...groups.values()].filter((g) => g.length > 1);
fs.mkdirSync('research/categories', { recursive: true });
fs.writeFileSync(DUPES, csv(['title', 'id', 'slug', 'status'], dupes.flatMap((g) => g.map((p) => ({ title: p.title, id: p.id, slug: p.slug, status: p.status })))));

// Every category to the third level, every top: a product filed in the wrong top can only be caught from all of them.
const list = [];
for (const line of fs.readFileSync(TAXONOMY, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\d+) - (.+)$/);
  if (m && m[2].split(' > ').length <= 3) list.push(`${m[1]} - ${m[2].trim()}`);
}
const ask = products.filter((p) => p.google_category_id && !['manual', 'checked'].includes(p.google_category_source));
const cache = (() => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } })();
const cacheKey = (p) => `${p.google_category_id}|${String(p.title).toLowerCase()}`;
const todo = ask.filter((p) => cache[cacheKey(p)] === undefined);
const apiKey = envKey('ANTHROPIC_API_KEY');
if (todo.length && !apiKey) { console.error('\n  No ANTHROPIC_API_KEY, so nothing could be read.\n'); process.exit(1); }

let calls = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  const part = todo.slice(i, i + BATCH);
  const lines = part.map((p, n) => `${n + 1}. ${String(p.title).split('#')[0].trim()}  [filed: ${tax.pathOf(p.google_category_id)}]`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CLASSIFY_MODEL || 'claude-sonnet-5-5',
      max_tokens: 2000,
      thinking: { type: 'between_tools' },
      system: [
        { type: 'text', text: 'You check where products are filed in Google\'s product taxonomy. For each product you get its title and the category it is filed under now. Choose the category from the list that best describes what the product itself is (not where it is used or who buys it). If the category it is filed under is right, or as good as any on the list, answer the id on the list that matches it or contains it. Reply with one line per product and nothing else: the product number, a tab, the category ID.' },
        { type: 'text', text: `Categories:\n${list.join('\n')}`, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: `Products:\n${lines}` }],
    }),
  });
  calls += 1;
  if (!res.ok) { console.error(`  Call failed (${res.status}); ${part.length} products not read this time. Run again to finish.`); continue; }
  const text = (await res.json())?.content?.map((c) => c.text ?? '').join('') ?? '';
  const answers = new Map([...text.matchAll(/^\s*(\d+)\s*[\t:|,.-]\s*(\d+)\s*$/gm)].map((m) => [Number(m[1]), Number(m[2])]));
  part.forEach((p, n) => { const id = answers.get(n + 1); cache[cacheKey(p)] = id && tax.has(id) ? id : 0; });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
}

// A disagreement is a different place in the shop: another top, or another second level.
const rows = [];
let unread = 0;
for (const p of ask) {
  const s = cache[cacheKey(p)];
  if (!s) { unread += 1; continue; }
  const now = p.google_category_id;
  const deep = (id) => tax.pathOf(id).split(' > ').length;
  const care = 'Health & Beauty > Healthcare';
  const moves = level(s, 1) !== level(now, 1)
    || (deep(s) >= 2 && deep(now) >= 2 && level(s, 2) !== level(now, 2))
    // Healthcare splits a level deeper on the shop (DEEPER in shop-sort), so a move inside it counts there.
    || (level(s, 2) === care && level(now, 2) === care && deep(s) >= 3 && deep(now) >= 3 && level(s, 3) !== level(now, 3));
  if (moves) rows.push({ id: p.id, title: p.title, now: tax.pathOf(now), suggested: tax.pathOf(s), suggested_id: s, apply: 'yes' });
}
rows.sort((a, b) => a.suggested.localeCompare(b.suggested));
fs.writeFileSync(OUT, csv(['id', 'title', 'now', 'suggested', 'suggested_id', 'apply'], rows));

console.log(`\n  ${products.length} products. Read: ${ask.length - unread} (${calls} calls now, the rest from earlier answers). Hers or checked by hand, not asked: ${products.length - ask.length}.`);
if (unread) console.log(`  Not read: ${unread}. Run again to finish them.`);
console.log(`\n  Would move ${rows.length}:`);
for (const r of rows) console.log(`    ${String(r.title).slice(0, 52).padEnd(52)}  ${r.now}\n${' '.repeat(58)}> ${r.suggested}`);
console.log(`\n  On the shop more than once: ${dupes.length} ${dupes.length === 1 ? 'title' : 'titles'}`);
for (const g of dupes) console.log(`    ${g.length}x  ${String(g[0].title).slice(0, 70)}  (${g.map((p) => p.status).join(', ')})`);
console.log(`\n  ${OUT}\n  ${DUPES}`);
console.log(`\n  Nothing written. Change "apply" to no on any row to leave it, then:\n  node scripts/categories/second-opinion.mjs --apply=${OUT}\n`);
