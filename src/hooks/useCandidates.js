import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// The unique constraint on candidate_id makes this a to-one embed, so PostgREST
// returns an object here and an array elsewhere. Take either.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
}

function flatten(row) {
  const { decisions, candidate_notes: notes, candidate_sources: sources, ...candidate } = row;
  return {
    ...candidate,
    decision: one(decisions),
    notes: [...(notes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    sources: [...(sources ?? [])].sort(
      (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
    ),
  };
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
        classification, tier, score, component_count, breakdown,
        ebay_category_id, ebay_category_path, cluster, variation_count,
        monthly_headroom,
        confidence, signal_count, signals, margin,
        headroom, hold, same_sku_sellers, bulky, routes, window_series,
        sold_30d, avg_sold_price, active_listings, sell_through, trend,
        seller_concentration, competition, window_start, window_end,
        recommended_channels, recommended_volume, analyst_note,
        decisions ( id, action, reason, note, decided_at ),
        candidate_notes ( id, body, created_at ),
        candidate_sources (
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on
        )
      `)
      .eq('batch_id', batchId)
      .order('score', { ascending: false, nullsFirst: false })
      .order('monthly_headroom', { ascending: false, nullsFirst: false });

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

  // A note is not a decision, so it does not touch the decision row and does
  // not need one to exist.
  const addNote = useCallback(
    async ({ candidateId, tenantId, body }) => {
      const text = String(body ?? '').trim();
      if (!text) return;

      const { data, error } = await supabase
        .from('candidate_notes')
        .insert({ candidate_id: candidateId, tenant_id: tenantId, body: text })
        .select('id, body, created_at')
        .single();

      if (error) throw error;

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId
          ? { ...r, notes: [data, ...(r.notes ?? [])] }
          : r)),
      }));
    },
    [],
  );

  // She enters her own suppliers. Ours is one row among hers, not the only one.
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

  return { ...state, reload: load, decide, clear, addNote, addSource };
}

// undefined while resolving, null when there is genuinely no batch. Without the
// distinction the empty state flashes on every load.
// Every delivered batch, newest first. Retired ones are excluded here rather
// than filtered at the call site, because a retired batch is one she has
// already been told is withdrawn and showing it again undoes that.
//
// This replaces a query that took the newest batch and stopped. That was
// correct while there was one category, and the moment a second landed it
// hid the first: 201 mobility candidates she was midway through disappeared
// behind a batch of duvet covers delivered a day later.
export function useBatches(tenantId) {
  const [batches, setBatches] = useState(undefined);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('batches')
      .select('id, delivered_for, status, candidate_count, sources_used, category_label, term')
      .eq('tenant_id', tenantId)
      .eq('status', 'delivered')
      .is('retired_at', null)
      .order('delivered_for', { ascending: false })
      .then(({ data }) => setBatches(data ?? []));
  }, [tenantId]);

  return batches;
}

export function useLatestBatch(tenantId) {
  const batches = useBatches(tenantId);
  if (batches === undefined) return undefined;
  return batches[0] ?? null;
}
