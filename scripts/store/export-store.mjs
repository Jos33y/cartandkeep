/*
 * Read-only: the store cards of one Google category, out to a CSV for review. Writes nothing to the database.
 *
 *   node scripts/store/export-store.mjs --label="Home & Garden"
 *
 * Out: research/review/store-<category>-<date>.csv, one row per card in the store batch, plus any eBay card
 * that gained the shop (marked joined=yes). eBay keep is worked out here at the store cost, for review only.
 */
import fs from 'node:fs';
import { squash } from './match.mjs';
import { PROFIT, ebayCosts, keepAt, listFor, round2 } from '../../src/lib/pricing.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const label = arg('label');
const slug = arg('tenant', 'cart-and-keep');
if (!label) { console.error('\n  Pass --label=, e.g. --label="Home & Garden".\n'); process.exit(1); }
const term = arg('term', `store-${squash(label).replace(/ /g, '-')}`);

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const { data: batches, error: bErr } = await db.from('batches').select('id, term, delivered_for').eq('tenant_id', tenant.id).eq('term', term);
if (bErr || !batches?.length) { console.error(`No batch with term "${term}". ${bErr?.message ?? ''}`); process.exit(1); }
const storeBatchIds = new Set(batches.map((b) => b.id));

const COLS = `id, batch_id, external_ref, title, category, category_id, category_source, category_flag, source_labels,
  recommended_channels, reference_url, image_url, cluster, margin, entry, sold_30d, avg_sold_price, active_listings,
  decisions ( action, reason ), candidate_sources ( supplier, landed_unit_cost )`;

// Paged: the store batch, then every card of hers carrying a store reading (the eBay cards that gained the shop).
async function paged(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const inBatch = await paged(() => db.from('candidates').select(COLS).in('batch_id', [...storeBatchIds]).order('id'));
const joined = (await paged(() => db.from('candidates').select(COLS).eq('tenant_id', tenant.id).contains('recommended_channels', ['store']).order('id')))
  .filter((c) => !storeBatchIds.has(c.batch_id) && c.margin?.cost != null);
const cards = [...inBatch, ...joined];

const ids = [...new Set(cards.map((c) => c.category_id).filter(Boolean))];
const paths = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from('google_categories').select('id, path').in('id', ids.slice(i, i + 200));
  for (const g of data ?? []) paths.set(g.id, g.path);
}

const one = (d) => (Array.isArray(d) ? d[0] : d) ?? null;
const n = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '' : round2(Number(v)));
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

const head = ['joined', 'decision', 'title', 'page_name', 'brand', 'gtin', 'season', 'shops_all', 'need', 'big_brand', 'shop', 'cost', 'her_cheapest', 'match', 'grams', 'weight_from', 'band',
  'google_rank', 'google_months', 'google_min', 'google_max', 'list_at', 'floor', 'keep', 'over_google_by', 'category_path', 'category_source', 'category_flag',
  'labels', 'on_ebay', 'ebay_sold_month', 'ebay_entry_price', 'ebay_entry_feedback', 'ebay_entry_proved', 'ebay_median', 'ebay_list_at', 'ebay_keep_at_store_cost', 'ebay_over_entry_by',
  'external_ref', 'shop_url', 'id', 'image_url'];

const rows = cards.map((c) => {
  const m = c.margin ?? {};
  const g = m.google ?? {};
  const d = one(c.decisions);
  const her = (c.candidate_sources ?? []).map((s) => Number(s.landed_unit_cost)).filter((v) => v > 0).sort((a, b) => a - b)[0];
  const e = m.ebay;
  const entry = c.entry ?? e?.entry ?? null;
  let ebayList = null; let ebayKeep = null; let overEntry = null;
  if (e && m.cost != null) {
    const costs = ebayCosts(e);
    const market = entry?.proved && entry?.price ? Number(entry.price) : Number(e.sale_price ?? c.avg_sold_price) || null;
    const l = costs ? listFor(Number(m.cost), market, costs, PROFIT.ebay) : null;
    if (l) { ebayList = l.price; ebayKeep = keepAt(l.price, Number(m.cost), costs); }
    if (ebayList != null && entry?.price) overEntry = round2(ebayList - Number(entry.price));
  }
  return [
    storeBatchIds.has(c.batch_id) ? '' : 'yes', d?.action ?? '', c.title, m.cost_from?.product, m.brand, m.gtin, c.cluster, (m.shops ?? []).join(' '), m.need, m.big_brand ? 'yes' : '', m.cost_from?.shop, n(m.cost), n(her), m.match?.verdict,
    m.postage_band?.grams, m.postage_band?.from, m.postage_band?.label, g.rank, g.months, n(g.min), n(g.max), n(m.list_at), n(m.floor), n(m.keep),
    g.min && m.list_at ? n(Math.max(0, m.list_at - g.min)) : '', paths.get(c.category_id) ?? '', c.category_source, c.category_flag,
    (c.source_labels ?? []).join('; '), (c.recommended_channels ?? []).includes('ebay') ? 'yes' : '', c.sold_30d ?? '', n(entry?.price), entry?.seller_feedback ?? '',
    entry ? (entry.proved ? 'yes' : 'no') : '', n(e?.median ?? c.avg_sold_price), n(ebayList), n(ebayKeep), n(overEntry),
    c.external_ref, m.cost_from?.url ?? c.reference_url, c.id, c.image_url,
  ].map(cell).join(',');
});

fs.mkdirSync('research/review', { recursive: true });
const out = `research/review/store-${squash(label).replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
fs.writeFileSync(out, `${head.join(',')}\n${rows.join('\n')}\n`);
console.log(`\n  ${inBatch.length} in the store batch, ${joined.length} eBay cards that gained the shop.\n  Written ${out}\n`);
