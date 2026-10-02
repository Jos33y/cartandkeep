// Brings her own eBay listings onto the shop as drafts, then hands each to the agent through the queue.
// Stock is the shop's own (a split from eBay's count): every new listing starts at NEW_LISTING_STOCK.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';
const SITE = '3';
const NEW_LISTING_STOCK = 5;
const PER_CALL = 10;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
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

// The shop id is public, so the caller has to prove membership, not just name the shop.
async function allowed(req: Request, tenantId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  return !error && data === true;
}

const decode = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : null;
};

const raw = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
};

const raws = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);

// Item specifics as eBay holds them; a spec with several values keeps them all.
function pairs(block: string) {
  const out: Record<string, string> = {};
  for (const nv of raws(block, 'NameValueList')) {
    const name = tag(nv, 'Name');
    const values = raws(nv, 'Value').map((v) => decode(v.trim())).filter(Boolean);
    if (name && values.length) out[name.trim()] = values.join(', ');
  }
  return out;
}

// The lister's template stripped to readable text. Kept as the supplier's words, never as her copy.
function plainText(html: string | null) {
  if (!html) return null;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 40 ? text.slice(0, 4000) : null;
}

const NOT_A_BRAND = new Set(['unbranded', 'no brand', 'generic', 'n/a', 'na', '-', '--', 'does not apply']);
function cleanBrand(value: string | undefined) {
  const text = String(value ?? '').replace(/[‎‏​﻿]/g, '').replace(/\s+/g, ' ').trim().replace(/\s+Store$/i, '');
  return !text || NOT_A_BRAND.has(text.toLowerCase()) ? null : text;
}

function slugify(title: string) {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'product';
}

const money = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

async function accessToken(refresh: string) {
  const basic = btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);
  const tok = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
    // No scope on refresh: sending one breaks the moment a scope is added.
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }).toString(),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error(tok.error_description ?? 'eBay refused the token refresh.');
  return tok.access_token as string;
}

async function getItem(access: string, listingId: string) {
  const res = await fetch(`${EBAY}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'content-type': 'text/xml',
      'X-EBAY-API-CALL-NAME': 'GetItem',
      'X-EBAY-API-SITEID': SITE,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
      'X-EBAY-API-IAF-TOKEN': access,
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${listingId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`,
  });
  const xml = await res.text();
  if (tag(xml, 'Ack') === 'Failure' || !res.ok) {
    throw new Error(tag(xml, 'LongMessage') ?? tag(xml, 'ShortMessage') ?? `eBay returned ${res.status}`);
  }
  return raw(xml, 'Item');
}

type Variant = { label: string; price: number | null; sku: string | null };

