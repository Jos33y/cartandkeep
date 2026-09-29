/*
 * Puts a review's verdicts onto her live cards: rejections, Later, and notes. Lists only, unless --apply.
 *
 *   node scripts/store/apply-review.mjs --review=research/review/store-home-and-garden-review-2026-09-29.csv
 *   node scripts/store/apply-review.mjs --review=... --apply
 *
 * The review file's action column says what happens to each card:
 *   reject    a rejection with the file's reason (must be one of hers) and note
 *   defer     Later, with the note
 *   note      a note on the card, no decision; she decides
 *   resource  left for resource.mjs, which repoints the card or rejects it
 *   keep      nothing
 * A card she has already decided keeps her decision unless --override. A note already on the card is not added twice.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const reviewPath = arg('review');
const slug = arg('tenant', 'cart-and-keep');
const apply = args.includes('--apply');
const override = args.includes('--override');
if (!reviewPath) { console.error('\n  Pass --review= the review CSV with action, reason and note columns.\n'); process.exit(1); }

// Mirrors decisions_reason_check in 0033_rejection_reasons.sql.
const REASONS = ['too_much_competition', 'wrong_category', 'margin_thin', 'not_profitable', 'not_sourceable', 'previous_underperformer', 'other'];
const rows = parseCsv(fs.readFileSync(reviewPath, 'utf8')).filter((r) => ['reject', 'defer', 'note'].includes(r.action));
const bad = rows.filter((r) => r.action === 'reject' && !REASONS.includes(r.reason));
if (bad.length) { console.error(`\n  ${bad.length} rejections without a known reason, e.g. "${bad[0].title}": ${bad[0].reason}\n`); process.exit(1); }

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

// Her cards as they are now, with any decision and the notes already on them.
const live = new Map();
const ids = rows.map((r) => r.id);
for (let i = 0; i < ids.length; i += 100) {
  const { data, error } = await db.from('candidates').select('id, title, decisions ( action, reason ), candidate_notes ( body )')
    .eq('tenant_id', tenant.id).in('id', ids.slice(i, i + 100));
  if (error) { console.error(`Lookup failed: ${error.message}`); process.exit(1); }
  for (const c of data) live.set(c.id, c);
}
const decision = (c) => (Array.isArray(c.decisions) ? c.decisions[0] : c.decisions) ?? null;

const plan = { reject: [], defer: [], note: [], decided_by_her: [], note_already_there: [], missing: [] };
for (const r of rows) {
  const c = live.get(r.id);
  if (!c) { plan.missing.push(r); continue; }
  if (r.action === 'note') {
    if ((c.candidate_notes ?? []).some((n) => n.body === r.note)) plan.note_already_there.push(r);
    else plan.note.push(r);
    continue;
  }
  if (decision(c) && !override) { plan.decided_by_her.push(r); continue; }
  plan[r.action].push(r);
}

console.log(`\n  ${reviewPath}`);
for (const [k, list] of Object.entries(plan)) {
  if (!list.length) continue;
  const byReason = k === 'reject' ? ` (${Object.entries(list.reduce((o, r) => ({ ...o, [r.reason]: (o[r.reason] ?? 0) + 1 }), {})).map(([x, n]) => `${x} ${n}`).join(', ')})` : '';
  console.log(`  ${k.replace(/_/g, ' ').padEnd(20)}${String(list.length).padStart(4)}${byReason}`);
  for (const r of list.slice(0, 4)) console.log(`      ${r.title.slice(0, 50)}`);
}
if (!apply) { console.log('\n  List only. Run again with --apply to write it.\n'); process.exit(0); }

let written = 0;
let failed = 0;
const now = () => new Date().toISOString();
for (const r of [...plan.reject, ...plan.defer]) {
  // One live row per card; the decisions_audit trigger keeps the history.
  const { error } = await db.from('decisions').upsert({
    tenant_id: tenant.id, candidate_id: r.id, action: r.action,
    reason: r.action === 'reject' ? r.reason : null, note: r.note || null, decided_at: now(),
  }, { onConflict: 'candidate_id' });
  if (error) { failed += 1; console.error(`  ${r.title}: ${error.message}`); } else written += 1;
}
for (let i = 0; i < plan.note.length; i += 100) {
  const chunk = plan.note.slice(i, i + 100).map((r) => ({ tenant_id: tenant.id, candidate_id: r.id, body: r.note }));
  const { error } = await db.from('candidate_notes').insert(chunk);
  if (error) { failed += chunk.length; console.error(`  notes ${i + 1} to ${i + chunk.length}: ${error.message}`); } else written += chunk.length;
}
console.log(`\n  Written ${written}${failed ? `, failed ${failed}` : ''}. Next: resource.mjs for the cards marked resource.\n`);
