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
          image_url, images, category, category_path, postage_band,
          status, is_sample, position,
          brand, condition, source_description, specifications, highlights,
          in_the_box, gtin, availability, stock, dispatch_days,
          returns_class, returns_note,
          hazard, safety_data_sheet_url, energy_class, energy_label_url,
          compare_at_from, sale_ends
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
      setState({ status: 'ready', rows: data ?? [], error: null });
    })();

    return () => { live = false; };
  }, [tenantId, includeDrafts]);

  return state;
}
