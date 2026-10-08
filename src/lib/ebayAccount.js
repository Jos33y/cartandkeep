/*
 * The eBay account she sells on, and what it does to every eBay figure (Joseey, 8 October 2026).
 *
 *   private   no selling fee and no per-order fee. eBay adds its Buyer Protection fee on top of her price, paid by
 *             the buyer, so it is shown ("Buyers see") and never taken from her price. What she does pay is the ad
 *             rate on a promoted sale: the listing's own rate from her campaigns, or for a card not listed yet the
 *             rate she usually runs.
 *   business  the cards' own rates, as before: 12.8% plus 30p an order and the ad rate the research costed.
 *
 * No imports, so the scripts can read this file as the portal does: the reads live in ebayAccountRead.js.
 *
 * Read once with the tenant, before any portal page draws (PortalProtected), so assess() can stay synchronous. The
 * switch is hers, in Settings; with no choice made it follows what eBay says the account is. A charge on a promoted
 * sale is only taken when the sale came from the ad, so costing every sale at the rate errs on the safe side.
 */

const round = (v) => Math.round(v * 100) / 100;

let state = {
  type: 'business',
  chosen: null,
  ebayType: null,
  username: null,
  typical: null,
  campaigns: [],
  campaignsRead: false,
  fees: null,
  readAt: null,
  readError: null,
  adsRead: false,
  ads: new Map(),
  loaded: false,
};

const listeners = new Set();
const tell = () => { for (const f of listeners) f(state); };
export const onEbayAccount = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const ebayAccount = () => state;
export const isPrivate = () => state.type === 'private';

// Her choice; with none, what eBay says; with neither, business, the model every card was costed on.
export const typeOf = (row) => row?.seller_type ?? (row?.ebay_type === 'INDIVIDUAL' ? 'private' : 'business');

export function applyEbayAccount(row, ads) {
  state = {
    ...state,
    type: typeOf(row),
    chosen: row?.seller_type ?? null,
    ebayType: row?.ebay_type ?? null,
    username: row?.username ?? null,
    typical: row?.typical_ad != null ? Number(row.typical_ad) : null,
    campaigns: Array.isArray(row?.campaigns) ? row.campaigns : [],
    campaignsRead: Array.isArray(row?.campaigns),
    fees: row?.fees ?? null,
    readAt: row?.read_at ?? null,
    readError: row?.read_error ?? null,
    // The campaigns were read once at least, so a listing missing from them is not promoted.
    adsRead: Boolean(row?.read_at) && Array.isArray(row?.campaigns),
    ads: ads ? new Map(ads.map((a) => [String(a.listing_id), { rate: Number(a.rate), campaign: a.campaign_name ?? null }])) : state.ads,
    loaded: true,
  };
  tell();
  return state;
}

/*
 * The ad rate a listing costs, and where it came from:
 *   listing  in one of her running campaigns, at its own rate
 *   none     listed and not promoted: nothing
 *   usual    not listed yet: the rate she usually runs
 *   card     nothing read from eBay yet: the rate the card was costed with
 */
export function adFor(listingId, cardAd = 0) {
  const id = listingId != null ? String(listingId) : null;
  const hit = id ? state.ads.get(id) : null;
  if (hit) return { rate: hit.rate, from: 'listing', campaign: hit.campaign };
  if (id && state.adsRead) return { rate: 0, from: 'none', campaign: null };
  if (state.adsRead) return { rate: state.typical ?? 0, from: state.typical != null ? 'usual' : 'none', campaign: null };
  return { rate: Number(cardAd) || 0, from: 'card', campaign: null };
}

// A card's eBay rates for the account. Business keeps them as they are.
export function ratesFor(rates, listingId) {
  if (!rates || state.type !== 'private') return rates;
  const ad = adFor(listingId, rates.ad);
  return { fvf: 0, ad: ad.rate, fixed: 0, private: true, adFrom: ad.from, campaign: ad.campaign };
}

// A margin with its rates for the account.
export function forAccount(m, listingId) {
  if (!m?.rates || state.type !== 'private') return m;
  return { ...m, rates: ratesFor(m.rates, listingId) };
}

// The tenant's eBay fee as a share and a fixed charge, for figures with no card (Listings, Products).
export function ebayFeeRate(fees, listingId = null) {
  if (state.type === 'private') return { pct: adFor(listingId, 0).rate, fixed: 0 };
  return { pct: Number(fees?.ebay?.pct ?? 0.128), fixed: Number(fees?.ebay?.fixed ?? 0.3) };
}

/*
 * eBay's Buyer Protection fee on a private seller's item, paid by the buyer (eBay UK, checked 8 October 2026):
 * 10p an item, 7% of the price to £20, 4% from £20 to £300, 2% from £300 to £4,000, nothing above. On the item price.
 */
export function buyerProtection(price) {
  const p = Number(price);
  if (!(p > 0)) return null;
  const band = (from, to, pct) => Math.max(0, Math.min(p, to) - from) * pct;
  return round(0.1 + band(0, 20, 0.07) + band(20, 300, 0.04) + band(300, 4000, 0.02));
}

// What a buyer pays for the item on a private account; null on business, where her price is what they see.
export const buyersSee = (price) => (state.type === 'private' && Number(price) > 0 ? round(Number(price) + buyerProtection(price)) : null);
