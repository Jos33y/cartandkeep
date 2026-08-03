import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// Same to-one embed as the candidates read.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
}

// Approved is not batch scoped. What she committed to three weeks ago is still
// waiting to be listed, so this reads across every batch.
export function useApproved(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        id, title, category, external_ref, reference_url, classification,
        image_url, ebay_category_id, ebay_category_path, variation_count,
        score, breakdown, margin, headroom, hold, same_sku_sellers, bulky,
        sold_30d, avg_sold_price, window_start, window_series,
        recommended_channels,
        batches ( delivered_for ),
        decisions!inner ( action, decided_at, note )
      `)
      .eq('tenant_id', tenantId)
      .eq('decisions.action', 'approve')
      .order('score', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      rows: data.map(({ decisions, batches, ...c }) => ({
        ...c,
        decision: one(decisions),
        delivered_for: batches?.delivered_for ?? null,
      })),
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
