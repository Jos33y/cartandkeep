import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { readPages } from '@lib/readPages';
import { channelStates } from '@lib/golive';

// Same to-one embed as the candidates read.
function one(decisions) {
  if (Array.isArray(decisions)) return decisions[0] ?? null;
  return decisions ?? null;
}

// Evidence first, then value. A median-priced row carries the bigger figure
// precisely because nobody has been paid it.
function byListOrder(a, b) {
  const trust = (r) => (r.margin?.list_trusted === true ? 0 : 1);
  const worth = (r) => r.margin?.net ?? r.margin?.max_goods_cost ?? 0;
  return trust(a) - trust(b) || worth(b) - worth(a);
}

// Approved is not batch scoped. What she committed to three weeks ago is still
// waiting to be listed, so this reads across every batch.
export function useApproved(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    // In pages: past 1,000 approved cards a single read would stop short without saying so.
    const { data, error } = await readPages(() => supabase
      .from('candidates')
      .select(`
        id, title, category, external_ref, reference_url, classification,
        image_url, ebay_category_id, ebay_category_path, variation_count,
        score, breakdown, margin, headroom, hold, same_sku_sellers, bulky,
        entry, monthly_headroom, active_listings,
        listing, draft, ebay, competition,
        store_products ( id, status, slug ),
        sold_30d, avg_sold_price, window_start, window_series,
        recommended_channels,
        batches ( delivered_for ),
        decisions!inner ( action, decided_at, note ),
        candidate_sources (
          id, supplier, supplier_kind, fulfilment, status, url, note,
          unit_cost, moq, price_at_moq, supplier_shipping,
          inbound_freight_per_unit, duty_pct, landed_unit_cost,
          ships_from, transit_days, confirmed, quoted_on, matched_on
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('decisions.action', 'approve'));

    if (error) return setState({ status: 'error', rows: [], error });

    setState({
      status: 'ready',
      // A card stays until every channel it is meant for has started: live on eBay, and on her shop as a draft
      // or on sale. A card on eBay still waiting for the shop stays, with only the shop left to do.
      rows: data.filter((c) => channelStates(c).left.length > 0).map(({ decisions, batches, candidate_sources: sources, ...c }) => ({
        ...c,
        decision: one(decisions),
        delivered_for: batches?.delivered_for ?? null,
        sources: [...(sources ?? [])].sort(
          (a, b) => Number(a.landed_unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? 1e9),
        ),
      })).sort(byListOrder),
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
          ships_from, transit_days, confirmed, quoted_on, matched_on
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

  // dry returns what eBay would receive, including the category it suggests
  // from the title, which is the one field nobody can check in advance.
  const list = useCallback(
    async ({ candidateId, dry = false, ...fields }) => {
      const { data, error } = await supabase.functions.invoke('ebay-list', {
        body: { tenant_id: tenantId, candidate_id: candidateId, dry, ...fields },
      });
      if (error || data?.error) throw new Error(data?.error ?? error.message);
      // Live on eBay: the card keeps its place while another channel is left, and goes once none is.
      if (!dry) {
        setState((s) => ({
          ...s,
          rows: s.rows.map((r) => (r.id === candidateId ? { ...r, ebay: data } : r)).filter((r) => channelStates(r).left.length > 0),
        }));
      }
      return data;
    },
    [tenantId],
  );

  // A draft product, never live. The shop is not public yet, and 0036 keeps
  // anything with unconfirmed returns or hazard fields off sale anyway.
  const addToShop = useCallback(
    async ({ candidateId, product }) => {
      const { data, error } = await supabase
        .from('store_products')
        .upsert(
          { tenant_id: tenantId, status: 'draft', source_kind: 'candidate', ...product, candidate_id: candidateId },
          { onConflict: 'tenant_id,slug' },
        )
        .select('id, status, slug')
        .single();

      if (error) throw error;

      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === candidateId ? { ...r, store_products: [data] } : r))
          .filter((r) => channelStates(r).left.length > 0),
      }));
      return data;
    },
    [tenantId],
  );

  return { ...state, reload: load, addSource, list, addToShop };
}
