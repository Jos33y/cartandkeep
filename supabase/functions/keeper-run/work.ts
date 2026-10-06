// The work behind keeper-run: leases a run, checks its drafts at the pace she chose, and writes each product only
// through set_keeper_check (0123). Kept apart from the server so the tests can drive it against a real database.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOne, contextFor } from '../_shared/keeper-check.ts';
import { sourceBatch } from './source.ts';
import { readyBatch, type Call } from './ready.ts';
import { readSize } from '../_shared/parcel-read.ts';
import { askLessons, review } from './review.ts';
import { pence, tallied, used } from '../_shared/usage.ts';

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

// Sourcing on Amazon (task 02): one batch per call, since a batch waits on two Apify runs. Watch: one candidate.
// Normal: eight, one search and one read for all of them. The lease covers the slowest batch.
const SOURCE_AT_ONCE = 8;
const SOURCE_LEASE_S = 240;

// Getting cards ready (task 03): one batch per call, each card as many steps as the call has time for. Watch: one card.
// Normal: three side by side. The lease covers a slow photo check.
const READY_AT_ONCE = 3;
const READY_LEASE_S = 240;
// One of our own functions, called as the service. Each step waits on one; the longest is the photo check.
const CALL_TIMEOUT_MS = 110_000;

export const callFunction: Call = async (fn, body, headers = {}) => {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, apikey: key, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  const text = await res.text();
  let out: Json;
  try { out = JSON.parse(text); } catch { out = { error: `${fn} answered ${res.status}: ${text.slice(0, 200)}` }; }
  // A refusal in words (a conflict, nothing to write from) comes back as the answer; the step says it.
  if (!res.ok && !out.error) out.error = `${fn} answered ${res.status}`;
  // What Claude was used for in that call, as the function counted it (usage.ts), for Keeper's spend.
  const usage = res.headers.get('x-claude-usage');
  if (usage) { try { out._usage = JSON.parse(usage); } catch { /* counted at the estimate instead */ } }
  return out;
};

async function schedulerSecret(client: Db) {
  const { data, error } = await client.from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
  if (error || !data?.value) throw new Error('The scheduler secret is not set (app_config.scheduler_secret).');
  return String(data.value);
}

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

// One batch of a sourcing run: claimed, looked up, each job finished or sent round again, the spend added.
async function workSource(client: Db, run: Json) {
  let looked = 0;
  try {
    const { data: now } = await client.from('keeper_runs').select('state, pace, rehearsal').eq('id', run.id).single();
    if (!now || now.state !== 'running') return 0;
    await client.from('keeper_runs').update({ lease_until: new Date(Date.now() + SOURCE_LEASE_S * 1000).toISOString() }).eq('id', run.id);
    const { data: jobs, error } = await client.rpc('claim_run_jobs', { p_run: run.id, p_limit: now.pace === 'watch' ? 1 : SOURCE_AT_ONCE });
    if (error) throw new Error(error.message);
    if (!jobs?.length) return 0;
    const outs = await sourceBatch(client, jobs as Json[], { ...run, ...now }, {
      token: env('APIFY_TOKEN'),
      gbpPerUsd: Number(Deno.env.get('KEEPER_GBP_PER_USD') ?? 0.75) || 0.75,
    });
    let spent = 0;
    let lastError = '';
    let failures = 0;
    for (let i = 0; i < outs.length; i += 1) {
      const o = outs[i];
      spent += o.cost ?? 0;
      if ('error' in o) { lastError = o.error; failures += 1; await failJob(client, jobs[i], o.error); } else { await finishJob(client, jobs[i], o); looked += 1; }
    }
    if (spent > 0) await client.rpc('add_keeper_spend', { p_run: run.id, p_pence: spent });
    // Every one in a batch failing is Amazon or Apify, not the candidates: pause and say why rather than spend again.
    if (failures === outs.length && failures >= Math.min(FAIL_STREAK, outs.length) && jobs.every((j: Json) => j.attempts >= 3)) {
      await client.rpc('close_keeper_run', { p_run: run.id, p_pause_reason: `Amazon could not be read three times. The last said: ${lastError}` });
    }
  } finally {
    await client.rpc('close_keeper_run', { p_run: run.id });
  }
  return looked;
}

/*
 * What she reads when a run stops for want of credit: whose, where to top up, and that nothing was lost. The cards
 * not yet done wait in the queue and Carry on picks them up from where each got to.
 */
export function creditPause({ service, title }: { service: string; title: string | null }) {
  const where = service === 'Apify' ? 'console.apify.com, under Billing' : 'console.anthropic.com, under Plans & Billing';
  return `Paused: ${service} has run out of credit${title ? `, while getting ${title} ready` : ''}. Top it up at ${where}, then press Carry on. Nothing was lost: the cards not done are still in the queue, each from where it got to.`;
}

