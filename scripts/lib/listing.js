/*
 * Reading one listing: its seller, its brand, its sales, its age.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

import { D } from './cost.js';

// ------------------------------------------------------------------ readings

// Field names are read defensively and a miss is reported rather than defaulted.
// A zero where the answer is "we could not see" is the failure this whole
// exercise exists to stop.
export function readSeller(item) {
  const s = item?.seller ?? {};
  const score = s.feedbackScore ?? s.feedback_score;
  return {
    username: s.username ?? null,
    feedback: Number.isFinite(Number(score)) ? Number(score) : null,
    percentage: s.feedbackPercentage != null ? Number(s.feedbackPercentage) : null,
  };
}

// Brand comes off the item aspects on the detail call we already make, so this
// costs no extra requests. It answers a question the gate never asked: can she
// even buy this thing. A market of Unbranded and Generic listings is sourceable
// from a Chinese supplier. A market of Royal Canin and Tena is not, and no
// AliExpress search will ever produce it.
export function readBrand(detail) {
  const aspects = detail?.localizedAspects;
  if (!Array.isArray(aspects)) return null;
  const hit = aspects.find((a) => String(a?.name ?? '').trim().toLowerCase() === 'brand');
  const v = hit?.value == null ? null : String(hit.value).trim();
  return v || null;
}

// The barcode, where the seller gave one. Read off the detail call already made,
// so a shelf product can be matched exactly rather than by its title.
export function readGtin(detail) {
  const aspects = Array.isArray(detail?.localizedAspects) ? detail.localizedAspects : [];
  const named = aspects.find((a) => /^(ean|upc|gtin|isbn)$/i.test(String(a?.name ?? '').trim()))?.value;
  for (const v of [detail?.gtin, named]) {
    const digits = String(v ?? '').replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 14) return digits;
  }
  return null;
}

const OPEN_BRAND = /^(un-?branded|generic|no\s*brand|unbranded\s*\/\s*generic|does\s*not\s*apply|not\s*applicable|n\/?a|none|no)$/i;

export function brandIsOpen(brand) {
  return brand != null && OPEN_BRAND.test(brand.trim());
}

// Not a verdict. A route. The audit of her live catalogue showed branded goods
// selling perfectly well (Behringer, Tena, Blagdon), they just cannot be
// dropshipped from China, they have to be bought as the genuine article. So
// this splits the sourcing job in two rather than throwing half of it away.
export function routeOf(listings = []) {
  const brands = listings.map((l) => l.brand).filter((b) => b != null);
  const known = brands.length;
  if (known < 3) return { route: 'unknown', known, openShare: null, top: [] };

  const open = brands.filter(brandIsOpen).length;
  const openShare = open / known;

  const counts = new Map();
  for (const b of brands) {
    if (brandIsOpen(b)) continue;
    const k = b.toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

  const route = openShare >= 0.6 ? 'china' : openShare <= 0.2 ? 'branded' : 'mixed';
  return { route, known, openShare: Math.round(openShare * 100) / 100, top };
}

export function readSold(detail) {
  const avail = detail?.estimatedAvailabilities;
  if (!Array.isArray(avail) || !avail.length) return null;
  for (const a of avail) {
    const n = a?.estimatedSoldQuantity;
    if (Number.isFinite(Number(n))) return Number(n);
  }
  return null;
}

// itemOriginDate is when the listing first went live, which is the window the
// sold count accrued over. itemCreationDate moves on a revision and would
// make an old listing look like it sold everything last week.
export function readAge(item, now = Date.now()) {
  const raw = item?.itemOriginDate ?? item?.itemCreationDate;
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t)) return null;
  const days = (now - t) / 86400000;
  return days >= 0 ? Math.max(days, 1) : null;
}

/*
 * How many units a listing has to show before its rate means anything.
 *
 * A flat floor is wrong at both ends. Two sales asked too much of a listing put
 * up a fortnight ago, and it asked far too little of one that has been up since
 * June: a Sooty puppet showing one sale in eighty days was reported as proof
 * that a newcomer could enter, when what it actually shows is one sale a
 * quarter.
 *
 * So under a month, one sale will do, because there has not been time for
 * more. At a month or older, two at minimum, and the monthly rate has to hold
 * on top of that. The two together mean the bar rises with the calendar:
 *
 *     20 days   1 sale
 *     30 days   2 sales
 *     60 days   2 sales
 *     90 days   3 sales
 *    180 days   6 sales
 */
