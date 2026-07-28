import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { isDemo } from '@lib/mode';
import { DEMO_BATCH, DEMO_CANDIDATES } from '@data/demo';

// Nested array from the join, but unique on candidate_id, so zero or one.
function flatten(row) {
  const { decisions, ...candidate } = row;
  return { ...candidate, decision: decisions?.[0] ?? null };
}

export function useCandidates(batchId) {
  const demo = isDemo();
  const [state, setState] = useState(
    demo
      ? { status: 'ready', rows: DEMO_CANDIDATES.map((c) => ({ ...c })), error: null }
      : { status: 'loading', rows: [], error: null },
  );

  const load = useCallback(async () => {
    if (demo || !batchId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('candidates')
      .select(`
        id, title, category, image_url, supplier_url, external_ref,
        classification, score, component_count, breakdown,
        confidence, signal_count, signals, margin,
        sold_30d, avg_sold_price, active_listings, sell_through, trend,
        seller_concentration, window_start, window_end,
        recommended_channels, recommended_volume, analyst_note,
        decisions ( id, action, reason, note, decided_at )
      `)
      .eq('batch_id', batchId)
      .order('score', { ascending: false, nullsFirst: false });

    if (error) return setState({ status: 'error', rows: [], error });
    setState({ status: 'ready', rows: data.map(flatten), error: null });
  }, [batchId, demo]);

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

      // Demo decisions live in this tab only. Nothing is written.
      if (demo) return;

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
    [demo, load],
  );

  return { ...state, reload: load, decide };
}

export function useLatestBatch(tenantId) {
  const demo = isDemo();
  const [batch, setBatch] = useState(demo ? DEMO_BATCH : null);

  useEffect(() => {
    if (demo || !tenantId) return;
    supabase
      .from('batches')
      .select('id, delivered_for, status, candidate_count, sources_used')
      .eq('tenant_id', tenantId)
      .eq('status', 'delivered')
      .order('delivered_for', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBatch(data));
  }, [tenantId, demo]);

  return batch;
}
