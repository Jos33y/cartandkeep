import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// candidate_id is unique on decisions, so PostgREST returns a to-one embed here
// and an array elsewhere. Reading [0] off an object gives undefined, which read
// as nobody having decided anything.
const one = (d) => (Array.isArray(d) ? d[0] ?? null : d ?? null);

const EMPTY = {
  status: 'loading',
  batch: null,
  batches: [],
  rows: [],
  counts: { total: 0, approved: 0, rejected: 0, deferred: 0, pending: 0 },
  netIfSold: 0,
  reasons: [],
  sources: [],
  listings: 0,
  performance: { units: 0, revenue: 0, net: 0 },
};

export function useOverview(tenantId) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!tenantId) return;
    let live = true;

    (async () => {
      // Every live batch, not the newest one.
      //
      // Overview answers how much is outstanding in total. Taking the newest
      // batch and stopping meant that the day a second category arrived, 50
      // mobility candidates she was midway through stopped being counted
      // anywhere, and the page read 41 while she had 91 to do. Retired batches
      // are excluded here rather than at the call site, because a batch she
      // has been told is withdrawn should not reappear in a total.
      const { data: batchList } = await supabase
        .from('batches')
        .select('id, delivered_for, status, candidate_count, sources_used, category_label, term')
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered')
        .is('retired_at', null)
        .order('delivered_for', { ascending: false });

      const batches = batchList ?? [];
      const batch = batches[0] ?? null;

      const [candidates, sources, listings, perf] = await Promise.all([
        batches.length
          ? supabase
              .from('candidates')
              .select(`
                id, batch_id, title, score, headroom, sold_30d, bulky, variation_count, margin,
                decisions ( action, reason )
              `)
              .in('batch_id', batches.map((b) => b.id))
          : Promise.resolve({ data: [] }),
        supabase
          .from('tenant_sources')
          .select('source_id, enabled, last_run_at, last_status, sources ( name )')
          .eq('tenant_id', tenantId)
          .eq('enabled', true),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase
          .from('listing_performance')
          .select('units_sold, revenue, net')
          .eq('tenant_id', tenantId)
          .eq('day_offset', 30),
      ]);

      if (!live) return;

      const rows = (candidates.data ?? []).map(({ decisions, ...c }) => ({
        ...c,
        headroom: c.headroom == null ? null : Number(c.headroom),
        action: one(decisions)?.action ?? null,
        reason: one(decisions)?.reason ?? null,
      }));

      const decisionOf = (r) => r.action;

      const counts = {
        total: rows.length,
        approved: rows.filter((r) => decisionOf(r) === 'approve').length,
        rejected: rows.filter((r) => decisionOf(r) === 'reject').length,
        deferred: rows.filter((r) => decisionOf(r) === 'defer').length,
        pending: rows.filter((r) => !decisionOf(r)).length,
      };

      const netIfSold = rows
        .filter((r) => decisionOf(r) === 'approve')
        .reduce((a, r) => a + Number(r.margin?.net ?? 0), 0);

      // Rejection reasons are the training signal, so they belong on the
      // overview rather than buried in a filter.
      const tally = new Map();
      for (const r of rows) {
        if (r.reason) tally.set(r.reason, (tally.get(r.reason) ?? 0) + 1);
      }
      const reasons = [...tally.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      const performance = (perf.data ?? []).reduce(
        (a, p) => ({
          units: a.units + Number(p.units_sold ?? 0),
          revenue: a.revenue + Number(p.revenue ?? 0),
          net: a.net + Number(p.net ?? 0),
        }),
        { units: 0, revenue: 0, net: 0 },
      );

      // Per batch, so the total can be broken down without a second query and
      // so the scatter can stay one chart per category. Mixing a £134 patient
      // lift into a chart of £5 duvet covers sets the scale on the outlier and
      // destroys it, which this project has already learnt once.
      const byBatch = batches.map((b) => {
        const own = rows.filter((r) => r.batch_id === b.id);
        return {
          ...b,
          rows: own,
          pending: own.filter((r) => !decisionOf(r)).length,
        };
      });

      setState({
        status: 'ready',
        batch: batch ?? null,
        batches: byBatch,
        rows,
        counts,
        netIfSold,
        reasons,
        sources: (sources.data ?? []).map((s) => ({
          id: s.source_id,
          name: s.sources?.name ?? s.source_id,
          lastRunAt: s.last_run_at,
          lastStatus: s.last_status,
        })),
        listings: listings.count ?? 0,
        performance,
      });
    })();

    return () => { live = false; };
  }, [tenantId]);

  return state;
}

export function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}
