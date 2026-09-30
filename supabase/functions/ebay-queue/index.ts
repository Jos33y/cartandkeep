// Lists queued cards on eBay, at her pace and under her monthly limit. Kicked every minute by the schedule in
// 0113_listing_jobs.sql while anything is waiting, and by the portal the moment she queues something.
//
// Each card goes through the same prepare and publish as a single listing (_shared/ebay/listing.ts). A card eBay
// refuses fails at once with eBay's own words, since trying again would be refused again; a hiccup (eBay down,
// a timeout) goes back in the queue, three tries at most.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CANDIDATE_FIELDS, EbayError, allowance, appToken, duplicateOf, env, policiesMissing, prepare, publish, userToken,
} from '../_shared/ebay/listing.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// A run stops starting cards after this, so it finishes inside the schedule's 150 second call.
const BUDGET_MS = 110_000;
// At most this many a run, whatever the pace allows: the next minute takes the rest.
const PER_RUN = 10;

// The schedule calls with the service role; a member may kick her own shop's queue.
async function caller(req: Request): Promise<{ service: boolean; tenants?: (t: string) => Promise<boolean> } | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token === env('SUPABASE_SERVICE_ROLE_KEY')) return { service: true };
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return {
    service: false,
    tenants: async (t: string) => {
      const { data, error } = await asUser.rpc('has_tenant', { t });
      return !error && data === true;
    },
  };
}

type Job = { id: string; tenant_id: string; candidate_id: string; request: Record<string, unknown>; attempts: number };

async function finish(client: any, job: Job, patch: Record<string, unknown>) {
  await client.from('listing_jobs').update({ ...patch, finished_at: new Date().toISOString() }).eq('id', job.id);
}

// One tenant's turn: how many it may list now, then that many jobs, one at a time.
async function runTenant(client: any, tenantId: string, started: number) {
  const done: Record<string, number> = { listed: 0, failed: 0, retry: 0 };

  const { data: cred } = await client
    .from('tenant_credentials')
    .select('refresh_token, settings')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ebay')
    .maybeSingle();
  if (!cred) return { tenantId, skipped: 'not connected to eBay' };
  const s = cred.settings ?? {};
  const missing = policiesMissing(s);
  if (missing.length) return { tenantId, skipped: `choose ${missing.join(', ')} on the settings screen` };

  const limits = await allowance(client, tenantId, s);
  const take = Math.min(limits.left, PER_RUN);
  if (take <= 0) return { tenantId, skipped: limits.monthLeft <= 0 ? 'monthly limit reached' : 'today\'s pace reached', limits };

  const { data: jobs, error } = await client.rpc('claim_listing_jobs', { p_tenant: tenantId, p_limit: take });
  if (error) throw new Error(error.message);
  if (!jobs?.length) return { tenantId, ...done, limits };

  const access = await userToken(cred.refresh_token);
  let app: string | null = null;
  const appOnce = async () => (app ??= await appToken());

  for (const job of jobs as Job[]) {
    // Out of time: put the rest back as they were, untouched.
    if (Date.now() - started > BUDGET_MS) {
      await client.from('listing_jobs').update({ state: 'queued', attempts: Math.max(0, job.attempts - 1), started_at: null }).eq('id', job.id);
      continue;
    }
    try {
      const { data: c } = await client.from('candidates').select(CANDIDATE_FIELDS)
        .eq('id', job.candidate_id).eq('tenant_id', tenantId).maybeSingle();
      if (!c) { await finish(client, job, { state: 'failed', error: 'The card no longer exists.' }); done.failed++; continue; }
      // Listed some other way since it was queued: nothing to do, and not a failure.
      if (c.ebay?.listing_id) { await finish(client, job, { state: 'done', result: c.ebay }); continue; }

      const preview = await prepare(c, job.request ?? {}, { user: access, app: appOnce }, { settings: s });
      const dup = await duplicateOf(client, tenantId, c).catch(() => null);
      if (dup) preview.problems.push(`Already on eBay as "${dup.title}". Two identical listings break eBay's rules.`);
      if (preview.problems.length) {
        await finish(client, job, { state: 'failed', error: preview.problems.join(' ') });
        done.failed++;
        continue;
      }
      const record = await publish(c, preview, s, access);
      const { error: saveErr } = await client.from('candidates').update({ ebay: record }).eq('id', c.id).eq('tenant_id', tenantId);
      await finish(client, job, { state: 'done', result: saveErr ? { ...record, warning: `Listed, but not recorded on the card: ${saveErr.message}` } : record, error: null });
      done.listed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // eBay said no to this card: trying again gets the same answer. Anything else, a later minute may go through.
      const refused = e instanceof EbayError && e.status >= 400 && e.status < 500 && e.status !== 429;
      if (refused || job.attempts >= 3) {
        await finish(client, job, { state: 'failed', error: message });
        done.failed++;
      } else {
        await client.from('listing_jobs').update({ state: 'queued', error: message, started_at: null }).eq('id', job.id);
        done.retry++;
      }
    }
  }
  return { tenantId, ...done, limits };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const started = Date.now();

  try {
    const who = await caller(req);
    if (!who) return json({ error: 'Not authorised.' }, 401);
    const body = await req.json().catch(() => ({}));
    const client = db();

    let tenants: string[];
    if (who.service) {
      const { data } = await client.from('listing_jobs').select('tenant_id').in('state', ['queued', 'working']);
      tenants = [...new Set(((data ?? []) as Array<{ tenant_id: string }>).map((r) => r.tenant_id))];
    } else {
      if (!body.tenant_id || !(await who.tenants!(body.tenant_id))) return json({ error: 'Not authorised for this shop.' }, 401);
      tenants = [body.tenant_id];
    }

    const runs = [];
    for (const t of tenants) {
      if (Date.now() - started > BUDGET_MS) break;
      runs.push(await runTenant(client, t, started));
    }
    return json({ runs });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
