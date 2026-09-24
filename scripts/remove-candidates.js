// Takes cards out of one batch by the gate CSVs that put them there. Lists only, unless --apply.
//   node scripts/remove-candidates.js --date=2026-09-25 --from=research/gates/a.csv,research/gates/b.csv
//   node scripts/remove-candidates.js --date=2026-09-25 --from=... --apply

import fs from 'node:fs';
import { parseCsv } from './lib/sources.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const apply = args.includes('--apply');
const date = arg('date');
const slug = arg('tenant', 'cart-and-keep');
const files = String(arg('from', '')).split(',').map((f) => f.trim()).filter(Boolean);

if (!date || !files.length) {
  console.error('\n  Needs --date and --from=<gate csv>[,<gate csv>...]\n');
  process.exit(1);
}

const refs = new Set();
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`\n  ${f} not found. Nothing removed.\n`);
    process.exit(1);
  }
  for (const r of parseCsv(fs.readFileSync(f, 'utf8'))) {
    const q = String(r.query ?? '').split('#')[0].trim();
    if (q) refs.add(q);
  }
}

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();

const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const { data: batch } = await db.from('batches')
  .select('id, term, category_label').eq('tenant_id', tenant.id).eq('delivered_for', date).maybeSingle();
if (!batch) { console.error(`No batch on ${date}.`); process.exit(1); }

const { data: all, error } = await db.from('candidates')
  .select('id, external_ref, title, decisions ( id ), candidate_notes ( id ), candidate_sources ( id )')
  .eq('batch_id', batch.id)
  .in('external_ref', [...refs]);
if (error) { console.error(`Lookup failed, nothing removed: ${error.message}`); process.exit(1); }

// Deleting a card cascades to her decision on it, so anything she has touched stays.
const touched = (c) => (c.decisions?.length ?? 0) + (c.candidate_notes?.length ?? 0) + (c.candidate_sources?.length ?? 0) > 0;
const kept = all.filter(touched);
const found = all.filter((c) => !touched(c));
if (kept.length) {
  console.log(`\n  ${kept.length} left alone, already decided, noted or sourced:`);
  for (const c of kept) console.log(`    ${c.title}`);
}

console.log(`\n${batch.category_label} (${date}): ${found.length} cards came from ${files.length} file(s)\n`);
for (const c of found) console.log(`  ${c.title}`);

if (!apply) {
  console.log('\nList only. Run again with --apply to remove them.\n');
  process.exit(0);
}
if (!found.length) process.exit(0);

const { error: dErr } = await db.from('candidates').delete().in('id', found.map((c) => c.id));
if (dErr) {
  console.error(`\nRemove failed, nothing removed: ${dErr.message}\n`);
  process.exit(1);
}

const { count } = await db.from('candidates').select('external_ref', { count: 'exact', head: true }).eq('batch_id', batch.id);
await db.from('batches').update({ candidate_count: count ?? 0 }).eq('id', batch.id);
console.log(`\nRemoved ${found.length}. ${count ?? 0} left in the batch.\n`);
