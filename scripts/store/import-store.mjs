/*
 * Store picks into her Candidates, in a tab named after the Google category, as store cards.
 *
 * Price: Google's lowest price for it, when that clears her floor. The floor is what it costs where it
 * was seen (a cost reference, not where she must buy it) plus Royal Mail, packing, the card fee, a returns
 * allowance and her profit in pounds. When the floor is above Google's lowest, the card lists at the floor
 * and lands in "Above the market" for her to decide.
 *
 *   node scripts/store/import-store.mjs --label="Home & Garden" --dry
 *   node scripts/store/import-store.mjs --label="Home & Garden"
 *
 * Reads research/picks/checked.csv (all.csv if the check has not run). Cards she has decided are left exactly as they are.
 *
 * Postage comes from the product's weight (Royal Mail Tracked 48 small or medium parcel); over 20kg is left out.
 * A product already in her queue as an eBay card is not made twice: that card gains the Shop label and the shop
 * price. A re-import keeps the eBay label and reading the gate added to a store card.
 */
import fs from 'node:fs';
import { parseCsv } from '../lib/sources.js';
import { queryOf, squash } from './match.mjs';
import { PROFIT, STORE, ebayAtWeight, listFor, storeBandFor, storeCosts } from '../../src/lib/pricing.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const dry = args.includes('--dry');

const picksPath = arg('picks', fs.existsSync('research/picks/checked.csv') ? 'research/picks/checked.csv' : 'research/picks/all.csv');
const label = arg('label');
const term = arg('term', label ? `store-${squash(label).replace(/ /g, '-')}` : null);
const slug = arg('tenant', 'cart-and-keep');
const date = arg('date', new Date().toISOString().slice(0, 10));
const withoutPrice = args.includes('--without-price');
// Only what the page check confirmed comes in; an unsure match is still a guess.
const withUnsure = args.includes('--with-unsure');
const bigBrands = args.includes('--big-brands');

// Prices, postage bands and profit steps live in src/lib/pricing.js, which her portal reads too.
// No weight on file is costed as a small parcel and says so on her card. Size is not on file, so a light but
// long product (a curtain pole, a long-reach tool) can still need a medium parcel: the card tells her to check.
if (!label) {
  console.error('\n  Pass --label= the Google category the picks came from, e.g. --label="Home & Garden".\n');
  process.exit(1);
}

// The store figures for one product: band from its weight, floor from its cost, list at Google's lowest when that clears it.
export function priceStore(cost, googleMin, grams) {
  const band = storeBandFor(grams);
  if (!band) return { band: null };
  const c = storeCosts({ postage: band.postage, packaging: band.packaging });
  const market = googleMin > 0 ? googleMin : null;
  const l = cost != null ? listFor(cost, market, c, PROFIT.store) : null;
  return { band, costs: c, list: l, aboveMarket: Boolean(l && market != null && !l.onMarket) };
}

const rows = parseCsv(fs.readFileSync(picksPath, 'utf8'));
const tally = { read: rows.length, wrong_match: 0, unsure_match: 0, not_checked: 0, big_brand: 0, no_price: 0, over_20kg: 0, kept: 0 };
const bandCount = {};
const cards = [];
const seenRefs = new Set();

