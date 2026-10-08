import { assess } from './assess.js';
import { ebayFeeRate } from './ebayAccount.js';
import { STORE, atParcel, storeBandFor } from './pricing.js';

/*
 * A live listing's prices worked out from its cost (Joseey, 4 October: "since its cost change it should
 * automatically adjust the listing prices"). Each channel on its own terms, through the same assess the cards use:
 * eBay from eBay's fees and postage, the shop from the card fee alone. For each: the lowest price that keeps her
 * profit (`floor`), and what she keeps at any price (`keepAt`). Null for a channel the card cannot price, and for a
 * listing with no card at all (made in Seller Hub), where only eBay's fee can be shown.
 */

const isStore = (card) => card?.margin?.channel === 'store';
const postedFor = (card) => {
  const hers = (card?.sources ?? []).filter((s) => Number(s.landed_unit_cost) > 0)
    .sort((a, b) => Number(a.landed_unit_cost) - Number(b.landed_unit_cost));
  return hers[0]?.fulfilment === 'stock' ? 'you' : 'supplier';
};

// The card read as an eBay listing at a price: its own margin, or a shop card's eBay reading.
function ebayRow(card, price) {
  const d = { ...(card.draft ?? {}), price };
  if (isStore(card)) return card.margin?.ebay ? { ...card, margin: card.margin.ebay, draft: d } : null;
  return card.margin?.rates ? { ...card, draft: d } : null;
}

// The card read as a shop product at a price. An eBay card has no shop margin, so one is made from the shop's own
// rates and the parcel band, priced from the same cost.
function shopRow(card, price) {
  if (isStore(card)) return { ...card, draft: { ...(card.draft ?? {}), price } };
  const m = card.margin ?? {};
  const band = storeBandFor(null);
  const margin = atParcel({
    channel: 'store', postage: band.postage, packaging: band.packaging, postage_band: band,
    returns_allowance: STORE.returns, cost: m.shelf?.price ?? null, google: {},
  }, card.draft?.package?.weight_kg, true);
  return { ...card, margin, draft: { ...(card.draft ?? {}), price } };
}

function priced(rowAt, card, cost) {
  const opts = { holdPrice: true, tryCost: cost ?? null, tryPosted: postedFor(card) };
  const at = (price) => {
    const row = rowAt(price);
    return row ? assess(row, opts) : null;
  };
  const a = at(null);
  if (!a || (a.goods == null && a.cost == null)) return null;
  return {
    cost: a.goods ?? a.cost ?? null,
    // Whether that cost is known (a supplier of hers, or a pack she checked) or the shelf standing in.
    confirmed: Boolean(a.costConfirmed),
    from: a.costFrom?.from ?? null,
    floor: a.floor ?? null,
    breakEven: a.breakEven ?? null,
    keepAt: (price) => (Number(price) > 0 ? at(Number(price))?.keep ?? null : null),
  };
}

export function pricesFor(card, { cost = null } = {}) {
  if (!card) return { ebay: null, shop: null };
  const c = Number(cost) > 0 ? Number(cost) : null;
  const shop = priced((p) => shopRow(card, p), card, c);
  // A shop card's eBay reading carries no cost of its own: the shop's cost is what she pays either way.
  const ebay = priced((p) => ebayRow(card, p), card, c ?? (isStore(card) ? shop?.cost ?? null : null));
  // A shop card's eBay reading is priced from the shop's cost, passed in as a figure: say where that cost came from,
  // not "At that cost".
  if (ebay && shop && isStore(card) && c == null) Object.assign(ebay, { from: shop.from, confirmed: shop.confirmed });
  return { ebay, shop };
}

// eBay's take at a price for a listing with no card: the tenant's rates, with the defaults the Listings page uses. On a
// private account, the listing's ad rate alone (lib/ebayAccount.js).
export const ebayFeeAt = (price, fees, listingId = null) => {
  if (!(Number(price) > 0)) return null;
  const r = ebayFeeRate(fees, listingId);
  return Math.round((Number(price) * r.pct + r.fixed) * 100) / 100;
};
