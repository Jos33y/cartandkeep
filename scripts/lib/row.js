/*
 * One candidate row, as the portal renders it.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

import { D, BANDS, headroomAt, maxGoodsCost } from './cost.js';
import { entryKeepOf, listingsOf, refusalsOf } from './refusals.js';
import { num, int, yes } from './sources.js';

export const BAND_LABEL = {
  letter100: 'large letter to 100g',
  letter250: 'large letter to 250g',
  letter500: 'large letter to 500g',
  evri5: 'Evri to 5kg',
  evri10: 'Evri 5 to 10kg',
  evri15: 'Evri 10 to 15kg',
  parcel: 'Royal Mail small parcel to 2kg',
  rmMedium: 'Royal Mail medium to 2kg',
};

/*
 * What to list at.
 *
 * The market median is what the market sells at, not what she can sell at. A
 * hundred feedback account listing at the median of a market it has no standing
 * in is the position her existing catalogue is already in: 272 of 282 listings
 * priced viably and never sold.
 *
 * So where a seller her size is proved to be converting, that seller's price is
 * the answer, because it is the only price on the page somebody in her position
 * has actually been paid.
 *
 * Two guards. An entry price outside the interquartile range is an outlier
 * rather than a going rate, so it is pulled back to the edge of the field. And
 * with no entry proof there is nothing better than the median, which is said
 * rather than implied.
 */
export function listPrice({ median, entryPrice, proved, p25, p75 }) {
  if (median == null) return { price: null, basis: 'no market price' };
  if (!proved || entryPrice == null) {
    return { price: median, trusted: false, basis: 'market median, no small seller selling to price against' };
  }
  // No quartiles, no guard, so no trust. A CSV written before the gate emitted
  // them put a £339 hot tub on the board with a £280 buying ceiling, because
  // one seller's price with nothing to check it against is not a going rate.
  if (p25 == null || p75 == null) {
    return { price: median, trusted: false, basis: 'market median, the spread of the field is not known' };
  }
  /*
   * Outside the field, the row is not trusted rather than corrected.
   *
   * Pulling the price back to the edge of the field was the first version and
   * it was wrong in the most dangerous direction. A portable bath tub sold by a
   * 243 feedback seller at £339.99 landed in a market of real hot tubs whose
   * bottom quartile is £608.97, so the clamp moved the price up and told her to
   * list at nearly double the only figure anybody in her position had been
   * paid. Beard kit and PSU did the same at smaller scale.
   *
   * A seller price far outside the field does not mean the price is wrong. It
   * means the query pulled a market that seller does not trade in, and no
   * arithmetic on the wrong market produces a right answer.
   */
  if (p25 != null && p75 != null && (entryPrice < p25 || entryPrice > p75)) {
    return {
      price: median,
      trusted: false,
      basis: `market median. A small seller sells at £${entryPrice.toFixed(2)}, outside `
        + `the £${p25.toFixed(2)} to £${p75.toFixed(2)} field, so the query has probably `
        + 'pulled a different product',
    };
  }
  return { price: entryPrice, trusted: true, basis: 'what a small seller is selling at now' };
}

// eBay matches every word, so a query is a phrase rather than a name. Sentence
// case reads as a product on the card where the raw query reads as a search box.
export const titleOf = (q) => q.charAt(0).toUpperCase() + q.slice(1);

// Ranking entry evidence. Proved first, then rate.
//
// Rate alone is wrong: a 4,797 feedback seller taking 60 units is a bigger
// number than a 99 feedback seller taking 50 and a worse reason to buy.
// Smallest feedback alone is also wrong: it put a 55 feedback seller with three
// sales above a 99 feedback seller with fifty, and both are her size. So the
// gate's proved flag bands them, and rate orders inside the band.
export function entryRank(r) {
  if (!r.entry) return [2, 0];
  return [r.entry.proved ? 0 : 1, r.entry.per_day ?? 0];
}

