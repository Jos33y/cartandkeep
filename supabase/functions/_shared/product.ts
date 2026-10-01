// Which product a card is now. The research proved a market with one eBay listing; she, or Keepr, can move the card
// to another listing that matches what she can actually source. When that listing is another product, the shelf,
// the shop page the card was costed from and the photos checked on it all describe the old one, and nothing is
// written from them again. The portal keeps the same rules in src/lib/product.js.

type Json = Record<string, any>;

// The listing the card now prices from and is written for, when it is another product than the research's.
export const swappedTo = (c: Json): Json | null => {
  const e = c?.draft?.entry;
  return e?.item_id && e.new_product ? e : null;
};

// What a photo check or a read was made for: the swapped listing's id, or null for the card's own product.
export const productKey = (c: Json): string | null => swappedTo(c)?.item_id ?? null;

// The shop page read for this product. After a swap only her supplier's page counts, and only once it is read.
export function listingOf(c: Json): Json | null {
  const l = c?.listing ?? null;
  if (!swappedTo(c)) return l;
  return l && c.draft?.page && l.source_url === c.draft.page ? l : null;
}

// What eBay holds for the swapped listing: brand, model, barcode, item details. Facts only; never its wording.
export const itemFactsOf = (c: Json): Json | null => (swappedTo(c) ? c.draft?.item_facts ?? null : null);
