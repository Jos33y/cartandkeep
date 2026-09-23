/*
 * Records a quote against a candidate. Most real sourcing arrives by email, not
 * by API, and a quote that lives in an inbox is not a quote the margin can use.
 *
 * Usage:
 *   node scripts/add-source.js --find="vet bed crate" --supplier="Acme Textiles" \
 *     --kind=wholesale --fulfilment=stock --moq=50 --price=6.40 \
 *     --freight=1.20 --duty=0.04 --from=CN --transit=42 \
 *     --weight=1400 --dims=600x400x80 --note="green back, 10m roll"
 *
 *   node scripts/add-source.js --find="2 in1 feeder" --supplier=cj_dropshipping \
 *     --kind=marketplace --fulfilment=dropship --price=4.02 --shipping=0 \
 *     --from=CN --transit=12 --ref=<cj product id>
 *
 * Add --confirm once the match has actually been checked.
 */

import { connect } from '../pipeline/lib/db.js';

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

const flag = (name) => process.argv.slice(2).includes(`--${name}`);
const num = (v) => (v === undefined || v === '' ? null : Number(v));

async function main() {
  const { db, E } = await connect();

  const find = arg('find');
  const supplier = arg('supplier');

  if (!find || !supplier) {
    console.error('Need --find="part of the title" and --supplier="name".');
    process.exit(1);
  }

  const fulfilment = arg('fulfilment') ?? 'stock';
  if (!['stock', 'dropship'].includes(fulfilment)) {
    console.error('--fulfilment must be stock or dropship.');
    process.exit(1);
  }

  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';
  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();

  const { data: hits, error } = await db
    .from('candidates')
    .select('id, title, headroom, margin, tier')
    .eq('tenant_id', tenant.id)
    .ilike('title', `%${find}%`);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (!hits?.length) {
    console.error(`Nothing matches "${find}".`);
    process.exit(1);
  }

  // Guessing which of four vet beds was meant would attach a real quote to the
  // wrong product, which is worse than stopping.
  if (hits.length > 1) {
    console.error(`"${find}" matches ${hits.length} candidates. Narrow it:`);
    for (const h of hits) console.error(`  ${h.title}`);
    process.exit(1);
  }

  const c = hits[0];
  const dims = (arg('dims') ?? '').split('x').map(Number);

  const row = {
    tenant_id: tenant.id,
    candidate_id: c.id,
    supplier,
    external_ref: arg('ref') ?? null,
    title: arg('title') ?? null,
    url: arg('url') ?? null,
    supplier_kind: arg('kind') ?? 'unknown',
    fulfilment,
    unit_cost: num(arg('price')),
    price_at_moq: num(arg('price')),
    moq: num(arg('moq')),
    inbound_freight_per_unit: num(arg('freight')),
    duty_pct: num(arg('duty')),
    supplier_shipping: num(arg('shipping')),
    ships_from: arg('from') ?? null,
    transit_days: num(arg('transit')),
    weight_g: num(arg('weight')),
    length_mm: dims.length === 3 ? dims[0] : null,
    width_mm: dims.length === 3 ? dims[1] : null,
    height_mm: dims.length === 3 ? dims[2] : null,
    quoted_on: arg('on') ?? new Date().toISOString().slice(0, 10),
    note: arg('note') ?? null,
    confirmed: flag('confirm'),
    confirmed_at: flag('confirm') ? new Date().toISOString() : null,
  };

  const { data: saved, error: sErr } = await db
    .from('candidate_sources')
    .upsert(row, { onConflict: 'candidate_id,supplier,external_ref' })
    .select('landed_unit_cost')
    .single();

  if (sErr) {
    console.error(sErr.message);
    process.exit(1);
  }

  const landed = Number(saved.landed_unit_cost);
  const m = c.margin ?? {};

  // On a dropship order the supplier posts it, so the postage deducted from
  // headroom is not hers to pay and goes back on.
  const postageBack = fulfilment === 'dropship' ? Number(m.postage ?? 0) : 0;
  const net = c.headroom == null ? null
    : Math.round((Number(c.headroom) + postageBack - landed) * 100) / 100;

  console.log(`\n${c.title}\n`);
  console.log(`  supplier    ${supplier}, ${fulfilment}${row.moq ? `, MOQ ${row.moq}` : ''}`);
  console.log(`  landed      £${landed.toFixed(2)} a unit`);
  console.log(`  headroom    £${Number(c.headroom).toFixed(2)}`);
  if (postageBack) console.log(`  postage     £${postageBack.toFixed(2)} back, the supplier ships`);
  console.log(`  net         ${net == null ? 'not computable' : `£${net.toFixed(2)} a unit`}`);
  if (row.moq && net != null) {
    console.log(`  at MOQ      £${(net * row.moq).toFixed(2)} on £${(landed * row.moq).toFixed(2)} of stock`);
  }
  console.log(`  ${row.confirmed ? 'Confirmed.' : 'Not confirmed. Check the match before trusting this.'}\n`);
}

main();