export function buildRow({ r, tenant, cluster, checkedAt, shelf = null, shops = null, product = null }) {
  const median = num(r.median_price);
  const perMonth = int(r.observed_units_per_month);
  const band = (r.band || '').trim() || null;
  const entryId = (r.entry_item_id || '').trim() || null;

  // Both figures come off the same listing or neither is written. Pairing one
  // listing's price with another's volume is what produced the £652 diesel
  // pump, and an entry object assembled from two rows would be that error
  // stored rather than printed.
  //
  // Written whether or not entry was proved. An unproved seller is still a real
  // seller with a real rate, and dropping the row hid the fact that somebody is
  // selling at all.
  const proved = yes(r.entry_proved);
  const entry = num(r.entry_seller_feedback) != null
    ? {
      proved,
      seller_feedback: int(r.entry_seller_feedback),
      price: num(r.entry_price),
      sold_lifetime: int(r.entry_sold),
      age_days: int(r.entry_age_days),
      per_day: num(r.entry_per_day),
      // The pack check reads this against the shelf title.
      title: (r.entry_title || '').trim() || null,
      ceiling: int(r.entry_ceiling),
      item_id: entryId,
      image_url: (r.image_url || '').trim() || null,
      checked_at: checkedAt,
    }
    : null;

  // Recomputed at the price she would list at, not at the median the gate used.
  // Fees and postage come from the gate's own model so the two cannot drift.
  const costs = { ...D, band: band ?? D.band };
  const { price, basis, trusted } = listPrice({
    median,
    entryPrice: entry?.price ?? null,
    proved,
    p25: num(r.price_p25),
    p75: num(r.price_p75),
  });
  const headroom = headroomAt(price, costs);
  const maxGoods = maxGoodsCost(price, costs);
  const bandCosts = BANDS[costs.band] ?? BANDS[D.band];

  // The shelf turns a ceiling into a profit. maxGoods already has the target
  // profit taken out of it, so it goes back in before the shelf comes off.
  const net = shelf && maxGoods != null
    ? Math.round((maxGoods + D.minProfit - shelf.price) * 100) / 100
    : null;

  return {
    tenant_id: tenant?.id ?? null,
    external_ref: r.query,
    title: titleOf(r.query),
    category: null,

    image_url: (r.image_url || '').trim() || null,
    // eBay's composite id is v1|287502604374|0 and the /itm/ path wants the
    // middle part. Passed whole, the pipes percent-encode and every link 404s.
    reference_url: entryId ? `https://www.ebay.co.uk/itm/${String(entryId).split('|')[1] ?? entryId}` : null,

    classification: 'unknown',
    cluster,
    // Cleared the market read and has never been tested against its own
    // history, which needs three windows the gate does not produce.
    tier: 'candidate',

    // No score. On a single Browse read there is no trend, no sell-through and
    // no window series, so four of the components have no data and a number
    // built on the rest is asserted rather than computed.
    score: null,
    component_count: 0,
    breakdown: {},

    confidence: null,
    signal_count: 1,
    signals: [],

    headroom,

    // What a seller her size is currently taking on this, before goods.
    //
    // Not the sampled market's units times headroom. That put £3,734 a month
    // against a caravan pump on the review screen, which is the whole market's
    // volume presented as her return, and it is the diesel pump error in a new
    // shape. It also sorted the board by market size, which is the one thing
    // the entry test exists to stop.
    // Only where entry is proved. A rate from a seller with thousands of
    // feedback is not a figure she can expect, and putting it on the card would
    // be the market's volume dressed as hers a second time.
    monthly_headroom: proved && entry?.per_day != null && headroom != null
      ? Math.round(entry.per_day * 30 * headroom * 100) / 100
      : null,

    // The whole sampled market, kept because it is a real measurement and the
    // competition read shows it as what it is.
    sold_30d: perMonth,
    avg_sold_price: median,
    active_listings: int(r.competitors),
    routes: (r.route || '').trim() || null,

    margin: {
      sale_price: price,
      list_basis: basis,
      // False where the entry seller's price and the market the query found do
      // not belong together. The figures are still real, they are just probably
      // not about the same product.
      // Trusted means one thing: the price came from a small seller who is
      // converting. Two branches of listPrice returned no flag at all, so
      // `trusted !== false` read as true on the rows with no evidence behind
      // them, and a market median nobody has been paid showed a profit figure.
      list_trusted: trusted === true,
      market_median: median,
      headroom,
      // The number she acts on standing in front of a shelf. Reported, never
      // assumed: no share of the selling price is taken as goods cost, so a
      // real supplier price is what decides.
      max_goods_cost: maxGoods,

      // The ledger prints these individually. Without them it showed a dash on
      // every line between the list price and the goods cost, so the card could
      // not explain where the money went.
      platform_fee: price ? Math.round((price * (D.fvfPct + D.adRate) + D.fvfFixed) * 100) / 100 : null,
      postage: bandCosts.postage,
      packaging: bandCosts.packaging,
      returns_allowance: Math.round(D.returnRate * D.returnCost * 100) / 100,
      target_profit: D.minProfit,

      // Percentages, so the page can recompute margin as she moves the price
      // without a second copy of the cost model in the browser.
      rates: {
        fvf: D.fvfPct,
        ad: D.adRate,
        fixed: D.fvfFixed,
      },

      band,
      band_label: band ? BAND_LABEL[band] ?? band : null,
      headroom_band: band,
      landed_cost: shelf ? shelf.price : null,
      cost_source: shelf ? 'shelf' : 'not_quoted',
      net,
      net_pct: net != null && price ? Math.round((net / price) * 1000) / 10 : null,

      // Where it actually came from, with the price it was seen at. One link,
      // not a search.
      shelf: shelf
        ? { shop: shelf.shop, url: shelf.url, product: shelf.product, price: shelf.price }
        : null,

      // Proposed, not found. Rendered as searches on the card.
      shops: shops && shops.length ? shops : null,
    },

    // Everything a listing needs, read off the shop's own product page. Kept
    // whole rather than spread across columns, because what eBay wants from it
    // is still settling and a jsonb blob does not need a migration each time.
    listing: product
      ? {
        title: product.title,
        brand: product.brand,
        images: product.images ?? [],
        summary: product.summary,
        description: product.description,
        features: product.features ?? [],
        ingredients: product.ingredients,
        nutrition: product.nutrition,
        safety: product.safety,
        shop_category: product.category_name,
        shop_category_id: product.category_id,
        product_code: product.product_code,
        in_stock: product.in_stock,
        max_qty: product.max_qty,
        unit_price: product.unit_price,
        rrp: product.rrp,
        fetched_at: new Date().toISOString().slice(0, 10),
      }
      : null,

    entry,

    // Shape read by MarketLine. usable is the gate saying the sample was deep
    // enough to quote, and without it the row prints "Market not read".
    competition: {
      usable: median != null && num(r.price_band) != null,
      query: r.query,
      median,
      low: num(r.price_low),
      high: num(r.price_high),
      // Read by listPrice and discarded until now. The approved page draws the
      // market on these, and without them there is no body to the field.
      p25: num(r.price_p25),
      p75: num(r.price_p75),
      band: num(r.price_band),
      sample: int(r.listings_with_sold),
      // One point per sampled listing, for the price field.
      listings: listingsOf(r),
      competitors: int(r.competitors),
      unbranded_share: num(r.unbranded_share),
      // What the median came from, so a price nobody has been paid is visible as one.
      median_listed: num(r.median_listed),
      price_basis: (r.price_basis || '').trim() || null,
      selling_seen: int(r.selling_seen),
      outcome: (r.outcome || '').trim() || null,
      reasons: (r.reasons || '').trim() || null,
      checked_at: checkedAt,
    },
  };
}
