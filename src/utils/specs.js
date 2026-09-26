/*
 * Item specifics, and the ones that are not facts about the goods.
 *
 * Her catalogue came from an eBay bulk export, so every row carries the
 * seller's own business policy ids alongside the size and the material. On a
 * product page they read as reference numbers a shopper is expected to care
 * about, and "Returns Policy ID" reads as a returns policy, which is the one
 * thing on that page that must not be ambiguous.
 *
 * This is the only copy for the browser. The shop hides them from a customer
 * and the portal hides them from her, because she is deciding what a product is
 * rather than auditing an export, and three rows of another marketplace's
 * plumbing in a panel headed Details is noise she has to read past every time.
 *
 * The draft edge function holds a second copy on purpose. The Supabase
 * dashboard editor deploys one folder and cannot import from src, which is the
 * same constraint that duplicates the CORS block and the postcode list. The
 * comment there points back here.
 */

const HIDDEN = new Set([
  // eBay business policy references. Hers, and about her account rather than
  // about the thing in the box.
  'payment policies', 'returns policy id', 'shipping policies',

  // Identifiers that belong on the product record rather than in a table a
  // shopper reads.
  'brand', 'mpn', 'ean', 'upc', 'gtin', 'isbn',
  'manufacturer part number', 'ebay product id (epid)',

  // Required eBay fields whose answer is almost always no. "Personalise: No" is
  // the seller completing a form, and "Vintage: Yes" on a boxed gift set is the
  // form being completed wrongly, which is a better reason to drop them than to
  // render them.
  'personalise', 'personalization', 'personalisation instructions',
  'custom bundle', 'modified item', 'non-domestic product',
  'classic part', 'performance part', 'universal fitment',
  'antique', 'vintage', 'handmade',

  // Dimensions, which the shop shows from its own columns rather than from a
  // free text field a bulk lister filled in.
  'item height', 'item width', 'item length', 'item depth', 'item weight',
  'unit quantity', 'unit type',

  'country/region of manufacture', 'california prop 65 warning',
]);

export const isHiddenSpec = (key) => HIDDEN.has(String(key ?? '').trim().toLowerCase());

/*
 * eBay's feed carries directional marks in front of numbers. They survive every
 * other clean and render as an invisible character glued to a dimension, so a
 * value copied off the page arrives somewhere else broken.
 */
export const cleanSpecValue = (v) =>
  String(v ?? '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();

/*
 * The pairs worth showing, in the order eBay returned them.
 *
 * `max` drops a value that is the whole product title or the whole condition
 * blurb, which is a seller filling a required field rather than a
 * specification. Zero means no limit, for the portal, where she should see the
 * long ones and decide herself.
 */
export function visibleSpecs(specifications, { max = 120 } = {}) {
  return Object.entries(specifications ?? {})
    .filter(([k, v]) => k && v && !isHiddenSpec(k))
    .map(([k, v]) => [k.trim(), cleanSpecValue(v)])
    .filter(([, v]) => v && (max === 0 || v.length < max));
}

/*
 * The pairs that were hidden, kept so an editor can write them back.
 *
 * The portal builds its editor state from `specifications` and saves the same
 * object back, so filtering the display alone would delete every hidden row the
 * first time she pressed Save. They are her record and hiding one is not the
 * same as discarding it.
 */
export function hiddenSpecs(specifications) {
  return Object.fromEntries(
    Object.entries(specifications ?? {}).filter(([k]) => isHiddenSpec(k)),
  );
}

// The facts that decide a purchase, in the order a buyer asks them. Her labels are kept as written.
const TAG_ORDER = [
  /\b(dimensions?|size)\b/i,
  /\bweight\b/i,
  /\bmaterials?\b/i,
  /\b(capacity|load)\b/i,
  /\b(compatib\w*|fits|suitable for)\b/i,
  /\bcolou?r\b/i,
  /^type$/i,
];

export function tagFacts(specifications, { max = 4, longest = 32 } = {}) {
  const rows = visibleSpecs(specifications).filter(([, v]) => v.length <= longest);
  const picked = [];
  for (const pattern of TAG_ORDER) {
    const hit = rows.find(([k]) => pattern.test(k) && !picked.some(([p]) => p === k));
    if (hit) picked.push(hit);
    if (picked.length === max) break;
  }
  // One fact is not a label; the table below already carries it.
  return picked.length >= 2 ? picked : [];
}
