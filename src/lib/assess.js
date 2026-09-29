import {
  PROFIT, breakEvenFor, cheapestCost, ebayCosts, floorFor, keepAt as keepFor, listFor, marketAllows, positionOf, profitAt, storeCosts,
} from './pricing.js';

// Above this many variations the price is a blend.
export const BLENDED = 10;

// Mirrors maxFeedback in gate.js, for rows imported before entry carried its own.
const CEILING = 1000;

// Above this, the converting listing is usually a bigger pack than the shelf one.
const PACK_RATIO = 3.5;

const round = (v) => Math.round(v * 100) / 100;

export function keepAt(price, margin, goods) {
  const r = margin?.rates;
  if (!r || price == null) return null;
  return round(price * (1 - r.fvf - r.ad)
    - r.fixed
    - Number(margin.postage ?? 0)
    - Number(margin.packaging ?? 0)
    - Number(margin.returns_allowance ?? 0)
    - Number(goods ?? 0));
}

// keepAt solved for price.
export function priceFor(left, margin, goods) {
  const r = margin?.rates;
  if (!r || goods == null || left == null) return null;
  const fixed = r.fixed
    + Number(margin.postage ?? 0)
    + Number(margin.packaging ?? 0)
    + Number(margin.returns_allowance ?? 0);
  return round((fixed + Number(goods) + left) / (1 - r.fvf - r.ad));
}

// Butcher's found a 24 tin case on eBay against a 6 tin shelf pack.
export function packOf(name) {
  const t = String(name ?? '').toLowerCase();
  const m = t.match(/(\d+)\s?x\s?\d/)
    || t.match(/\bx\s?(\d+)\b/)
    || t.match(/(\d+)\s?(?:pack|pk|tins|trays|pouches|washes|tabs|tablets)\b/);
  return m ? Number(m[1]) : null;
}

// Shop tags as the shelves name them, shown as the shop's own name.
const SHOP_NAMES = {
  bmstores: 'B&M', hb: 'Home Bargains', 'hb-seasonal': 'Home Bargains', 'hb-costed': 'Home Bargains', savers: 'Savers',
  poundland: 'Poundland', theworks: 'The Works', toolstation: 'Toolstation', wickes: 'Wickes', lakeland: 'Lakeland',
  completecareshop: 'Complete Care Shop', essentialaids: 'Essential Aids', hannworld: 'Hannworld', maplin: 'Maplin',
  qdstores: 'QD Stores', cpc: 'CPC', hartsofstur: 'Harts of Stur', studio: 'Studio', johnlewis: 'John Lewis',
  homediscount: 'Home Discount', monstershop: 'MonsterShop', lights4fun: 'Lights4fun',
};
export const shopName = (tag) => SHOP_NAMES[tag] ?? tag;

// Where a card is for. Cards from before channels existed came from the eBay pipeline.
export function channelsOf(row) {
  const set = new Set(row?.recommended_channels ?? []);
  if (row?.margin?.channel === 'store') set.add('store');
  if (set.size === 0) set.add('ebay');
  return ['store', 'ebay'].filter((c) => set.has(c));
}

