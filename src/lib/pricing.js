/*
 * One price model for both channels. The portal and the import scripts read this file, so the figure on
 * her card and the figure a script prints can never disagree.
 *
 * Forward, when a real cost is known (the shop page, the page reader, or a supplier she added, cheapest wins):
 *   floor = (cost + per-order costs + profit) / (1 - the channel's percentage fees), rounded up to .49 or .99
 *   list at the market price when it clears the floor, otherwise at the floor, and say where that sits.
 *
 * With no real cost yet (eBay only): the most the goods could cost is everything the market price leaves
 * after fees and postage at no profit. Priced from that, her price always sits above the market price by
 * about profit / (1 - fees). A real cost found later can only bring it down. That figure is never a cost:
 * it is stored and shown as "the most the market allows".
 */

export const round2 = (v) => Math.round(v * 100) / 100;

// Up to the next .49 or .99, the way shop prices read.
export const upToPrice = (v) => {
  const w = Math.floor(v + 1e-9);
  return v <= w + 0.49 + 1e-9 ? w + 0.49 : w + 0.99;
};

// Profit in pounds, stepped by the price it lists at. Keeper may suggest more, up to KEEPER_MAX_PROFIT.
export const PROFIT = {
  store: [{ below: 15, profit: 2 }, { profit: 3 }],
  ebay: [{ below: 15, profit: 3 }, { below: 30, profit: 4 }, { profit: 5 }],
};
export const KEEPER_MAX_PROFIT = 10;

// Her own shop: Stripe's UK card rate, and one order in twenty back at about £8.
export const STORE = { cardPct: 0.015, cardFixed: 0.2, returns: 0.4 };

// Royal Mail Tracked 48 online prices, checked 29 Sept 2026. Small parcel 45x35x16cm, medium 61x46x46cm.
export const STORE_BANDS = [
  { key: 'rm-small', upTo: 2000, postage: 3.65, packaging: 0.3, label: 'Royal Mail small parcel, to 2kg' },
  { key: 'rm-medium-10', upTo: 10000, postage: 7.35, packaging: 0.5, label: 'Royal Mail medium parcel, to 10kg' },
  { key: 'rm-medium-20', upTo: 20000, postage: 11.85, packaging: 0.6, label: 'Royal Mail medium parcel, to 20kg' },
];

// eBay: the same Evri bands the gate uses (scripts/lib/cost.js), picked by weight. Evri stops at 15kg.
export const EBAY_BANDS = [
  { key: 'evri5', upTo: 5000, postage: 2.62, packaging: 0.4, label: 'Evri to 5kg' },
  { key: 'evri10', upTo: 10000, postage: 5.87, packaging: 0.5, label: 'Evri 5 to 10kg' },
  { key: 'evri15', upTo: 15000, postage: 9.01, packaging: 0.6, label: 'Evri 10 to 15kg' },
  { key: 'rm-medium-20', upTo: 20000, postage: 11.85, packaging: 0.6, label: 'Royal Mail medium parcel, to 20kg' },
];

// The band a weight falls in. No weight: the first band, marked assumed. Over the last band: null, not postable.
export function bandFor(grams, bands) {
  const g = Number(grams);
  if (!(g > 0)) return { ...bands[0], grams: null, basis: 'assumed' };
  const b = bands.find((x) => g <= x.upTo);
  return b ? { ...b, grams: g, basis: 'weight' } : null;
}
export const storeBandFor = (grams) => bandFor(grams, STORE_BANDS);
export const ebayBandFor = (grams) => bandFor(grams, EBAY_BANDS);

// A channel's costs as two numbers: the share of the price taken, and the pounds taken per order, goods aside.
export function storeCosts({ postage, packaging, returns = STORE.returns, cardPct = STORE.cardPct, cardFixed = STORE.cardFixed }) {
  return { pct: cardPct, fixed: round2(cardFixed + Number(postage ?? 0) + Number(packaging ?? 0) + Number(returns ?? 0)) };
}
// The eBay margin a gate row carries: rates, postage, packaging and returns allowance.
export function ebayCosts(margin) {
  const r = margin?.rates;
  if (!r) return null;
  return {
    pct: r.fvf + r.ad,
    fixed: round2(r.fixed + Number(margin.postage ?? 0) + Number(margin.packaging ?? 0) + Number(margin.returns_allowance ?? 0)),
  };
}

export const keepAt = (price, cost, c) => (price == null || cost == null || !c ? null : round2(price * (1 - c.pct) - c.fixed - cost));
export const breakEvenFor = (cost, c) => (cost == null || !c ? null : round2((cost + c.fixed) / (1 - c.pct)));

// The lowest price that pays the profit for the step it lands in.
export function floorFor(cost, c, steps) {
  if (cost == null || !(cost >= 0) || !c) return null;
  for (const s of steps) {
    const floor = upToPrice((cost + c.fixed + s.profit) / (1 - c.pct));
    if (s.below == null || floor < s.below) return { floor, profit: s.profit };
  }
  return null;
}

// What it lists at: the market price when that clears the floor, otherwise the floor.
export function listFor(cost, market, c, steps) {
  const f = floorFor(cost, c, steps);
  if (!f) return null;
  const onMarket = market != null && market >= f.floor;
  const price = onMarket ? round2(market) : f.floor;
  return { ...f, price, onMarket, keep: keepAt(price, cost, c) };
}

// With no real cost: everything the market price leaves after fees and postage, at no profit.
export function marketAllows(marketPrice, c) {
  if (marketPrice == null || !c) return null;
  const v = round2(marketPrice * (1 - c.pct) - c.fixed);
  return v > 0 ? v : null;
}