function productFrom(item: string, listingId: string, tenantId: string) {
  const title = (tag(item, 'Title') ?? '').trim();
  const specifics = pairs(raw(item, 'ItemSpecifics'));
  const photos = raws(raw(item, 'PictureDetails'), 'PictureURL').map((u) => decode(u.trim())).filter(Boolean);
  const path = (tag(raw(item, 'PrimaryCategory'), 'CategoryName') ?? '').split(':').map((p) => p.trim()).filter(Boolean);
  const listing = raw(item, 'ProductListingDetails');

  const variations = raws(raw(item, 'Variations'), 'Variation').map((v) => ({
    label: Object.entries(pairs(raw(v, 'VariationSpecifics'))).map(([k, val]) => `${k} ${val}`).join(', '),
    price: money(tag(v, 'StartPrice')),
    sku: tag(v, 'SKU'),
  })).filter((v) => v.label);

  const prices = variations.map((v) => v.price).filter((p): p is number => p !== null);
  const price = prices.length ? Math.min(...prices) : money(tag(item, 'StartPrice'));

  const product = {
    tenant_id: tenantId,
    title,
    price,
    image_url: photos[0] ?? null,
    images: photos,
    category: path.at(-1) ?? null,
    category_path: path.length ? path.join('|') : null,
    status: 'draft',
    is_sample: false,
    source_kind: 'ebay_listing',
    source_ref: listingId,
    brand: cleanBrand(specifics.Brand),
    condition: tag(item, 'ConditionDisplayName'),
    mpn: specifics.MPN ?? tag(listing, 'MPN'),
    gtin: specifics.EAN ?? tag(listing, 'EAN') ?? specifics.UPC ?? null,
    sku: tag(item, 'SKU'),
    specifications: specifics,
    source_description: plainText(tag(item, 'Description')),
    stock: variations.length ? null : NEW_LISTING_STOCK,
    availability: 'in_stock',
    // Standard is what the law gives, so it is not a question for her; Keeper's check (queued below) raises sealed
    // or no return where the goods call for it.
    returns_class: 'standard',
    derived_fields: { imported: { from: 'ebay', listing_id: listingId, at: new Date().toISOString() } },
  };

  const variants: Variant[] = variations.map((v) => ({ label: v.label, price: v.price === price ? null : v.price, sku: v.sku }));
  return { product, variants };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, listing_ids: asked, sections = [] } = await req.json();
    if (!tenantId || !Array.isArray(asked) || !asked.length) return json({ error: 'tenant_id and listing_ids are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const ids = [...new Set(asked.map((x: unknown) => String(x).replace(/\D/g, '')).filter(Boolean))].slice(0, PER_CALL);
    const client = db();

    const { data: cred } = await client.from('tenant_credentials').select('refresh_token')
      .eq('tenant_id', tenantId).eq('provider', 'ebay').maybeSingle();
    if (!cred) return json({ error: 'This shop is not connected to eBay yet.' }, 400);

    // Already on the shop, either copied from this listing or published to eBay from the portal.
    const { data: have } = await client.from('store_products').select('source_ref')
      .eq('tenant_id', tenantId).eq('source_kind', 'ebay_listing').in('source_ref', ids);
    const { data: published } = await client.from('candidates').select('ebay, store_products ( id )')
      .eq('tenant_id', tenantId).not('ebay', 'is', null);
    const onShop = new Set([
      ...(have ?? []).map((r) => String(r.source_ref)),
      ...(published ?? []).filter((c) => (c.store_products ?? []).length).map((c) => String(c.ebay?.listing_id ?? '')),
    ]);

    const access = await accessToken(cred.refresh_token);
    const added: Array<{ listing_id: string; product_id: string }> = [];
    const skipped: Array<{ listing_id: string; reason: string }> = [];

    for (const id of ids) {
      if (onShop.has(id)) { skipped.push({ listing_id: id, reason: 'Already on your shop' }); continue; }
      try {
        const { product, variants } = productFrom(await getItem(access, id), id, tenantId);
        if (!product.title) throw new Error('eBay returned no title');
        if (!product.price) throw new Error('eBay returned no price');

        let row: { id: string } | null = null;
        for (let attempt = 0; attempt < 4 && !row; attempt += 1) {
          const slug = attempt === 0 ? `${slugify(product.title)}-${id}` : `${slugify(product.title)}-${id}-${attempt}`;
          const { data, error } = await client.from('store_products').insert({ ...product, slug }).select('id').single();
          if (!error) row = data;
          else if (error.code !== '23505') throw new Error(error.message);
        }
        if (!row) throw new Error('No free web address for that title');

        if (variants.length) {
          const { error } = await client.from('store_variants').insert(variants.map((v, i) => ({
            tenant_id: tenantId, product_id: row!.id, label: v.label, price: v.price, sku: v.sku,
            stock: NEW_LISTING_STOCK, position: i,
          })));
          if (error) console.error('[ebay-import] variants', id, error.message);
        }

        // Keeper writes the draft, then checks it: returns, label and the shop title. The check waits for the writing.
        const { error: jErr } = await client.from('keeper_jobs').insert([
          { tenant_id: tenantId, product_id: row.id, sections },
          { tenant_id: tenantId, product_id: row.id, kind: 'shop_check' },
        ]);
        if (jErr) console.error('[ebay-import] jobs', id, jErr.message);

        added.push({ listing_id: id, product_id: row.id });
      } catch (err) {
        skipped.push({ listing_id: id, reason: err instanceof Error ? err.message : String(err) });
      }
    }

    return json({ added, skipped });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
