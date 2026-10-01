// Every listing's traffic, not the 200 the report returns unasked: the active ones, and since 1 October the ones
// that ended inside the window, so a listing that sold out and ended keeps its views and sales on the page.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';
// UK site id for the Trading API.
const SITE = '3';

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

const ymd = (d: Date) => d.toISOString().slice(0, 10);
// eBay's date_range wants 20260918 and refuses the hyphenated form.
const compact = (d: Date) => ymd(d).replace(/-/g, '');
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

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

const decode = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : null;
};

type Active = {
  id: string; title: string | null; image: string | null; price: number | null; available: number | null;
  ended_at?: string | null; sold?: number | null;
};

// The selling list sees every listing; the Inventory API only its own.
async function activeListings(access: string) {
  const all: Active[] = [];
  let page = 1;
  let pages = 1;

  do {
    const res = await fetch(`${EBAY}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-SITEID': SITE,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
        'X-EBAY-API-IAF-TOKEN': access,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ActiveList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`,
    });

    const xml = await res.text();
    if (tag(xml, 'Ack') === 'Failure' || !res.ok) {
      throw new Error(`eBay refused the listing list: ${tag(xml, 'LongMessage') ?? tag(xml, 'ShortMessage') ?? res.status}`);
    }

    const list = tag(xml, 'ActiveList') ?? '';
    pages = Number(tag(list, 'TotalNumberOfPages') ?? 1);

    for (const block of list.match(/<Item>[\s\S]*?<\/Item>/g) ?? []) {
      const id = tag(block, 'ItemID');
      if (!id) continue;
      all.push({
        id,
        title: tag(block, 'Title'),
        image: tag(block, 'GalleryURL'),
        price: num(tag(block, 'CurrentPrice')),
        available: num(tag(block, 'QuantityAvailable')),
      });
    }
    page += 1;
  } while (page <= pages && page <= 50);

  return all;
}

/*
 * Listings that ended inside the window: sold out, ended by her, or run out of time. GetSellerList by end time,
 * which takes up to 120 days, so the 90-day window fits. A GTC listing still live has its end ahead of now and is
 * not in it.
 */
async function endedListings(access: string, from: Date, active: Set<string>) {
  const all: Active[] = [];
  let page = 1;
  let pages = 1;
  const to = new Date();

  do {
    const res = await fetch(`${EBAY}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GetSellerList',
        'X-EBAY-API-SITEID': SITE,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
        'X-EBAY-API-IAF-TOKEN': access,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <EndTimeFrom>${from.toISOString()}</EndTimeFrom>
  <EndTimeTo>${to.toISOString()}</EndTimeTo>
  <GranularityLevel>Fine</GranularityLevel>
  <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
</GetSellerListRequest>`,
    });

    const xml = await res.text();
    if (tag(xml, 'Ack') === 'Failure' || !res.ok) {
      throw new Error(`eBay refused the ended listings: ${tag(xml, 'LongMessage') ?? tag(xml, 'ShortMessage') ?? res.status}`);
    }
    pages = Number(tag(tag(xml, 'PaginationResult') ?? '', 'TotalNumberOfPages') ?? 1);

    for (const block of (tag(xml, 'ItemArray') ?? '').match(/<Item>[\s\S]*?<\/Item>/g) ?? []) {
      const id = tag(block, 'ItemID');
      const status = tag(tag(block, 'SellingStatus') ?? '', 'ListingStatus');
      if (!id || active.has(id) || status === 'Active') continue;
      const selling = tag(block, 'SellingStatus') ?? '';
      all.push({
        id,
        title: tag(block, 'Title'),
        image: tag(tag(block, 'PictureDetails') ?? '', 'GalleryURL') ?? tag(tag(block, 'PictureDetails') ?? '', 'PictureURL'),
        price: num(tag(selling, 'CurrentPrice')),
        available: 0,
        ended_at: tag(tag(block, 'ListingDetails') ?? '', 'EndTime'),
        sold: num(tag(selling, 'QuantitySold')),
      });
    }
    page += 1;
  } while (page <= pages && page <= 50);

  return all;
}

