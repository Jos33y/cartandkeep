import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

export function useQueryCoverage(batchIds) {
  const [state, setState] = useState({ status: 'loading', queries: [], candidates: [], error: null });
  const key = (batchIds ?? []).join(',');

  const load = useCallback(async () => {
    if (!key) return setState({ status: 'ready', queries: [], candidates: [], error: null });
    const ids = key.split(',');
    setState((st) => ({ ...st, status: 'loading' }));

    const [q, c] = await Promise.all([
      supabase
        .from('research_queries')
        .select(`
          id, batch_id, query, outcome, reason, reasons, shelf_product, shelf_price,
          competitors, median_price, market_per_month, entry_feedback, max_goods, net
        `)
        .in('batch_id', ids),
      supabase
        .from('candidates')
        .select('id, batch_id, ebay, decisions ( action )')
        .in('batch_id', ids),
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