// A store card: her own price from the cheapest real cost (where it was seen, or a supplier she added).
function assessStore(row) {
  const m = row.margin ?? {};
  const d = row.draft ?? {};
  const g = m.google ?? {};
  const from = m.cost_from ?? {};
  const returns = Number(m.returns_allowance ?? 0);
  const steps = Array.isArray(m.profit_rule) ? m.profit_rule : PROFIT.store;
  const c = storeCosts({ postage: m.postage, packaging: m.packaging, returns, cardPct: m.card?.pct, cardFixed: m.card?.fixed });
  const best = cheapestCost({ seen: m.cost, seenFrom: shopName(from.shop) ?? 'Where it was seen', sources: row.sources ?? [] });
  const cost = best?.cost ?? null;
  const l = cost != null ? listFor(cost, g.min > 0 ? Number(g.min) : null, c, steps) : null;
  const price = d.price ?? l?.price ?? m.list_at ?? null;
  const floor = l?.floor ?? m.floor ?? null;
  const target = profitAt(price, steps);
  const keep = keepFor(price, cost, c);
  const fees = price != null ? round(price * c.pct + Number(m.card?.fixed ?? 0)) : null;
  const shops = (m.shops ?? []).map(shopName);
  const position = positionOf(price, { lowest: g.min > 0 ? Number(g.min) : null });
  const warnings = [
    cost == null && 'No price read where it was seen yet, so there is no list price.',
    shops.length === 1 && `Seen at one shop only, ${shops[0]}.`,
    keep != null && keep < 0 && 'Loses money at this price.',
    keep != null && keep >= 0 && floor != null && price < floor && `Under your floor of £${floor.toFixed(2)}, so it keeps less than your profit.`,
    m.postage_band?.basis === 'assumed' && 'No weight on file, so postage is costed as a small parcel (up to 2kg, 45 x 35 x 16cm). Check it fits before listing.',
  ].filter(Boolean);
  // The same card read as an eBay listing, once the gate has priced it for eBay. Its own price, never the shop's.
  const ebay = m.ebay ? assess({ ...row, margin: m.ebay, draft: { ...d, price: d.ebay_price ?? undefined } }) : null;
  return {
    store: true, m, d, g, price, keep, fees, shops, warnings, position,
    cost,
    costFrom: best,
    floor,
    breakEven: breakEvenFor(cost, c),
    target,
    ebay,
    channels: channelsOf(row),
    returns,
    goods: cost,
    best: best ? { supplier: best.from, url: best.url ?? from.url ?? null, landed_unit_cost: best.cost } : null,
    l: null,
    modelled: true,
    // An assumed postage is shown, not a block: most shelves carry no weight, and she can see the size.
    ready: warnings.length === (m.postage_band?.basis === 'assumed' ? 1 : 0) && price != null && (d.images ?? []).length > 0,
    postage: round(Number(m.postage ?? 0) + Number(m.packaging ?? 0) + returns),
    postageBand: m.postage_band ?? null,
    onEbay: (row.recommended_channels ?? []).includes('ebay'),
    entry: row.entry ?? null,
    lane: 'store',
    month: null,
    title: d.title ?? row.title,
    images: d.images ?? [],
    edited: Object.keys(d).length > 0,
  };
}

