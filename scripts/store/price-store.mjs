// The store figures for one product, shared by import-store and resource so a repointed card is priced like a new one.
import { PROFIT, listFor, storeBandFor, storeCosts } from '../../src/lib/pricing.js';

// Band from its weight, floor from its cost, list at Google's lowest when that clears it. Over 20kg: no band.
export function priceStore(cost, googleMin, grams) {
  const band = storeBandFor(grams);
  if (!band) return { band: null };
  const c = storeCosts({ postage: band.postage, packaging: band.packaging });
  const market = googleMin > 0 ? googleMin : null;
  const l = cost != null ? listFor(cost, market, c, PROFIT.store) : null;
  return { band, costs: c, list: l, aboveMarket: Boolean(l && market != null && !l.onMarket) };
}
