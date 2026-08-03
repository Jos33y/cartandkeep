import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// The unique constraint on candidate_id makes this a to-one embed, so PostgREST
// returns an object here and an array elsewhere. Take either.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
}

function flatten(row) {
  const { decisions, ...candidate } = row;
  return { ...candidate, decision: one(decisions) };
}

export function useCandidates(batchId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!batchId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        id, title, category, image_url, supplier_url, reference_url, external_ref,
        classification, score, component_count, breakdown,
        ebay_category_id, ebay_category_path, variation_count,
        confidence, signal_count, signals, margin,
        headroom, hold, same_sku_sellers, bulky, routes, window_series,
        sold_30d, avg_sold_price, active_listings, sell_through, trend,
        seller_concentration, window_start, window_end,
        recommended_channels, recommended_volume, analyst_note,
        decisions ( id, action, reason, note, decided_at )
      `)
      .eq('batch_id', batchId)
      .order('score', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', rows: [], error });
    setState({ status: 'ready', rows: data.map(flatten), error: null });
  }, [batchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic so a batch can be worked through without a round trip per card.
  const decide = useCallback(
    async ({ candidateId, tenantId, action, reason = null, note = null }) => {
      setState((s) => ({
        ...s,
        rows: s.rows.map((r) =>
          r.id === candidateId
            ? { ...r, decision: { action, reason, note, decided_at: new Date().toISOString() } }
            : r,
        ),
      }));

      const { error } = await supabase
        .from('decisions')
        .upsert(
          { candidate_id: candidateId, tenant_id: tenantId, action, reason, note },
          { onConflict: 'candidate_id' },
        );

      if (error) {
        await load();
        throw error;
      }
    },
    [load],
  );

  // Change means back to undecided. Writing defer again looked like a dead
  // button because the row was already deferred.
  const clear = useCallback(
    async ({ candidateId }) => {
      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId ? { ...r, decision: null } : r)),
      }));

      const { error } = await supabase.from('decisions').delete().eq('candidate_id', candidateId);

      if (error) {
        await load();
        throw error;
      }
    },
    [load],
  );

  return { ...state, reload: load, decide, clear };
}

// undefined while resolving, null when there is genuinely no batch. Without the
// distinction the empty state flashes on every load.
export function useLatestBatch(tenantId) {
  const [batch, setBatch] = useState(undefined);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('batches')
      .select('id, delivered_for, status, candidate_count, sources_used')
      .eq('tenant_id', tenantId)
      .eq('status', 'delivered')
      .order('delivered_for', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBatch(data ?? null));
  }, [tenantId]);

  return batch;
}
