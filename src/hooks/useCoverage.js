import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

export function useCoverage(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('research_terms')
      .select(`
        id, term, ebay_category_id, ebay_category_path,
        outcome, outcome_note, listable_count, stock_count,
        first_swept_on, last_swept_on,
        research_windows ( window_month, avg_price, avg_postage, sell_through, sellers )
      `)
      .eq('tenant_id', tenantId)
      .order('stock_count', { ascending: false });

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      rows: data.map(({ research_windows: w, ...t }) => ({
        ...t,
        windows: [...(w ?? [])].sort((a, b) => a.window_month.localeCompare(b.window_month)),
      })),
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
