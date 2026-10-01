// Moves a card to the eBay listing that sells what she can source. Two ways in:
//   item_id: she chose the listing. It is read in full and returned as the card's new reference.
//   none:    Keepr looks. The product she buys (her supplier's page, or its web address) against the listings on the
//            card's chart and a fresh eBay search, and says how sure it is that each sells the same product.
// Nothing is written here. The portal puts the answer in her draft, so she sees it, and can switch back.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appToken, env, gtinOf } from '../_shared/ebay/listing.ts';
import { legacyId, readItem } from '../_shared/ebay/item.ts';
import { marketFor } from '../_shared/ebay/market.ts';
import { matchScore } from '../_shared/match.ts';
import { listingOf } from '../_shared/product.ts';
import { readShopPage } from '../_shared/shop-page.ts';
import { AUTO_SWAP, judgeSame, settle, titleFromUrl } from '../_shared/same-product.ts';

type Json = Record<string, any>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const db = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

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

// The product the card's copy describes now, to tell a better listing of the same product from another product.
function cardProduct(c: Json) {
  const l = listingOf(c) ?? {};
  return { title: c.draft?.title || c.draft?.item_facts?.title || l.title || c.title, brand: c.draft?.item_facts?.brand ?? l.brand ?? null, gtin: gtinOf(c) };
}

// Another product unless the listing reads as the same one the card is written for.
const isNewProduct = (c: Json, read: Json) => {
  const r = matchScore(cardProduct(c), { title: read.entry.title, brand: read.facts.brand, gtin: read.facts.gtin });
  return r.rules_out || r.score < 0.85;
};

async function marketOf(title: string, app: string, brand: string | null) {
  try {
    const m = await marketFor(title, app, { brand });
    if (!m) return null;
    const { listings, ...rest } = m;
    return { ...rest, listings: listings.slice(0, 8) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const { tenant_id: tenantId, candidate_id: candidateId, item_id: itemId } = body;
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: c, error } = await client.from('candidates')
      .select('id, title, external_ref, listing, entry, margin, draft, competition')
      .eq('id', candidateId).eq('tenant_id', tenantId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    const app = await appToken();

    // She chose it: read it whole. Her choice is her confirmation that it is what she sources.
    if (itemId) {
      const read = await readItem(String(itemId), app);
      return json({
        entry: { ...read.entry, by: 'her', sure: null, why: null },
        facts: read.facts,
        new_product: isNewProduct(c, read),
        market: await marketOf(read.entry.title, app, read.facts.brand),
      });
    }

    // Keepr looks. First what she buys: her supplier's page, read, or the words in its address.
    const { data: sources } = await client.from('candidate_sources').select('url, supplier, created_at')
      .eq('candidate_id', c.id).not('url', 'is', null).order('created_at', { ascending: false }).limit(1);
    const page: string | null = body.product_url ?? c.draft?.page ?? sources?.[0]?.url ?? null;
    if (!page) return json({ error: 'Keepr needs the page of the product you buy. Add your supplier\'s link first.' }, 400);
    const read = c.listing?.source_url === page ? c.listing : await readShopPage(page).catch(() => null);
    const product = read
      ? { title: read.title, brand: read.brand, gtin: read.gtin, mpn: read.product_code, description: read.description, image: read.images?.[0] ?? null }
      : { title: titleFromUrl(page), brand: null, gtin: null, mpn: null, description: null, image: null };
    if (!product.title) {
      return json({ error: `Keepr could not read the product at ${new URL(page).hostname.replace(/^www\./, '')}. Open a listing on the chart and choose it yourself.` }, 400);
    }

    // The listings to weigh: the card's chart, and eBay's search for her product.
    const search = await marketFor(product.title, app, { brand: product.brand }).catch(() => null);
    const pool = new Map<string, Json>();
    for (const l of [...(c.competition?.listings ?? []), ...(search?.listings ?? [])] as Json[]) {
      const id = l.item_id ? legacyId(l.item_id) : null;
      if (id && !pool.has(id)) pool.set(id, l);
    }
    const ranked = [...pool.values()]
      .map((l) => ({ l, r: matchScore(product, { title: l.title, brand: l.brand ?? null }) }))
      .filter((x) => !x.r.rules_out && x.r.score >= 0.3)
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, 4);
    const reads = (await Promise.allSettled(ranked.map((x) => readItem(String(x.l.item_id), app))))
      .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (!reads.length) return json({ best: null, considered: pool.size, product: { title: product.title, page } });

    const said = await judgeSame(env('ANTHROPIC_API_KEY'), product, reads);
    const settled = settle(product, reads, said);
    const best = settled[0];
    const current = c.draft?.entry ?? c.entry ?? null;
    const already = current?.item_id && legacyId(current.item_id) === legacyId(best.entry.item_id);

    return json({
      product: { title: product.title, page },
      considered: pool.size,
      auto: AUTO_SWAP,
      already: Boolean(already),
      best: {
        entry: { ...best.entry, by: 'keepr', sure: best.sure, why: best.why },
        facts: best.facts,
        new_product: isNewProduct(c, best),
      },
      others: settled.slice(1, 3).map((x) => ({ item_id: x.entry.item_id, title: x.entry.title, price: x.entry.price, url: x.entry.url, sure: x.sure, why: x.why })),
      market: await marketOf(best.entry.title, app, best.facts.brand),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
