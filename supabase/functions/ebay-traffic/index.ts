// Every active listing's traffic, not the 200 the report returns unasked.

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

type Active = { id: string; title: string | null; image: string | null; price: number | null; available: number | null };

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
  return (body.records ?? []).map((r: Record<string, never>) => {
    const out: Record<string, unknown> = {};
    headers.forEach((key, i) => { out[key] = (r.metricValues?.[i] as { value: unknown })?.value ?? null; });
    out._dimension = (r.dimensionValues ?? []).map((d: { value: string }) => d.value);
    return out;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, days = 90 } = await req.json();
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);

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

    const listings = await activeListings(access);

    // Asked for by id, 200 at a time: unasked, the report stops at 200.
    const traffic = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < listings.length; i += 200) {
      const ids = listings.slice(i, i + 200).map((l) => l.id).join('|');
      const rows = await report(access, {
        filter: `marketplace_ids:{EBAY_GB},listing_ids:{${ids}},${range}`,
        metric,
        dimension: 'LISTING',
      });
      for (const r of rows) traffic.set(String((r._dimension as string[])?.[0]), r);
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
    if (clearErr) return json({ error: clearErr.message }, 500);

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await client
        .from('ebay_traffic')
        .upsert(rows.slice(i, i + 500), { onConflict: 'tenant_id,window_start,window_end,listing_id' });
      if (error) return json({ error: error.message }, 500);
    }

    return json({
      ...window,
      listings: listings.length,
      reported: traffic.size,
      days: days$.length,
      impressions,
      views,
      transactions,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
