// Publishes or updates one candidate on eBay, from the portal: inventory item, offer, publish.
//
// Three modes besides publishing:
//   lookup: eBay's catalogue entry for the card's barcode, for the photos check on the card.
//   dry:    everything that would go to eBay and anything that stops it, written nowhere.
//   update: revises a listing already live from here, keeping its category.
//
// What goes up, and the rule that it is her copy and never the shop's, lives in _shared/ebay/listing.ts, which
// the queue uses too.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CANDIDATE_FIELDS, EbayError, allowance, appToken, catalogueFor, duplicateOf, env, gtinOf, policiesMissing, prepare, publish, userToken,
} from '../_shared/ebay/listing.ts';
import { aspectFacts, fillAspects } from '../_shared/aspects.ts';
import { marketFor } from '../_shared/ebay/market.ts';
import { metered } from '../_shared/usage.ts';

const CORS = {
  'access-control-allow-origin': '*',
  // supabase-js sends x-client-info on every invoke.
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// The shop id is public, so the caller has to prove membership, not just name the shop.
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

// Its Claude use handed back to Keeper in the x-claude-usage header (usage.ts).
Deno.serve(metered(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = await req.json();
    const { tenant_id: tenantId, candidate_id: candidateId, dry, update, lookup, fill, market } = body;
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

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

    const { data: c, error: cErr } = await client
      .from('candidates')
      .select(CANDIDATE_FIELDS)
      .eq('id', candidateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (cErr) return json({ error: cErr.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    const access = await userToken(cred.refresh_token);
    let app: string | null = null;
    const appOnce = async () => (app ??= await appToken());

    // The catalogue for the card's barcode, and nothing else: the card's photos check asks this first.
    if (lookup) {
      const gtin = gtinOf(c);
      if (!gtin) return json({ gtin: null, catalogue: null, note: 'No barcode on this card, so eBay\'s catalogue cannot be matched.' });
      try {
        const catalogue = await catalogueFor(gtin, {
          user: access,
          app: () => appToken('https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly'),
        });
        return json({ gtin, catalogue });
      } catch (e) {
        return json({ gtin, catalogue: null, catalogueError: e instanceof Error ? e.message : String(e) });
      }
    }

    // The shelf product's own market on eBay, for listing it as it is when it is not the product that proved the
    // card's market. Read only; nothing is listed.
    if (market) {
      const m = c.margin ?? {};
      const title = String(body.query ?? m.shelf?.product ?? m.cost_from?.product ?? c.listing?.title ?? c.title ?? '');
      try {
        return json({ market: await marketFor(title, await appOnce(), { brand: c.listing?.brand ?? null }) });
      } catch (e) {
        return json({ error: `eBay's search could not be read: ${e instanceof Error ? e.message : String(e)}` }, 400);
      }
    }

    const missing = policiesMissing(s);
    if (missing.length) return json({ error: `Choose ${missing.join(', ')} on the settings screen before listing.` }, 400);

    if (c.ebay?.listing_id && !update) return json({ error: 'This is already on eBay.', ebay: c.ebay }, 409);
    if (update && !c.ebay?.offer_id) return json({ error: 'Only listings published from here can be updated from here.' }, 400);

    const preview = await prepare(c, body, { user: access, app: appOnce }, { revising: Boolean(update), settings: s });
    if (!update) {
      const dup = await duplicateOf(client, tenantId, c).catch(() => null);
      if (dup) preview.problems.push(`Already on eBay as "${dup.title}". Two identical listings break eBay's rules.`);
    }
    const limits = await allowance(client, tenantId, s);

    if (dry) {
      // Keepr fills the details the category needs, and the ones eBay recommends, from the card's facts. Only
      // returned: the portal puts them in her draft, where she can change them.
      let filled: Record<string, string> = {};
      let fillError: string | null = null;
      const wanted = [...preview.missing.map((a) => ({ ...a, required: true })), ...preview.recommended.map((a) => ({ ...a, required: false }))];
      if (fill && wanted.length) {
        try {
          const facts = aspectFacts(c, { ...(c.draft ?? {}), title: body.title ?? c.draft?.title, description: body.description ?? c.draft?.description }, preview.category?.name ?? null);
          // What Keeper has learned about item details, when Keeper asks (keeper-run/ready.ts).
          const learned = body.lessons ? `\nWhat Keeper has learned (follow where it fits): ${String(body.lessons).slice(0, 1500)}` : '';
          filled = await fillAspects(env('ANTHROPIC_API_KEY'), facts + learned, wanted);
        } catch (e) {
          fillError = e instanceof Error ? e.message : String(e);
        }
      }
      return json({
        filled,
        fill_error: fillError,
        recommended: preview.recommended.map((a) => ({ name: a.name, mode: a.mode, values: a.values })),
        dry: true,
        sku: preview.sku,
        title: preview.title,
        price: preview.price,
        quantity: preview.quantity,
        category: preview.category ? { id: preview.category.id, name: preview.category.name, source: preview.category.source } : null,
        suggested: preview.suggested,
        category_differs: preview.categoryDiffers,
        images: preview.images.length,
        image_source: preview.imageSource,
        gtin: preview.gtin,
        catalogue: preview.catalogue
          ? { epid: preview.catalogue.epid, title: preview.catalogue.title, image: preview.catalogue.images[0] ?? null, images: preview.catalogue.images.length, aspects: Object.keys(preview.catalogue.aspects).length }
          : null,
        catalogue_error: preview.catalogueError,
        required: preview.required.map((a) => ({ name: a.name, mode: a.mode, values: a.values })),
        missing: preview.missing.map((a) => ({ name: a.name, mode: a.mode, values: a.values })),
        aspects: preview.aspects,
        problems: preview.problems,
        limits,
        policies: s,
      });
    }

    // Her monthly limit is eBay's rule; counting it here stops a refusal after the work is done.
    if (!update && limits.monthLeft <= 0) {
      return json({ error: `All ${limits.monthly} listings for this month are used. The count starts again on the 1st.`, limits }, 409);
    }

    const record = await publish(c, preview, s, access, { update: Boolean(update) });

    const { error: saveErr } = await client
      .from('candidates')
      .update({ ebay: record })
      .eq('id', candidateId)
      .eq('tenant_id', tenantId);

    // It is live either way; saying otherwise gets it listed twice.
    if (saveErr) return json({ ...record, warning: `Listed, but not recorded here: ${saveErr.message}` });

    return json(record);
  } catch (err) {
    const status = err instanceof EbayError && err.status >= 400 && err.status < 500 ? 400 : 500;
    return json({ error: err instanceof Error ? err.message : String(err) }, status);
  }
}));
