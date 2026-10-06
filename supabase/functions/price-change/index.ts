// Changes a live price, the price alone (Joseey, 4 October: "lets change only the price to avoid affecting every other
// changes and also makes it easier for keeper to handle later"). From Listings, on eBay and on her shop together.
//
// eBay is told the way the listing was made:
//   inventory  a listing published from Cart & Keep has an offer: its price is changed on the offer, which eBay
//              carries to the live listing. eBay will not let the other route change these.
//   trading    any other listing (made in Seller Hub) by its item number, with ReviseInventoryStatus, which changes
//              the price and nothing else.
// The shop's price is changed on the product. Every change is kept in price_changes (0141), the ones that failed too.
//
// Body: { tenant_id, listing_id?, product_id?, ebay_price?, shop_price?, ebay_was?, shop_was?, cost?,
//         ebay_choice?, shop_choice? }   choice: floor | kept | typed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { call, env, userToken } from '../_shared/ebay/listing.ts';
import { cardOf, changeEbay, changeShop, priceOf, showNewPrice } from './price.ts';

type Json = Record<string, any>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const CHOICES = ['floor', 'kept', 'typed'];

async function caller(req: Request, tenantId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token === env('SUPABASE_SERVICE_ROLE_KEY')) return { user: null };
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  if (error || data !== true) return null;
  const { data: u } = await asUser.auth.getUser();
  return { user: u?.user?.id ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const tenantId = body.tenant_id;
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
    const who = await caller(req, tenantId);
    if (!who) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const listingId = body.listing_id ? String(body.listing_id).replace(/\D/g, '') : null;
    const ebayPrice = body.ebay_price != null ? priceOf(body.ebay_price) : null;
    const shopPrice = body.shop_price != null ? priceOf(body.shop_price) : null;
    if (body.ebay_price != null && ebayPrice == null) return json({ error: 'The eBay price needs to be 99p or more.' }, 400);
    if (body.shop_price != null && shopPrice == null) return json({ error: 'The shop price needs to be 99p or more.' }, 400);
    if (ebayPrice != null && !listingId) return json({ error: 'An eBay price needs the item number.' }, 400);
    if (shopPrice != null && !body.product_id) return json({ error: 'A shop price needs the product.' }, 400);
    if (ebayPrice == null && shopPrice == null) return json({ error: 'No new price was given.' }, 400);

    const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const card = listingId ? await cardOf(client, tenantId, listingId) : null;
    const cost = body.cost != null && Number(body.cost) > 0 ? Math.round(Number(body.cost) * 100) / 100 : null;
    const choiceOf = (v: unknown) => (CHOICES.includes(String(v)) ? String(v) : 'typed');
    const log: Json[] = [];
    const out: Json = {};

    if (ebayPrice != null && listingId) {
      let route: string | null = card?.ebay?.offer_id ? 'inventory' : 'trading';
      let error: string | null = null;
      try {
        const { data: cred } = await client.from('tenant_credentials').select('refresh_token')
          .eq('tenant_id', tenantId).eq('provider', 'ebay').maybeSingle();
        if (!cred?.refresh_token) throw new Error('This account is not connected to eBay yet.');
        const done = await changeEbay(listingId, ebayPrice, card, { fetch, call, access: () => userToken(cred.refresh_token) });
        route = done.route;
        error = done.error;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      if (!error) await showNewPrice(client, tenantId, listingId, ebayPrice, card);
      out.ebay = { ok: !error, price: ebayPrice, error: error ? `eBay: ${error}` : null };
      log.push({
        channel: 'ebay', listing_id: listingId, product_id: body.product_id ?? null, candidate_id: card?.id ?? null,
        old_price: priceOf(body.ebay_was), new_price: ebayPrice, choice: choiceOf(body.ebay_choice), route, ok: !error, error,
      });
    }

    if (shopPrice != null && body.product_id) {
      const done = await changeShop(client, tenantId, body.product_id, shopPrice);
      out.shop = { ok: !done.error, price: shopPrice, error: done.error, options: done.options ?? 0 };
      log.push({
        channel: 'shop', listing_id: listingId, product_id: body.product_id, candidate_id: card?.id ?? null,
        old_price: done.old ?? priceOf(body.shop_was), new_price: shopPrice, choice: choiceOf(body.shop_choice), route: 'shop',
        ok: !done.error, error: done.error,
      });
    }

    if (log.length) {
      await client.from('price_changes').insert(log.map((x) => ({ ...x, tenant_id: tenantId, cost, by: 'her', user_id: who.user })));
    }
    return json(out);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
