import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * The words on her shop front.
 *
 * Reads `store_category_map`, which is every category path actually in the
 * catalogue with her name beside it where she has given one. Listing what
 * exists rather than asking her to type an eBay path from memory is the whole
 * reason that view was written.
 *
 * A row here is a rename, not a move. Products keep their eBay path, the
 * Google feed keeps saying what Google expects, and an absent row means the
 * shop behaves exactly as it does today.
 */

const EMPTY = {
  status: 'loading',
  departments: [],
  error: null,
  counts: { named: 0, unnamed: 0, hidden: 0, all: 0 },
};

export function useCategoryNames(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('store_category_map')
      .select('path, depth, products, live, name_id, name, slug, blurb, position, hidden, ebay_name')
      .eq('tenant_id', tenantId)
      .order('depth')
      .order('path');

    if (error) return setState({ ...EMPTY, status: 'error', error });

    const rows = (data ?? []).map((r) => ({
      ...r,
      products: Number(r.products),
      live: Number(r.live),
    }));

    /*
     * Shelves nested under their department.
     *
     * She thinks about the shop as departments containing shelves, and a flat
     * list of thirty paths with pipes in them is the eBay taxonomy wearing a
     * portal screen. The nesting is done here rather than in the view because
     * it is a shape for one screen rather than a fact about the data.
     */
    const departments = rows
      .filter((r) => r.depth === 1)
      .map((d) => ({
        ...d,
        shelves: rows.filter((r) => r.depth === 2 && r.path.startsWith(`${d.path}|`)),
      }));

    setState({
      status: 'ready',
      error: null,
      departments,
      counts: {
        named: rows.filter((r) => r.name).length,
        unnamed: rows.filter((r) => !r.name).length,
        hidden: rows.filter((r) => r.hidden).length,
        all: rows.length,
      },
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Saving a name.
   *
   * Upsert on the path, because she is editing a section rather than a row and
   * whether one exists yet is not a distinction she should have to think
   * about. Clearing the name deletes the row instead, so the shop falls back
   * to the eBay name rather than showing an empty heading.
   */
  const save = useCallback(async ({ tenantId: t, path, name, slug, blurb, position, hidden }) => {
    const clean = String(name ?? '').trim();

    if (!clean) {
      const { error } = await supabase.from('store_category_names')
        .delete().eq('tenant_id', t).eq('path', path);
      if (error) throw error;
      await load();
      return;
    }

    const tidySlug = String(slug ?? '').trim().toLowerCase();
    if (tidySlug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tidySlug)) {
      // Caught here rather than by the column, so the message says what to do
      // rather than naming a constraint.
      throw new Error('A web address can only use lower case letters, numbers and hyphens.');
    }

    const { error } = await supabase.from('store_category_names').upsert({
      tenant_id: t,
      path,
      name: clean,
      slug: tidySlug || null,
      blurb: String(blurb ?? '').trim() || null,
      // An empty box means no position, which sorts last. Zero would sort
      // first, which is not what an empty box says.
      position: String(position ?? '').trim() === '' ? null : Number(position),
      hidden: Boolean(hidden),
    }, { onConflict: 'tenant_id,path' });

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Hiding, on its own.
   *
   * A section can be hidden without being renamed, so this writes a row with
   * the eBay name in it rather than requiring her to name something first just
   * to take it off the navigation.
   */
  const setHidden = useCallback(async ({ tenantId: t, path, name, hidden }) => {
    const { error } = await supabase.from('store_category_names').upsert({
      tenant_id: t,
      path,
      name: String(name ?? '').trim(),
      hidden,
    }, { onConflict: 'tenant_id,path' });

    if (error) throw error;
    await load();
  }, [load]);

  return { ...state, reload: load, save, setHidden };
}