// One batch of a get-ready run: claimed, each card taken as far as the call allows, the spend added. A card with
// steps left goes back in the queue where it got to, its tries counted afresh, since it did not fail.
async function workReady(client: Db, run: Json) {
  let finished = 0;
  try {
    const { data: now } = await client.from('keeper_runs').select('state, pace').eq('id', run.id).single();
    if (!now || now.state !== 'running') return 0;
    await client.from('keeper_runs').update({ lease_until: new Date(Date.now() + READY_LEASE_S * 1000).toISOString() }).eq('id', run.id);
    const { data: jobs, error } = await client.rpc('claim_run_jobs', { p_run: run.id, p_limit: now.pace === 'watch' ? 1 : READY_AT_ONCE });
    if (error) throw new Error(error.message);
    if (!jobs?.length) return 0;
    let secret: string | null = null;
    // What Keeper has learned for this shop, read once for the batch.
    const { data: lessons } = await client.from('keeper_lessons').select('key, scope_kind, scope, area, action, lesson, evidence, against, removed_at')
      .eq('tenant_id', run.tenant_id).is('removed_at', null).gte('evidence', 2).limit(200);
    const outs = await readyBatch(client, jobs as Json[], {
      lessons: (lessons ?? []) as Json[],
      gbpPerUsd: Number(Deno.env.get('KEEPER_GBP_PER_USD') ?? 0.75) || 0.75,
      call: callFunction,
      secret: async () => (secret ??= await schedulerSecret(client)),
      size: (read) => readSize(env('ANTHROPIC_API_KEY'), read),
    });
    let spent = 0;
    let failures = 0;
    let lastError = '';
    let credit: { service: string; said: string; title: string | null } | null = null;
    for (let i = 0; i < outs.length; i += 1) {
      const o = outs[i];
      spent += o.cost ?? 0;
      if ('credit' in o) {
        // Not the card's fault: back in the queue where it got to, its tries untouched, for when the credit is back.
        credit ??= { service: o.service, said: o.credit, title: o.result?.title ?? null };
        await client.from('keeper_jobs').update({ state: 'queued', attempts: 0, error: null, result: o.result }).eq('id', jobs[i].id);
      } else if ('error' in o) { lastError = o.error; failures += 1; await failJob(client, jobs[i], o.error); } else if ('again' in o) {
        await client.from('keeper_jobs').update({ state: 'queued', attempts: 0, error: null, result: o.result }).eq('id', jobs[i].id);
      } else { await finishJob(client, jobs[i], o); finished += 1; }
    }
    if (spent > 0) await client.rpc('add_keeper_spend', { p_run: run.id, p_pence: spent });
    if (credit) {
      await client.rpc('close_keeper_run', { p_run: run.id, p_pause_reason: creditPause(credit) });
      return finished;
    }
    if (failures === outs.length && jobs.every((j: Json) => j.attempts >= 3)) {
      await client.rpc('close_keeper_run', { p_run: run.id, p_pause_reason: `Cards could not be got ready three times. The last said: ${lastError}` });
    }
  } finally {
    await client.rpc('close_keeper_run', { p_run: run.id });
  }
  // The run over (done, or stopped by her): Keeper looks back on it once and learns (review.ts).
  const { data: after } = await client.from('keeper_runs').select('id, tenant_id, state, reviewed_at').eq('id', run.id).single();
  if (after && ['done', 'stopped'].includes(after.state) && !after.reviewed_at) {
    try {
      // The look back's own Claude use, counted as it happened (nothing when it had nothing to look at).
      const [, spentOn] = await tallied(() => review(client, after, askLessons(env('ANTHROPIC_API_KEY'))));
      const p = used(spentOn) ? pence(spentOn, Number(Deno.env.get('KEEPER_GBP_PER_USD') ?? 0.75) || 0.75) : 0;
      if (p > 0) await client.rpc('add_keeper_spend', { p_run: run.id, p_pence: p });
    } catch (e) {
      console.error('[keeper-run] look back failed:', message(e));
    }
  }
  return finished;
}

// Works one run until the budget, the run's state or the cap stops it.
async function workRun(client: Db, run: Json, until: number) {
  if (run.task === 'amazon_source') return workSource(client, run);
  if (run.task === 'get_ready') return workReady(client, run);
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
  let sourced = 0;
  let readied = 0;
  // A sourcing or get-ready run gets one batch a call; the call then goes on to any other run.
  const worked: string[] = [];
  while (Date.now() < until) {
    const { data: runs, error } = await client.rpc('lease_keeper_run', { p_seconds: LEASE_S, p_tenant: tenant, p_skip: worked.length ? worked : null });
    if (error) throw new Error(error.message);
    if (!runs?.length) break;
    const n = await workRun(client, runs[0], until);
    if (runs[0].task === 'amazon_source') { sourced += n; worked.push(runs[0].id); continue; }
    if (runs[0].task === 'get_ready') { readied += n; worked.push(runs[0].id); continue; }
    checked += n;
    // Nothing could be taken (its drafts are still being written): leave it for the next call.
    if (n === 0) break;
  }
  if (Date.now() < until) checked += await workLoose(client, tenant, until);
  // A get-ready run she stopped, or one that finished between calls, not looked back on yet: one a call.
  if (Date.now() < until) {
    let q = client.from('keeper_runs').select('id, tenant_id, state, reviewed_at').eq('task', 'get_ready')
      .in('state', ['done', 'stopped']).is('reviewed_at', null).order('created_at', { ascending: true }).limit(1);
    if (tenant) q = q.eq('tenant_id', tenant);
    const { data: left } = await q;
    if (left?.[0]) {
      try { await review(client, left[0], askLessons(env('ANTHROPIC_API_KEY'))); } catch (e) { console.error('[keeper-run] look back failed:', message(e)); }
    }
  }
  // Three or more checked products waiting in a Google branch no section covers get a section (0129).
  if (checked > 0) {
    const { error } = await client.rpc('keeper_open_sections', { p_tenant: tenant });
    if (error) console.error('[keeper-run] sections not opened:', error.message);
  }
  return { checked, sourced, readied };
}

