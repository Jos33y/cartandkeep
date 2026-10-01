import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * What is live, a page at a time, from the live_listings view (migration 0120): sorted, filtered and counted in the
 * database, so 5,000 listings cost the page what 60 do. The counts come from the same rows the list does, so a tab's
 * number and its list always agree.
 */
export const PAGE = 60;

export const SORTS = {
  sold: { column: 'sold', label: 'Sold' },
  views: { column: 'views', label: 'Opened, 90 days' },
  price: { column: 'price', label: 'Price' },
  available: { column: 'available', label: 'Left' },
  title: { column: 'title', label: 'Product' },
};

const COLUMNS = 'key, listing_id, candidate_id, product_id, title, image_url, price, available, impressions, views, orders_window, window_start, window_end, sold, refunded, on_ebay, on_shop, shop_state, shop_slug, shop_price, since, shop_views, shop_quick_views, shop_saves, shop_adds, shop_removes, shop_sold, views_all';

// The view's filters for a tab and a filter chip, as PostgREST conditions.
export function conditions({ tab = 'all', show = null, find = '' } = {}) {
  const out = [];
  if (tab === 'both') out.push(['eq', 'on_ebay', true], ['eq', 'on_shop', true]);
  if (tab === 'ebayOnly') out.push(['eq', 'on_ebay', true], ['eq', 'on_shop', false]);
  if (tab === 'shopOnly') out.push(['eq', 'on_ebay', false]);
  if (show === 'out') out.push(['eq', 'available', 0]);
  if (show === 'low') out.push(['gte', 'available', 1], ['lte', 'available', 2]);
  if (show === 'quiet') out.push(['eq', 'on_ebay', true], ['eq', 'views', 0]);
  if (show === 'noShop') out.push(['eq', 'on_ebay', true], ['is', 'shop_state', null]);
  if (show === 'selling') out.push(['gt', 'sold', 0]);
  // On sale on her shop, saved or put in a basket, never bought: the Interest page's question, asked of the live list.
  if (show === 'wanted') out.push(['eq', 'on_shop', true], ['eq', 'shop_sold', 0], ['or', 'shop_adds.gt.0,shop_saves.gt.0']);
  const q = find.trim().replace(/[%,()*]/g, ' ').trim();
  if (q) out.push(q.replace(/\D/g, '').length >= 9 && /^\d+$/.test(q) ? ['eq', 'listing_id', q] : ['ilike', 'title', `%${q}%`]);
  return out;
}

