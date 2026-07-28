import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { isDemo } from '@lib/mode';
import {
  DEMO_BATCH,
  DEMO_CANDIDATES,
  DEMO_SOURCES,
  DEMO_LISTINGS,
  DEMO_PERFORMANCE,
} from '@data/demo';

const EMPTY = {
  status: 'loading',
  batch: null,
  counts: { total: 0, approved: 0, rejected: 0, deferred: 0, pending: 0 },
  netIfSold: 0,
  reasons: [],
  sources: [],
  listings: 0,
  performance: { units: 0, revenue: 0, net: 0 },
};

function demoState() {
  const rows = DEMO_CANDIDATES;
  const by = (a) => rows.filter((r) => r.decision?.action === a).length;

  const tally = new Map();
  for (const r of rows) {
    const reason = r.decision?.reason;
    if (reason) tally.set(reason, (tally.get(reason) ?? 0) + 1);
  }

  return {
    status: 'ready',
    batch: DEMO_BATCH,
    counts: {
      total: rows.length,
      approved: by('approve'),
      rejected: by('reject'),
      deferred: by('defer'),
      pending: rows.filter((r) => !r.decision).length,
    },
    netIfSold: rows
      .filter((r) => r.decision?.action === 'approve')
      .reduce((a, r) => a + Number(r.margin?.net ?? 0), 0),
    reasons: [...tally.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    sources: DEMO_SOURCES,
    listings: DEMO_LISTINGS,
    performance: DEMO_PERFORMANCE,
  };
}

export function useOverview(tenantId) {
  const demo = isDemo();
  const [state, setState] = useState(demo ? demoState() : EMPTY);

  useEffect(() => {
    if (demo || !tenantId) return;
    let live = true;

    (async () => {
      const { data: batch } = await supabase
        .from('batches')
        .select('id, delivered_for, status, candidate_count, sources_used')
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered')
        .order('delivered_for', { ascending: false })
        .limit(1)
        .maybeSingle();

      const [candidates, sources, listings, perf] = await Promise.all([
        batch
          ? supabase
              .from('candidates')
              .select('id, margin, decisions ( action, reason )')
              .eq('batch_id', batch.id)
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

      const rows = candidates.data ?? [];
      const decisionOf = (r) => r.decisions?.[0]?.action ?? null;

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
        const reason = r.decisions?.[0]?.reason;
        if (reason) tally.set(reason, (tally.get(reason) ?? 0) + 1);
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

      setState({
        status: 'ready',
        batch: batch ?? null,
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
  }, [tenantId, demo]);

  return state;
}

export function nextMonday(from = new Date()) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
}
