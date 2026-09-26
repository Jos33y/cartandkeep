import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '@hooks/useTenant';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { PAGE_SIZE, fetchCardsByIds, fetchFacets, fetchGroupCounts, fetchPage, fetchProduct, filterArgs } from '@lib/catalogue';
import { withVariants } from '@hooks/useStoreProducts';
import { groupsFromCounts } from '@utils/categories';

// undefined while the tenant loads, null when there is none: every hook here waits on the first and gives up on the second.
function useTenantId() {
  const tenant = useTenant();
  return tenant === undefined ? undefined : (tenant?.id ?? null);
}

// Results kept for the visit, so Back and returning to a filter are instant. Bounded, oldest out first.
const MAX_ENTRIES = 60;
function remember(cache, key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

const groupCache = new Map();

export function useGroups() {
  const tenantId = useTenantId();
  const names = useCategoryNames();
  const [state, setState] = useState(() => ({ status: 'loading', counts: groupCache.get(tenantId) ?? null, error: null }));

  useEffect(() => {
    if (tenantId === undefined) return undefined;
    if (tenantId === null) { setState({ status: 'error', counts: null, error: new Error('No shop') }); return undefined; }
    if (groupCache.has(tenantId)) { setState({ status: 'ready', counts: groupCache.get(tenantId), error: null }); return undefined; }
    let live = true;
    fetchGroupCounts(tenantId)
      .then((counts) => { groupCache.set(tenantId, counts); if (live) setState({ status: 'ready', counts, error: null }); })
      .catch((error) => { console.error('[store] section counts did not load', error); if (live) setState({ status: 'error', counts: null, error }); });
    return () => { live = false; };
  }, [tenantId]);

  const groups = useMemo(() => (state.counts ? groupsFromCounts(state.counts, { names }) : []), [state.counts, names]);
  const total = useMemo(() => (state.counts ?? []).reduce((n, c) => n + c.count, 0), [state.counts]);
  return { status: state.status, groups, total, error: state.error };
}

const pageCache = new Map();
const keyOf = (tenantId, filters, limit) => JSON.stringify([filterArgs(tenantId, filters), filters?.sort ?? 'featured', limit]);

// Pages of cards for a filter: the first page, then "show more" appends; the next page is fetched ahead so it lands instantly.
export function useBrowse(filters, { limit = PAGE_SIZE, enabled = true } = {}) {
  const tenantId = useTenantId();
  const key = tenantId && enabled ? keyOf(tenantId, filters, limit) : null;
  const [state, setState] = useState(() => {
    const hit = key ? pageCache.get(key) : null;
    return hit ? { status: 'ready', ...hit, error: null } : { status: 'loading', items: [], total: null, error: null };
  });
  const request = useRef(0);
  const ahead = useRef(null);

  const prefetch = useCallback((k, offset) => {
    if (!tenantId) return;
    ahead.current = { key: k, offset, promise: fetchPage(tenantId, filters, { offset, limit }).catch(() => null) };
  }, [tenantId, filters, limit]);

  useEffect(() => {
    if (tenantId === undefined || !key) return undefined;
    const hit = pageCache.get(key);
    if (hit) {
      setState({ status: 'ready', ...hit, error: null });
      return undefined;
    }
    const id = ++request.current;
    const controller = new AbortController();
    setState((s) => ({ ...s, status: s.items.length ? 'refreshing' : 'loading', error: null }));
    fetchPage(tenantId, filters, { signal: controller.signal, limit })
      .then(({ items, total }) => {
        if (id !== request.current) return;
        const value = { items, total };
        remember(pageCache, key, value);
        setState({ status: 'ready', ...value, error: null });
        if (total > items.length) prefetch(key, items.length);
      })
      .catch((error) => {
        if (id !== request.current || controller.signal.aborted) return;
        console.error('[store] products did not load', error);
        setState((s) => ({ ...s, status: 'error', error }));
      });
    return () => controller.abort();
  }, [key]);

  const loadMore = useCallback(async () => {
    if (!key || state.status === 'more' || state.total === null || state.items.length >= state.total) return;
    const offset = state.items.length;
    setState((s) => ({ ...s, status: 'more' }));
    try {
      const pending = ahead.current?.key === key && ahead.current.offset === offset
        ? ahead.current.promise
        : fetchPage(tenantId, filters, { offset, limit });
      const page = (await pending) ?? await fetchPage(tenantId, filters, { offset, limit });
      // Keyed by id, so a product that moved between pages while they loaded is never shown twice.
      const seen = new Set(state.items.map((p) => p.id));
      const items = [...state.items, ...page.items.filter((p) => !seen.has(p.id))];
      const value = { items, total: page.total ?? state.total };
      remember(pageCache, key, value);
      setState({ status: 'ready', ...value, error: null });
      if (value.total > items.length) prefetch(key, items.length);
    } catch (error) {
      console.error('[store] more products did not load', error);
      setState((s) => ({ ...s, status: 'error', error }));
    }
  }, [key, state, tenantId, filters, prefetch, limit]);

  return {
    status: state.status,
    items: state.items,
    total: state.total,
    error: state.error,
    hasMore: state.total !== null && state.items.length < state.total,
    loadMore,
    pageSize: limit,
  };
}

const facetCache = new Map();

// The counts behind the filters, a moment after the filters stop changing, so a dragged slider does not fire a request per pixel.
export function useFacets(filters, { delay = 140 } = {}) {
  const tenantId = useTenantId();
  const key = tenantId ? JSON.stringify(filterArgs(tenantId, filters)) : null;
  const [state, setState] = useState(() => ({ status: 'loading', facets: key ? facetCache.get(key) ?? null : null }));

  useEffect(() => {
    if (!key) return undefined;
    if (facetCache.has(key)) { setState({ status: 'ready', facets: facetCache.get(key) }); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchFacets(tenantId, filters, { signal: controller.signal })
        .then((facets) => { remember(facetCache, key, facets); setState({ status: 'ready', facets }); })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error('[store] filter counts did not load', error);
          setState((s) => ({ ...s, status: 'error' }));
        });
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]);

  return state;
}

