/*
 * Turning the gate’s words back into codes, and reading its columns.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

export const REFUSAL_TEXT = [
  ['no_listings', /nobody is listing this/],
  ['crowded', /live listings, over the \d+ ceiling/],
  ['young_not_selling', /recent listings in the sample and none of them are selling/],
  ['nothing_sold', /nothing has sold on any of the sampled listings/],
  ['market_small', /whole sampled market moves about/],
  ['below_cost', /does not cover the cost base/],
  ['entry_large_only', /feedback, over the \d+ ceiling/],
  ['entry_thin', /Somebody bought it, nobody is buying it/],
  ['entry_untested', /entry is untested here, against/],
  ['goods_high', /over the £[\d.]+ a product is bought at today/],
  ['goods_low', /which UK stock rarely does/],
  ['band_unsure', /Run it again with the band this product actually posts at/],
];

// What a sale keeps at the price the proving seller is actually being paid.
export function entryKeepOf(row) {
  const m = row.margin;
  if (!row.entry?.proved || row.entry.price == null || !m.shelf) return null;
  return Math.round((row.entry.price * (1 - m.rates.fvf - m.rates.ad) - m.rates.fixed
    - m.postage - m.packaging - m.returns_allowance - m.shelf.price) * 100) / 100;
}

export function listingsOf(r) {
  if (!r.listings) return null;
  try {
    const list = JSON.parse(r.listings);
    return Array.isArray(list) ? list.filter((l) => Number(l.price) > 0) : null;
  } catch {
    return null;
  }
}

export function refusalsOf(r) {
  const coded = String(r.refusal ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  if (coded.length) return coded;
  const text = String(r.reasons ?? '');
  return REFUSAL_TEXT.filter(([, re]) => re.test(text)).map(([code]) => code);
}

// The postage band as she reads it, not as the gate names it internally.
