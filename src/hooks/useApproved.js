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
        decisions!inner ( action, decided_at, note ),
        candidate_sources (
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('decisions.action', 'approve')
      .order('score', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      rows: data.map(({ decisions, batches, candidate_sources: sources, ...c }) => ({
        ...c,
        decision: one(decisions),
        delivered_for: batches?.delivered_for ?? null,
        sources: [...(sources ?? [])].sort(
          (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
        ),
      })),
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // She prices from this page, so a supplier has to be addable here rather than
  // only on the candidate queue.
  const addSource = useCallback(
    async ({ candidateId, tenantId, ...fields }) => {
      const { data, error } = await supabase
        .from('candidate_sources')
        .insert({ candidate_id: candidateId, tenant_id: tenantId, ...fields })
        .select(`
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on
        `)
        .single();

      if (error) throw error;

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId
          ? {
            ...r,
            sources: [...(r.sources ?? []), data].sort(
              (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
            ),
          }
          : r)),
      }));
    },
    [],
  );

  return { ...state, reload: load, addSource };
}
