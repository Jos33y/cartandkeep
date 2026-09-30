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
import { PROFIT, STORE, ebayAtWeight } from '../../src/lib/pricing.js';
import { priceStore } from './price-store.mjs';
import { withVat } from './page.mjs';
import { categorise } from '../categories/categorise.mjs';
import path from 'node:path';
import { buildCoverage, printCoverage, readCoverageFiles, writeCoverage } from './coverage.mjs';
import { postCheckOf, stopOf } from './rules/index.mjs';

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

const rows = parseCsv(fs.readFileSync(picksPath, 'utf8'));
const tally = { read: rows.length, stopped_by_rules: 0, wrong_match: 0, unsure_match: 0, not_checked: 0, big_brand: 0, no_price: 0, bigger_pack: 0, over_20kg: 0, kept: 0 };
const bandCount = {};
const cards = [];
const seenRefs = new Set();

for (const r of rows) {
  // The rules again, so a picks file made before a rule was added cannot bring in what the rule now stops.
  if (stopOf({ title: r.title, brand: r.brand, category: r.category || label })) { tally.stopped_by_rules += 1; continue; }
  const verdict = String(r.verdict ?? '');
  if (/^wrong/.test(verdict)) { tally.wrong_match += 1; continue; }
  if (/^unsure/.test(verdict) && !withUnsure) { tally.unsure_match += 1; continue; }
  if (!/^confirmed/.test(verdict) && !/^unsure/.test(verdict) && !withUnsure) { tally.not_checked += 1; continue; }
  if (r.big_brand === 'yes' && !r.need && !bigBrands) { tally.big_brand += 1; continue; }
  // The shelf price is the shop's own figure: a VAT-relief or trade shop's gains VAT here. The page price already has it.
  const shelfCost = withVat(r.seen_price, r.seen_link)?.price ?? null;
  const cost = shelfCost ?? (Number(r.page_price) > 0 ? Number(r.page_price) : null);
  if (cost == null && !withoutPrice) { tally.no_price += 1; continue; }
  // A cost over twice Google's highest price is a bigger pack or another model: the page check read the wrong thing.
  if (cost != null && Number(r.google_max) > 0 && cost > Number(r.google_max) * 2) { tally.bigger_pack += 1; continue; }
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
      post: r.post || postCheckOf(r.title) || null,
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

if (!cards.length) { console.error('\n  Nothing to import.\n'); process.exit(1); }

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

// A card made before the key rule changed (match.mjs queryOf) is found by its title and keeps its old key, so a
// better key never turns her existing card into a second one.
{
  const titles = [...new Set(cards.map((c) => c.title))];
  const byTitle = new Map();
  for (let i = 0; i < titles.length; i += 100) {
    const { data } = await db.from('candidates').select('external_ref, title').eq('tenant_id', tenant.id).in('title', titles.slice(i, i + 100));
    for (const c of data ?? []) if (!byTitle.has(c.title)) byTitle.set(c.title, c.external_ref);
  }
  let rekeyed = 0;
  const taken = new Set(cards.map((c) => c.external_ref));
  for (const c of cards) {
    const old = byTitle.get(c.title);
    if (old && old !== c.external_ref && !taken.has(old)) { taken.delete(c.external_ref); c.external_ref = old; taken.add(old); rekeyed += 1; }
  }
  if (rekeyed) console.log(`\n  ${rekeyed} card${rekeyed === 1 ? '' : 's'} already in her queue under an older key, matched by title and kept on it`);
}

// A product already in her queue under another batch is the same card twice, so no second card is made.
// If that card is an eBay card she has not decided, it gains the shop: the mirror of import-gate adding eBay to a store card.
// Asked 100 references at a time: all 578 in one request made a URL too long for the server, and the request failed.
const prior = [];
{
  const refs = cards.map((c) => c.external_ref);
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error: pErr } = await db.from('candidates')
      .select('id, external_ref, batch_id, margin, recommended_channels, image_url, decisions ( id )')
      .eq('tenant_id', tenant.id).in('external_ref', refs.slice(i, i + 100));
    if (pErr) { console.error(`Duplicate check failed, nothing imported: ${pErr.message}`); process.exit(1); }
    prior.push(...(data ?? []));
  }
}

