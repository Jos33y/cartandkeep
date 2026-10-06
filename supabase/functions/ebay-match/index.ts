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
import { asinOf, isAmazon } from '../_shared/amazon.ts';
import { AUTO_SWAP, judgeSame, settle, titleFromUrl } from '../_shared/same-product.ts';
import { metered } from '../_shared/usage.ts';

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
// Her Amazon supplier's facts, when the page read is the one the card is checked against: a barcode settles a match.
const amazonFacts = (c: Json) => (c.supplier_read?.found ? c.supplier_read.facts ?? null : null);

function cardProduct(c: Json) {
  const l = listingOf(c) ?? {};
  const a = amazonFacts(c) ?? {};
  return {
    title: c.draft?.title || c.draft?.item_facts?.title || l.title || a.title || c.title,
    brand: c.draft?.item_facts?.brand ?? l.brand ?? a.brand ?? null,
    gtin: gtinOf(c) ?? a.barcode ?? null,
  };
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

// Its Claude use handed back to Keeper in the x-claude-usage header (usage.ts).
Deno.serve(metered(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json();
    const { tenant_id: tenantId, candidate_id: candidateId, item_id: itemId } = body;
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: c, error } = await client.from('candidates')
      .select('id, title, external_ref, listing, entry, margin, draft, competition, supplier_read')
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
    const { data: sources } = await client.from('candidate_sources').select('url, supplier, found_at')
      .eq('candidate_id', c.id).not('url', 'is', null).order('found_at', { ascending: false }).limit(1);
    // Her supplier's link on the draft first: it is the product she sends, where the newest source may be a shop she
    // only compared.
    const page: string | null = body.product_url ?? c.draft?.supplier_url ?? c.draft?.page ?? sources?.[0]?.url ?? null;
    if (!page) return json({ error: 'Keepr needs the page of the product you buy. Add your supplier\'s link first.' }, 400);
    // Amazon cannot be read here; its page read through Apify is used when it is the same product.
    const az = isAmazon(page) && asinOf(page) && asinOf(page) === c.supplier_read?.asin ? amazonFacts(c) : null;
    const read = az ? null : c.listing?.source_url === page ? c.listing : isAmazon(page) ? null : await readShopPage(page).catch(() => null);
    const product = az
      ? { title: az.title, brand: az.brand, gtin: az.barcode, mpn: az.model, description: az.details.join('; '), image: az.images?.[0] ?? null }
      : read
      ? { title: read.title, brand: read.brand, gtin: read.gtin, mpn: read.product_code, description: read.description, image: read.images?.[0] ?? null }
      : { title: titleFromUrl(page), brand: null, gtin: null, mpn: null, description: null, image: null };
    // No reading of her Amazon page (none yet, or of another ASIN) and nothing in its address: the card's own name
    // stands in, so the match still runs (6 October: "Keepr could not read the product at amazon.co.uk").
    if (!product.title) {
      const name = String(c.draft?.title || c.title || c.listing?.title || '').trim();
      if (name) Object.assign(product, { title: name, brand: product.brand ?? c.listing?.brand ?? null, gtin: product.gtin ?? c.listing?.gtin ?? null });
    }
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

    const said = await judgeSame(env('ANTHROPIC_API_KEY'), product, reads, typeof body.lessons === 'string' ? body.lessons : null);
    const settled = settle(product, reads, said);
    const best = settled[0];
    const current = c.draft?.entry ?? c.entry ?? null;
    const already = current?.item_id && legacyId(current.item_id) === legacyId(best.entry.item_id);
    const newProduct = isNewProduct(c, best);
    /*
     * The research's listing already sells her product and Keepr's find, the same product, has not sold: the card
     * keeps the listing that sells (the Salus, 4 October: 10 sold swapped for none in 31 days). Keeper does not move
     * it; she still sees Keepr's find when she asks on the card.
     */
    const research = c.entry ?? null;
    const keepProved = !already && !c.draft?.entry && !newProduct && Boolean(research?.proved) && !best.entry.proved;

    return json({
      product: { title: product.title, page },
      considered: pool.size,
      auto: AUTO_SWAP,
      already: Boolean(already),
      best: {
        entry: { ...best.entry, by: 'keepr', sure: best.sure, why: best.why },
        facts: best.facts,
        new_product: newProduct,
      },
      keep_proved: keepProved ? { item_id: research.item_id, title: research.title ?? null, price: research.price ?? null } : null,
      others: settled.slice(1, 3).map((x) => ({ item_id: x.entry.item_id, title: x.entry.title, price: x.entry.price, url: x.entry.url, sure: x.sure, why: x.why })),
      market: await marketOf(best.entry.title, app, best.facts.brand),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}));
