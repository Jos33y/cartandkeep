// Keepr's photo check for one card: eBay's catalogue by barcode first, then each of the shop's photos looked at for
// a shop's name or logo, a watermark, text laid over, a styled scene, the wrong pack, and a size eBay refuses.
// The answer is kept on the card (candidates.photo_checks). A photo that passes is copied into her listing-images
// folder, so eBay and her shop read it from us, not from a shop that may block eBay or delete it later. Nothing of
// hers is changed here: the portal puts passed photos in her draft when she asks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appToken, catalogueFor, env, gtinOf, userToken } from '../_shared/ebay/listing.ts';
import { pageUrlOf, readShopPage } from '../_shared/shop-page.ts';
import {
  MAX_BYTES, MAX_PHOTOS, PHOTO_SYSTEM, brandRuleFor, imageSize, judge, parseSeen, smaller, toBase64,
} from '../_shared/photos.ts';
import { MODEL } from '../_shared/model.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function allowed(req: Request, tenantId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  if (token === env('SUPABASE_SERVICE_ROLE_KEY')) return true;
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  return !error && data === true;
}

// The photo's bytes, its type and size. A photo too heavy to send is asked for smaller where the CDN allows it.
async function fetchImage(url: string) {
  const get = async (u: string) => {
    const res = await fetch(u, { headers: { 'user-agent': UA, accept: 'image/jpeg,image/png,image/webp;q=0.9,image/*;q=0.5' }, signal: AbortSignal.timeout(15000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  };
  let bytes = await get(url).catch(() => null);
  if (bytes && bytes.length > MAX_BYTES) {
    const s = smaller(url);
    bytes = s ? await get(s).catch(() => null) : null;
  }
  if (!bytes) return null;
  const size = imageSize(bytes);
  return { bytes, size, heavy: bytes.length > MAX_BYTES };
}

async function look(photos: Array<{ type: string; data: string }>, context: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: PHOTO_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          ...photos.flatMap((p, i) => [
            { type: 'text', text: `Photo ${i + 1}:` },
            { type: 'image', source: { type: 'base64', media_type: p.type, data: p.data } },
          ]),
          { type: 'text', text: context },
        ],
      }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `Anthropic returned ${res.status}`);
  return parseSeen((body.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join(''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, candidate_id: candidateId } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: c, error } = await client.from('candidates')
      .select('id, title, margin, listing, draft, image_url')
      .eq('id', candidateId).eq('tenant_id', tenantId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    // The page first, if it has never been read: its photos are what is checked.
    const page = pageUrlOf(c);
    let fresh: Record<string, unknown> | null = null;
    if (!c.listing && page) {
      const read = await readShopPage(page).catch(() => null);
      if (read) {
        fresh = read;
        c.listing = read;
        await client.from('candidates').update({ listing: read }).eq('id', c.id).is('listing', null);
      }
    }
    const l = c.listing ?? {};
    const shop = page ? new URL(page).hostname.replace(/^www\./, '') : null;
    const brand = l.brand ?? null;

    const { data: rules } = await client.from('photo_brand_rules').select('brand, rule, tenant_id')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    const rule = brandRuleFor(rules ?? [], brand, l.title ?? c.title);

    // eBay's catalogue for the barcode, with her eBay connection when there is one.
    const gtin = gtinOf(c);
    let catalogue: Record<string, unknown> | null = null;
    let catalogueError: string | null = null;
    if (gtin) {
      const { data: cred } = await client.from('tenant_credentials').select('refresh_token')
        .eq('tenant_id', tenantId).eq('provider', 'ebay').maybeSingle();
      try {
        const user = cred?.refresh_token ? await userToken(cred.refresh_token).catch(() => undefined) : undefined;
        const found = await catalogueFor(gtin, { user, app: () => appToken('https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly') });
        catalogue = found ? { epid: found.epid, title: found.title, images: found.images } : null;
      } catch (e) {
        catalogueError = e instanceof Error ? e.message : String(e);
      }
    }

    // The shop's photos, first few. A brand on the list is not looked at: its shop photos are not used either way.
    const urls = [...new Set((l.images ?? []) as string[])].filter((u) => /^https?:\/\//.test(u)).slice(0, MAX_PHOTOS);
    const images: Array<Record<string, unknown>> = [];
    if (!rule && urls.length) {
      const got = await Promise.all(urls.map((u) => fetchImage(u).catch(() => null)));
      const sendable = urls.map((url, i) => ({ url, got: got[i] }))
        .filter((x) => x.got && !x.got.heavy && x.got.size);
      const expected = [
        `Expected product: ${c.draft?.title || l.title || c.title}`,
        c.margin?.shelf?.product && `Shelf product it was costed from: ${c.margin.shelf.product}`,
        c.margin?.cost_from?.product && `Shop product it was costed from: ${c.margin.cost_from.product}`,
        brand && `Brand: ${brand}`,
        shop && `The shop these photos are from: ${shop}`,
      ].filter(Boolean).join('\n');
      const seen = sendable.length
        ? await look(sendable.map((x) => ({ type: x.got!.size!.type, data: toBase64(x.got!.bytes) })), expected).catch(() => null)
        : null;
      for (const [i, url] of urls.entries()) {
        const g = got[i];
        const k = sendable.findIndex((x) => x.url === url);
        const verdict = !g
          ? { ok: false, reasons: ['Could not be downloaded'] }
          : g.heavy ? { ok: false, reasons: ['Too large to check'] }
            : !g.size ? { ok: false, reasons: ['An image format that could not be read'] }
              : judge(seen?.[k] ?? null, g.size, shop);
        // Passed: kept as our own copy, the one that goes up.
        let copy: string | null = null;
        if (verdict.ok && g?.size) {
          const ext = g.size.type.split('/')[1] === 'jpeg' ? 'jpg' : g.size.type.split('/')[1];
          const path = `${tenantId}/${c.id}/shop/${i + 1}.${ext}`;
          const { error: upErr } = await client.storage.from('listing-images')
            .upload(path, g.bytes, { contentType: g.size.type, upsert: true });
          if (!upErr) copy = client.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
        }
        images.push({ url, ...verdict, copy, width: g?.size?.width ?? null, height: g?.size?.height ?? null });
      }
    }

    const checks = {
      checked_at: new Date().toISOString(),
      page,
      shop,
      brand,
      brand_rule: rule ? rule.rule : null,
      gtin,
      catalogue,
      catalogue_error: catalogueError,
      images,
    };
    const { error: saveErr } = await client.from('candidates').update({ photo_checks: checks }).eq('id', c.id).eq('tenant_id', tenantId);
    if (saveErr) return json({ error: saveErr.message }, 500);

    return json({ photo_checks: checks, read: fresh });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
