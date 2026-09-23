// Reads one live listing from eBay, as eBay holds it after any Seller Hub edits.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';
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

const decode = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : null;
};

const tags = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => decode(m[1].trim()));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, listing_id: listingId } = await req.json();
    if (!tenantId || !listingId) return json({ error: 'tenant_id and listing_id are required' }, 400);

    const { data: cred, error } = await db()
      .from('tenant_credentials')
      .select('refresh_token, settings')
      .eq('tenant_id', tenantId)
      .eq('provider', 'ebay')
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!cred) return json({ error: 'This account is not connected to eBay yet.' }, 400);

    const basic = btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);
    const tok = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
      // No scope on refresh: sending one breaks the moment a scope is added.
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cred.refresh_token }).toString(),
    }).then((r) => r.json());
    if (!tok.access_token) return json({ error: tok.error_description ?? 'eBay refused the token refresh.' }, 500);

    const res = await fetch(`${EBAY}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml',
        'X-EBAY-API-CALL-NAME': 'GetItem',
        'X-EBAY-API-SITEID': SITE,
        'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
        'X-EBAY-API-IAF-TOKEN': tok.access_token,
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${String(listingId).replace(/\D/g, '')}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`,
    });

    const xml = await res.text();
    if (tag(xml, 'Ack') === 'Failure' || !res.ok) {
      return json({ error: `eBay refused the lookup: ${tag(xml, 'LongMessage') ?? tag(xml, 'ShortMessage') ?? res.status}` }, 502);
    }

    const item = tag(xml, 'Item') ?? '';
    const status = tag(item, 'SellingStatus') ?? '';
    const profiles = tag(item, 'SellerProfiles') ?? '';
    const shipping = tag(profiles, 'SellerShippingProfile') ?? '';
    const returns = tag(profiles, 'SellerReturnProfile') ?? '';

    const quantity = Number(tag(item, 'Quantity') ?? 0);
    const sold = Number(tag(status, 'QuantitySold') ?? 0);
    const postageId = tag(shipping, 'ShippingProfileID');
    const returnId = tag(returns, 'ReturnProfileID');
    const saved = cred.settings ?? {};

    return json({
      listing_id: listingId,
      title: tag(item, 'Title'),
      // The price she set, not what the buyer's page adds on top.
      price: Number(tag(item, 'StartPrice') ?? tag(status, 'CurrentPrice') ?? 0),
      available: Math.max(0, quantity - sold),
      sold,
      photos: tags(tag(item, 'PictureDetails') ?? '', 'PictureURL'),
      state: tag(status, 'ListingStatus'),
      postage: { id: postageId, name: tag(shipping, 'ShippingProfileName'), matches_saved: postageId === saved.fulfillment },
      returns: { id: returnId, name: tag(returns, 'ReturnProfileName'), matches_saved: returnId === saved.return },
      revised: tag(item, 'ReviseStatus') ? tag(tag(item, 'ReviseStatus') ?? '', 'ItemRevised') === 'true' : null,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
