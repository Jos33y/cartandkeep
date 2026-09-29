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

// Cheapest real cost: the price where it was seen (when it counts as a cost) or any supplier she added.
export function cheapestCost({ seen = null, seenFrom = null, sources = [] }) {
  const quoted = sources
    .filter((s) => s.landed_unit_cost != null && Number(s.landed_unit_cost) > 0)
    .map((s) => ({ cost: Number(s.landed_unit_cost), from: s.supplier_name ?? s.supplier ?? s.name ?? 'Your supplier', url: s.url ?? s.product_url ?? null, basis: 'supplier' }));
  const all = [...(seen != null && Number(seen) > 0 ? [{ cost: Number(seen), from: seenFrom ?? 'Where it was seen', basis: 'seen' }] : []), ...quoted];
  if (!all.length) return null;
  all.sort((a, b) => a.cost - b.cost);
  const best = all[0];
  const beaten = best.basis === 'supplier' && seen != null && Number(seen) > best.cost ? Number(seen) : null;
  return { ...best, beaten };
}

// Where a price sits against the market, in her words. Amber is "look at this", never a block.
export function positionOf(price, { median = null, entry = null, lowest = null } = {}) {
  if (price == null) return null;
  const gbp = (v) => `£${Number(v).toFixed(2)}`;
  if (lowest != null) {
    const d = round2(price - lowest);
    return d > 0.009
      ? { tone: 'warning', short: `${gbp(d)} over Google's lowest`, text: `${gbp(d)} over Google's lowest price of ${gbp(lowest)}.` }
      : { tone: 'positive', short: "at Google's lowest", text: `At or under Google's lowest price of ${gbp(lowest)}.` };
  }
  if (median == null && entry == null) return null;
  const overMedian = median != null ? round2(price - median) : null;
  const overEntry = entry != null ? round2(price - entry) : null;
  const parts = [];
  if (overMedian != null) parts.push(overMedian > 0.009 ? `${gbp(overMedian)} over the eBay median of ${gbp(median)}` : `${gbp(-overMedian)} under the eBay median of ${gbp(median)}`);
  if (overEntry != null && overEntry > 0.009) parts.push(`${gbp(overEntry)} over the cheapest seller who is selling (${gbp(entry)})`);
  const above = (overMedian != null && overMedian > 0.009) || (overEntry != null && overEntry > 0.009);
  const short = overMedian != null && overMedian > 0.009 ? `${gbp(overMedian)} over the median`
    : overEntry != null && overEntry > 0.009 ? `${gbp(overEntry)} over the cheapest seller`
      : 'in the market';
  return { tone: above ? 'warning' : 'positive', short, text: `${parts.join('; ')}.`.replace(/^./, (x) => x.toUpperCase()) };
}

// An eBay reading costed at the gate's run band, re-costed for a known weight. No weight: left as the gate costed it.
export function ebayAtWeight(ebay, grams) {
  if (!ebay) return ebay;
  const b = ebayBandFor(grams);
  if (!b || b.basis !== 'weight') return { ...ebay, postage_basis: b ? 'run band' : 'over 20kg' };
  return { ...ebay, postage: b.postage, packaging: b.packaging, band: b.key, band_label: b.label, headroom_band: b.key, postage_basis: 'weight', grams: b.grams };
}

// The profit a price's step asks for.
export const profitAt = (price, steps) => (price == null ? null : (steps.find((s) => s.below == null || price < s.below) ?? steps[steps.length - 1]).profit);
