// Cards that are the same eBay listing under different queries. Keeps one per listing. Lists only, unless --apply.
//   node scripts/dedupe-candidates.js
//   node scripts/dedupe-candidates.js --apply

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();

const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const { data: rows, error } = await db.from('candidates')
  .select('id, title, batch_id, entry, margin, decisions ( id ), candidate_notes ( id ), candidate_sources ( id )')
  .eq('tenant_id', tenant.id);
if (error) { console.error(`Lookup failed: ${error.message}`); process.exit(1); }

const worked = (c) => (c.decisions?.length ?? 0) + (c.candidate_notes?.length ?? 0) + (c.candidate_sources?.length ?? 0) > 0;

const groups = new Map();
for (const c of rows) {
  const id = c.entry?.item_id;
  if (!id) continue;
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(c);
}

const drop = [];
for (const cards of groups.values()) {
  if (cards.length < 2) continue;
  // Her decisions and notes first, then a card with a shelf, then the shortest title.
  cards.sort((a, b) => Number(worked(b)) - Number(worked(a))
    || Number(Boolean(b.margin?.shelf)) - Number(Boolean(a.margin?.shelf))
    || a.title.length - b.title.length);
  const [keep, ...rest] = cards;
  console.log(`\n  keep  ${keep.title}${worked(keep) ? '  (decided or noted)' : ''}`);
  for (const c of rest) {
    // Never removes anything she has already touched.
    if (worked(c)) { console.log(`  also  ${c.title}  (decided or noted, left in place)`); continue; }
    console.log(`  drop  ${c.title}`);
    drop.push(c);
  }
}

console.log(`\n${drop.length} cards share a listing with another card.`);
if (!apply) { console.log('List only. Run again with --apply to remove them.\n'); process.exit(0); }
if (!drop.length) process.exit(0);

const { error: dErr } = await db.from('candidates').delete().in('id', drop.map((c) => c.id));
if (dErr) { console.error(`Remove failed, nothing removed: ${dErr.message}`); process.exit(1); }

for (const batchId of new Set(drop.map((c) => c.batch_id))) {
  const { count } = await db.from('candidates').select('id', { count: 'exact', head: true }).eq('batch_id', batchId);
  await db.from('batches').update({ candidate_count: count ?? 0 }).eq('id', batchId);
}
console.log(`Removed ${drop.length}.\n`);
