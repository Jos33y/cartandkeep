import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Her own listing traffic.
 *
 * The one measurement on this project that separates a dead listing from a dead
 * market. Browse gives price, seller, age and sold quantity for everyone's
 * listings and impressions for nobody's, so until this a listing nobody sees
 * and a listing everybody ignores looked the same.
 *
 * Read from the table, not from eBay. The report covers a window, it is slow,
 * and the same numbers are read many times. Pulling is a deliberate act.
 */

// Why a listing is not selling, from the two ratios.
//
//   nothing shown    the title carries no search volume
//   shown, no opens  the photograph or the price is wrong
//   opened, no sales the listing itself is wrong
export function diagnose(r) {
  if (!r.impressions) return 'unseen';
  if (!r.views) return 'ignored';
  if (!r.transactions) return 'unconvincing';
  return 'selling';
}

/*
 * What a listing that is not converting is costing her.
 *
 * Measured against her own selling listings rather than against a published
 * benchmark, because a rate from an article is somebody else's account in
 * somebody else's category. If the listings that do sell convert at some rate,
 * a listing with views and no sales is short of that rate, and the shortfall
 * times the price is what the fault is worth.
 *
 * An ordering device, not a forecast. It says fix this one before that one.
 */
export function atStake(row, benchmark) {
  if (!benchmark || !row.views || row.transactions) return 0;
  const expected = row.views * benchmark;
  return Math.round(expected * Number(row.price ?? 0));
}

// The median conversion of the listings that are actually selling. Median
// rather than mean, because one listing converting at 20% would drag a mean
// into fiction.
export function benchmarkOf(listings) {
  const rates = listings
    .filter((r) => r.transactions > 0 && r.views > 0)
    .map((r) => r.transactions / r.views)
    .sort((a, b) => a - b);
  if (!rates.length) return null;
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
}

export const VERDICTS = {
  unseen: {
    label: 'Never shown',
    note: 'No search volume on the title. Rewriting it is the only fix.',
  },
  ignored: {
    label: 'Shown, not opened',
    note: 'Passed over in results. The photograph or the price.',
  },
  unconvincing: {
    label: 'Opened, not bought',
    note: 'Read and abandoned. Check the description, postage and price.',
  },
  selling: { label: 'Selling', note: 'Converting. Nothing to do here.' },
};

export function useEbayTraffic(tenantId) {
  const [state, setState] = useState({ status: 'loading', total: null, listings: [], days: [], sales: [], error: null });
  const [pulling, setPulling] = useState(false);
  const [onShop, setOnShop] = useState(() => new Map());

  // Which listings already have a shop product: copied from the listing, or published to eBay from the portal.
  const loadShop = useCallback(async () => {
    if (!tenantId) return;
    const [copied, published] = await Promise.all([
      supabase.from('store_products').select('id, status, source_ref')
        .eq('tenant_id', tenantId).eq('source_kind', 'ebay_listing'),
      supabase.from('candidates').select('ebay, store_products ( id, status )')
        .eq('tenant_id', tenantId).not('ebay', 'is', null),
    ]);
    const map = new Map();
    for (const p of copied.data ?? []) map.set(String(p.source_ref), { id: p.id, status: p.status });
    for (const c of published.data ?? []) {
      const p = (c.store_products ?? [])[0];
      if (p && c.ebay?.listing_id) map.set(String(c.ebay.listing_id), { id: p.id, status: p.status });
    }
    setOnShop(map);
  }, [tenantId]);

  useEffect(() => { loadShop(); }, [loadShop]);

  // Ten listings a call, so a long run reports as it goes and one bad listing costs only itself.
  const bringToShop = useCallback(async (listingIds, sections, onProgress) => {
    const added = [];
    const skipped = [];
    for (let i = 0; i < listingIds.length; i += 10) {
      const chunk = listingIds.slice(i, i + 10);
      const { data, error } = await supabase.functions.invoke('ebay-import', {
        body: { tenant_id: tenantId, listing_ids: chunk, sections },
      });
      if (error || data?.error) {
        skipped.push(...chunk.map((id) => ({ listing_id: id, reason: data?.error ?? error.message })));
      } else {
        added.push(...(data.added ?? []));
        skipped.push(...(data.skipped ?? []));
      }
      onProgress?.(Math.min(i + chunk.length, listingIds.length), listingIds.length);
    }
    await loadShop();
    return { added, skipped };
  }, [tenantId, loadShop]);

  const load = useCallback(async () => {
    if (!tenantId) return;

    // The newest window, whatever it is. A window is one pull, so the newest
    // window_end is the newest pull.
    const { data: recent, error: e1 } = await supabase
      .from('ebay_traffic')
      .select('window_start, window_end')
      .eq('tenant_id', tenantId)
      .order('window_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (e1) return setState({ status: 'error', total: null, listings: [], days: [], sales: [], error: e1.message });
    if (!recent) return setState({ status: 'empty', total: null, listings: [], days: [], sales: [], error: null });

    const { data, error } = await supabase
      .from('ebay_traffic')
      .select('listing_id, title, image_url, price, currency, impressions, views, click_rate, transactions, conversion_rate, window_start, window_end, fetched_at, ended_at, quantity_sold')
      .eq('tenant_id', tenantId)
      .eq('window_start', recent.window_start)
      .eq('window_end', recent.window_end)
      .order('impressions', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', total: null, listings: [], days: [], sales: [], error: error.message });

    // The account total is the row with no listing on it.
    const total = data.find((r) => !r.listing_id) ?? null;
    const listings = data.filter((r) => r.listing_id);

    // The day by day series, for the chart. Separate table, because a daily row
    // and a per listing row share no columns worth sharing a table for.
    const { data: days } = await supabase
      .from('ebay_traffic_daily')
      .select('day, impressions, views, transactions')
      .eq('tenant_id', tenantId)
      .gte('day', recent.window_start)
      .lte('day', recent.window_end)
      .order('day');

    // The traffic report counts sales per listing; which day each sold comes from the orders.
    const { data: sales } = await supabase
      .from('channel_sales')
      .select('external_ref, line_no, external_sku, title, sold_at, qty, gross')
      .eq('tenant_id', tenantId)
      .eq('channel', 'ebay')
      .eq('status', 'paid')
      .order('sold_at', { ascending: false })
      .limit(500);

    setState({ status: 'ready', total, listings, days: days ?? [], sales: sales ?? [], error: null });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const pull = useCallback(async (days = 90) => {
    setPulling(true);
    const { data, error } = await supabase.functions.invoke('ebay-traffic', {
      body: { tenant_id: tenantId, days },
    });
    // Every order eBay still holds (two years), all pages: sales from July on were missing because this asked for
    // 30 days and the morning run for 60, so an order that aged past both never came in unless an export did.
    const sales = error || data?.error
      ? null
      : await supabase.functions.invoke('ebay-sales', { body: { tenant_id: tenantId } });
    setPulling(false);
    if (error || data?.error) {
      setState((s) => ({ ...s, error: data?.error ?? error.message }));
      return null;
    }
    if (sales?.error || sales?.data?.error) {
      setState((s) => ({ ...s, error: `Traffic pulled, recent orders not: ${sales.data?.error ?? sales.error.message}` }));
    }
    await load();
    return data;
  }, [tenantId, load]);

  return { ...state, pulling, pull, reload: load, onShop, bringToShop };
}
