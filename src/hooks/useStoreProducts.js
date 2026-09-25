import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * The shop's catalogue.
 *
 * Drafts and samples are for the build. Two gates stand in front of them and
 * both have to open:
 *
 *   1. This flag, which decides what the query asks for.
 *   2. The read policy on store_products, which allows anon to see only
 *      `status = 'live' and is_sample = false`. A signed in session sees
 *      everything, an anonymous one never does.
 *
 * So a mistake here shows the wrong thing to whoever is signed in and nothing
 * at all to a customer. That is the right way round.
 */
const SHOW_DRAFTS = import.meta.env.VITE_STORE_SHOW_DRAFTS === 'true';

/*
 * A product, with its variants sorted and its price range worked out once.
 *
 * Done here so a card, a quick view and a product page cannot disagree about
 * what "from £24.99" means. A product with no variants comes back with an empty
 * array and a range of its own price, so every consumer reads the same shape
 * whether or not the product has any.
 */
function withVariants(row) {
  const { store_variants: raw, ...product } = row;

  const variants = [...(raw ?? [])].sort((a, b) => {
    // Nulls last. A variant she has not ordered goes after the ones she has,
    // rather than first, which is what a plain numeric sort would do.
    const ap = a.position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.position ?? Number.MAX_SAFE_INTEGER;
    return ap === bp ? String(a.label).localeCompare(String(b.label)) : ap - bp;
  });

  // Null price on a variant means the product price applies, so the range is
  // computed after that fallback rather than over the raw column.
  const prices = variants.length
    ? variants.map((v) => Number(v.price ?? product.price))
    : [Number(product.price)];

  return {
    ...product,
    variants,
    priceFrom: Math.min(...prices),
    priceTo: Math.max(...prices),
  };
}

/*
 * Whether a variant can be bought, and whether the product can be.
 *
 * A product with variants is buyable when any one of them is, because the
 * chooser will refuse the rest. Without that, a bed sheet with one size gone
 * would read as out of stock entirely.
 */
export const variantBuyable = (v) =>
  v.availability !== 'out_of_stock' && v.availability !== 'discontinued';

export const anyBuyable = (product) => (product.variants?.length
  ? product.variants.some(variantBuyable)
  : (product.availability ?? 'in_stock') !== 'out_of_stock'
    && (product.availability ?? 'in_stock') !== 'discontinued');

// One catalogue per tenant per visit, shared: the header, the home page and a category page read the same fetch.
const cache = new Map();

function fetchCatalogue(tenantId, includeDrafts) {
  const key = `${tenantId}:${includeDrafts}`;
  if (!cache.has(key)) {
    let query = supabase
      .from('store_products')
      .select(`
        id, slug, title, description, price, compare_at,
        image_url, images, category, category_path, section, postage_band,
        status, is_sample, position,
        brand, condition, source_description, specifications, highlights,
        in_the_box, gtin, availability, stock, dispatch_days,
        returns_class, returns_note,
        hazard, safety_data_sheet_url, energy_class, energy_label_url,
        compare_at_from, sale_ends,
        store_variants ( id, label, price, stock, availability, sku, gtin, image_url, position )
      `)
      .eq('tenant_id', tenantId);
    if (!includeDrafts) query = query.eq('status', 'live');

    const pending = query
      .order('position', { ascending: true, nullsFirst: false })
      .order('price', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []).map(withVariants);
      });

    // A failed fetch is forgotten, so the next page to ask tries again rather than inheriting the failure.
    pending.catch(() => cache.delete(key));
    cache.set(key, { pending, rows: null });
    pending.then((rows) => { const hit = cache.get(key); if (hit) hit.rows = rows; });
  }
  return cache.get(key);
}

export function useStoreProducts(tenantId, { includeDrafts = SHOW_DRAFTS } = {}) {
  const ready = tenantId ? cache.get(`${tenantId}:${includeDrafts}`)?.rows : null;
  const [state, setState] = useState(() => (ready
    ? { status: 'ready', rows: ready, error: null }
    : { status: 'loading', rows: [], error: null }));

  useEffect(() => {
    if (tenantId === undefined) return undefined;

    if (tenantId === null) {
      setState({ status: 'error', rows: [], error: new Error('No shop is configured for this address') });
      return undefined;
    }

    let live = true;
    const entry = fetchCatalogue(tenantId, includeDrafts);
    if (entry.rows) {
      setState({ status: 'ready', rows: entry.rows, error: null });
      return undefined;
    }
    entry.pending
      .then((rows) => { if (live) setState({ status: 'ready', rows, error: null }); })
      .catch((error) => { if (live) setState({ status: 'error', rows: [], error }); });

    return () => { live = false; };
  }, [tenantId, includeDrafts]);

  return state;
}
