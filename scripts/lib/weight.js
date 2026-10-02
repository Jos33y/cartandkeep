/*
 * A product's weight for postage, and the eBay figures re-costed for it.
 *
 * The gate costs a whole run at one band: a store-card run at Evri to 5kg, a shelf-queries run at a band guessed
 * from the name. So a 14kg tub of jointing compound reached her as a £2.62 parcel and "You keep £5.08" was a loss.
 * The weight was on the card all along: in the eBay listing title, the shop's own weight, the shop page name or the
 * title. This file finds it and re-costs the eBay reading, so the importers and recost-ebay-weight agree.
 *
 * Decided 2 October:
 * - eBay postage follows the eBay listing's weight first, because that is the pack she sells there.
 * - A weight read from words gets 5% for the box and packing. A weight the shop states does not.
 * A weight raises a band; it never lowers one the run chose unless asked (allowDown), because a light but bulky
 * product (a garden chair) was put in a big band on purpose.
 */
import { round2, ebayBandFor, EBAY_BANDS } from '../../src/lib/pricing.js';
import { D } from './cost.js';

export const PACKING = 1.05;
const LETTER_UP_TO = { letter100: 100, letter250: 250, letter500: 500 };
const unitG = (n, u) => Number(n) * (String(u).toLowerCase() === 'kg' ? 1000 : 1);

/*
 * Grams named in a piece of text, read for postage.
 * - kg and g: the largest single weight, or a pack of them ("24 x 400g" is 9.6kg). A capacity or a load ("holds
 *   up to 150kg"), the size of pet or person it is for ("medium dogs 10-25kg") and a rate ("45g/min steam") are not
 *   the product's weight.
 * - Litres only for a liquid (paint, sealer, cleaner) at about 1.2kg a litre, or a dry fill sold by the litre
 *   (compost, bark, sand) at about 0.45kg. A container's own litres (a 20L cool box, a 90L incinerator), a filter's
 *   litres filtered and a gas cylinder's litres of gas are not weights. On 2 October scripts/store/shelf.mjs titleGrams,
 *   which reads every litre as liquid, made all four of those courier-only.
 */
const NOT_WEIGHT = /(up to|upto|max(?:imum)?|capacity|holds|supports|load|user weight|for|over|under|dogs?|cats?|kids?|child(?:ren)?|loads?|drum)\s*$/i;
// "Medium dogs 10-25kg" is the dog, not the pack.
const RANGE_BEFORE = /\d+(?:\.\d+)?\s?(?:kg)?\s?(?:-|–|to)\s?$/i;
const SIZE_NEAR = /\b(dogs?|cats?|breeds?|pets?|pupp(?:y|ies)|puppy|adults? up|babies|baby up|toddlers?|children|user|person|people|max(?:imum)?|capacity|load|rated)\b/i;
const RATE_AFTER = /^\s?(?:\/|per\b|steam|boost|shot|output)/i;
const LIQUID = /\b(paint|emulsion|gloss|varnish|stain|oil|seal(?:er|ant)?|primer|cleaner|bleach|disinfectant|detergent|softener|shampoo|conditioner|wash|liquid|screen ?wash|de-?icer|antifreeze|coolant|vinegar|treatment|preserver|protector|solution|adhesive|glue|resin|slurry|fluid|concentrate|creosote|weed ?killer|lawn feed|plant feed|descaler|limescale remover)\b/i;
const DRY = /\b(compost|soil|bark|mulch|grit|gravel|sand|litter|potting mix|manure|chippings|pebbles)\b/i;
const CONTAINER = /\b(buckets?|tubs? (?:only|empty)|bins?|butts?|tanks?|containers?|coolers?|cool ?box(?:es)?|polar ?box|ice ?box|kettles?|bags? only|backpacks?|rucksacks?|storage|sprayers?|watering|empty|vac(?:uum)?s?|dehumidifiers?|humidifiers?|fryers?|cookers?|bottles?|flasks?|jugs?|pots?|pans?|trays?|trugs?|planters?|baskets?|dispensers?|jerry ?cans?|reservoirs?|steamers?|steam|irons?|pumps?|filters?|cartridges?|incinerators?|cylinders?|gas|co2|composters?|wheelbarrows?|barrows?|mixers?|blenders?)\b/i;

export function textGrams(text) {
  const t = String(text ?? '');
  if (!t.trim()) return null;
  let best = 0;
  const take = (g) => { if (g > best) best = g; };
  // Packs: "24 x 400g", "400g x 24", "Pack of 6 x 1kg".
  for (const m of t.matchAll(/\b(\d{1,3})\s?x\s?(\d+(?:\.\d+)?)\s?(kg|g)\b/gi)) take(Number(m[1]) * unitG(m[2], m[3]));
  for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)\s?(kg|g)\s?x\s?(\d{1,3})\b/gi)) take(unitG(m[1], m[2]) * Number(m[3]));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(kg|g)\b/gi)) {
    const before = t.slice(0, m.index);
    if (NOT_WEIGHT.test(before) || RANGE_BEFORE.test(before) || SIZE_NEAR.test(before.slice(-30))) continue;
    if (RATE_AFTER.test(t.slice(m.index + m[0].length))) continue;
    take(unitG(m[1], m[2]));
  }
  if (best > 0) return Math.round(best);
  if (CONTAINER.test(t)) return null;
  const perLitre = LIQUID.test(t) ? 1200 : DRY.test(t) ? 450 : 0;
  if (!perLitre) return null;
  let litres = 0;
  for (const m of t.matchAll(/\b(\d+(?:\.\d+)?)\s?(l|ltrs?|litres?|liters?|ml)\b/gi)) {
    const l = Number(m[1]) / (m[2].toLowerCase() === 'ml' ? 1000 : 1);
    if (l > litres) litres = l;
  }
  return litres >= 0.5 ? Math.round(litres * perLitre + 200) : null;
}

