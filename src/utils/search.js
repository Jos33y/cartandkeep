import { leafOf } from './categories';

/*
 * The shop's search.
 *
 * One implementation, used by the hero on the shop front and by /search, so
 * the same query cannot return two different answers depending on where it was
 * typed.
 *
 * Substring across title, brand and category, every word having to match
 * somewhere. Honest about what it is: enough for a catalogue of this size, and
 * replaced by a real index rather than stretched when it outgrows that.
 */
export function searchTerms(query) {
  return String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function searchProducts(products, query) {
  const terms = searchTerms(query);
  if (!terms.length) return [];

  return products
    .map((product) => {
      const title = product.title.toLowerCase();
      const leaf = (leafOf(product.category_path) ?? product.category ?? '').toLowerCase();
      const brand = (product.brand ?? '').toLowerCase();
      const hay = `${title} ${leaf} ${brand}`;
      if (!terms.every((t) => hay.includes(t))) return null;

      // A match in the title beats one in a category, and a match at the start
      // of the title beats one in the middle. Otherwise searching "lamp"
      // ranks a lamp-shaped accessory above the lamp.
      let score = 0;
      for (const t of terms) {
        if (title.startsWith(t)) score += 4;
        else if (title.includes(t)) score += 3;
        if (brand.includes(t)) score += 2;
        if (leaf.includes(t)) score += 1;
      }
      return { product, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || Number(b.product.price) - Number(a.product.price))
    .map((r) => r.product);
}

// Real words from the catalogue, most common first. Nothing here can return
// nothing, because every one of them came out of a product that exists.
export function suggestions(products, limit = 6) {
  const tally = new Map();
  for (const p of products) {
    const leaf = leafOf(p.category_path);
    if (leaf) tally.set(leaf, (tally.get(leaf) ?? 0) + 1);
  }
  return [...tally.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([leaf]) => leaf);
}
