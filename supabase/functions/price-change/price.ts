// The price change's working parts (price-change/index.ts serves them). Kept apart so the tests can load them
// without starting the function.

import { EBAY, call } from '../_shared/ebay/listing.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;


const SITE = '3';

// A price as eBay and the shop take it: pounds, two places, at least 99p.
export function priceOf(v: unknown): number | null {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n >= 0.99 && n < 100000 ? n : null;
}

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : null;
};

export const reviseXml = (itemId: string, price: number) => `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <InventoryStatus>
    <ItemID>${itemId.replace(/\D/g, '')}</ItemID>
    <StartPrice currencyID="GBP">${price.toFixed(2)}</StartPrice>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

// eBay's answer to ReviseInventoryStatus: null when it took it, else what it said. A warning is still a change made.
export function tradingAnswer(xml: string, ok: boolean): string | null {
  const ack = tag(xml, 'Ack');
  if (ok && (ack === 'Success' || ack === 'Warning')) return null;
  return tag(xml, 'LongMessage') ?? tag(xml, 'ShortMessage') ?? `eBay answered ${ack ?? 'nothing'}`;
}

// eBay's answer to a price change on an offer: null when it took it, else what it said.
export function offerAnswer(body: Json): string | null {
  const r = (body?.responses ?? [])[0];
  if (!r) return 'eBay gave no answer for the offer';
  if (Number(r.statusCode) === 200) return null;
  const e = (r.errors ?? [])[0];
  return e ? [e.message, e.longMessage].filter(Boolean).join(' ') : `eBay answered ${r.statusCode}`;
}

// The card that published this listing from Cart & Keep, if one did: its offer is the way to change the price.
export async function cardOf(client: Client, tenantId: string, listingId: string) {
  const { data } = await client.from('candidates').select('id, ebay')
    .eq('tenant_id', tenantId).eq('ebay->>listing_id', listingId).limit(1).maybeSingle();
  return data ?? null;
}

export type Deps = { fetch: typeof fetch; call: typeof call; access: () => Promise<string> };

// eBay's price changed, by the route the listing was made with. Returns the route and eBay's refusal, if any.
export async function changeEbay(listingId: string, price: number, card: Json | null, deps: Deps) {
  const access = await deps.access();
  if (card?.ebay?.offer_id) {
    const body = await deps.call('/sell/inventory/v1/bulk_update_price_quantity', access, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ offers: [{ offerId: card.ebay.offer_id, price: { value: price.toFixed(2), currency: 'GBP' } }] }] }),
    });
    return { route: 'inventory', error: offerAnswer(body) };
  }
  const res = await deps.fetch(`${EBAY}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'content-type': 'text/xml',
      'X-EBAY-API-CALL-NAME': 'ReviseInventoryStatus',
      'X-EBAY-API-SITEID': SITE,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
      'X-EBAY-API-IAF-TOKEN': access,
    },
    body: reviseXml(listingId, price),
  });
  return { route: 'trading', error: tradingAnswer(await res.text(), res.ok) };
}

// The shop's price changed on the product. A was-price under the new price would be a false claim, so it is left
// for her to clear rather than changed here.
export async function changeShop(client: Client, tenantId: string, productId: string, price: number) {
  const { data: p, error } = await client.from('store_products').select('id, price, compare_at')
    .eq('tenant_id', tenantId).eq('id', productId).maybeSingle();
  if (error) return { error: error.message };
  if (!p) return { error: 'That product is not on your shop.' };
  if (p.compare_at != null && price > Number(p.compare_at)) {
    return { error: `Its was-price is £${Number(p.compare_at).toFixed(2)}, under the new price. Clear the was-price in Products first.` };
  }
  const { error: e } = await client.from('store_products').update({ price }).eq('id', productId).eq('tenant_id', tenantId);
  if (e) return { error: e.message };
  const { count } = await client.from('store_variants').select('id', { count: 'exact', head: true })
    .eq('product_id', productId).not('price', 'is', null);
  return { error: null, old: Number(p.price), options: count ?? 0 };
}

// The page shows the new price straight away: eBay's own list is read again only the next morning.
export async function showNewPrice(client: Client, tenantId: string, listingId: string, price: number, card: Json | null) {
  const { data: last } = await client.from('ebay_traffic').select('fetched_at')
    .eq('tenant_id', tenantId).eq('listing_id', listingId).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
  if (last?.fetched_at) {
    await client.from('ebay_traffic').update({ price }).eq('tenant_id', tenantId).eq('listing_id', listingId).eq('fetched_at', last.fetched_at);
  }
  if (card) await client.from('candidates').update({ ebay: { ...card.ebay, price, price_changed_at: new Date().toISOString() } }).eq('id', card.id);
}
