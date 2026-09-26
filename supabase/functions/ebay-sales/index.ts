// Pulls eBay orders into channel_sales, with eBay's actual fees.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';

const CORS = {
  'access-control-allow-origin': '*',
  // supabase-js sends x-client-info on every invoke.
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};

const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/*
 * eBay refuses a start date more than two years back, and it measures that in
 * its own timezone rather than ours. At exactly 730 days the request lands on
 * the boundary and comes back "Start date must be within '2' years from
 * present date", so the window stops two days short of it.
 */
const MAX_DAYS = 728;

const money = (a: { value?: string } | undefined) => Number(a?.value ?? 0);
const round = (n: number) => Math.round(n * 100) / 100;

async function accessFor(tenantId: string) {
  const { data, error } = await db()
    .from('tenant_credentials')
    .select('refresh_token')
    .eq('tenant_id', tenantId)
    .eq('provider', 'ebay')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('This account is not connected to eBay yet.');

  const basic = btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);
  const res = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
    // No scope on refresh: sending one breaks the moment a scope is added.
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error_description ?? `eBay returned ${res.status}`);
  return body.access_token as string;
}

async function orders(access: string, since: string) {
  const all: Array<Record<string, never>> = [];
  let offset = 0;

  for (;;) {
    const url = new URL(`${EBAY}/sell/fulfillment/v1/order`);
    url.searchParams.set('filter', `creationdate:[${since}..]`);
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', String(offset));

    const res = await fetch(url.toString(), {
      headers: { authorization: `Bearer ${access}`, 'accept-language': 'en-GB' },
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = body.errors?.[0]?.message ?? `eBay returned ${res.status}`;
      throw new Error(res.status === 403
        ? `eBay refused the orders read. Reconnect eBay in Settings. eBay said: ${msg}`
        : msg);
    }

    all.push(...(body.orders ?? []));
    if (!body.next || !(body.orders ?? []).length) break;
    offset += 200;
  }

  return all;
}

function statusOf(o: Record<string, never>) {
  const cancel = (o.cancelStatus as { cancelState?: string })?.cancelState;
  if (cancel === 'CANCELED') return 'cancelled';
  const refunds = ((o.paymentSummary as { refunds?: unknown[] })?.refunds ?? []).length;
  // The table allows paid, refunded and cancelled.
  return refunds ? 'refunded' : 'paid';
}

// Two callers: the 8am schedule with the service key, or a signed-in member of this tenant. Anyone else is refused.
async function callerOf(req: Request, tenantId: string): Promise<'schedule' | 'portal' | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token === env('SUPABASE_SERVICE_ROLE_KEY')) return 'schedule';
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  return !error && data === true ? 'portal' : null;
}

// Every run is written down, so the morning check and the pages know when figures last arrived.
async function beginPull(tenantId: string, source: string, startedBy: string) {
  const { data, error } = await db()
    .from('data_pulls')
    .insert({ tenant_id: tenantId, source, started_by: startedBy })
    .select('id')
    .single();
  if (error) console.error(`[${source}] run not recorded`, error.message);
  return data?.id ?? null;
}

async function endPull(id: string | null, ok: boolean, error: string | null, summary: unknown) {
  if (!id) return;
  const { error: e } = await db()
    .from('data_pulls')
    .update({ finished_at: new Date().toISOString(), ok, error, summary })
    .eq('id', id);
  if (e) console.error('[pull] result not recorded', e.message);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let body: { tenant_id?: string; days?: number };
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400); }
  const { tenant_id: tenantId, days = MAX_DAYS } = body;
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

  const caller = await callerOf(req, tenantId);
  if (!caller) return json({ error: 'Not authorised' }, 401);
  const run = await beginPull(tenantId, 'ebay_sales', caller);

  try {

    const asked = Math.max(Number(days) || MAX_DAYS, 1);
    const span = Math.min(asked, MAX_DAYS);
    const since = new Date(Date.now() - span * 86_400_000).toISOString();

    const access = await accessFor(tenantId);
    const list = await orders(access, since);
    const client = db();

    // Older listings match by legacy id, portal listings by SKU.
    const { data: shop } = await client
      .from('store_products')
      .select('id, source_kind, source_ref, candidate_id')
      .eq('tenant_id', tenantId);

    const { data: published } = await client
      .from('candidates')
      .select('id, ebay')
      .eq('tenant_id', tenantId)
      .not('ebay', 'is', null);

    const byLegacy = new Map((shop ?? [])
      .filter((s) => s.source_kind === 'ebay_listing' && s.source_ref)
      .map((s) => [String(s.source_ref), s.id]));
    const candidateBySku = new Map((published ?? [])
      .filter((c) => c.ebay?.sku)
      .map((c) => [c.ebay.sku, c.id]));
    const productByCandidate = new Map((shop ?? [])
      .filter((s) => s.candidate_id)
      .map((s) => [s.candidate_id, s.id]));

    const rows: Record<string, unknown>[] = [];
    const refs: string[] = [];

    for (const o of list) {
      const lines = (o.lineItems ?? []) as Array<Record<string, never>>;
      if (!lines.length) continue;

      const orderGross = lines.reduce((s, l) => s + money(l.lineItemCost), 0);
      const orderFee = money(o.totalMarketplaceFee as { value?: string });
      const haveFee = o.totalMarketplaceFee != null;
      const status = statusOf(o);

      refs.push(o.orderId as string);

      lines.forEach((l, i) => {
        const qty = Number(l.quantity ?? 1);
        const gross = money(l.lineItemCost);
        const legacy = String(l.legacyItemId ?? '');
        const sku = (l.sku as string) ?? null;
        const candidate = sku ? candidateBySku.get(sku) : null;

        rows.push({
          tenant_id: tenantId,
          channel: 'ebay',
          external_ref: o.orderId,
          line_no: i + 1,
          sold_at: o.creationDate,
          title: l.title ?? 'eBay sale',
          external_sku: sku ?? (legacy || null),
          product_id: byLegacy.get(legacy) ?? (candidate ? productByCandidate.get(candidate) ?? null : null),
          qty,
          unit_price: qty ? round(gross / qty) : gross,
          gross: round(gross),
          postage_charged: round(money((l.deliveryCost as { shippingCost?: { value?: string } })?.shippingCost)),
          // eBay reports the fee once per order, so each line takes its share.
          fees: haveFee ? round(orderGross ? orderFee * (gross / orderGross) : orderFee / lines.length) : null,
          fees_estimated: !haveFee,
          status,
          source_file: 'ebay-api',
          imported_at: new Date().toISOString(),
        });
      });
    }

    // Rewrite each order whole, so a second pull replaces rather than adds.
    if (refs.length) {
      for (let i = 0; i < refs.length; i += 200) {
        const { error } = await client
          .from('channel_sales')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('channel', 'ebay')
          .in('external_ref', refs.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }

      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client.from('channel_sales').insert(rows.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
    }

    const result = {
      orders: refs.length,
      lines: rows.length,
      matched: rows.filter((r) => r.product_id).length,
      since,
      days: span,
      // Said rather than silently returned short, so a thin month is not read
      // as a quiet week.
      clipped: asked > span ? `asked for ${asked} days, eBay only reaches back ${MAX_DAYS}` : null,
    };
    await endPull(run, true, null, result);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await endPull(run, false, message, null);
    return json({ error: message }, 500);
  }
});
