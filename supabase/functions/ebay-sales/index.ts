// Pulls eBay orders into channel_sales, with eBay's actual fees.
//
// The fees come from eBay's Finances API, line by line (8 October 2026): the selling fee, none on a private account,
// and the promoted listing's ad fee kept apart in ad_fees, so Finance shows each as charged. An order the Finances
// API does not have yet keeps the order's own fee figure, marked estimated, as before; a Finances refusal never fails
// the pull.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cancelReasonOf, faultOf, lineGross, reasonText, refundedAtOf, refundedOf, statusOf } from '../_shared/ebay/orders.ts';
import { feesByOrder, transactions } from '../_shared/ebay/finances.ts';
import { lineFees, placeItemCharges } from './fees.ts';

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

/*
 * Why a refunded order came back: its return, or its item-not-received case, from the Post-Order API. eBay has
 * taken this call with both header forms over the years, so the OAuth form is tried first and the older one after.
 * Nothing here can fail the pull: no answer is a null reason, said as such on the page.
 */
async function postOrder(access: string, path: string) {
  for (const auth of [`IAF ${access}`, `Bearer ${access}`]) {
    const res = await fetch(`${EBAY}/post-order/v2/${path}`, {
      headers: { authorization: auth, 'content-type': 'application/json', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB' },
    }).catch(() => null);
    if (!res) return null;
    if (res.status === 401 || res.status === 403) continue;
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  }
  return null;
}

async function returnReason(access: string, orderId: string): Promise<{ code: string | null; by: string | null }> {
  const r = await postOrder(access, `return/search?order_id=${encodeURIComponent(orderId)}`);
  const m = (r?.members ?? [])[0];
  if (m?.creationInfo?.reason) return { code: m.creationInfo.reason, by: 'BUYER' };
  const q = await postOrder(access, `inquiry/search?order_id=${encodeURIComponent(orderId)}`);
  if ((q?.members ?? []).length) return { code: 'ITEM_NOT_RECEIVED', by: 'BUYER' };
  return { code: null, by: null };
}

// Same length and every character compared, so the time taken says nothing about how close a guess was.
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Read from app_config with this function's own connection, so there is no second copy to paste or drift.
async function storedSchedulerSecret() {
  const { data, error } = await db().from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
  if (error) console.error('[scheduler] secret not readable', error.message);
  return data?.value ?? '';
}

// Two callers: the 8am schedule with its own secret, or a signed-in member of this tenant. Anyone else is refused.
async function callerOf(req: Request, tenantId: string): Promise<'schedule' | 'portal' | null> {
  const sent = req.headers.get('x-scheduler-secret');
  if (sent) {
    if (sameSecret(sent, await storedSchedulerSecret())) return 'schedule';
    console.error('[scheduler] secret sent but did not match app_config');
    return null;
  }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
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
  if (!caller) {
    return json({ error: 'Not authorised', reason: req.headers.get('x-scheduler-secret') ? 'scheduler secret does not match app_config' : 'not a member of this shop' }, 401);
  }
  const run = await beginPull(tenantId, 'ebay_sales', caller);

  try {

    const asked = Math.max(Number(days) || MAX_DAYS, 1);
    const span = Math.min(asked, MAX_DAYS);
    const since = new Date(Date.now() - span * 86_400_000).toISOString();

    const access = await accessFor(tenantId);
    const list = await orders(access, since);
    const client = db();

    // eBay's own books for the same stretch. Without them the lines keep the order's figure, as before.
    let fin: ReturnType<typeof feesByOrder> | null = null;
    let finError: string | null = null;
    try {
      fin = feesByOrder(await transactions(fetch, access, Date.parse(since), Date.now()));
    } catch (e) {
      finError = e instanceof Error ? e.message : String(e);
      console.error('[ebay_sales] finances not read', finError);
    }

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
    let lookups = 0;

    for (const o of list) {
      const lines = (o.lineItems ?? []) as Array<Record<string, never>>;
      if (!lines.length) continue;

      const orderGross = lines.reduce((s, l) => s + money(l.lineItemCost), 0);
      // Money back: how much, when, and why. The reason from the cancellation when there is one; a return or
      // item-not-received case otherwise, looked up for at most 40 orders a run.
      const refunded = refundedOf(o);
      const refundedAt = refundedAtOf(o);
      let why = cancelReasonOf(o);
      if (!why.code && (refunded > 0 || statusOf(o) !== 'paid') && lookups < 40) {
        lookups += 1;
        why = await returnReason(access, o.orderId as string).catch(() => ({ code: null, by: null }));
      }
      const orderFee = money(o.totalMarketplaceFee as { value?: string });
      const haveFee = o.totalMarketplaceFee != null;
      const status = statusOf(o);
      const booked = fin?.orders.get(o.orderId as string) ?? null;

      refs.push(o.orderId as string);

      lines.forEach((l, i) => {
        const qty = Number(l.quantity ?? 1);
        // A part refund comes off the takings; the units still sold.
        const before = money(l.lineItemCost);
        const gross = lineGross(o, before, orderGross);
        const legacy = String(l.legacyItemId ?? '');
        const sku = (l.sku as string) ?? null;
        const candidate = sku ? candidateBySku.get(sku) : null;
        const share = orderGross ? before / orderGross : 1 / lines.length;
        const real = booked ? lineFees(booked, (l.lineItemId as string) ?? null, share) : null;

        rows.push({
          tenant_id: tenantId,
          channel: 'ebay',
          external_ref: o.orderId,
          line_no: i + 1,
          sold_at: o.creationDate,
          title: l.title ?? 'eBay sale',
          external_sku: sku ?? (legacy || null),
          // The eBay listing it sold on, whatever SKU she gave it, so each listing's sales can be counted.
          listing_id: legacy || null,
          product_id: byLegacy.get(legacy) ?? (candidate ? productByCandidate.get(candidate) ?? null : null),
          qty,
          unit_price: qty ? round(gross / qty) : gross,
          gross: round(gross),
          postage_charged: round(money((l.deliveryCost as { shippingCost?: { value?: string } })?.shippingCost)),
          // eBay's books when they have the order: the selling fee here, the ad fee on its own. Otherwise the order's
          // own fee figure, reported once per order, so each line takes its share.
          fees: real ? real.selling : haveFee ? round(orderFee * share) : null,
          ad_fees: real ? real.ad : null,
          fee_detail: real ? real.detail : null,
          fees_estimated: real ? false : !haveFee,
          status,
          // The order's refund, shared across its lines as the fee is.
          refunded: refunded > 0 ? round(orderGross ? refunded * (before / orderGross) : refunded / lines.length) : null,
          refunded_at: refunded > 0 || status !== 'paid' ? refundedAt : null,
          refund_reason: refunded > 0 || status !== 'paid' ? reasonText(why.code) : null,
          refund_fault: refunded > 0 || status !== 'paid' ? faultOf(why.code, why.by) : null,
          source_file: 'ebay-api',
          imported_at: new Date().toISOString(),
        });
      });
    }

    // Ad fees billed on their own against an item, not an order, go on that item's latest sale before the charge.
    const unplacedCharges = fin ? placeItemCharges(rows, fin.items) : 0;

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
      refunds: rows.filter((r) => r.refunded != null || r.status !== 'paid').length,
      reasons_found: rows.filter((r) => r.refund_reason).length,
      // Lines whose fees are eBay's own, and why the rest are not.
      fees_booked: rows.filter((r) => r.fees_estimated === false && r.fee_detail).length,
      ad_fees: round(rows.reduce((n, r) => n + Number(r.ad_fees ?? 0), 0)),
      charges_unplaced: unplacedCharges,
      finances_error: finError,
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
