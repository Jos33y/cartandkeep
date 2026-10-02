// The work behind keeper-run: leases a run, checks its drafts at the pace she chose, and writes each product only
// through set_keeper_check (0123). Kept apart from the server so the tests can drive it against a real database.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOne, contextFor } from '../_shared/keeper-check.ts';

type Json = Record<string, any>;

export const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};

// The schedule calls every minute; a call works for under a minute and holds its run a little longer, so two calls
// never work the same run.
const BUDGET_MS = 50_000;
const LEASE_S = 75;
// Watch: one draft at a time, at least this long each, so she can follow it. Normal: three at once.
const WATCH_MS = 3_500;
const NORMAL_AT_ONCE = 3;
const FAIL_STREAK = 5;

export const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
export type Db = ReturnType<typeof db>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function finishJob(client: Db, job: Json, out: { state: string; result: Json }) {
  await client.from('keeper_jobs').update({
    state: out.state,
    result: out.result,
    error: null,
    finished_at: out.state === 'done' ? new Date().toISOString() : null,
  }).eq('id', job.id);
}

async function failJob(client: Db, job: Json, why: string) {
  // Three tries, then it stops and says why; a busy moment at Anthropic usually clears on the next go.
  await client.from('keeper_jobs').update(job.attempts >= 3
    ? { state: 'failed', finished_at: new Date().toISOString(), error: why, result: { tray: 'unread', line: `Could not read it: ${why}` } }
    : { state: 'queued', error: why }).eq('id', job.id);
}

// Works one run until the budget, the run's state or the cap stops it.
async function workRun(client: Db, run: Json, until: number) {
  const ctx = await contextFor(client, run.tenant_id, run.id);
  let streak = 0;
  let lastError = '';
  let checked = 0;
  try {
    while (Date.now() < until) {
      const { data: now } = await client.from('keeper_runs').select('state, pace, rehearsal').eq('id', run.id).single();
      if (!now || now.state !== 'running') break;
      const watch = now.pace === 'watch';
      const { data: jobs, error } = await client.rpc('claim_run_jobs', { p_run: run.id, p_limit: watch ? 1 : NORMAL_AT_ONCE });
      if (error) throw new Error(error.message);
      if (!jobs?.length) break;

      const started = Date.now();
      const outs = await Promise.allSettled((jobs as Json[]).map((j) => checkOne(client, j, { ...run, ...now }, ctx)));
      let spent = 0;
      for (let i = 0; i < outs.length; i += 1) {
        const o = outs[i];
        if (o.status === 'fulfilled') {
          await finishJob(client, jobs[i], o.value);
          spent += o.value.cost ?? 0;
          streak = 0;
          checked += 1;
        } else {
          lastError = message(o.reason);
          await failJob(client, jobs[i], lastError);
          streak += 1;
        }
      }
      if (spent > 0) await client.rpc('add_keeper_spend', { p_run: run.id, p_pence: spent });
      if (streak >= FAIL_STREAK) {
        await client.rpc('close_keeper_run', { p_run: run.id, p_pause_reason: `${FAIL_STREAK} drafts in a row could not be read. The last said: ${lastError}` });
        return checked;
      }
      await client.from('keeper_runs').update({ lease_until: new Date(Date.now() + LEASE_S * 1000).toISOString() }).eq('id', run.id);
      if (watch) {
        const rest = WATCH_MS - (Date.now() - started);
        if (rest > 0) await sleep(Math.min(rest, Math.max(0, until - Date.now())));
      }
    }
  } finally {
    // Done when nothing is left; otherwise the lease goes back so the next call can carry on.
    await client.rpc('close_keeper_run', { p_run: run.id });
  }
  return checked;
}

// Checks outside a run: new copies from eBay, once Keeper has written their draft.
async function workLoose(client: Db, tenant: string | null, until: number) {
  let checked = 0;
  const ctxByTenant = new Map<string, Awaited<ReturnType<typeof contextFor>>>();
  while (Date.now() < until) {
    const { data: jobs, error } = await client.rpc('claim_check_jobs', { p_limit: NORMAL_AT_ONCE, p_tenant: tenant });
    if (error) throw new Error(error.message);
    if (!jobs?.length) break;
    for (const job of jobs as Json[]) {
      if (!ctxByTenant.has(job.tenant_id)) ctxByTenant.set(job.tenant_id, await contextFor(client, job.tenant_id, null));
    }
    const outs = await Promise.allSettled((jobs as Json[]).map((j) => checkOne(client, j, null, ctxByTenant.get(j.tenant_id)!)));
    for (let i = 0; i < outs.length; i += 1) {
      const o = outs[i];
      if (o.status === 'fulfilled') { await finishJob(client, jobs[i], o.value); checked += 1; } else await failJob(client, jobs[i], message(o.reason));
    }
  }
  return checked;
}

export async function work(client: Db, tenant: string | null, budgetMs = BUDGET_MS) {
  const until = Date.now() + budgetMs;
  let checked = 0;
  while (Date.now() < until) {
    const { data: runs, error } = await client.rpc('lease_keeper_run', { p_seconds: LEASE_S, p_tenant: tenant });
    if (error) throw new Error(error.message);
    if (!runs?.length) break;
    const n = await workRun(client, runs[0], until);
    checked += n;
    // Nothing could be taken (its drafts are still being written): leave it for the next call.
    if (n === 0) break;
  }
  if (Date.now() < until) checked += await workLoose(client, tenant, until);
  // Three or more checked products waiting in a Google branch no section covers get a section (0129).
  if (checked > 0) {
    const { error } = await client.rpc('keeper_open_sections', { p_tenant: tenant });
    if (error) console.error('[keeper-run] sections not opened:', error.message);
  }
  return { checked };
}

