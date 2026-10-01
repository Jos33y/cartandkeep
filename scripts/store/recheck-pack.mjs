/*
 * Re-judges the eBay pack on store cards that gained eBay before 1 October. Until then import-gate (addEbay) and
 * import-store (withStore) wrote "same_product_same_pack, via the store card" whenever the store card had a cost,
 * without comparing anything, so Fairy Liquid at 19 washes was marked the same pack as a 140-pod eBay listing.
 *
 * Now the gate's own check (matchOf in lib/row.js) compares the store card's shelf (the shop's name for it, brand,
 * barcode) with the eBay listing's title, exactly as the importers do from 1 October. Only that asserted marking is
 * touched; a pack the gate itself matched by barcode or model is left alone.
 *
 *   node scripts/store/recheck-pack.mjs                       # list only
 *   node scripts/store/recheck-pack.mjs --apply               # write, undecided cards only
 *   node scripts/store/recheck-pack.mjs --apply --decided     # her decided cards too (evidence only, never the decision)
 *
 * Writes research/review/recheck-pack-<date>.csv either way, one row per card checked.
 */
import fs from 'node:fs';
import { matchOf } from '../lib/row.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const withDecided = args.includes('--decided');
const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';
const date = new Date().toISOString().slice(0, 10);

const ASSERTED = (m) => m?.level === 'same_product_same_pack' && /^the store card$/.test(String(m?.via ?? ''));
const UNKNOWN_PACK = { level: 'same_product_unknown_pack', via: 'the store card, pack not compared' };
function packAgainst(m, entryTitle) {
  if (m?.cost == null || !m?.cost_from?.product) return null;
  const got = matchOf({ product: m.cost_from.product, brand: m.brand ?? null, gtin: m.gtin ?? null, price: m.cost }, null, entryTitle);
  return got ? { ...got, via: `${got.via}, shelf from the store card` } : null;
}

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

// Every store card carrying an eBay reading, read in pages so none is missed.
const cards = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('candidates')
    .select('id, title, external_ref, margin, entry, decisions ( action )')
    .eq('tenant_id', tenant.id).eq('margin->>channel', 'store').not('margin->ebay', 'is', null)
    .range(from, from + 999);
  if (error) { console.error(`Read failed: ${error.message}`); process.exit(1); }
  cards.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const decisionOf = (c) => (Array.isArray(c.decisions) ? c.decisions[0]?.action : c.decisions?.action) ?? '';
const rows = [];
for (const c of cards) {
  const was = c.margin?.ebay?.match;
  if (!ASSERTED(was)) continue;
  const now = packAgainst(c.margin, c.entry?.title) ?? UNKNOWN_PACK;
  rows.push({ c, now, decision: decisionOf(c) });
}

const tally = {};
for (const r of rows) tally[r.now.level] = (tally[r.now.level] ?? 0) + 1;
const decided = rows.filter((r) => r.decision);
console.log(`\n  ${cards.length} store cards with an eBay reading; ${rows.length} carry the asserted "same pack"`);
console.log(`  re-judged: ${Object.entries(tally).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}`);
console.log(`  of them decided by her: ${decided.length} (${Object.entries(decided.reduce((o, r) => ({ ...o, [r.decision]: (o[r.decision] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'})\n`);
const show = rows.filter((r) => r.now.level !== 'same_product_same_pack').slice(0, 25);
for (const r of show) {
  const p = (x) => (x ? `${x.n}${x.kind === 'count' ? '' : ` ${x.kind}`}` : '?');
  console.log(`  ${r.now.level.replace(/^same_product_|^same_brand_/, '').padEnd(15)} ${r.decision.padEnd(8)} shelf ${p(r.now.shelf).padEnd(9)} eBay ${p(r.now.ebay).padEnd(9)} ${String(r.c.margin?.cost_from?.product ?? r.c.title).slice(0, 40).padEnd(40)} | ${String(r.c.entry?.title ?? '').slice(0, 45)}`);
}
if (rows.length > show.length) console.log(`  ... see the CSV for all ${rows.length}`);

const out = `research/review/recheck-pack-${date}.csv`;
fs.mkdirSync('research/review', { recursive: true });
const cell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const cols = ['id', 'title', 'decision', 'new_level', 'via', 'shelf_pack', 'ebay_pack', 'shelf_product', 'ebay_title', 'ebay_item'];
fs.writeFileSync(out, [cols.join(','), ...rows.map((r) => [
  r.c.id, r.c.title, r.decision, r.now.level, r.now.via,
  r.now.shelf ? `${r.now.shelf.n} ${r.now.shelf.kind}` : '', r.now.ebay ? `${r.now.ebay.n} ${r.now.ebay.kind}` : '',
  r.c.margin?.cost_from?.product ?? '', r.c.entry?.title ?? '', r.c.entry?.item_id ?? '',
].map(cell).join(','))].join('\n') + '\n');
console.log(`\n  ${out}`);

if (!apply) { console.log('\n  List only. --apply writes undecided cards; add --decided for hers too (the evidence, never the decision).\n'); process.exit(0); }

let written = 0; let failed = 0; let skipped = 0;
for (const r of rows) {
  if (r.decision && !withDecided) { skipped += 1; continue; }
  const margin = { ...r.c.margin, ebay: { ...r.c.margin.ebay, match: { ...r.now, rechecked: date } } };
  const { error } = await db.from('candidates').update({ margin }).eq('id', r.c.id);
  if (error) { failed += 1; console.error(`  ${r.c.title}: ${error.message}`); } else written += 1;
}
console.log(`\n  written ${written}${skipped ? `, decided left as they are ${skipped}` : ''}${failed ? `, failed ${failed}` : ''}\n`);
