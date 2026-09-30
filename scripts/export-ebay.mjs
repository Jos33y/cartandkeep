/*
 * Read-only: her eBay cards out to a CSV for review. Writes nothing to the database.
 *
 *   node scripts/export-ebay.mjs                       open and approved (the default)
 *   node scripts/export-ebay.mjs --status=open         not decided yet
 *   node scripts/export-ebay.mjs --status=approved     approved only
 *   node scripts/export-ebay.mjs --status=all          every decision, rejected and later included
 *   node scripts/export-ebay.mjs --label="Care & DIY"  one source label only
 *
 * An eBay card is any card whose channels include eBay, or that has no store reading (every card the
 * gate imported before the store existed). Store-only cards stay in export-store.mjs.
 *
 * Out: research/review/ebay-<status>-<date>.csv, one row per card. margin_json keeps the whole margin
 * reading, so a field this file does not name is never lost.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const slug = arg('tenant', 'cart-and-keep');
const status = arg('status', 'open-approved');
const label = arg('label');
const STATUSES = { 'open-approved': [null, 'approve'], open: [null], approved: ['approve'], all: null };
if (!(status in STATUSES)) { console.error(`\n  --status must be one of: ${Object.keys(STATUSES).join(', ')}\n`); process.exit(1); }

const { connect } = await import('../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const COLS = `id, batch_id, external_ref, title, category, category_id, category_source, category_flag, source_labels,
  recommended_channels, reference_url, image_url, cluster, margin, entry, sold_30d, avg_sold_price, active_listings,
  decisions ( action, reason, note, decided_at ), candidate_sources ( supplier, landed_unit_cost ), batches ( term, delivered_for )`;

async function paged(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

const all = await paged(() => db.from('candidates').select(COLS).eq('tenant_id', tenant.id).order('id'));
const one = (d) => (Array.isArray(d) ? d[0] : d) ?? null;

const isEbay = (c) => {
  const ch = c.recommended_channels ?? [];
  if (ch.includes('ebay')) return true;
  // Before the store existed every card was an eBay card and carried no channel list.
  return !ch.includes('store') && !String(one(c.batches)?.term ?? '').startsWith('store');
};
const wanted = STATUSES[status];
const cards = all.filter((c) => {
  if (!isEbay(c)) return false;
  if (label && !(c.source_labels ?? []).includes(label)) return false;
  if (!wanted) return true;
  return wanted.includes(one(c.decisions)?.action ?? null);
});

const ids = [...new Set(cards.map((c) => c.category_id).filter(Boolean))];
const paths = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from('google_categories').select('id, path').in('id', ids.slice(i, i + 200));
  for (const g of data ?? []) paths.set(g.id, g.path);
}

const round2 = (v) => Math.round(v * 100) / 100;
const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '' : round2(Number(v)));
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
// The eBay reading sits on the margin itself for eBay cards, and under margin.ebay for store cards that gained eBay.
const pick = (...vals) => vals.find((v) => v != null && v !== '');

const head = ['decision', 'reason', 'decided_at', 'title', 'category_path', 'category_source', 'category_flag', 'labels', 'channels', 'batch', 'imported_for',
  'sold_30d', 'active_listings', 'median', 'buy_under', 'ebay_list', 'ebay_net', 'list_trusted', 'list_basis',
  'cost', 'cost_source', 'her_cheapest', 'her_supplier', 'store_list', 'store_keep', 'store_floor',
  'entry_proved', 'entry_price', 'entry_feedback', 'entry_sold', 'entry_age_days',
  'shop', 'shop_product', 'shop_price', 'match', 'match_via', 'band', 'grams', 'ebay_category', 'note',
  'external_ref', 'shop_url', 'id', 'image_url', 'margin_json'];

const rows = cards.map((c) => {
  const m = c.margin ?? {};
  const e = m.ebay ?? m;
  const d = one(c.decisions);
  const b = one(c.batches);
  const src = (c.candidate_sources ?? []).filter((s) => Number(s.landed_unit_cost) > 0).sort((x, y) => x.landed_unit_cost - y.landed_unit_cost)[0];
  const entry = c.entry ?? e.entry ?? null;
  const store = m.ebay ? m : null; // a store card that gained eBay: store figures on the margin, eBay under margin.ebay
  return [
    d?.action ?? '', d?.reason ?? '', d?.decided_at?.slice(0, 10) ?? '', c.title,
    paths.get(c.category_id) ?? c.category ?? '', c.category_source, c.category_flag,
    (c.source_labels ?? []).join('; '), (c.recommended_channels ?? []).join(' '), b?.term, b?.delivered_for,
    c.sold_30d ?? '', c.active_listings ?? '', n(pick(e.market_median, c.avg_sold_price)),
    n(e.max_goods_cost), n(e.sale_price), n(e.net), e.list_trusted == null ? '' : (e.list_trusted ? 'yes' : 'no'), e.list_basis ?? '',
    n(pick(store?.cost, e.landed_cost)), pick(store?.cost != null ? 'store card' : null, e.cost_source),
    n(src?.landed_unit_cost), src?.supplier ?? '', n(store?.list_at), n(store?.keep), n(store?.floor),
    entry ? (entry.proved ? 'yes' : 'no') : '', n(entry?.price), entry?.seller_feedback ?? entry?.sellerFeedback ?? '',
    pick(entry?.sold_lifetime, entry?.sold, entry?.soldLifetime) ?? '', entry?.age_days ?? entry?.ageDays ?? '',
    e.shelf?.shop ?? '', e.shelf?.product ?? '', n(e.shelf?.price), pick(e.match?.level, m.match?.verdict) ?? '', pick(e.match?.via, m.match?.by) ?? '',
    pick(e.band_label, e.band), pick(e.grams, m.grams) ?? '', e.ebay_category?.path ?? '',
    d?.note ?? '',
    c.external_ref, pick(e.shelf?.url, c.reference_url), c.id, c.image_url, JSON.stringify(m),
  ].map(cell).join(',');
});

fs.mkdirSync('research/review', { recursive: true });
const out = `research/review/ebay-${status}${label ? `-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
fs.writeFileSync(out, `${head.join(',')}\n${rows.join('\n')}\n`);

const count = (a) => cards.filter((c) => (one(c.decisions)?.action ?? null) === a).length;
console.log(`\n  ${cards.length} eBay cards: ${count(null)} open, ${count('approve')} approved${status === 'all' ? `, ${count('reject')} rejected, ${count('defer')} later` : ''}.`);
console.log(`  Written ${out}\n`);
