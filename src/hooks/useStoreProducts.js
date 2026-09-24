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

export function useStoreProducts(tenantId, { includeDrafts = SHOW_DRAFTS } = {}) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  useEffect(() => {
    // undefined means the tenant has not resolved yet. null means it resolved
    // to nothing, which is a failure and has to say so. Treating both as "wait"
    // is how a page sits on "Loading the catalogue" until somebody reloads.
    if (tenantId === undefined) return undefined;

    if (tenantId === null) {
      setState({
        status: 'error',
        rows: [],
        error: new Error('No shop is configured for this address'),
      });
      return undefined;
    }

    let live = true;

    (async () => {
      /*
       * Variants come with the product rather than as a second query.
       *
       * The grid needs them to show "from" on a card and the product page needs
       * them to render a chooser. Two reads would mean a page that paints one
       * price and then reflows into a range, which reads as a shop that changed
       * its mind.
       *
       * The embed is written on one line because the select is a string
       * PostgREST parses, and a block comment inside it is sent to the server
       * as part of the query. That cost a parse error the first time.
       */
      let query = supabase
        .from('store_products')
        // Written out rather than select('*') so adding a column to the table
        // does not silently start shipping it to a shopper's browser, and so
        // this list is the one place to look when the page renders nothing.
        //
        // Everything after `position` arrived with migration 0036 and was
        // missing here, which is why brand, specifications and the supplier
        // description were in the database and not on the page.
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

      // `position` is hers to set and most rows will not have one, so nulls
      // sort last and price decides the rest. A grid ordered by whatever the
      // database happened to return reshuffles between loads.
      const { data, error } = await query
        .order('position', { ascending: true, nullsFirst: false })
        .order('price', { ascending: false });

      if (!live) return;
      if (error) return setState({ status: 'error', rows: [], error });
      setState({ status: 'ready', rows: (data ?? []).map(withVariants), error: null });
    })();

    return () => { live = false; };
  }, [tenantId, includeDrafts]);

  return state;
}
