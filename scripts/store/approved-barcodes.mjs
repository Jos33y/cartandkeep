/*
 * Approved cards and their barcodes, for choosing one to test eBay's catalogue (a listing matched by barcode
 * takes eBay's own photos and item specifics). Reads only.
 *
 *   node scripts/store/approved-barcodes.mjs
 */
const slug = process.argv.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';
const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }
const { data, error } = await db.from('decisions').select('candidate_id, action, decided_at, candidates ( id, title, margin, ebay )')
  .eq('tenant_id', tenant.id).eq('action', 'approve');
if (error) { console.error(error.message); process.exit(1); }
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const rows = (data ?? []).map((d) => {
  const c = d.candidates ?? {};
  const m = c.margin ?? {};
  const gtin = digits(m.gtin ?? m.ebay?.gtin ?? m.store?.gtin ?? m.shelf?.gtin ?? m.cost_from?.gtin);
  const how = String(m.match?.by ?? m.match?.verdict ?? m.ebay?.match?.level ?? '');
  return { id: String(c.id ?? d.candidate_id), title: c.title ?? '', gtin, channel: m.channel ?? 'ebay', how, live: Boolean(c.ebay?.listing_id ?? c.ebay?.listingId) };
});
rows.sort((a, b) => Boolean(b.gtin) - Boolean(a.gtin) || /barcode/.test(b.how) - /barcode/.test(a.how));
console.log(`\n  ${rows.length} approved cards, ${rows.filter((r) => r.gtin).length} with a barcode\n`);
for (const r of rows) console.log(`  ${r.gtin ? r.gtin.padEnd(14) : 'no barcode    '} ${r.channel.padEnd(6)} ${(r.how || '-').slice(0, 18).padEnd(18)} ${r.live ? 'LIVE ' : '     '}${r.id.slice(0, 8)}  ${r.title.slice(0, 60)}`);
console.log('');
