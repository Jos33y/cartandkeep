import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

const PAGE = 1000;

// Supabase returns at most 1,000 rows a request, so Coverage sat at "1,000 checked" however many there were.
async function everyRow(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...data);
    if (data.length < PAGE) return { data: rows, error: null };
  }
}

export function useQueryCoverage(batchIds) {
  const [state, setState] = useState({ status: 'loading', queries: [], candidates: [], error: null });
  const key = (batchIds ?? []).join(',');

  const load = useCallback(async () => {
    if (!key) return setState({ status: 'ready', queries: [], candidates: [], error: null });
    const ids = key.split(',');
    setState((st) => ({ ...st, status: 'loading' }));

    const [q, c] = await Promise.all([
      everyRow(() => supabase
        .from('research_queries')
        .select(`
          id, batch_id, query, outcome, reason, reasons, shelf_product, shelf_price,
          competitors, median_price, market_per_month, entry_feedback, max_goods, net
        `)
        .in('batch_id', ids)
        .order('id')),
      everyRow(() => supabase
        .from('candidates')
        .select('id, batch_id, ebay, category_top_id, decisions ( action )')
        .in('batch_id', ids)
        .order('id')),
    ]);

    const error = q.error ?? c.error;
    if (error) return setState({ status: 'error', queries: [], candidates: [], error });

    setState({
      status: 'ready',
      queries: q.data,
      // To-one embed comes back as an object here and an array elsewhere.
      candidates: c.data.map(({ decisions, ...r }) => ({
        ...r,
        decision: Array.isArray(decisions) ? decisions[0] ?? null : decisions ?? null,
      })),
      error: null,
    });
  }, [key]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
