import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

const EMPTY = { status: 'loading', departments: [], error: null };

export const sectionSlug = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

export function useCategoryNames(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: s.departments.length ? 'ready' : 'loading' }));

    const { data, error } = await supabase
      .from('store_category_map')
      .select('path, products, live, name, slug, blurb, position, hidden, own, aliases, ebay_name')
      .eq('tenant_id', tenantId)
      .order('path');

    if (error) return setState({ ...EMPTY, status: 'error', error });

    const departments = (data ?? []).map((r) => ({
      ...r,
      products: Number(r.products),
      live: Number(r.live),
      label: r.name || r.ebay_name,
    })).sort((a, b) => {
      if (a.position !== null && b.position !== null && a.position !== b.position) return a.position - b.position;
      if (a.position !== null && b.position === null) return -1;
      if (a.position === null && b.position !== null) return 1;
      return b.live - a.live || a.label.localeCompare(b.label);
    });

    setState({ status: 'ready', error: null, departments });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const write = useCallback(async (row) => {
    const { error } = await supabase.from('store_category_names')
      .upsert({ tenant_id: tenantId, ...row }, { onConflict: 'tenant_id,path' });
    if (error) throw error;
  }, [tenantId]);

  const create = useCallback(async (name, { reload = true } = {}) => {
    const clean = String(name ?? '').trim();
    if (!clean) throw new Error('Give the section a name.');
    const path = `own:${crypto.randomUUID().slice(0, 8)}`;
    await write({ path, name: clean, slug: sectionSlug(clean), own: true });
    if (reload) await load();
    return path;
  }, [write, load]);

  // A new name moves the address; the old one is kept as an alias, so shared links and Google still arrive.
  const rename = useCallback(async (dept, name) => {
    const clean = String(name ?? '').trim();
    if (!clean) throw new Error('A section needs a name.');
    const slug = sectionSlug(clean);
    const aliases = [...new Set([...(dept.aliases ?? []), dept.slug].filter((a) => a && a !== slug))];
    await write({ path: dept.path, name: clean, slug, own: true, aliases });
    await load();
  }, [write, load]);

  const setHidden = useCallback(async (dept, hidden) => {
    await write({ path: dept.path, hidden });
    await load();
  }, [write, load]);

  const reorder = useCallback(async (paths) => {
    const { error } = await supabase.from('store_category_names').upsert(
      paths.map((path, position) => ({ tenant_id: tenantId, path, position })),
      { onConflict: 'tenant_id,path' },
    );
    if (error) throw error;
    await load();
  }, [tenantId, load]);

  // Null sends a product to Odds and ends.
  const move = useCallback(async (ids, path, { reload = true } = {}) => {
    if (!ids.length) return;
    // In batches: three hundred ids in one filter is a URL long enough to be refused.
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('store_products')
        .update({ section: path || null })
        .eq('tenant_id', tenantId)
        .in('id', ids.slice(i, i + 100));
      if (error) throw error;
    }
    if (reload) await load();
  }, [tenantId, load]);

  // Its products and its addresses go to the section that takes over, or to Odds and ends, so no link ever breaks.
  const remove = useCallback(async (dept, successor = null, { reload = true } = {}) => {
    const moved = await supabase.from('store_products').update({ section: successor?.path ?? null })
      .eq('tenant_id', tenantId).eq('section', dept.path);
    if (moved.error) throw moved.error;
    if (successor) {
      const aliases = [...new Set([...(successor.aliases ?? []), dept.slug, ...(dept.aliases ?? [])]
        .filter((a) => a && a !== successor.slug))];
      const { error: aErr } = await supabase.from('store_category_names').update({ aliases })
        .eq('tenant_id', tenantId).eq('path', successor.path);
      if (aErr) throw aErr;
    }
    const { error } = await supabase.from('store_category_names').delete()
      .eq('tenant_id', tenantId).eq('path', dept.path);
    if (error) throw error;
    if (reload) await load();
  }, [tenantId, load]);

  return { ...state, reload: load, create, rename, setHidden, reorder, move, remove };
}