// A row saved by "Same item and pack" says the shelf price is the same pack. It is not a supplier. Rows from
// before matched_on was written carry the note that button wrote.
export const isPackCheck = (s) => s?.matched_on === 'shelf' || /checked by eye/i.test(String(s?.note ?? ''));

// The cost a card is priced from. A supplier she added is where it will be bought, so her cost wins whether it is
// under or over the shelf price, the cheapest of hers when there are several; one asked but not yet priced does
// not count. Only with no supplier of hers does the shelf price stand in, confirmed once the pack is checked.
export function cheapestCost({ seen = null, seenFrom = null, seenConfirmed = true, sources = [] }) {
  const hers = sources
    .filter((s) => !isPackCheck(s) && s.landed_unit_cost != null && Number(s.landed_unit_cost) > 0)
    .map((s) => ({ cost: Number(s.landed_unit_cost), from: s.supplier_name ?? s.supplier ?? s.name ?? 'Your supplier', url: s.url ?? s.product_url ?? null, basis: 'supplier', fulfilment: s.fulfilment ?? 'dropship' }))
    .sort((a, b) => a.cost - b.cost);
  const shelf = seen != null && Number(seen) > 0 ? Number(seen) : null;
  if (hers.length) return { ...hers[0], shelf, confirmed: true };
  if (shelf == null) return null;
  const checked = seenConfirmed || sources.some(isPackCheck);
  return { cost: shelf, from: seenFrom ?? 'Where it was seen', url: null, basis: 'seen', shelf, confirmed: checked };
}

// Where a price sits against the market, read at a glance. One reference per channel: Google's lowest on the
// shop; on eBay the cheapest small seller who is converting (the price someone her size is paid), else the
// median. `short` fits under a figure (under 18 characters); `text` is the full sentence for the opened card.
export function positionOf(price, { median = null, entry = null, lowest = null } = {}) {
  if (price == null) return null;
  const gbp = (v) => `£${Number(v).toFixed(2)}`;
  const ref = lowest ?? entry ?? median;
  if (ref == null) return null;
  const over = round2(price - ref);
  const inMarket = over <= 0.009;
  const refName = lowest != null ? "Google's lowest" : entry != null ? 'the cheapest seller who is selling' : 'the eBay median';
  const parts = [inMarket ? `At or under ${refName} (${gbp(ref)})` : `${gbp(over)} over ${refName} (${gbp(ref)})`];
  if (lowest == null && entry != null && median != null) {
    const m = round2(price - median);
    parts.push(m > 0.009 ? `${gbp(m)} over the median of ${gbp(median)}` : `${gbp(-m)} under the median of ${gbp(median)}`);
  }
  return {
    inMarket,
    ref,
    refName,
    // The gap as a share of the reference, so one scale reads the same on every row.
    pct: Math.round((over / ref) * 1000) / 1000,
    over: inMarket ? 0 : over,
    tone: inMarket ? 'positive' : 'warning',
    short: inMarket ? 'In the market' : `+${gbp(over)} over`,
    text: `${parts.join('; ')}.`,
  };
}

// An eBay reading costed at the gate's run band, re-costed for a known weight. No weight: left as the gate costed it.
export function ebayAtWeight(ebay, grams) {
  if (!ebay) return ebay;
  const b = ebayBandFor(grams);
  if (!b || b.basis !== 'weight') return { ...ebay, postage_basis: b ? 'run band' : 'over 20kg' };
  return { ...ebay, postage: b.postage, packaging: b.packaging, band: b.key, band_label: b.label, headroom_band: b.key, postage_basis: 'weight', grams: b.grams };
}

// A supplier's cost by the time a unit is ready to sell. The same sum as candidate_sources.landed_unit_cost
// (0026), so a figure she tries is the figure the database stores. Null until there is a price.
export function landedOf({ fulfilment = 'dropship', unit_cost = null, price_at_moq = null, supplier_shipping = null, inbound_freight_per_unit = null, duty_pct = null }) {
  const n = (v) => (v == null || v === '' ? null : Number(v));
  const goods = n(price_at_moq) ?? n(unit_cost);
  if (goods == null || !Number.isFinite(goods)) return null;
  if (fulfilment === 'stock') return round2(goods * (1 + (n(duty_pct) ?? 0)) + (n(inbound_freight_per_unit) ?? 0));
  return round2(goods + (n(supplier_shipping) ?? 0));
}

// A channel's costs when the supplier posts to the buyer (0023): her postage and packing drop out, since the
// supplier's postage is inside the landed cost. The returns allowance stays; returns happen whoever posts.
export function dropshipCosts(c, { postage = 0, packaging = 0 } = {}) {
  if (!c) return null;
  return { pct: c.pct, fixed: round2(c.fixed - Number(postage ?? 0) - Number(packaging ?? 0)) };
}

// The profit a price's step asks for.
export const profitAt = (price, steps) => (price == null ? null : (steps.find((s) => s.below == null || price < s.below) ?? steps[steps.length - 1]).profit);

// Down to the last .49 or .99 at or under a price: the dearest floor that still lists on it.
export const downToPrice = (v) => {
  const w = Math.floor(v + 1e-9);
  if (v >= w + 0.99 - 1e-9) return w + 0.99;
  if (v >= w + 0.49 - 1e-9) return w + 0.49;
  return w - 0.01;
};

// The most the goods can cost and still list on a market price with the full profit.
export function goodsToList(market, c, steps) {
  if (market == null || !c) return null;
  const top = downToPrice(market);
  if (top <= 0) return null;
  const v = Math.floor((top * (1 - c.pct) - c.fixed - profitAt(top, steps)) * 100 + 1e-6) / 100;
  return v > 0 ? v : null;
}
