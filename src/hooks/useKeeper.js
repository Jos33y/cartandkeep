import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';

const OPEN = new Set(['queued', 'working']);
const FIELDS = 'id, product_id, state, error, result, created_at, finished_at';
const POLL_MS = 2500;
// Nothing moved for this long while work waits: kick the queue again rather than wait for the minute.
const STALL_MS = 20000;
const isOpen = (j) => OPEN.has(j.state);

// Keeper's work lives on the server, so this only reads it and asks for more. A reload loses nothing.
export function useKeeper(tenantId, { onFinished } = {}) {
  const [jobs, setJobs] = useState([]);
  const [since, setSince] = useState(null);
  const [batch, setBatch] = useState(null);
  const lastMove = useRef(Date.now());
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const kick = useCallback(() => {
    if (!tenantId) return;
    lastMove.current = Date.now();
    // Not awaited: the call returns when its share is done, and the poll reports progress meanwhile.
    supabase.functions.invoke('draft', { body: { queue: true, tenant_id: tenantId } }).catch(() => {});
  }, [tenantId]);

  const read = useCallback(async (from) => {
    let q = supabase.from('keeper_jobs').select(FIELDS).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(500);
    q = from ? q.or(`state.in.(queued,working),created_at.gte.${from}`) : q.in('state', [...OPEN]);
    const { data } = await q;
    return data ?? [];
  }, [tenantId]);

  // Work still running from before the page opened is picked up and shown as one batch.
  useEffect(() => {
    if (!tenantId) return undefined;
    let live = true;
    read(null).then((open) => {
      if (!live || !open.length) return;
      const first = open.reduce((a, j) => (j.created_at < a ? j.created_at : a), open[0].created_at);
      setSince(first);
      setBatch({ since: first, ids: new Set(open.map((j) => j.id)) });
      setJobs(open);
    });
    return () => { live = false; };
  }, [tenantId, read]);

  const waiting = jobs.some(isOpen);

  useEffect(() => {
    if (!since || !waiting) return undefined;
    const timer = setInterval(async () => {
      const next = await read(since);
      setJobs((prev) => {
        const moved = next.filter((j) => prev.find((p) => p.id === j.id)?.state !== j.state);
        if (moved.length) lastMove.current = Date.now();
        if (moved.some((j) => !isOpen(j))) finishedRef.current?.();
        return next;
      });
      if (Date.now() - lastMove.current > STALL_MS && next.some((j) => j.state === 'queued')) kick();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [since, waiting, read, kick]);

  // quiet: one product asked from its own sheet, which shows its own progress, so it stays out of the page strip.
  const ask = useCallback(async (productIds, sections = [], { quiet = false } = {}) => {
    if (!tenantId || !productIds.length) return;
    const busy = new Set(jobs.filter(isOpen).map((j) => j.product_id));
    const fresh = productIds.filter((x) => !busy.has(x)).map((id) => ({ tenant_id: tenantId, product_id: id, sections }));
    if (!fresh.length) return;
    let added = [];
    const all = await supabase.from('keeper_jobs').insert(fresh).select(FIELDS);
    if (!all.error) added = all.data ?? [];
    else if (all.error.code !== '23505') throw new Error(all.error.message);
    else {
      // Another tab got some of these first: add the rest one by one and skip the clashes.
      for (const row of fresh) {
        const { data, error } = await supabase.from('keeper_jobs').insert(row).select(FIELDS).single();
        if (!error) added.push(data);
        else if (error.code !== '23505') throw new Error(error.message);
      }
    }
    if (!added.length) return;

    const stamp = new Date(Date.now() - 2000).toISOString();
    setSince((s) => (s && jobs.some(isOpen) ? s : stamp));
    if (!quiet) {
      const ids = added.map((j) => j.id);
      setBatch((b) => (b && jobs.some((j) => b.ids.has(j.id) && isOpen(j))
        ? { since: b.since, ids: new Set([...b.ids, ...ids]) }
        : { since: stamp, ids: new Set(ids) }));
    }
    setJobs((prev) => [...added, ...prev]);
    kick();
  }, [tenantId, jobs, kick]);

  // Jobs another function queued (the eBay import): pick them up, show them as a batch and start the work.
  const adopt = useCallback(async () => {
    const open = await read(null);
    const fresh = open.filter((j) => !jobs.some((x) => x.id === j.id));
    if (!fresh.length) return;
    const first = fresh.reduce((a, j) => (j.created_at < a ? j.created_at : a), fresh[0].created_at);
    setSince((s) => (s && s < first ? s : first));
    setBatch((b) => (b && jobs.some((j) => b.ids.has(j.id) && isOpen(j))
      ? { since: b.since, ids: new Set([...b.ids, ...fresh.map((j) => j.id)]) }
      : { since: first, ids: new Set(fresh.map((j) => j.id)) }));
    setJobs((prev) => [...fresh, ...prev]);
    kick();
  }, [jobs, read, kick]);

  const summary = useMemo(() => {
    const inBatch = batch ? jobs.filter((j) => batch.ids.has(j.id)) : [];
    if (!inBatch.length) return null;
    const done = inBatch.filter((j) => j.state === 'done');
    return {
      total: inBatch.length,
      finished: inBatch.filter((j) => !isOpen(j)).length,
      running: inBatch.some(isOpen),
      done: done.length,
      failed: inBatch.filter((j) => j.state === 'failed'),
      withQuestions: done.filter((j) => j.result?.questions > 0).map((j) => j.product_id),
    };
  }, [jobs, batch]);

  const stateOf = useCallback((productId) => jobs.find((j) => j.product_id === productId && isOpen(j))?.state ?? null, [jobs]);
  const lastFor = useCallback((productId) => jobs.find((j) => j.product_id === productId) ?? null, [jobs]);
  const dismiss = useCallback(() => setBatch((b) => (b && jobs.some((j) => b.ids.has(j.id) && isOpen(j)) ? b : null)), [jobs]);

  return { ask, adopt, stateOf, lastFor, summary, dismiss };
}
