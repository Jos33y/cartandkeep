// Keepr's photo check for one card: eBay's catalogue by barcode first, then each of the shop's photos looked at for
// a shop's name or logo, a watermark, text laid over, a styled scene, the wrong pack, and a size eBay refuses.
// The answer is kept on the card (candidates.photo_checks). A photo that passes is copied into her listing-images
// folder, so eBay and her shop read it from us, not from a shop that may block eBay or delete it later. Nothing of
// hers is changed here: the portal puts passed photos in her draft when she asks.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appToken, catalogueOfCard, env, gtinOf, userToken } from '../_shared/ebay/listing.ts';
import { READER, pageUrlOf, readShopPage } from '../_shared/shop-page.ts';
import { listingOf, productKey, swappedTo } from '../_shared/product.ts';
import {
  MAX_BYTES, MAX_PHOTOS, PHOTO_SYSTEM, brandRuleFor, imageSize, judge, parseSeen, smaller, toBase64,
} from '../_shared/photos.ts';
import { askText } from '../_shared/claude.ts';
import { ENOUGH_PHOTOS, PHOTOS_PER_PAGE, findPages, samePage } from '../_shared/other-shops.ts';

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
  const text = await askText(env('ANTHROPIC_API_KEY'), {
    system: PHOTO_SYSTEM,
    maxTokens: 1200,
    content: [
      ...photos.flatMap((p, i) => [
        { type: 'text', text: `Photo ${i + 1}:` },
        { type: 'image', source: { type: 'base64', media_type: p.type, data: p.data } },
      ]),
      { type: 'text', text: context },
    ],
  });
  return parseSeen(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, candidate_id: candidateId, again, wider = false, supplied = null } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: c, error } = await client.from('candidates')
      .select('id, title, margin, listing, draft, image_url, photo_checks')
      .eq('id', candidateId).eq('tenant_id', tenantId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    // The page first, if it has never been read: its photos are what is checked.
    const page = pageUrlOf(c);
    let fresh: Record<string, unknown> | null = null;
    // Moved to another product with no page of its own: the old product's page and photos are not looked at.
    if (swappedTo(c) && !page) c.listing = null;
    // Read again when asked, when the page is another one now, or when it was read before the whole gallery was.
    const stale = c.listing && (again || (c.listing.reader ?? 1) < READER || (c.listing.source_url && c.listing.source_url !== page));
    if ((!c.listing || stale) && page) {
      const read = await readShopPage(page).catch(() => null);
      if (read) {
        // A barcode read before stays when the fresh read has none.
        const merged = { ...read, gtin: read.gtin ?? c.listing?.gtin ?? null };
        fresh = merged;
        c.listing = merged;
        await client.from('candidates').update({ listing: merged }).eq('id', c.id);
      }
    }
    const l = listingOf(c) ?? {};
    const moved = swappedTo(c);
    const shop = page ? new URL(page).hostname.replace(/^www\./, '') : null;
    const brand = l.brand ?? c.draft?.item_facts?.brand ?? null;

    const { data: rules } = await client.from('photo_brand_rules').select('brand, rule, tenant_id')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    const rule = brandRuleFor(rules ?? [], brand, l.title ?? moved?.title ?? c.title);

    // eBay's catalogue for the barcode, with her eBay connection when there is one.
    const gtin = gtinOf(c);
    let catalogue: Record<string, unknown> | null = null;
    let catalogueError: string | null = null;
    if (gtin || moved?.item_id && c.draft?.item_facts?.epid) {
      const { data: cred } = await client.from('tenant_credentials').select('refresh_token')
        .eq('tenant_id', tenantId).eq('provider', 'ebay').maybeSingle();
      try {
        const user = cred?.refresh_token ? await userToken(cred.refresh_token).catch(() => undefined) : undefined;
        const found = await catalogueOfCard(c, { user, app: () => appToken('https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly') });
        catalogue = found ? { epid: found.epid, title: found.title, images: found.images } : null;
      } catch (e) {
        catalogueError = e instanceof Error ? e.message : String(e);
      }
    }

    // What the photos should show, for Keepr's look: this product, from whichever shop.
    const expectedFor = (from: string | null) => [
      `Expected product: ${c.draft?.title || l.title || moved?.title || c.title}`,
      !moved && c.margin?.shelf?.product && `Shelf product it was costed from: ${c.margin.shelf.product}`,
      !moved && c.margin?.cost_from?.product && `Shop product it was costed from: ${c.margin.cost_from.product}`,
      brand && `Brand: ${brand}`,
      from && `The shop these photos are from: ${from}`,
    ].filter(Boolean).join('\n');

    // Each photo looked at and judged; a passed one copied into her folder (under shop/, so it is never taken for hers).
    async function checkPhotos(urls: string[], from: string | null, name: (i: number) => string) {
      const out: Array<Record<string, unknown>> = [];
      if (!urls.length) return out;
      const got = await Promise.all(urls.map((u) => fetchImage(u).catch(() => null)));
      const sendable = urls.map((url, i) => ({ url, got: got[i] })).filter((x) => x.got && !x.got.heavy && x.got.size);
      const seen = sendable.length
        ? await look(sendable.map((x) => ({ type: x.got!.size!.type, data: toBase64(x.got!.bytes) })), expectedFor(from)).catch(() => null)
        : null;
      for (const [i, url] of urls.entries()) {
        const g = got[i];
        const k = sendable.findIndex((x) => x.url === url);
        const verdict = !g
          ? { ok: false, reasons: ['Could not be downloaded'] }
          : g.heavy ? { ok: false, reasons: ['Too large to check'] }
            : !g.size ? { ok: false, reasons: ['An image format that could not be read'] }
              : judge(seen?.[k] ?? null, g.size, from);
        let copy: string | null = null;
        if (verdict.ok && g?.size) {
          const ext = g.size.type.split('/')[1] === 'jpeg' ? 'jpg' : g.size.type.split('/')[1];
          const path = `${tenantId}/${c.id}/shop/${name(i)}.${ext}`;
          const { error: upErr } = await client.storage.from('listing-images')
            .upload(path, g.bytes, { contentType: g.size.type, upsert: true });
          if (!upErr) copy = client.storage.from('listing-images').getPublicUrl(path).data.publicUrl;
        }
        out.push({ url, ...verdict, copy, width: g?.size?.width ?? null, height: g?.size?.height ?? null });
      }
      return out;
    }

    /*
     * A supplier page she sent from her own browser (the Send to Cart & Keep button): Amazon and other shops that
     * refuse to be read by a server are read by her browser, on the page she is looking at. Its photos are checked
     * like any shop's, and kept beside the others; the rest of the check is left as it was.
     */
    // A sent page is the gallery she chose to send, so all of eBay's twelve are looked at.
    const SENT_PHOTOS = 12;
    if (supplied && Array.isArray(supplied.images)) {
      const from = (() => { try { return new URL(String(supplied.url)).hostname.replace(/^www\./, ''); } catch { return 'your supplier'; } })();
      const pics = [...new Set((supplied.images as unknown[]).map(String).filter((u) => /^https:\/\//.test(u)))].slice(0, SENT_PHOTOS);
      const checked = rule ? [] : await checkPhotos(pics, from, (i) => `s${i + 1}`);
      const prev = c.photo_checks && (c.photo_checks.product ?? null) === productKey(c) && (c.photo_checks.version ?? 1) >= READER ? c.photo_checks : null;
      const entry = {
        url: String(supplied.url ?? ''), shop: String(supplied.shop ?? from).slice(0, 60), title: String(supplied.title ?? '').slice(0, 200),
        ok: true, via: 'sent from your browser', sent: true,
        description: String(supplied.text ?? '').slice(0, 2000) || null,
        features: Array.isArray(supplied.bullets) ? (supplied.bullets as unknown[]).map(String).slice(0, 12) : [],
        images: checked,
      };
      const kept = {
        version: READER, checked_at: new Date().toISOString(), page: prev?.page ?? page, product: productKey(c),
        shop: prev?.shop ?? null, brand: prev?.brand ?? brand, brand_rule: rule ? rule.rule : null, gtin: prev?.gtin ?? null,
        catalogue: prev?.catalogue ?? null, catalogue_error: prev?.catalogue_error ?? null, images: prev?.images ?? [],
        others: [entry, ...((prev?.others ?? []) as Array<Record<string, unknown>>).filter((o) => o.url !== entry.url)],
        others_for: prev?.others_for ?? null, others_error: prev?.others_error ?? null, searches: prev?.searches ?? 0,
      };
      const { error: sentErr } = await client.from('candidates').update({ photo_checks: kept }).eq('id', c.id).eq('tenant_id', tenantId);
      if (sentErr) return json({ error: sentErr.message }, 500);
      return json({ photo_checks: kept, read: null });
    }

    // The shop's photos, first few. A brand on the list is not looked at: its shop photos are not used either way.
    const urls = [...new Set((l.images ?? []) as string[])].filter((u) => /^https?:\/\//.test(u)).slice(0, MAX_PHOTOS);
    const images = rule ? [] : await checkPhotos(urls, shop, (i) => String(i + 1));

    /*
     * Too few passed: other UK shops that sell the same product, found by web search and held to a strict match
     * (barcode, or brand with model or nearly the whole name and the pack). Their photos are checked the same way;
     * their facts are kept for the writing. An earlier search for this product and page is reused unless she asks
     * again, so a search is paid for once.
     */
    const identity = `${productKey(c) ?? ''}|${page ?? ''}`;
    const before = c.photo_checks?.others && c.photo_checks.others_for === identity ? c.photo_checks : null;
    let others: Array<Record<string, unknown>> = before?.others ?? [];
    let othersError: string | null = null;
    let searches = 0;
    const passedHere = images.filter((i) => i.ok).length;
    if (!rule && (wider || (!before && passedHere < ENOUGH_PHOTOS))) {
      try {
        const product = {
          title: c.draft?.title || l.title || moved?.title || c.title, brand, gtin, mpn: l.product_code ?? c.draft?.item_facts?.mpn ?? null,
          used: [page].filter(Boolean),
        };
        const found = await findPages(env('ANTHROPIC_API_KEY'), product);
        searches = found.searches;
        const reads = await Promise.all(found.pages.map((p) => readShopPage(p.url).catch(() => null)));
        others = [];
        for (const [n, p] of found.pages.entries()) {
          const read = reads[n];
          if (!read) { others.push({ url: p.url, shop: p.shop, ok: false, via: 'the page could not be read', images: [] }); continue; }
          const same = samePage(product, read);
          if (!same.ok) { others.push({ url: p.url, shop: p.shop, title: read.title, ok: false, via: same.via, images: [] }); continue; }
          const pics = [...new Set((read.images ?? []) as string[])].filter((u) => /^https?:\/\//.test(u)).slice(0, PHOTOS_PER_PAGE);
          others.push({
            url: p.url, shop: p.shop, title: read.title, ok: true, via: same.via, gtin: read.gtin ?? null,
            description: read.description ? String(read.description).slice(0, 2000) : null,
            features: (read.features ?? []).slice(0, 12),
            images: await checkPhotos(pics, new URL(p.url).hostname.replace(/^www\./, ''), (i) => `o${n + 1}-${i + 1}`),
          });
        }
      } catch (e) {
        othersError = e instanceof Error ? e.message : String(e);
        others = before?.others ?? [];
      }
    }

    const checks = {
      version: READER,
      checked_at: new Date().toISOString(),
      page,
      // The listing the card had moved to when this was checked; null for the card's own product.
      product: productKey(c),
      shop,
      brand,
      brand_rule: rule ? rule.rule : null,
      gtin,
      catalogue,
      catalogue_error: catalogueError,
      images,
      // Other UK shops for the same product, and what they were looked for.
      others,
      others_for: others.length || before || wider || passedHere < ENOUGH_PHOTOS ? identity : null,
      others_error: othersError,
      searches,
    };
    const { error: saveErr } = await client.from('candidates').update({ photo_checks: checks }).eq('id', c.id).eq('tenant_id', tenantId);
    if (saveErr) return json({ error: saveErr.message }, 500);

    return json({ photo_checks: checks, read: fresh });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
