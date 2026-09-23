// Publishes or updates a candidate on eBay: inventory item, offer, publish.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EBAY = 'https://api.ebay.com';
const MARKETPLACE = 'EBAY_GB';
// eBay's category tree for the UK site.
const TREE_ID = '3';

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

const basic = () => btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);

async function token(form: Record<string, string>) {
  const res = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic()}` },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error_description ?? `eBay returned ${res.status}`);
  return body;
}

// The useful detail is in errors[], not in the top-level message.
function readError(status: number, body: Record<string, never>) {
  const errors = (body?.errors ?? []) as Array<Record<string, never>>;
  if (!errors.length) return body?.message ?? `eBay returned ${status}`;
  return errors
    .map((e) => {
      const params = ((e.parameters ?? []) as Array<{ name: string; value: string }>)
        .map((p) => `${p.name}: ${p.value}`)
        .join(', ');
      return [e.message, e.longMessage, params].filter(Boolean).join(' ');
    })
    .join(' | ');
}

async function call(path: string, access: string, init: RequestInit = {}) {
  const res = await fetch(`${EBAY}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${access}`,
      'content-type': 'application/json',
      'content-language': 'en-GB',
      // The runtime's own default is not one eBay accepts.
      'accept-language': 'en-GB',
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(readError(res.status, body));
  return body;
}

const escape = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// eBay renders descriptions as HTML, so plain line breaks would collapse.
function toHtml(text: string) {
  if (/<\/?(p|ul|li|br|div)\b/i.test(text)) return text;
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^[-•*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escape(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(escape).join('<br>')}</p>`;
    })
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const {
      tenant_id: tenantId,
      candidate_id: candidateId,
      price,
      quantity = 1,
      title: titleOverride,
      description: descriptionOverride,
      images: imagesOverride,
      dry,
      update,
      package: parcel,
    } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);

    const client = db();

    const { data: cred, error: credErr } = await client
      .from('tenant_credentials')
      .select('refresh_token, settings')
      .eq('tenant_id', tenantId)
      .eq('provider', 'ebay')
      .maybeSingle();

    if (credErr) return json({ error: credErr.message }, 500);
    if (!cred) return json({ error: 'This account is not connected to eBay.' }, 400);

    const s = cred.settings ?? {};
    const missing = [
      !s.fulfillment && 'a postage policy',
      !s.payment && 'a payment policy',
      !s.return && 'a returns policy',
      !s.location && 'a dispatch location',
    ].filter(Boolean);

    if (missing.length) {
      return json({ error: `Choose ${missing.join(', ')} on the settings screen before listing.` }, 400);
    }

    const { data: c, error: cErr } = await client
      .from('candidates')
      .select('id, title, margin, listing, draft, ebay, external_ref')
      .eq('id', candidateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (cErr) return json({ error: cErr.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);
    if (c.ebay?.listing_id && !update) return json({ error: 'This is already on eBay.', ebay: c.ebay }, 409);
    if (update && !c.ebay?.offer_id) return json({ error: 'Only listings published from here can be updated from here.' }, 400);

    const l = c.listing ?? {};
    const d = c.draft ?? {};

    // The edited version wins. The pipeline's is what it starts from.
    const title = String(titleOverride ?? d.title ?? l.title ?? c.title ?? '').slice(0, 80);
    const images = ((imagesOverride ?? d.images ?? l.images ?? []) as string[]).slice(0, 12);
    const sell = Number(price ?? d.price ?? c.margin?.sale_price ?? 0);

    if (!title) return json({ error: 'No title to list with.' }, 400);
    if (!images.length) return json({ error: 'No photographs to list with.' }, 400);
    if (!(sell > 0)) return json({ error: 'No price to list at.' }, 400);

    const access = (await token({
      grant_type: 'refresh_token',
      refresh_token: cred.refresh_token,
    })).access_token as string;

    // An update keeps the category it went up in; a new listing asks eBay.
    let category = update
      ? { categoryId: c.ebay.category_id, categoryName: c.ebay.category_name }
      : null;

    if (!category) {
      const app = (await token({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      })).access_token as string;

      const suggested = await call(
        `/commerce/taxonomy/v1/category_tree/${TREE_ID}/get_category_suggestions?q=${encodeURIComponent(title)}`,
        app,
      );
      category = suggested?.categorySuggestions?.[0]?.category ?? null;
    }

    if (!category?.categoryId) {
      return json({ error: 'eBay could not suggest a category for this title.' }, 400);
    }

    // Stable across relists, so a second publish replaces rather than duplicates.
    const sku = `CK-${String(c.id).replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    const fromShop = [
      l.summary,
      l.description,
      (l.features ?? []).length ? (l.features as string[]).map((f) => `• ${f}`).join('\n') : null,
    ].filter(Boolean).join('\n\n');

    // eBay's own delivery services price by parcel, and refuse a listing without one.
    const box = parcel ?? d.package ?? null;
    const packageWeightAndSize = box?.weight_kg
      ? {
        packageType: 'MAILING_BOX',
        weight: { value: Number(box.weight_kg), unit: 'KILOGRAM' },
        ...(box.length_cm && box.width_cm && box.height_cm
          ? {
            dimensions: {
              length: Number(box.length_cm),
              width: Number(box.width_cm),
              height: Number(box.height_cm),
              unit: 'CENTIMETER',
            },
          }
          : {}),
      }
      : null;

    const description = toHtml(descriptionOverride ?? d.description ?? (fromShop || title));

    if (dry) {
      return json({
        dry: true,
        sku,
        title,
        price: sell,
        quantity,
        category: { id: category.categoryId, name: category.categoryName },
        images: images.length,
        policies: s,
      });
    }

    await call(`/sell/inventory/v1/inventory_item/${sku}`, access, {
      method: 'PUT',
      body: JSON.stringify({
        availability: { shipToLocationAvailability: { quantity } },
        condition: 'NEW',
        ...(packageWeightAndSize ? { packageWeightAndSize } : {}),
        product: {
          title,
          description,
          imageUrls: images,
          // Required as a pair; the shop's product code is not an MPN.
          brand: l.brand ?? 'Unbranded',
          mpn: l.mpn ?? 'Does not apply',
          aspects: {
            Brand: [l.brand ?? 'Unbranded'],
            MPN: [l.mpn ?? 'Does not apply'],
          },
        },
      }),
    });

    const offerBody = {
      sku,
      marketplaceId: MARKETPLACE,
      format: 'FIXED_PRICE',
      availableQuantity: quantity,
      categoryId: category.categoryId,
      listingDescription: description,
      pricingSummary: { price: { value: sell.toFixed(2), currency: 'GBP' } },
      listingPolicies: {
        fulfillmentPolicyId: s.fulfillment,
        paymentPolicyId: s.payment,
        returnPolicyId: s.return,
      },
      merchantLocationKey: s.location,
    };

    // A failed publish leaves the offer behind, and creating it twice is refused.
    const existing = await call(
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${MARKETPLACE}`,
      access,
    ).catch(() => null);

    let offerId = existing?.offers?.[0]?.offerId ?? null;

    if (offerId) {
      await call(`/sell/inventory/v1/offer/${offerId}`, access, {
        method: 'PUT',
        body: JSON.stringify(offerBody),
      });
    } else {
      const created = await call('/sell/inventory/v1/offer', access, {
        method: 'POST',
        body: JSON.stringify(offerBody),
      });
      offerId = created.offerId;
    }

    // Updating a published offer revises the live listing in place.
    const published = update
      ? { listingId: c.ebay.listing_id }
      : await call(`/sell/inventory/v1/offer/${offerId}/publish`, access, { method: 'POST' });

    const record = {
      ...(update ? c.ebay : {}),
      sku,
      offer_id: offerId,
      listing_id: published.listingId,
      category_id: category.categoryId,
      category_name: category.categoryName,
      price: sell,
      quantity,
      ...(box ? { package: box } : {}),
      ...(update
        ? { revised_at: new Date().toISOString() }
        : { published_at: new Date().toISOString() }),
    };

    const { error: saveErr } = await client
      .from('candidates')
      .update({ ebay: record })
      .eq('id', candidateId)
      .eq('tenant_id', tenantId);

    // It is live either way; saying otherwise gets it listed twice.
    if (saveErr) return json({ ...record, warning: `Listed, but not recorded here: ${saveErr.message}` });

    return json(record);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
