import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Coverage for the Google best sellers route. The funnel is drawn from store_coverage_summary, counts only; the
 * 26,000 products behind it are read a reason at a time, when she opens one. Her decisions come from the cards.
 */

const PAGE = 1000;
export const ROWS = 50;

// The table arrives with 0111. Until it has run, the route says so rather than failing.
const missing = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''));

async function everyRow(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < PAGE) return { data: rows, error: null };
  }
}

export function useStoreCoverage(batchIds) {
  const [state, setState] = useState({ status: 'loading', summary: [], candidates: [], error: null });
  const key = (batchIds ?? []).join(',');

  const load = useCallback(async () => {
    if (!key) return setState({ status: 'ready', summary: [], candidates: [], error: null });
    const ids = key.split(',');
    setState((st) => ({ ...st, status: 'loading' }));

    const [s, c] = await Promise.all([
      everyRow(() => supabase
        .from('store_coverage_summary')
        .select('batch_id, stage, reason, season, products, ranked_more_than_once, searched_by_need')
        .in('batch_id', ids)
        .order('batch_id')
        .order('stage')
        .order('reason')
        .order('season')),
      everyRow(() => supabase
        .from('candidates')
        .select('id, batch_id, ebay, decisions ( action )')
        .in('batch_id', ids)
        .order('id')),
    ]);

    if (c.error) return setState({ status: 'error', summary: [], candidates: [], error: c.error });
    const candidates = c.data.map(({ decisions, ...r }) => ({
      ...r,
      decision: Array.isArray(decisions) ? decisions[0] ?? null : decisions ?? null,
    }));
    if (missing(s.error)) return setState({ status: 'absent', summary: [], candidates, error: null });
    if (s.error) return setState({ status: 'error', summary: [], candidates: [], error: s.error });
    setState({ status: 'ready', summary: s.data, candidates, error: null });
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

// A product with no season reads as All year, as it does on the chips.
const withSeason = (q, season) => {
  if (!season) return q;
  return season === 'All year' ? q.or('season.eq."All year",season.is.null') : q.eq('season', season);
};

// The products that stopped for one reason, best ranked first.
export async function readReason({ batchIds, stage, reason, season, from = 0 }) {
  let q = supabase
    .from('store_coverage')
    .select('id, title, brand, rank, months, season, need, google_min, google_max, shop, shop_url, cost, candidate_id')
    .in('batch_id', batchIds)
    .eq('stage', stage);
  q = reason ? q.eq('reason', reason) : q.is('reason', null);
  const { data, error } = await withSeason(q, season)
    .order('rank', { ascending: true, nullsFirst: false })
    .order('id')
    .range(from, from + ROWS - 1);
  if (error) throw error;
  return data;
}

// The gap by brand: which shop to collect next. One row per brand once summed across batches and seasons.
export async function readGap({ batchIds, season }) {
  const { data, error } = await everyRow(() => withSeason(supabase
    .from('store_coverage_gap')
    .select('brand, season, unseen, best_rank')
    .in('batch_id', batchIds), season)
    .order('brand'));
  if (error) throw error;
  const by = new Map();
  for (const g of data) {
    const k = g.brand?.trim() || '';
    const cur = by.get(k) ?? { brand: k, unseen: 0, best: null };
    cur.unseen += g.unseen;
    if (g.best_rank != null && (cur.best == null || g.best_rank < cur.best)) cur.best = g.best_rank;
    by.set(k, cur);
  }
  return [...by.values()].sort((a, b) => b.unseen - a.unseen || (a.best ?? 1e9) - (b.best ?? 1e9));
}

// Winter and Christmas products that reached her: they need listing by late October.
export async function readSoon({ batchIds }) {
  const { data, error } = await supabase
    .from('store_coverage')
    .select('id, title, brand, rank, season, candidate_id')
    .in('batch_id', batchIds)
    .eq('stage', 'sent')
    .in('season', ['Winter', 'Christmas'])
    .order('rank', { ascending: true, nullsFirst: false })
    .limit(12);
  if (error) throw error;
  return data;
}