const productCache = new Map();

// One product by address, shaped exactly as the product page expects today.
export function useProduct(slug) {
  const tenantId = useTenantId();
  const key = tenantId && slug ? `${tenantId}:${slug}` : null;
  const [state, setState] = useState(() => (key && productCache.has(key)
    ? { status: 'ready', product: productCache.get(key) }
    : { status: 'loading', product: null }));

  useEffect(() => {
    if (tenantId === undefined || !slug) return undefined;
    if (!key) { setState({ status: 'ready', product: null }); return undefined; }
    if (productCache.has(key)) { setState({ status: 'ready', product: productCache.get(key) }); return undefined; }
    let live = true;
    setState({ status: 'loading', product: null });
    fetchProduct(tenantId, slug)
      .then((row) => {
        const product = row ? withVariants(row) : null;
        if (product) remember(productCache, key, product);
        if (live) setState({ status: 'ready', product });
      })
      .catch((error) => { console.error('[store] product did not load', error); if (live) setState({ status: 'error', product: null, error }); });
    return () => { live = false; };
  }, [key, tenantId, slug]);

  return state;
}

// Hovering a card starts the product page's request, so the click lands on a page that is already there.
export function prefetchProduct(tenantId, slug) {
  const key = `${tenantId}:${slug}`;
  if (!tenantId || !slug || productCache.has(key)) return;
  fetchProduct(tenantId, slug).then((row) => { if (row) remember(productCache, key, withVariants(row)); }).catch(() => {});
}

// Saved products as cards, live ones only; the difference from the ids given is what has gone.
export function useCards(ids) {
  const tenantId = useTenantId();
  const key = tenantId ? `${tenantId}:${(ids ?? []).join(',')}` : null;
  const [state, setState] = useState({ status: 'loading', items: [] });
  useEffect(() => {
    if (!key) return undefined;
    if (!ids?.length) { setState({ status: 'ready', items: [] }); return undefined; }
    let live = true;
    fetchCardsByIds(tenantId, ids)
      .then((items) => { if (live) setState({ status: 'ready', items }); })
      .catch((error) => { console.error('[store] saved products did not load', error); if (live) setState({ status: 'error', items: [] }); });
    return () => { live = false; };
  }, [key]);
  return state;
}
