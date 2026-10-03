import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * What is live, from the live_listings view (migration 0120), read once and worked in the browser (useLiveListings).
 * Each tab and filter number is counted with the same conditions as the list, inside the other choices made, so a
 * number and the list it opens always agree. The rows are drawn 60 at a time, so a long list stays quick to scroll.
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

export const TAB_IDS = ['all', 'both', 'ebayOnly', 'shopOnly'];
export const SHOW_IDS = ['selling', 'noShop', 'out', 'low', 'quiet', 'wanted'];

function filtered(q, choice) {
  for (const [op, col, val] of conditions(choice)) q = op === 'or' ? q.or(col) : q[op](col, val);
  return q;
}

/*
 * The same conditions, read in the browser against a row, the way PostgREST reads them: a missing value never equals
 * anything, and ilike is a case-blind "contains". So a tab or filter here keeps exactly the rows the database would.
 */
const TEST = {
  eq: (v, x) => v != null && v === x,
  gt: (v, x) => v != null && Number(v) > x,
  gte: (v, x) => v != null && Number(v) >= x,
  lte: (v, x) => v != null && Number(v) <= x,
  is: (v, x) => (x === null ? v == null : v === x),
  ilike: (v, x) => v != null && String(v).toLowerCase().includes(String(x).replace(/%/g, '').toLowerCase()),
};
function orTest(row, text) {
  return text.split(',').some((part) => {
    const [col, op, ...rest] = part.split('.');
    const val = Number(rest.join('.'));
    return TEST[op]?.(row[col], Number.isFinite(val) ? val : rest.join('.')) ?? false;
  });
}
export function matches(row, choice) {
  return conditions(choice).every(([op, col, val]) => (op === 'or' ? orTest(row, col) : TEST[op](row[col], val)));
}

// The database's order, in the browser: the column chosen with blanks last, then most opened, then the key.
const byTitle = new Intl.Collator('en-GB', { sensitivity: 'base', numeric: true });
function compare(column, ascending) {
  const one = (col, asc) => (a, b) => {
    const x = a[col];
    const y = b[col];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'string' || typeof y === 'string' ? byTitle.compare(String(x), String(y)) : Number(x) - Number(y);
    return asc ? c : -c;
  };
  const first = one(column, ascending);
  const views = one('views', false);
  return (a, b) => first(a, b) || (column !== 'views' ? views(a, b) : 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

// The header's counts from the rows themselves, with the same rules as live_listing_counts (0122).
export function countsOf(rows, pulledAt = null) {
  const c = (f) => rows.reduce((n, r) => n + (f(r) ? 1 : 0), 0);
  const sum = (col) => rows.reduce((n, r) => n + (r.on_ebay ? Number(r[col] ?? 0) : 0), 0);
  return {
    all: rows.length,
    ebay: c((r) => r.on_ebay),
    shop: c((r) => r.on_shop),
    both: c((r) => r.on_ebay && r.on_shop),
    ebay_only: c((r) => r.on_ebay && !r.on_shop),
    shop_only: c((r) => r.on_shop && !r.on_ebay),
    no_shop: c((r) => r.on_ebay && r.shop_state == null),
    drafts: c((r) => r.on_ebay && r.shop_state === 'draft'),
    out: c((r) => r.available === 0),
    low: c((r) => r.available != null && r.available >= 1 && r.available <= 2),
    quiet: c((r) => r.on_ebay && r.views === 0),
    selling: c((r) => r.sold > 0),
    wanted: c((r) => r.on_shop && Number(r.shop_sold ?? 0) === 0 && (r.shop_adds > 0 || r.shop_saves > 0)),
    ebay_impressions: sum('impressions'),
    ebay_views: sum('views'),
    ebay_orders: sum('orders_window'),
    pulled_at: pulledAt,
  };
}

/*
 * Every live listing, read once when the page opens (and again on reload), then sorted, filtered, searched and
 * counted in the browser. A tab or a filter costs nothing and is instant.
 *
 * Until 3 October each tab change asked the database about twelve times (the page, its total, four tab counts and six
 * filter counts), each a full run of live_listings, and a quick second click stacked twelve more on the first: the
 * "canceling statement due to statement timeout" on Listings. Now the view runs once, and a read still going when a
 * new one starts is cancelled. Comfortable to a few thousand listings; past that, a materialized live_listings.
 */
export function useLiveListings(tenantId, { tab, show, find, sort, dir }) {
  const [all, setAll] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [pulledAt, setPulledAt] = useState(null);
  const [sold, setSold] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const reading = useRef(null);

  const read = useCallback(async () => {
    if (!tenantId) return;
    reading.current?.abort();
    const ctl = new AbortController();
    reading.current = ctl;
    setStatus((s) => (s === 'loading' ? 'loading' : 'refreshing'));
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await supabase.from('live_listings').select(COLUMNS).eq('tenant_id', tenantId)
        .order('key', { ascending: true }).range(from, from + 999).abortSignal(ctl.signal);
      if (ctl.signal.aborted) return;
      if (e) { setError(e.message); setStatus('error'); return; }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const [t, u] = await Promise.all([
      supabase.from('ebay_traffic').select('fetched_at').eq('tenant_id', tenantId).not('listing_id', 'is', null)
        .order('fetched_at', { ascending: false }).limit(1).maybeSingle().abortSignal(ctl.signal),
      supabase.from('store_channel_profit').select('units, month').eq('tenant_id', tenantId).abortSignal(ctl.signal),
    ]);
    if (ctl.signal.aborted) return;
    setPulledAt(t.error ? null : t.data?.fetched_at ?? null);
    if (!u.error) {
      const months = (u.data ?? []).map((r) => r.month).filter(Boolean).sort();
      setSold({ units: (u.data ?? []).reduce((s, r) => s + Number(r.units ?? 0), 0), since: months[0] ?? null });
    }
    setAll(rows);
    setError(null);
    setStatus('ready');
  }, [tenantId]);

  useEffect(() => {
    read();
    return () => reading.current?.abort();
  }, [read]);

  // A new choice starts from the top of the list again.
  useEffect(() => { setShown(PAGE); }, [tab, show, find, sort, dir]);

  const counts = useMemo(() => (all ? countsOf(all, pulledAt) : null), [all, pulledAt]);

  const list = useMemo(() => {
    if (!all) return [];
    const column = SORTS[sort]?.column ?? 'sold';
    return all.filter((r) => matches(r, { tab, show, find })).sort(compare(column, dir === 'asc'));
  }, [all, tab, show, find, sort, dir]);

  // What each tab holds under the filter and search, and each filter under the tab and search.
  const facets = useMemo(() => (all ? {
    tab: Object.fromEntries(TAB_IDS.map((id) => [id, all.filter((r) => matches(r, { tab: id, show, find })).length])),
    show: Object.fromEntries(SHOW_IDS.map((id) => [id, all.filter((r) => matches(r, { tab, show: id, find })).length])),
  } : null), [all, tab, show, find]);

  const rows = useMemo(() => list.slice(0, shown), [list, shown]);
  const loadMore = useCallback(() => setShown((n) => n + PAGE), []);

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

  return {
    status,
    error,
    rows,
    total: list.length,
    more: rows.length < list.length,
    all: all ?? [],
    counts, facets, sold, loadMore, reload: read, addToShop, cardOf, updateOnEbay, readLive,
  };
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
