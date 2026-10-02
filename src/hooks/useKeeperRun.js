import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';
import { summarise, unchecked } from '@lib/keeper';

const TASK = 'shop_check';
const POLL_MS = 2000;
// Work waiting and nothing moved for this long: ask the server to carry on rather than wait for the minute.
const STALL_MS = 8000;
const JOB_FIELDS = 'id, product_id, state, result, error, attempts, started_at, finished_at, created_at';
const OPEN = new Set(['running', 'paused']);

/*
 * Keeper's latest shop check for this shop: the run, its jobs and the products they are for, read every two seconds
 * while it is open. The work is on the server (keeper-run, 0123), so closing the page loses nothing.
 */
// Rehearsals are the studio's: only the studio sees them (includeRehearsals), so she only ever sees her own real runs.
export function useKeeperRun(tenantId, { followPace = false, includeRehearsals = false } = {}) {
  const [run, setRun] = useState(undefined);
  const [jobs, setJobs] = useState([]);
  const [products, setProducts] = useState(() => new Map());
  const known = useRef(new Set());
  const [waiting, setWaiting] = useState(null);
  const [error, setError] = useState(null);
  const lastMove = useRef(Date.now());
  const seen = useRef('');

  // Drafts nobody has checked: what a new run would take.
  const countWaiting = useCallback(async () => {
    if (!tenantId) return;
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await supabase.from('store_products').select('id, status, archived_at, is_sample, derived_fields')
        .eq('tenant_id', tenantId).eq('status', 'draft').range(from, from + 999);
      if (e) { setError(e.message); return; }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    setWaiting(rows.filter(unchecked).length);
  }, [tenantId]);

  const readProducts = useCallback(async (ids) => {
    const missing = ids.filter((id) => !known.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => known.current.add(id));
    const found = [];
    for (let i = 0; i < missing.length; i += 200) {
      const { data } = await supabase.from('store_products').select('id, title, image_url, images, status').in('id', missing.slice(i, i + 200));
      found.push(...(data ?? []));
    }
    setProducts((m) => {
      const next = new Map(m);
      for (const p of found) next.set(p.id, p);
      return next;
    });
  }, []);

  const read = useCallback(async () => {
    if (!tenantId) return;
    let q = supabase.from('keeper_runs').select('*').eq('tenant_id', tenantId).eq('task', TASK);
    if (!includeRehearsals) q = q.eq('rehearsal', false);
    const { data: latest, error: e } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (e) { setError(e.message); setRun(null); return; }
    setRun(latest ?? null);
    if (!latest) { setJobs([]); return; }
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('keeper_jobs').select(JOB_FIELDS).eq('run_id', latest.id)
        .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const stamp = all.map((j) => `${j.id}:${j.state}`).join(',');
    if (stamp !== seen.current) { seen.current = stamp; lastMove.current = Date.now(); }
    setJobs(all);
    readProducts([...new Set(all.map((j) => j.product_id))]);
  }, [tenantId, readProducts, includeRehearsals]);

  const kick = useCallback(() => {
    if (!tenantId) return;
    lastMove.current = Date.now();
    // Not awaited: the calls return when their share is done; the reads report progress meanwhile. The writer goes
    // too, since a run writes a draft first where nothing has been written (0128).
    supabase.functions.invoke('draft', { body: { queue: true, tenant_id: tenantId } }).catch(() => {});
    supabase.functions.invoke('keeper-run', { body: { queue: true, tenant_id: tenantId } }).catch(() => {});
  }, [tenantId]);

  useEffect(() => { read(); countWaiting(); }, [read, countWaiting]);

  const open = Boolean(run && OPEN.has(run.state));
  useEffect(() => {
    if (!open) return undefined;
    const timer = setInterval(() => {
      read();
      if (run?.state === 'running' && Date.now() - lastMove.current > STALL_MS) kick();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, read, kick, run?.state]);

  // Finished: one last read of what is waiting, for the next run.
  useEffect(() => { if (run && !open) countWaiting(); }, [run, open, countWaiting]);

  // A rehearsal takes the next drafts nobody has rehearsed (pick 'next'), or the last rehearsal's again ('again').
  const start = useCallback(async ({ pace = 'watch', capPence = 500, rehearsal = false, limit = null, pick = 'next' } = {}) => {
    setError(null);
    const { error: e } = await supabase.rpc('start_keeper_run', {
      p_tenant: tenantId, p_task: TASK, p_pace: pace, p_cap_pence: capPence, p_rehearsal: rehearsal, p_limit: limit, p_pick: pick,
    });
    if (e) { setError(e.message); throw new Error(e.message); }
    await read();
    kick();
  }, [tenantId, read, kick]);

  const set = useCallback(async (change) => {
    if (!run) return;
    const { error: e } = await supabase.rpc('set_keeper_run', { p_run: run.id, p_state: change.state ?? null, p_pace: change.pace ?? null });
    if (e) { setError(e.message); return; }
    await read();
    if (change.state === 'running') kick();
  }, [run, read, kick]);

  /*
   * Her pace follows the page: one at a time while she watches, the full pace once she has gone, so 194 drafts are
   * not held to the watching speed with nobody watching. The studio sets the pace by hand, so this is hers only.
   * Keyed on the run's id, not the run, so the two-second reads do not set it again and again.
   */
  const pace = useRef(null);
  pace.current = run?.pace ?? null;
  const runId = open ? run?.id : null;
  useEffect(() => {
    if (!followPace || !runId) return undefined;
    const want = (p) => {
      if (pace.current === p) return;
      pace.current = p;
      supabase.rpc('set_keeper_run', { p_run: runId, p_state: null, p_pace: p });
    };
    const onVisibility = () => want(document.visibilityState === 'visible' ? 'watch' : 'normal');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      want('normal');
    };
  }, [followPace, runId]);

  const totals = useMemo(() => summarise(jobs), [jobs]);

  return { run, jobs, products, totals, waiting, error, open, start, set, reload: read, recount: countWaiting };
}
