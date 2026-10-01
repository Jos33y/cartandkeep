/*
 * Which product a card is now, the portal's copy of supabase/functions/_shared/product.ts.
 *
 * The research proved a market with one eBay listing. She, or Keepr, can move the card to another listing that
 * matches what she can actually source. When that listing is another product, the shelf, the page the card was
 * costed from and the photos checked on it describe the old one, and nothing is written or priced from them again.
 */

// The listing the card prices from now, when she or Keepr chose one over the research's.
export const chosenEntry = (draft = {}) => (draft?.entry?.item_id ? draft.entry : null);

// The chosen listing when it is another product than the research's.
export const swappedTo = (row, draft = row?.draft ?? {}) => {
  const e = chosenEntry(draft);
  return e?.new_product ? e : null;
};

export const productKey = (row, draft = row?.draft ?? {}) => swappedTo(row, draft)?.item_id ?? null;

// The shop page read for this product. After a move to another product only her supplier's page counts.
export function listingOf(row, draft = row?.draft ?? {}) {
  const l = row?.listing ?? null;
  if (!swappedTo(row, draft)) return l;
  return l && draft.page && l.source_url === draft.page ? l : null;
}

// eBay item ids come as "v1|123|0" from the API and as the number in a web address.
export const legacyId = (id) => {
  const s = String(id ?? '');
  return s.split('|')[1] ?? s.replace(/\D/g, '');
};
export const sameListing = (a, b) => Boolean(a && b) && legacyId(a) === legacyId(b);

// The listing on eBay UK. A variation's id opens the whole listing, its options there to pick from.
export const ebayItemUrl = (id) => {
  const n = legacyId(id);
  return n ? `https://www.ebay.co.uk/itm/${n}` : null;
};

// eBay UK's search for a card's query, items in the UK only: where a card kept no listing to open.
export const ebaySearchUrl = (query) => {
  const q = String(query ?? '').trim();
  return q ? `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_PrefLoc=1` : null;
};

// What a move to another product clears from her draft: everything written, chosen or found for the old product.
// Her own photos stay. Kept whole under `before`, so switching back restores it.
export const PRODUCT_FIELDS = ['title', 'description', 'images', 'catalogue', 'ebay_category', 'aspects', 'package', 'price', 'ebay_price', 'as_shelf', 'market'];