for (const r of rows) {
  const verdict = String(r.verdict ?? '');
  if (/^wrong/.test(verdict)) { tally.wrong_match += 1; continue; }
  if (/^unsure/.test(verdict) && !withUnsure) { tally.unsure_match += 1; continue; }
  if (!/^confirmed/.test(verdict) && !/^unsure/.test(verdict) && !withUnsure) { tally.not_checked += 1; continue; }
  if (r.big_brand === 'yes' && !r.need && !bigBrands) { tally.big_brand += 1; continue; }
  const cost = Number(r.seen_price) > 0 ? Number(r.seen_price) : Number(r.page_price) > 0 ? Number(r.page_price) : null;
  if (cost == null && !withoutPrice) { tally.no_price += 1; continue; }
  // The same key store-picks wrote and the eBay query file carries; drafted here only for a picks file that predates it.
  const ref = String(r.query ?? '').trim() || queryOf(r.title, r.brand);
  if (seenRefs.has(ref)) continue;
  const priced = priceStore(cost, Number(r.google_min), r.grams);
  const band = priced.band;
  if (!band) { tally.over_20kg += 1; continue; }
  seenRefs.add(ref);
  tally.kept += 1;
  const bandKey = band.basis === 'assumed' ? 'no weight, small parcel assumed' : band.label;
  bandCount[bandKey] = (bandCount[bandKey] ?? 0) + 1;

  const shops = String(r.seen_at ?? '').split(/\s+/).filter(Boolean);
  cards.push({
    external_ref: ref,
    title: r.title,
    category: label,
    // Seen at the shop; for recognising it on her card only, never published.
    image_url: r.seen_image || r.page_image || null,
    reference_url: r.seen_link || null,
    classification: 'unknown',
    tier: 'candidate',
    cluster: r.season || 'All year',
    score: null,
    component_count: 0,
    breakdown: {},
    signal_count: 1,
    signals: [],
    recommended_channels: ['store'],
    margin: {
      channel: 'store',
      list_at: priced.list?.price ?? null,
      floor: priced.list?.floor ?? null,
      above_market: priced.aboveMarket,
      keep: priced.list?.keep ?? null,
      profit_target: priced.list?.profit ?? null,
      cost,
      cost_from: { shop: shops[0] ?? null, url: r.seen_link || null, product: r.page_name || r.seen_as || null, price: cost },
      postage: band.postage,
      packaging: band.packaging,
      postage_band: { key: band.key, label: band.label, grams: band.grams, basis: band.basis, from: r.weight_from || null },
      card: { pct: STORE.cardPct, fixed: STORE.cardFixed },
      returns_allowance: STORE.returns,
      profit_rule: PROFIT.store,
      google: {
        rank: Number(r.rank) || null,
        months: Number(r.months) || null,
        periods: String(r.periods ?? '').split(/\s+/).filter(Boolean),
        min: Number(r.google_min) || null,
        max: Number(r.google_max) || null,
        category: r.category || label,
      },
      brand: r.brand || null,
      gtin: r.gtin || null,
      need: r.need || null,
      big_brand: r.big_brand === 'yes',
      shops,
      match: { by: r.matched_by || null, verdict: r.verdict || null },
    },
  });
}

console.log(`\n  ${picksPath}`);
for (const [k, v] of Object.entries(tally)) console.log(`  ${k.replace(/_/g, ' ').padEnd(14)}${v}`);
const above = cards.filter((c) => c.margin.above_market).length;
console.log(`\n  Postage: ${Object.entries(bandCount).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  Floor: cost + Royal Mail and packing for its weight + card fee + £${STORE.returns.toFixed(2)} returns + profit (${PROFIT.store.map((x) => `£${x.profit}${x.below ? ` under £${x.below}` : ' above'}`).join(', ')})`);
console.log(`  Listed at Google's lowest price where that clears the floor; ${cards.length - above} do, ${above} sit above Google's lowest (her card says by how much)\n`);
const money = (v, w = 6) => (v != null ? `£${Number(v).toFixed(2)}`.padStart(w + 1) : '-'.padStart(w + 1));
for (const c of cards.slice(0, 20)) {
  const m = c.margin;
  console.log(`  ${(m.above_market ? 'above' : '').padEnd(6)} post${money(m.postage, 5)}  cost${money(m.cost)}  floor${money(m.floor)}  Google${money(m.google.min)}  list${money(m.list_at)}  keep${money(m.keep)}  ${c.title.slice(0, 44)}`);
}
if (cards.length > 20) console.log(`  ... and ${cards.length - 20} more`);

if (dry) { console.log('\n  Dry run, nothing written.\n'); process.exit(0); }
if (!cards.length) { console.error('\n  Nothing to import.\n'); process.exit(1); }

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

// A product already in her queue under another batch is the same card twice, so no second card is made.
// If that card is an eBay card she has not decided, it gains the shop: the mirror of import-gate adding eBay to a store card.
const { data: prior, error: pErr } = await db.from('candidates')
  .select('id, external_ref, batch_id, margin, recommended_channels, image_url, decisions ( id )')
  .eq('tenant_id', tenant.id).in('external_ref', cards.map((c) => c.external_ref));
if (pErr) { console.error(`Duplicate check failed, nothing imported: ${pErr.message}`); process.exit(1); }

