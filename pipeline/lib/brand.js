/*
 * Listing branded goods sourced from a dropshipping catalogue invites a VeRO
 * takedown, and repeat reports put the selling account at risk. The first real
 * supplier run returned 58 of 62 signals as one branded lash kit line.
 *
 * The known list is authoritative and grows as brands are seen. The heuristics
 * catch what the list has not met yet, and are deliberately conservative:
 * a false positive costs one candidate, a false negative can cost the account.
 */

const TRADEMARK = /[®™©]/;
const BY_BRAND = /\b(?:by|from)\s+[A-Z][A-Za-z]{2,}(?:\s+[A-Z][A-Za-z]+)?\b/;
const SHOUTED = /\b[A-Z]{4,}\b/g;

// Words that are capitalised in listings without being brands.
const NOT_BRANDS = new Set([
  'NEW', 'FREE', 'SALE', 'PACK', 'SET', 'KIT', 'XXL', 'XL', 'UK', 'USA', 'PCS',
  'HEAVY', 'DUTY', 'LARGE', 'SMALL', 'MEDIUM', 'SOFT', 'HARD', 'BEST', 'TOP',
  'ANTI', 'NON', 'SLIP', 'PET', 'DOG', 'CAT', 'HAIR', 'FACE', 'BODY', 'SIZE',
  'MICRON', 'INCH', 'RING', 'SHORT', 'LONG', 'FELT', 'SOCK', 'MARINE', 'SUMP',
  'GEL', 'MAT', 'BED', 'BOWL', 'TOY', 'LEAD', 'COLLAR', 'BRUSH', 'COMB',
]);

export function detectBrand(title, config = {}) {
  if (!title) return null;

  const known = config.known ?? [];
  const allow = config.allow ?? [];

  const lower = title.toLowerCase();
  if (allow.some((a) => lower.includes(a.toLowerCase()))) return null;

  const hit = known.find((b) => lower.includes(b.toLowerCase()));
  if (hit) return { brand: hit, reason: 'known' };

  if (TRADEMARK.test(title)) return { brand: null, reason: 'trademark_symbol' };

  const by = title.match(BY_BRAND);
  if (by) return { brand: by[0].replace(/^(by|from)\s+/i, ''), reason: 'attributed' };

  const shouted = (title.match(SHOUTED) ?? []).filter((w) => !NOT_BRANDS.has(w));
  if (shouted.length) return { brand: shouted[0], reason: 'capitalised' };

  return null;
}
