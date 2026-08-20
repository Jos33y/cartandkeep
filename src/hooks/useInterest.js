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
 * How sure the reading is, not whether to give one.
 *
 * Computed rather than picked. If a product were converting views to baskets at
 * an ordinary five per cent, zero adds across forty views happens about
 * thirteen per cent of the time. At a hundred it is under one per cent, and
 * even at a true rate of three per cent it is still under five.
 *
 * The first version of this used those thresholds to withhold a verdict below
 * forty views, which was the wrong lesson from the right arithmetic. Twelve
 * views and nothing added is a fact, and telling her it is too early to say is
 * a screen refusing to tell her what it knows. She is not asking whether it is
 * statistically significant. She is asking whether anything is happening.
 *
 * So the numbers always show and the wording changes with how much there is to
 * go on: not wanted yet, then not wanted, then never wanted.
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

  // Zero is a finding, and the most actionable one on the screen. A product
  // nobody has seen is not a product problem, it is a nobody problem, and the
  // fix is on the shop front rather than on the product.
  if (views === 0) return { tone: 'bad', text: 'Nobody has seen it' };

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
    tone: views >= ENOUGH ? 'bad' : 'warn',
    text: views >= CERTAIN
      ? 'Looked at, never wanted'
      : views >= ENOUGH ? 'Looked at, not wanted' : 'Looked at, not wanted yet',
  };
}

export function useInterest(tenantId) {
  const [state, setState] = useState({
    status: 'loading', products: [], searches: [], days: [], sources: [], error: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const [funnel, searches, days, sources] = await Promise.all([
      supabase.from('store_product_funnel').select('*')
        .eq('tenant_id', tenantId).order('views', { ascending: false }).limit(300),
      supabase.from('store_searches').select('*')
        .eq('tenant_id', tenantId).order('searches', { ascending: false }).limit(60),
      supabase.from('store_days').select('*')
        .eq('tenant_id', tenantId).order('day', { ascending: false }).limit(30),
      supabase.from('store_source_days').select('*')
        .eq('tenant_id', tenantId).order('day', { ascending: false }).limit(300),
    ]);

    const error = funnel.error ?? searches.error ?? days.error ?? sources.error;
    if (error) {
      return setState({ status: 'error', products: [], searches: [], days: [], sources: [], error });
    }

    setState({
      status: 'ready',
      // Samples are ours, not hers. A build artefact in her numbers is a number
      // she cannot act on.
      products: (funnel.data ?? []).filter((p) => !p.is_sample),
      searches: searches.data ?? [],
      days: days.data ?? [],
      sources: sources.data ?? [],
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
   * Everything that has been seen and never bought, sorted by how much
   * attention it wasted. No view threshold: a product with twelve views and no
   * basket belongs on this list, lower down, and hiding it until it reaches
   * forty means the screen says nothing for a fortnight.
   */
  const failing = useMemo(() => state.products
    .filter((p) => Number(p.views ?? 0) > 0 && Number(p.purchases ?? 0) === 0)
    .sort((a, b) => Number(b.views) - Number(a.views)), [state.products]);

  const missed = useMemo(() => state.searches.filter((s) => s.never_found), [state.searches]);

  /*
   * Where visits came from, over the window.
   *
   * Summed across days rather than shown as a series, because at this volume a
   * line chart of seven visits a day is a chart of noise. The series is worth
   * building when there is enough of it to have a shape.
   *
   * Ordered by visits, and the buy rate carried alongside, because the useful
   * finding is rarely which channel sends the most people. It is which channel
   * sends people who buy: fifty from TikTok that never reach a basket is worth
   * less than nine from Google that do.
   */
  const sources = useMemo(() => {
    const rolled = new Map();

    for (const row of state.sources) {
      const key = row.source;
      const at = rolled.get(key) ?? {
        source: key, visits: 0, baskets: 0, orders: 0, revenue: 0,
      };
      at.visits += Number(row.visits ?? 0);
      at.baskets += Number(row.visits_with_a_basket ?? 0);
      at.orders += Number(row.orders ?? 0);
      at.revenue += Number(row.revenue ?? 0);
      rolled.set(key, at);
    }

    return [...rolled.values()]
      .map((r) => ({
        ...r,
        // Null rather than zero when nobody came from there, same rule as the
        // product rates: no data and a failing channel are different findings.
        basketRate: r.visits > 0 ? Math.round((r.baskets / r.visits) * 1000) / 10 : null,
        buyRate: r.visits > 0 ? Math.round((r.orders / r.visits) * 1000) / 10 : null,
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [state.sources]);

  return { ...state, totals, failing, missed, sources, reload: load };
}