// The dry run reads her queue too (never writes), so it says how many cards are new, not only how many passed.
if (dry) {
  const { data: past } = await db.from('batches').select('id, delivered_for').eq('tenant_id', tenant.id).eq('term', term).order('delivered_for');
  const target = (past ?? []).find((b) => b.delivered_for === date);
  const dateOf = new Map((past ?? []).map((b) => [b.id, b.delivered_for]));
  const inQueue = new Map();
  for (const p of prior) if (!inQueue.has(p.external_ref)) inQueue.set(p.external_ref, p);
  const tallyQ = { new: 0, sameBatch: 0, sameBatchDecided: 0, storeElsewhere: 0, ebayUndecided: 0, ebayDecided: 0 };
  const byBatch = {};
  for (const c of cards) {
    const p = inQueue.get(c.external_ref);
    if (!p) { tallyQ.new += 1; continue; }
    const decided = Array.isArray(p.decisions) ? p.decisions.length > 0 : Boolean(p.decisions);
    if (target && p.batch_id === target.id) { tallyQ[decided ? 'sameBatchDecided' : 'sameBatch'] += 1; continue; }
    if (p.margin?.channel === 'store' && p.margin?.store_import !== term) {
      tallyQ.storeElsewhere += 1;
      const d = dateOf.get(p.batch_id) ?? 'another label';
      byBatch[d] = (byBatch[d] ?? 0) + 1;
      continue;
    }
    tallyQ[decided ? 'ebayDecided' : 'ebayUndecided'] += 1;
  }
  console.log(`\n  Her queue, read only. "${term}" batches: ${(past ?? []).map((b) => b.delivered_for).join(', ') || 'none'}; this import ${target ? `refreshes the ${date} batch` : `makes a new ${date} batch`}`);
  console.log(`    new cards                          ${tallyQ.new}`);
  if (tallyQ.sameBatch) console.log(`    in the ${date} batch, refreshed       ${tallyQ.sameBatch}`);
  if (tallyQ.sameBatchDecided) console.log(`    in the ${date} batch, decided, left   ${tallyQ.sameBatchDecided}`);
  if (tallyQ.storeElsewhere) console.log(`    store cards already, left there    ${tallyQ.storeElsewhere} (${Object.entries(byBatch).map(([k, v]) => `${k}: ${v}`).join(', ')})`);
  if (tallyQ.ebayUndecided) console.log(`    eBay cards, gain the Shop label    ${tallyQ.ebayUndecided}`);
  if (tallyQ.ebayDecided) console.log(`    eBay cards she decided, left       ${tallyQ.ebayDecided}`);
  console.log('\n  Dry run, nothing written.\n');
  process.exit(0);
}

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
const gainedIds = [];
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
  else { gainedStore += 1; gainedIds.push(card.id); }
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

// Written 100 at a time, so one large request never fails the whole import.
const written = [];
for (let i = 0; i < fresh.length; i += 100) {
  const { data: got, error: cErr } = await db.from('candidates').upsert(fresh.slice(i, i + 100), { onConflict: 'batch_id,external_ref' }).select('id, external_ref, margin');
  if (cErr) { console.error(`Candidate upsert failed after ${i} cards: ${cErr.message}. Rerun to finish; written cards are refreshed, not doubled.`); process.exit(1); }
  written.push(...(got ?? []));
}

// A Royal Mail limit goes on her card as a note, once, so she sees it without a portal change.
{
  const withPost = written.filter((c) => c.margin?.post);
  const bodyOf = (c) => `Postage: ${c.margin.post}.`;
  let added = 0;
  for (let i = 0; i < withPost.length; i += 100) {
    const slice = withPost.slice(i, i + 100);
    const { data: have } = await db.from('candidate_notes').select('candidate_id, body').in('candidate_id', slice.map((c) => c.id));
    const known = new Set((have ?? []).map((n) => `${n.candidate_id}|${n.body}`));
    const rowsToAdd = slice.filter((c) => !known.has(`${c.id}|${bodyOf(c)}`)).map((c) => ({ tenant_id: tenant.id, candidate_id: c.id, body: bodyOf(c) }));
    if (!rowsToAdd.length) continue;
    const { error: nErr } = await db.from('candidate_notes').insert(rowsToAdd);
    if (nErr) console.error(`  Postage notes not added: ${nErr.message}`); else added += rowsToAdd.length;
  }
  if (added) console.log(`  ${added} postage note${added === 1 ? '' : 's'} added (aerosol, perfume, battery limits)`);
}

const { count } = await db.from('candidates').select('id', { count: 'exact', head: true }).eq('batch_id', batch.id);
if (count != null) await db.from('batches').update({ candidate_count: count }).eq('id', batch.id);
console.log(`\n  "${label}" ${date}: ${fresh.length} written, ${count ?? fresh.length} in the batch.`);

// Google category and source labels: the export's top category, made specific from the title. Hers never move.
try {
  const { tally } = await categorise(db, tenant.id, { batchIds: [batch.id] });
  if (gainedIds.length) await categorise(db, tenant.id, { ids: gainedIds });
  console.log(`  Categories: ${tally.set} set, ${tally.deeper} made more specific, ${tally.ai_calls} classification calls\n`);
} catch (e) {
  console.error(`  Categories not set (${e.message}). Run scripts/categories/fill-categories.mjs once the migration is in.\n`);
}

// Coverage: every Google product in the exports and where it stopped, written beside the cards. store-picks writes
// coverage.csv next to the picks; --coverage= points elsewhere. Without it, say so rather than skip silently.
const coveragePath = arg('coverage', path.join(path.dirname(picksPath), 'coverage.csv'));
if (!fs.existsSync(coveragePath)) {
  console.log(`  Coverage not written: no ${coveragePath}. Run store-picks for this category, then scripts/store/store-coverage.mjs --label="${label}" --apply.\n`);
} else {
  try {
    const { rows: covRows, checked } = readCoverageFiles(coveragePath, picksPath);
    const built = await buildCoverage({ db, tenantId: tenant.id, batchId: batch.id, rows: covRows, checked });
    printCoverage(label, built.list, built);
    await writeCoverage(db, built.list);
    console.log(`  Written ${built.list.length} coverage rows.\n`);
  } catch (e) {
    console.error(`  Coverage not written (${e.message}). Rerun with scripts/store/store-coverage.mjs --label="${label}" --apply.\n`);
  }
}
