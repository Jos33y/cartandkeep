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

export const VERDICTS = {
  unseen: {
    label: 'Never shown',
    note: 'eBay put it in front of nobody, so the title carries no search volume. Rewriting the title is the only thing that changes this.',
  },
  ignored: {
    label: 'Shown, not opened',
    note: 'People saw it in results and passed. That is the photograph or the price, because those are all a buyer sees before clicking.',
  },
  unconvincing: {
    label: 'Opened, not bought',
    note: 'People looked and left. The listing itself is doing the damage: description, postage cost, or the price against the others on the page.',
  },
  selling: { label: 'Selling', note: 'Working as it should.' },
};

export function useEbayTraffic(tenantId) {
  const [state, setState] = useState({ status: 'loading', total: null, listings: [], error: null });
  const [pulling, setPulling] = useState(false);

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

    if (e1) return setState({ status: 'error', total: null, listings: [], error: e1.message });
    if (!recent) return setState({ status: 'empty', total: null, listings: [], error: null });

    const { data, error } = await supabase
      .from('ebay_traffic')
      .select('listing_id, title, impressions, views, click_rate, transactions, conversion_rate, window_start, window_end, fetched_at')
      .eq('tenant_id', tenantId)
      .eq('window_start', recent.window_start)
      .eq('window_end', recent.window_end)
      .order('impressions', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', total: null, listings: [], error: error.message });

    // The account total is the row with no listing on it.
    const total = data.find((r) => !r.listing_id) ?? null;
    const listings = data.filter((r) => r.listing_id);

    setState({ status: 'ready', total, listings, error: null });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const pull = useCallback(async (days = 90) => {
    setPulling(true);
    const { data, error } = await supabase.functions.invoke('ebay-traffic', {
      body: { tenant_id: tenantId, days },
    });
    setPulling(false);
    if (error || data?.error) {
      setState((s) => ({ ...s, error: data?.error ?? error.message }));
      return null;
    }
    await load();
    return data;
  }, [tenantId, load]);

  return { ...state, pulling, pull, reload: load };
}