const { data: batch, error: bErr } = await db.from('batches').upsert({
  tenant_id: tenant.id, delivered_for: date, term, category_label: label, status: 'delivered',
  delivered_at: new Date().toISOString(), sources_used: ['google_best_sellers'], candidate_count: cards.length,
}, { onConflict: 'tenant_id,delivered_for,term' }).select().single();
if (bErr) { console.error('Batch failed:', bErr.message); process.exit(1); }

const decidedOf = (c) => (Array.isArray(c.decisions) ? c.decisions.length > 0 : Boolean(c.decisions));
const isStore = (c) => c.margin?.channel === 'store';
const byRef = new Map(cards.map((c) => [c.external_ref, c]));
// The store figures on top, the card's eBay reading kept whole under margin.ebay: the same shape a store card has after the gate.
const withStore = (card, storeCard) => {
  const m = storeCard.margin;
  // The eBay reading re-costed for the product's weight, when the store side knows it.
  const ebay = ebayAtWeight(card.margin?.channel === 'store' ? card.margin.ebay ?? null : card.margin ?? null, m.postage_band?.grams);
  return {
    ...m,
    ...(ebay ? {
      ebay: {
        ...ebay,
        shelf: m.cost_from ? { ...m.cost_from, price: m.cost } : ebay.shelf,
        match: m.cost != null ? { level: 'same_product_same_pack', via: 'the store card' } : ebay.match,
      },
    } : {}),
  };
};

const elsewhere = (prior ?? []).filter((p) => p.batch_id !== batch.id);
const own = new Map((prior ?? []).filter((p) => p.batch_id === batch.id).map((p) => [p.external_ref, p]));
// An eBay card this label already gave the shop to is refreshed like its own; a store card from another import is left.
const ours = (c) => !isStore(c) || c.margin?.store_import === term;
const otherStore = elsewhere.filter((c) => !ours(c)).length;
let gainedStore = 0;
let decidedEbay = 0;
for (const card of elsewhere) {
  if (!ours(card)) continue;
  if (decidedOf(card)) { decidedEbay += 1; continue; }
  const storeCard = byRef.get(card.external_ref);
  const channels = [...new Set(['store', 'ebay', ...(card.recommended_channels ?? [])])];
  const { error } = await db.from('candidates').update({
    recommended_channels: channels,
    margin: { ...withStore(card, storeCard), store_import: term },
    image_url: card.image_url ?? storeCard.image_url,
  }).eq('id', card.id);
  if (error) console.error(`  ${card.external_ref}: shop not added, ${error.message}`);
  else gainedStore += 1;
}
const skip = new Set(elsewhere.map((p) => p.external_ref));
const held = new Set([...own.values()].filter(decidedOf).map((p) => p.external_ref));

// A re-import refreshes her store figures but keeps what the gate added: the eBay label and the eBay reading.
const fresh = cards.filter((c) => !skip.has(c.external_ref) && !held.has(c.external_ref)).map((c) => {
  const was = own.get(c.external_ref);
  const onEbay = (was?.recommended_channels ?? []).includes('ebay') && was?.margin?.ebay;
  return {
    ...c,
    tenant_id: tenant.id,
    batch_id: batch.id,
    recommended_channels: onEbay ? ['store', 'ebay'] : c.recommended_channels,
    margin: onEbay ? withStore({ margin: was.margin }, c) : c.margin,
  };
});
if (gainedStore) console.log(`\n  ${gainedStore} eBay card${gainedStore === 1 ? '' : 's'} already in her queue labelled Shop as well, with the shop price added or refreshed`);
if (decidedEbay) console.log(`  ${decidedEbay} already decided by her as eBay cards, left exactly as they are`);
if (otherStore) console.log(`  ${otherStore} already store cards in another import, left there`);
if (held.size) console.log(`  ${held.size} already decided by her, left exactly as they are`);

const { error: cErr } = fresh.length
  ? await db.from('candidates').upsert(fresh, { onConflict: 'batch_id,external_ref' })
  : { error: null };
if (cErr) { console.error('Candidate upsert failed:', cErr.message); process.exit(1); }

const { count } = await db.from('candidates').select('id', { count: 'exact', head: true }).eq('batch_id', batch.id);
if (count != null) await db.from('batches').update({ candidate_count: count }).eq('id', batch.id);
console.log(`\n  "${label}" ${date}: ${fresh.length} written, ${count ?? fresh.length} in the batch.\n`);