const readFrom = (text, from) => {
  const g = textGrams(text);
  return g ? { grams: Math.round(g * PACKING), read: g, from, text: String(text), stated: false } : null;
};

// The store card's own weight. "shop" is a weight the shop stated; "title" was read from Google's title by
// store-picks with no allowance, so it gets one here; "page name" was read at import and already has it.
function fromStoreBand(band) {
  const g = Number(band?.grams);
  if (!(g > 0) || band?.basis === 'assumed') return null;
  const from = band?.from || 'shop';
  const text = `store card weight ${g}g`;
  if (from === 'title') return { grams: Math.round(g * PACKING), read: g, from: 'the title, read at import', text, stated: false };
  return { grams: Math.round(g), read: g, from: from === 'shop' ? 'the shop' : `the ${from}`, text, stated: from === 'shop' };
}

// The weight eBay postage is costed at: the eBay listing, then the store card's weight, the shop page name, the title.
export function ebayWeight({ listingTitle = null, store = null, pageName = null, title = null } = {}) {
  return readFrom(listingTitle, 'the eBay listing title')
    ?? fromStoreBand(store)
    ?? readFrom(pageName, 'the shop page name')
    ?? readFrom(title, 'the card title');
}

// The weight her shop postage is costed at, for a store card that has none: the shop page name, then the title.
export function storeWeight({ pageName = null, title = null } = {}) {
  return readFrom(pageName, 'page name') ?? readFrom(title, 'title');
}

/*
 * An eBay reading re-costed for a weight: postage and packing, and the figures worked out from them (headroom,
 * the most the goods can cost, net), the same sums as cost.js so the card and the gate agree.
 * Over 20kg neither Evri nor Royal Mail takes it: marked courier only and costed at Royal Mail's 20kg price as the
 * least it will cost, so the card never shows a profit the small band made up.
 */
export function recostEbay(m, w, { allowDown = false } = {}) {
  if (!m || !w?.grams) return { margin: m, changed: false };
  const g = w.grams;
  const letterMax = LETTER_UP_TO[m.band];
  if (letterMax && g <= letterMax) return { margin: m, changed: false };
  const fit = ebayBandFor(g);
  const over = !fit;
  const band = fit ?? EBAY_BANDS[EBAY_BANDS.length - 1];
  const was = Number(m.postage ?? 0) + Number(m.packaging ?? 0);
  const now = band.postage + band.packaging;
  const up = now > was + 1e-9;
  const down = now < was - 1e-9;
  if (!over && !up && !(down && allowDown)) return { margin: m, changed: false };
  if (over && m.courier_only && Math.abs(now - was) < 1e-9) return { margin: m, changed: false };

  const rates = m.rates ?? { fvf: D.fvfPct, ad: D.adRate, fixed: D.fvfFixed };
  const price = Number(m.sale_price);
  const headroom = price > 0
    ? round2(price - (price * rates.fvf + rates.fixed + price * rates.ad + band.postage + band.packaging))
    : m.headroom ?? null;
  const returns = Number(m.returns_allowance ?? D.returnRate * D.returnCost);
  const profit = Number(m.target_profit ?? D.minProfit);
  const maxGoods = headroom != null ? round2(headroom - returns - profit) : null;
  const net = m.landed_cost != null && maxGoods != null ? round2(maxGoods + profit - Number(m.landed_cost)) : m.net ?? null;

  return {
    changed: true,
    over,
    down: down && !over,
    margin: {
      ...m,
      postage: band.postage,
      packaging: band.packaging,
      band: band.key,
      band_label: over ? 'Over 20kg, courier only (at least Royal Mail 20kg)' : band.label,
      headroom_band: band.key,
      postage_basis: over ? 'over 20kg' : 'weight',
      courier_only: over || undefined,
      grams: g,
      weight_from: w.from,
      band_was: m.band_was ?? m.band ?? null,
      headroom,
      max_goods_cost: maxGoods,
      net,
      net_pct: net != null && price > 0 ? Math.round((net / price) * 1000) / 10 : m.net_pct ?? null,
    },
  };
}

// A gate row (buildRow's shape, an eBay-only card) re-costed for its weight, with the row's own headroom figures.
export function weighGateRow(row, opts = {}) {
  const w = ebayWeight({ listingTitle: row.entry?.title, pageName: row.margin?.shelf?.product, title: row.title });
  const { margin, changed } = recostEbay(row.margin, w, opts);
  if (!changed) return row;
  const perDay = row.entry?.proved ? row.entry.per_day : null;
  return {
    ...row,
    margin,
    headroom: margin.headroom,
    monthly_headroom: perDay != null && margin.headroom != null ? round2(perDay * 30 * margin.headroom) : null,
  };
}