export function useLiveListings(tenantId, { tab, show, find, sort, dir }) {
  const [state, setState] = useState({ status: 'loading', rows: [], total: 0, error: null, more: false });
  const [counts, setCounts] = useState(null);
  const [sold, setSold] = useState(null);
  const ask = useRef(0);

  const query = useCallback((from) => {
    let q = supabase.from('live_listings').select(COLUMNS, { count: from === 0 ? 'exact' : undefined }).eq('tenant_id', tenantId);
    for (const [op, col, val] of conditions({ tab, show, find })) q = op === 'or' ? q.or(col) : q[op](col, val);
    const column = SORTS[sort]?.column ?? 'sold';
    const ascending = dir === 'asc';
    q = q.order(column, { ascending, nullsFirst: false });
    // A steady order inside equal values, so paging never repeats or skips a row.
    if (column !== 'views') q = q.order('views', { ascending: false, nullsFirst: false });
    return q.order('key', { ascending: true }).range(from, from + PAGE - 1);
  }, [tenantId, tab, show, find, sort, dir]);

  // The first page, again whenever the tab, the filter, the search or the sort changes.
  useEffect(() => {
    if (!tenantId) return undefined;
    const n = ++ask.current;
    setState((s) => ({ ...s, status: s.rows.length ? 'refreshing' : 'loading' }));
    const t = setTimeout(async () => {
      const { data, error, count } = await query(0);
      if (n !== ask.current) return;
      if (error) { setState({ status: 'error', rows: [], total: 0, error: error.message, more: false }); return; }
      setState({ status: 'ready', rows: data ?? [], total: count ?? (data ?? []).length, error: null, more: (data ?? []).length === PAGE });
    }, find ? 220 : 0);
    return () => clearTimeout(t);
  }, [tenantId, query, find]);

  const loadMore = useCallback(async () => {
    if (state.status !== 'ready' || !state.more) return;
    const n = ask.current;
    setState((s) => ({ ...s, status: 'more' }));
    const { data, error } = await query(state.rows.length);
    if (n !== ask.current) return;
    if (error) { setState((s) => ({ ...s, status: 'ready', more: false, error: error.message })); return; }
    setState((s) => {
      const have = new Set(s.rows.map((r) => r.key));
      const rows = [...s.rows, ...(data ?? []).filter((r) => !have.has(r.key))];
      return { ...s, status: 'ready', rows, more: (data ?? []).length === PAGE && rows.length < s.total };
    });
  }, [query, state.status, state.more, state.rows.length]);

  // Counts for the header, tabs and filters, and units sold on every channel since the first sale (the Overview's figure).
  const loadCounts = useCallback(async () => {
    if (!tenantId) return;
    const [c, u] = await Promise.all([
      supabase.rpc('live_listing_counts', { p_tenant: tenantId }),
      supabase.from('store_channel_profit').select('units, month').eq('tenant_id', tenantId),
    ]);
    if (!c.error) setCounts(c.data);
    if (!u.error) {
      const months = (u.data ?? []).map((r) => r.month).filter(Boolean).sort();
      setSold({ units: (u.data ?? []).reduce((s, r) => s + Number(r.units ?? 0), 0), since: months[0] ?? null });
    }
  }, [tenantId]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const reload = useCallback(() => {
    loadCounts();
    ask.current += 1;
    const n = ask.current;
    query(0).then(({ data, error, count }) => {
      if (n !== ask.current || error) return;
      setState({ status: 'ready', rows: data ?? [], total: count ?? 0, error: null, more: (data ?? []).length === PAGE });
    });
  }, [loadCounts, query]);

  /*
   * Her eBay listings onto the shop as drafts, ten to a call (the ebay-import function's limit), through the same
   * function the Traffic page uses. Drafts wait in Products; nothing goes on sale here.
   */
  const addToShop = useCallback(async (listingIds, onProgress) => {
    const added = [];
    const skipped = [];
    for (let i = 0; i < listingIds.length; i += 10) {
      const part = listingIds.slice(i, i + 10);
      const { data, error } = await supabase.functions.invoke('ebay-import', { body: { tenant_id: tenantId, listing_ids: part } });
      if (error || data?.error) {
        const said = error ? await error.context?.json?.().catch(() => null) : null;
        part.forEach((id) => skipped.push({ listing_id: id, reason: data?.error ?? said?.error ?? error.message }));
      } else {
        added.push(...(data?.added ?? []));
        skipped.push(...(data?.skipped ?? []));
      }
      onProgress?.(Math.min(i + 10, listingIds.length), listingIds.length);
    }
    return { added, skipped };
  }, [tenantId]);

  // The card behind a listing published from the portal, read when its row is opened: Update on eBay needs it.
  const cardOf = useCallback(async (candidateId) => {
    const { data, error } = await supabase.from('candidates')
      .select('id, title, image_url, listing, draft, ebay, margin')
      .eq('tenant_id', tenantId).eq('id', candidateId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }, [tenantId]);

  const updateOnEbay = useCallback(async (candidateId, { price, quantity, parcel }) => {
    const { data, error } = await supabase.functions.invoke('ebay-list', {
      body: { tenant_id: tenantId, candidate_id: candidateId, update: true, price: Number(price), quantity: Number(quantity), package: parcel },
    });
    if (error || data?.error) throw new Error(data?.error ?? error.message);
    return data;
  }, [tenantId]);

  // eBay's own copy of a listing, including edits made outside the portal.
  const readLive = useCallback(async (listingId) => {
    const { data, error } = await supabase.functions.invoke('ebay-item', { body: { tenant_id: tenantId, listing_id: listingId } });
    if (error || data?.error) throw new Error(data?.error ?? error.message);
    return data;
  }, [tenantId]);

  return { ...state, counts, sold, loadMore, reload, addToShop, cardOf, updateOnEbay, readLive };
}

// Live counts alone, for the Overview: the same numbers the Listings page shows.
export function useLiveCounts(tenantId) {
  const [counts, setCounts] = useState(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    if (!tenantId) return;
    supabase.rpc('live_listing_counts', { p_tenant: tenantId }).then(({ data, error }) => {
      setCounts(error ? null : data);
      setStatus(error ? 'error' : 'ready');
    });
  }, [tenantId]);
  return { status, counts };
}