export function assess(row) {
  if (row.margin?.channel === 'store') return assessStore(row);
  const m = row.margin ?? {};
  const l = row.listing ?? null;
  const entry = row.entry ?? null;
  const d = row.draft ?? {};

  const shelf = m.shelf ?? null;
  // The shelf is a cost only when it is the proving seller's product and pack; otherwise it is a lead.
  const shelfIsCost = m.match?.level === 'same_product_same_pack';
  // Cheapest real cost: the shelf when it counts, or a supplier she added.
  const cheapest = cheapestCost({ seen: shelfIsCost ? shelf?.price ?? null : null, seenFrom: shopName(shelf?.shop) ?? 'the shelf', sources: row.sources ?? [] });
  const quoted = cheapest?.basis === 'supplier' ? (row.sources ?? []).find((s) => Number(s.landed_unit_cost) === cheapest.cost) ?? null : null;
  const best = quoted ?? (cheapest ? { supplier: cheapest.from, landed_unit_cost: cheapest.cost, url: shelf?.url ?? null } : null);

  const goods = cheapest?.cost ?? null;
  const modelled = Boolean(m.rates);
  const c = ebayCosts(m);
  const steps = PROFIT.ebay;
  // The market price she is measured against: the small seller converting when trusted, else the median.
  const market = m.sale_price ?? row.avg_sold_price ?? null;
  // Forward from a real cost; with none, from the most the market price allows the goods to cost.
  const assumed = goods == null && modelled ? marketAllows(market, c) : null;
  const priced = !modelled ? null
    : goods != null ? listFor(goods, market, c, steps)
      : assumed != null ? (() => { const f = floorFor(assumed, c, steps); return f ? { ...f, price: f.floor } : null; })()
        : null;
  const price = d.price ?? priced?.price ?? market;
  const costBasis = goods != null ? cheapest.basis : assumed != null ? 'market' : null;
  // keepAt treats a missing cost as zero, so the cost is always passed.
  const keep = modelled
    ? keepFor(price, goods ?? assumed, c)
    : (d.price == null ? m.net ?? null : null);

  const fees = modelled && price != null
    ? round(price * (m.rates.fvf + m.rates.ad) + m.rates.fixed)
    : (m.platform_fee ?? null);
  const postage = round((m.postage ?? 0) + (m.packaging ?? 0) + (m.returns_allowance ?? 0));

  const trusted = m.list_trusted === true;
  const target = modelled ? profitAt(price, steps) : m.target_profit ?? null;
  const shelfPack = packOf(l?.title);
  const marketPack = packOf(entry?.title);

  // Rate and price off the same listing, or no month at all.
  const perMonth = entry?.per_day != null ? Math.round(entry.per_day * 300) / 10 : null;
  const entryKeep = modelled && goods != null ? keepFor(entry?.price ?? null, goods, c) : null;
  const ref = entry?.price ?? price;
  const ratio = goods > 0 && ref != null ? Math.round((ref / goods) * 10) / 10 : null;
  // A shelf matched on brand and pack has already had its pack checked.
  const packCheck = ratio != null && ratio > PACK_RATIO && !(shelfIsCost && !quoted);

  const entryLoses = Boolean(entry?.proved) && entryKeep != null && entryKeep <= 0;
  const ceiling = entry?.ceiling ?? CEILING;
  // Not proved can mean a small seller barely selling, or only big accounts selling. Different facts.
  const entryThin = Boolean(entry) && !entry.proved && entry.seller_feedback != null && entry.seller_feedback <= ceiling;
  // A rate from what may be a different pack is not this product's rate.
  const month = entry?.proved && perMonth != null && entryKeep > 0 && !packCheck
    ? round(entryKeep * perMonth)
    : null;

  const warnings = [
    shelfPack && marketPack && shelfPack !== marketPack
      && `Shelf pack holds ${shelfPack}, the listing this price came from holds ${marketPack}.`,
    !trusted && d.price == null && 'Priced at the market median, which no small seller has been paid.',
    l?.in_stock === 'no' && 'Out of stock at the shop.',
    row.variation_count >= BLENDED && `Sold in ${row.variation_count} variations, so the price is an average.`,
    row.bulky && 'Costed as a small parcel and this one is bulky.',
    packCheck && `Converting at ${ratio} times the shelf price. Check it is the same pack.`,
    keep != null && keep < 0 && 'Loses money at this price.',
    costBasis === 'market' && `Priced as if it costs £${assumed.toFixed(2)}, the most the eBay price allows. Price it at ${shelf?.shop ? shopName(shelf.shop) : 'a UK shop'} to bring this down.`,
    modelled && goods == null && assumed == null && market != null && 'The eBay price does not cover fees and postage, so no cost can pay here.',
  ].filter(Boolean);

  // Short of the profit is a fact about a real cost; a price built on the market's allowance keeps it by construction.
  const short = goods != null && keep != null && target != null && keep < target;
  const position = positionOf(price, { median: row.competition?.median ?? m.market_median ?? null, entry: entry?.proved ? entry.price : null });

  return {
    channels: channelsOf(row),
    m, l, entry, d, best, goods, price, keep, fees, postage, modelled, trusted, warnings, position,
    costBasis, assumed, costFrom: cheapest, market,
    target, perMonth, entryKeep, entryLoses, entryThin, month, ratio, packCheck, shelfIsCost,
    match: m.match ?? null,
    ceiling,
    breakEven: breakEvenFor(goods ?? assumed, c),
    floor: priced?.floor ?? null,
    lane: short ? 'short' : entry?.proved && trusted && !packCheck && !entryLoses ? 'ready' : 'call',
    ready: warnings.length === 0 && entry?.proved === true && keep != null && keep > 0,
    title: d.title ?? l?.title ?? row.title,
    images: d.images ?? l?.images ?? [],
    edited: Object.keys(d).length > 0,
  };
}
