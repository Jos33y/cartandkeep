// deno-lint-ignore-file no-explicit-any
// What the morning supplier check emails about, worked out apart from the function so it can be tested alone.
type Json = Record<string, any>;

const near = (a: unknown, b: unknown) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.015;
const landed = (s: Json | null) => {
  const v = Number(s?.landed_unit_cost ?? s?.unit_cost);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
};

/*
 * What to email about one card after a reading, or null. Only a card live on eBay. Two cases:
 *   moved   her cost followed Amazon: the landed cost before and after (postage included), when it changed
 *   dearer  her own cost is left alone, and Amazon's price with postage is over it: once per new price
 */
export function priceAlert(c: Json, before: Json | null, after: Json | null, follow: Json | null, r: Json, costed: number | null, told: Json | null) {
  const listing = c?.ebay?.listing_id ? String(c.ebay.listing_id) : null;
  if (!listing) return null;
  const title = String(c.draft?.title || c.title || 'A live listing');
  const price = c.ebay?.price != null ? Number(c.ebay.price) : null;
  if (follow && after) {
    const from = landed(before);
    const to = landed(after);
    if (to == null || near(from, to)) return null;
    return { title, listing_id: listing, from, to, price, why: 'moved', deal_ended: follow.why === 'deal_ended' };
  }
  if (follow || r?.offer?.price == null || costed == null) return null;
  const cost = Math.round((Number(r.offer.price) + Number(r.offer.shipping ?? 0)) * 100) / 100;
  if (cost <= Number(costed) + 0.01 || near(told?.price, cost)) return null;
  return { title, listing_id: listing, from: Math.round(Number(costed) * 100) / 100, to: cost, price, why: 'dearer' };
}

