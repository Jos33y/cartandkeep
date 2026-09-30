import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { readPages } from '@lib/readPages';

// decisions is a to-one embed here and an array elsewhere.
const one = (d) => (Array.isArray(d) ? d[0] ?? null : d ?? null);

const EMPTY = {
  status: 'loading',
  batches: [],
  counts: { total: 0, approved: 0, rejected: 0, deferred: 0, pending: 0 },
  reasons: [],
  traffic: null,
  days: [],
};

export function useOverview(tenantId) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!tenantId) return;
    let live = true;

    (async () => {
      // Every live batch: the day a second category arrives, the first one's
      // unreviewed rows must still count. Retired batches stay out.
      const { data: batchList } = await supabase
        .from('batches')
        .select('id, delivered_for, category_label')
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered')
        .is('retired_at', null)
        .order('delivered_for', { ascending: false });

      const batches = batchList ?? [];

      // In pages: one read stops at 1,000 rows without an error, which is how To review once showed 829 of 1,415.
      const [candidates, total, days] = await Promise.all([
        batches.length
          ? readPages(() => supabase
            .from('candidates')
            .select('id, batch_id, decisions ( action, reason )')
            .in('batch_id', batches.map((b) => b.id)))
          : Promise.resolve({ data: [] }),
        supabase
          .from('ebay_traffic')
          .select('window_start, window_end, impressions, views, transactions, click_rate, conversion_rate, fetched_at')
          .eq('tenant_id', tenantId)
          .is('listing_id', null)
          .order('window_end', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('ebay_traffic_daily')
          .select('day, impressions, views, transactions')
          .eq('tenant_id', tenantId)
          .order('day', { ascending: false })
          .limit(90),
      ]);

      if (!live) return;

      const rows = (candidates.data ?? []).map((c) => ({
        batch_id: c.batch_id,
        action: one(c.decisions)?.action ?? null,
        reason: one(c.decisions)?.reason ?? null,
      }));

      const counts = {
        total: rows.length,
        approved: rows.filter((r) => r.action === 'approve').length,
        rejected: rows.filter((r) => r.action === 'reject').length,
        deferred: rows.filter((r) => r.action === 'defer').length,
        pending: rows.filter((r) => !r.action).length,
      };

      const tally = new Map();
      for (const r of rows) if (r.reason) tally.set(r.reason, (tally.get(r.reason) ?? 0) + 1);
      const reasons = [...tally.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      setState({
        status: 'ready',
        batches: batches.map((b) => ({
          ...b,
          pending: rows.filter((r) => r.batch_id === b.id && !r.action).length,
        })),
        counts,
        reasons,
        traffic: total.data ?? null,
        days: [...(days.data ?? [])].reverse(),
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