async function report(access: string, params: Record<string, string>) {
  const url = new URL(`${EBAY}/sell/analytics/v1/traffic_report`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${access}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB' },
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const said = body.errors?.[0]?.message ?? body.message ?? `eBay returned ${res.status}`;
    throw new Error(res.status === 403
      ? `eBay refused the traffic report. Reconnect eBay in Settings. eBay said: ${said}`
      : said);
  }

  // Values arrive positionally, so the column order is read rather than assumed.
  const headers: string[] = (body.header?.metrics ?? []).map((m: { key: string }) => m.key);
  // deno-lint-ignore no-explicit-any
  return (body.records ?? []).map((r: Record<string, any>) => {
    const out: Record<string, unknown> = {};
    headers.forEach((key, i) => { out[key] = (r.metricValues?.[i] as { value: unknown })?.value ?? null; });
    out._dimension = (r.dimensionValues ?? []).map((d: { value: string }) => d.value);
    return out;
  });
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
  const { tenant_id: tenantId, days = 90 } = body;
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

  const caller = await callerOf(req, tenantId);
  if (!caller) {
    return json({ error: 'Not authorised', reason: req.headers.get('x-scheduler-secret') ? 'scheduler secret does not match app_config' : 'not a member of this shop' }, 401);
  }
  const run = await beginPull(tenantId, 'ebay_traffic', caller);

  try {

    // eBay serves 90 days and excludes today, which is partial.
    const span = Math.min(Math.max(Number(days) || 90, 1), 90);
    const end = new Date(Date.now() - 86_400_000);
    const start = new Date(end.getTime() - (span - 1) * 86_400_000);
    const range = `date_range:[${compact(start)}..${compact(end)}]`;
    const metric = 'LISTING_IMPRESSION_TOTAL,LISTING_VIEWS_TOTAL,CLICK_THROUGH_RATE,TRANSACTION,SALES_CONVERSION_RATE';

    const access = await accessFor(tenantId);
    const client = db();

    // The account total is complete without asking per listing.
    const daily = await report(access, { filter: `marketplace_ids:{EBAY_GB},${range}`, metric, dimension: 'DAY' });

    const days$ = daily.map((r) => ({
      tenant_id: tenantId,
      day: String((r._dimension as string[])?.[0] ?? '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      impressions: num(r.LISTING_IMPRESSION_TOTAL),
      views: num(r.LISTING_VIEWS_TOTAL),
      transactions: num(r.TRANSACTION),
      fetched_at: new Date().toISOString(),
    })).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day));

    if (days$.length) await client.from('ebay_traffic_daily').upsert(days$, { onConflict: 'tenant_id,day' });

    const active = await activeListings(access);
    // Ended ones too. A failure here costs only the ended rows, never the pull: they are said in the result.
    let ended: Active[] = [];
    let endedError: string | null = null;
    try {
      ended = await endedListings(access, start, new Set(active.map((l) => l.id)));
    } catch (e) {
      endedError = e instanceof Error ? e.message : String(e);
    }
    const listings = [...active, ...ended];

    // Asked for by id, 200 at a time: unasked, the report stops at 200. Ended listings in their own batches, so one
    // eBay will not report on does not take the active ones with it.
    const traffic = new Map<string, Record<string, unknown>>();
    const ask = async (list: Active[]) => {
      for (let i = 0; i < list.length; i += 200) {
        const ids = list.slice(i, i + 200).map((l) => l.id).join('|');
        const rows = await report(access, {
          filter: `marketplace_ids:{EBAY_GB},listing_ids:{${ids}},${range}`,
          metric,
          dimension: 'LISTING',
        });
        for (const r of rows) traffic.set(String((r._dimension as string[])?.[0]), r);
      }
    };
    await ask(active);
    try {
      await ask(ended);
    } catch (e) {
      endedError = endedError ?? (e instanceof Error ? e.message : String(e));
    }

    const sum = (key: string) => daily.reduce((a, r) => a + (num(r[key]) ?? 0), 0);
    const impressions = sum('LISTING_IMPRESSION_TOTAL');
    const views = sum('LISTING_VIEWS_TOTAL');
    const transactions = sum('TRANSACTION');
    const now = new Date().toISOString();
    const window = { window_start: ymd(start), window_end: ymd(end) };

    const rows = [
      {
        tenant_id: tenantId,
        ...window,
        listing_id: null,
        title: null,
        image_url: null,
        price: null,
        currency: null,
        impressions,
        views,
        // A mean of eBay's daily rates is not the rate over the window.
        click_rate: impressions ? views / impressions : null,
        transactions,
        conversion_rate: views ? transactions / views : null,
        ended_at: null,
        quantity_sold: null,
        quantity_available: null,
        fetched_at: now,
      },
      // A listing eBay reports nothing for was shown to nobody in the window.
      ...listings.map((l) => {
        const t = traffic.get(l.id);
        return {
          tenant_id: tenantId,
          ...window,
          listing_id: l.id,
          title: l.title,
          image_url: l.image,
          price: l.price,
          currency: 'GBP',
          impressions: t ? num(t.LISTING_IMPRESSION_TOTAL) : 0,
          views: t ? num(t.LISTING_VIEWS_TOTAL) : 0,
          click_rate: t ? num(t.CLICK_THROUGH_RATE) : 0,
          transactions: t ? num(t.TRANSACTION) : 0,
          conversion_rate: t ? num(t.SALES_CONVERSION_RATE) : 0,
          ended_at: l.ended_at ?? null,
          quantity_sold: l.sold ?? null,
          // What is left to sell on an active listing; an ended one has none to offer.
          quantity_available: l.ended_at ? null : l.available ?? null,
          fetched_at: now,
        };
      }),
    ];

    // A second pull the same day replaces the first, so ended listings do not linger.
    const { error: clearErr } = await client
      .from('ebay_traffic')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('window_start', window.window_start)
      .eq('window_end', window.window_end)
      .not('listing_id', 'is', null);
    if (clearErr) throw new Error(clearErr.message);

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await client
        .from('ebay_traffic')
        .upsert(rows.slice(i, i + 500), { onConflict: 'tenant_id,window_start,window_end,listing_id' });
      if (error) throw new Error(error.message);
    }

    const result = {
      ...window,
      listings: listings.length,
      active: active.length,
      ended: ended.length,
      ended_error: endedError,
      reported: traffic.size,
      days: days$.length,
      impressions,
      views,
      transactions,
    };
    await endPull(run, true, null, result);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await endPull(run, false, message, null);
    return json({ error: message }, 500);
  }
});
