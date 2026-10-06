import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';
import { RECENT_DAYS, badgeOf, buildAlerts, countsOf } from '@lib/alerts';

/*
 * The alerts as they stand, read fresh: on opening, when she comes back to the tab, and every five minutes. Nothing
 * is stored about them, so a fixed problem is gone on the next read (src/lib/alerts.js).
 * `approved: false` skips the approved cards' suppliers, the one heavy read, for the sidebar's count.
 */
const CARD = 'id, title, draft_title:draft->>title, supplier_read, ebay, candidate_sources ( id, url, unit_cost, landed_unit_cost )';
const EVERY = 5 * 60 * 1000;

export function useAlerts(tenantId, { approved = true, agent = null } = {}) {
  const [state, setState] = useState({ status: 'loading', rows: null, partial: false });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', again);
    const id = setInterval(reload, EVERY);
    return () => { document.removeEventListener('visibilitychange', again); clearInterval(id); };
  }, [reload]);

  useEffect(() => {
    if (!tenantId) return undefined;
    let live = true;
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 3600 * 1000).toISOString();
    (async () => {
      const reads = await Promise.all([
        supabase.from('candidates').select(CARD).eq('tenant_id', tenantId)
          .not('ebay->>listing_id', 'is', null).not('supplier_read', 'is', null).limit(2000),
        approved
          ? supabase.from('candidates').select(`${CARD}, decisions!inner ( action )`).eq('tenant_id', tenantId)
            .eq('decisions.action', 'approve').is('ebay->>listing_id', null).not('supplier_read', 'is', null).limit(1000)
          : Promise.resolve({ data: [] }),
        supabase.from('listing_jobs').select('candidate_id, state, error, created_at, finished_at, candidates ( title, draft_title:draft->>title, ebay )')
          .eq('tenant_id', tenantId).gte('created_at', since).limit(2000),
        supabase.from('keeper_runs').select('id, task, state, paused_reason, created_at').eq('tenant_id', tenantId).eq('state', 'paused'),
        supabase.from('store_low_stock').select('product_id, variant_id, title, label, stock').eq('tenant_id', tenantId).limit(200),
        supabase.from('price_changes').select('listing_id, created_at').eq('tenant_id', tenantId).eq('ok', true).gte('created_at', since).limit(1000),
      ]);
      if (!live) return;
      // One read failing leaves its part out; the rest still shows, and the page says so.
      const [lv, ap, jobs, runs, low, priced] = reads.map((x) => x.data ?? []);
      setState({ status: 'ready', rows: { live: lv, approved: ap, jobs, runs, low, priced }, partial: reads.some((x) => x.error) });
    })();
    return () => { live = false; };
  }, [tenantId, approved, tick]);

  const alerts = useMemo(() => (state.rows ? buildAlerts({ ...state.rows, agent }) : []), [state.rows, agent]);
  return {
    status: state.status,
    partial: state.partial,
    alerts,
    counts: countsOf(alerts),
    badge: badgeOf(alerts),
    reload,
  };
}

// The sidebar's number: red and amber on what is selling.
export function useAlertCount(tenantId) {
  return useAlerts(tenantId, { approved: false }).badge;
}
