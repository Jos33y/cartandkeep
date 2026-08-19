import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * What people do in the shop.
 *
 * Nine events have been recorded on every page view, product view, save, basket
 * add, removal and search since the storefront shipped, and nothing has ever
 * read them. You cannot run what you cannot see, and most of this fills up long
 * before the first sale: views, saves, adds and searches all start the hour the
 * shop goes public.
 */

/*
 * When a zero starts meaning something.
 *
 * Computed rather than picked. If a product were converting views to baskets at
 * an ordinary five per cent, seeing zero adds across forty views happens about
 * thirteen per cent of the time, which is unlucky rather than damning. At a
 * hundred views it is under one per cent, and even if the true rate were only
 * three per cent it is still under five. So forty is where the screen starts
 * saying anything and a hundred is where it stops hedging.
 *
 * Below forty it shows the number and no verdict, because a verdict from twelve
 * views is a guess wearing a percentage sign.
 */
export const ENOUGH = 40;
export const CERTAIN = 100;

/*
 * What a product's numbers are telling her, in the order the fixes differ.
 *
 * The distinction that earns this function: a product with saves and no sales
 * is a price problem, and a product with views and no saves is a photograph or
 * a description problem. Those are completely different afternoons of work, and
 * a single "poor conversion" flag would collapse them into one.
 */
export function verdict(row) {
  const views = Number(row.views ?? 0);
  const saves = Number(row.saves ?? 0);
  const adds = Number(row.adds ?? 0);
  const removes = Number(row.removes ?? 0);
  const buys = Number(row.purchases ?? 0);

  if (buys > 0) return { tone: 'good', text: 'Selling' };

  if (views < ENOUGH) {
    return views === 0
      ? { tone: 'quiet', text: 'Nobody has seen it' }
      : { tone: 'quiet', text: 'Too early to say' };
  }

  // Wanted, then thought better of once the total appeared. The likeliest
  // reasons are the price and the postage, in that order.
  if (adds > 0 && removes >= adds * 0.5) {
    return { tone: 'warn', text: 'Added, then taken back out' };
  }

  // They want it and they are not buying it today. That is a price question,
  // not a desire question.
  if (adds > 0 || saves > 0) {
    return { tone: 'warn', text: 'Wanted, not bought' };
  }

  return {
    tone: 'bad',
    text: views >= CERTAIN ? 'Looked at, never wanted' : 'Looked at, not wanted yet',
  };
}

export function useInterest(tenantId) {
  const [state, setState] = useState({
    status: 'loading', products: [], searches: [], days: [], error: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const [funnel, searches, days] = await Promise.all([
      supabase.from('store_product_funnel').select('*')
        .eq('tenant_id', tenantId).order('views', { ascending: false }).limit(300),
      supabase.from('store_searches').select('*')
        .eq('tenant_id', tenantId).order('searches', { ascending: false }).limit(60),
      supabase.from('store_days').select('*')
        .eq('tenant_id', tenantId).order('day', { ascending: false }).limit(30),
    ]);

    const error = funnel.error ?? searches.error ?? days.error;
    if (error) return setState({ status: 'error', products: [], searches: [], days: [], error });

    setState({
      status: 'ready',
      // Samples are ours, not hers. A build artefact in her numbers is a number
      // she cannot act on.
      products: (funnel.data ?? []).filter((p) => !p.is_sample),
      searches: searches.data ?? [],
      days: days.data ?? [],
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const d = state.days;
    const sum = (k) => d.reduce((n, r) => n + Number(r[k] ?? 0), 0);

    return {
      visits: sum('visits'),
      productViews: sum('product_views'),
      adds: sum('adds'),
      checkouts: sum('checkouts'),
      days: d.length,
    };
  }, [state.days]);

  /*
   * The products worth her attention, worst first.
   *
   * Sorted by wasted attention rather than by view count, because a product
   * with ninety views and one sale is fine and a product with fifty and nothing
   * is not. Anything below the threshold is left out entirely rather than
   * listed with a hedge beside it.
   */
  const failing = useMemo(() => state.products
    .filter((p) => Number(p.views ?? 0) >= ENOUGH && Number(p.purchases ?? 0) === 0)
    .sort((a, b) => Number(b.views) - Number(a.views)), [state.products]);

  const missed = useMemo(() => state.searches.filter((s) => s.never_found), [state.searches]);

  return { ...state, totals, failing, missed, reload: load };
}
