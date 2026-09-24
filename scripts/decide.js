// Records a decision on one card, found by its title. Lists only, unless --apply.
//   node scripts/decide.js --match="Paternity test kit" --action=reject --reason=not_sourceable --note="..."
//   node scripts/decide.js --match="Paternity test kit" --action=reject --reason=not_sourceable --note="..." --apply

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const apply = args.includes('--apply');
const override = args.includes('--override');
const slug = arg('tenant', 'cart-and-keep');
const match = arg('match');
const action = arg('action', 'reject');
const reason = arg('reason');
const note = arg('note');

// Mirrors decisions_reason_check in 0033_rejection_reasons.sql.
const REASONS = ['too_much_competition', 'wrong_category', 'margin_thin', 'not_profitable', 'not_sourceable', 'previous_underperformer', 'other'];

if (!match) { console.error('\n  Needs --match="part of the title"\n'); process.exit(1); }
if (!['approve', 'reject', 'defer'].includes(action)) { console.error(`\n  --action must be approve, reject or defer\n`); process.exit(1); }
if (action === 'reject' && !REASONS.includes(reason)) {
  console.error(`\n  A rejection needs --reason, one of: ${REASONS.join(', ')}\n`);
  process.exit(1);
}

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();

const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const { data: found, error } = await db.from('candidates')
  .select('id, title, decisions ( action, reason )')
  .eq('tenant_id', tenant.id)
  .ilike('title', `%${match}%`);
if (error) { console.error(`Lookup failed: ${error.message}`); process.exit(1); }

const decided = (c) => (Array.isArray(c.decisions) ? c.decisions[0] : c.decisions) ?? null;

if (!found.length) { console.log(`\n  No card matches "${match}".\n`); process.exit(1); }
if (found.length > 1) {
  console.log(`\n  "${match}" matches ${found.length} cards. Narrow it until one is left:`);
  for (const c of found) console.log(`    ${c.title}${decided(c) ? `  (already ${decided(c).action})` : ''}`);
  console.log();
  process.exit(1);
}

const [card] = found;
const prior = decided(card);
console.log(`\n  ${card.title}`);
console.log(`  ${prior ? `now ${prior.action}${prior.reason ? `, ${prior.reason}` : ''}` : 'undecided'}  ->  ${action}${reason ? `, ${reason}` : ''}`);
if (note) console.log(`  note: ${note}`);

if (prior && !override) {
  console.log(`\n  Already decided. Her decision stands; pass --override to change it.\n`);
  process.exit(1);
}
if (!apply) { console.log('\n  List only. Run again with --apply to record it.\n'); process.exit(0); }

// One live row per card; the decisions_audit trigger writes the history.
const { error: wErr } = await db.from('decisions').upsert({
  tenant_id: tenant.id,
  candidate_id: card.id,
  action,
  reason: action === 'reject' ? reason : null,
  note: note ?? null,
  decided_at: new Date().toISOString(),
}, { onConflict: 'candidate_id' });

if (wErr) { console.error(`\n  Not recorded: ${wErr.message}\n`); process.exit(1); }
console.log('\n  Recorded.\n');
