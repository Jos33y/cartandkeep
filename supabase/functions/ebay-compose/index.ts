// Writes eBay titles and descriptions from facts already on the candidate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pageUrlOf, parseTitles, readShopPage } from '../_shared/shop-page.ts';
import { askText } from '../_shared/claude.ts';
import { backstageOut } from '../_shared/copy.ts';
import { itemFactsOf, listingOf, productKey, swappedTo } from '../_shared/product.ts';
import { cleanAspects } from '../_shared/ebay/item.ts';

const CORS = {
  'access-control-allow-origin': '*',
  // supabase-js sends x-client-info on every invoke.
  'access-control-allow-headers':
    'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};

const db = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

async function claude(system: string, user: string, maxTokens = 1000, images: string[] = []) {
  return askText(env('ANTHROPIC_API_KEY'), {
    system,
    maxTokens,
    content: [
      ...images.map((url) => ({ type: 'image', source: { type: 'url', url } })),
      { type: 'text', text: user },
    ],
  });
}

// Other UK shops' pages matched to this product: facts to write from, never their wording.
// deno-lint-ignore no-explicit-any
function othersFacts(c: Record<string, any>): Array<[string, unknown]> {
  const pc = c.photo_checks;
  if (!pc || (pc.product ?? null) !== productKey(c)) return [];
  // deno-lint-ignore no-explicit-any
  // Her supplier's page sent from her own browser comes first and is trusted first; other shops after it.
  return ((pc.others ?? []) as any[]).filter((o) => o.ok).sort((a, b) => Number(Boolean(b.sent)) - Number(Boolean(a.sent))).slice(0, 2).map((o) => [
    o.sent
      ? `FROM HER SUPPLIER'S PAGE (${o.shop}, sent from her browser; the product she sends, trust this first; facts only, never its wording)`
      : `Another UK shop's page for the same product (${o.shop}, facts only, never its wording)`,
    [o.title, o.description, (o.features ?? []).join('; ')].filter(Boolean).join('\n').slice(0, 1800),
  ]);
}

// The only facts the model may use. Once the card moved to another product's eBay listing, what eBay holds for
// that listing (brand, model, barcode, item details, its seller's description) is a source of facts; its wording
// never is, and the research's search words are the old product's.
// deno-lint-ignore no-explicit-any
function facts(c: Record<string, any>) {
  const l = listingOf(c) ?? {};
  const f = itemFactsOf(c) ?? {};
  const moved = Boolean(swappedTo(c));
  // Cleaned again here, so details saved before the cleaning are read the same way.
  const held = Object.entries(cleanAspects(f.aspects ?? {})).map(([k, v]) => `${k}: ${v}`).join('; ');
  const supplier = String(c.draft?.supplier_text ?? '').trim();
  return [
    // What her supplier's page says, pasted by her: the product she sends, so the strongest source there is.
    ['FROM HER SUPPLIER (the product she sends; trust this first)', supplier ? supplier.slice(0, 3000) : null],
    ['Shop title', l.title],
    ['Brand', l.brand ?? f.brand],
    ['Category', l.shop_category ?? f.category],
    ['Summary', l.summary],
    ['Description', l.description],
    ['Features', Array.isArray(l.features) ? (l.features as string[]).join('; ') : null],
    ['Pack size on the shelf', l.unit_price],
    ['Model', f.mpn],
    ['Barcode', f.gtin],
    ['ANOTHER EBAY SELLER\'S item details (typed by hand, often incomplete or wrong; use only what agrees with the rest)', held || null],
    ['ANOTHER EBAY SELLER\'S description (same caution; facts only, never their wording)', f.description],
    ...othersFacts(c),
    ['Search this was found by', moved ? null : c.external_ref],
    ['ANOTHER EBAY SELLER\'S listing title (same caution)', (c.draft?.entry ?? c.entry)?.title],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}


const TITLE_SYSTEM = `You write eBay UK listing titles.

Rules:
- 80 characters maximum. Aim for 70 to 80: eBay ranks full titles better.
- Only use facts given. Never invent a size, a colour, a quantity, a material or a model.
- Front-load the words a buyer types. Brand, product, then qualifiers.
- No punctuation for decoration, no ALL CAPS, no emoji, no "BNIB" or "FAST POST".
- British spelling throughout: colour, flavour, fibre, litre.
- The photographs are the manufacturer's packaging. A pack count or size printed
  clearly on them is a fact like any other.
- If the trusted sources disagree about quantity, size, weight or count (her
  supplier, the shop's page, the packaging in the photographs), write no titles.
  Reply with a single line starting CONFLICT: saying what disagrees, for example
  "CONFLICT: title says 8 x 150g, the pack shows 4x".
- Anything marked ANOTHER EBAY SELLER is that seller's say-so and is often wrong.
  Where it disagrees with a trusted source or makes no sense, leave it out; that
  is never a conflict. A detail only that seller gives is used only if it is
  plainly about this product and nothing contradicts it.
- Her supplier's page can disagree with itself: a weight, a size or a battery
  time in the seller's bullet points that differs from Amazon's product details
  table. Use the table's figure and leave the other out; that is not a conflict.
  A disagreement about pack count, quantity or contents still is.
- Never put a health or medical claim in a title: pain relief, therapy,
  circulation, recovery, healing, treats or prevents, even when a source says it.

Otherwise reply with JSON only, no preamble and no markdown fence: an array of 4 strings.`;

const DESC_SYSTEM = `You write eBay UK listing descriptions.

Rules:
- Only use facts given. Never invent a specification, a claim or a use.
- Never make a claim more specific than the source. If it says "fully recyclable",
  do not say which part is. If it says "natural ingredients", do not name them.
- Keep factual lines verbatim: contents, weights, sizes, ingredients, pack counts.
- Keep every suitability limit exactly as written: ages, species, sizes, allergens,
  "not suitable for". These prevent wrong purchases and returns; never drop one.
- Do not calculate figures the source does not state, such as a total weight.
- The photographs are the manufacturer's packaging. Use printed text on them only
  where it is clearly legible, and treat it as a source like any other. Anything
  small, blurred or partly hidden is left out, not guessed.
- If the trusted sources (her supplier, the shop's page, the packaging in the
  photographs) disagree about quantity, size, weight, count or contents, do not
  reconcile them and do not write a description. Reply with a single line that
  starts CONFLICT: and says what disagrees, for example
  "CONFLICT: title says 8 x 150g, the pack shows 4x".
- Anything marked ANOTHER EBAY SELLER is that seller's say-so and is often wrong:
  sizes with no units, a figure in the wrong box, a feature their title claims.
  Leave out whatever makes no sense or disagrees with a trusted source; that is
  never a conflict. Write the description from what is left, and keep it short
  rather than guess.
- Her supplier's page can disagree with itself: a weight, a size or a battery
  time in the seller's bullet points that differs from Amazon's product details
  table. Use the table's figure and leave the other out; that is not a conflict.
  A disagreement about pack count, quantity or contents still is.
- Never make a health or medical claim, even when a source makes it: not "relieves
  pain", "muscle therapy", "improves circulation", "speeds recovery", "heals",
  "treats" or "prevents". Say what the product does as a thing (percussion
  massage, 6 speeds, 4 heads), never what it does for the body's health.
- Open with one sentence on what it is and who it is for.
- Then a short list of what is in the pack and what matters about it.
- No postage or returns copy: eBay shows those from the policies.
- No marketing voice, no exclamation marks, no "grab yours today".
- British spelling throughout: colour, flavour, fibre, litre, analyse. Never the
  American forms, including inside a list copied from the source.
- Plain text, no HTML, no markdown headings.
- The description is what a buyer reads. Never mention the photographs, the images, the listing, the source, the
  supplier, what is or is not confirmed, or advise the buyer to check anything. What is not known is simply left out.

Reply with the description only.`;


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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, candidate_id: candidateId, kind } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);
    if (kind !== 'title' && kind !== 'description') return json({ error: 'kind must be title or description' }, 400);

    const { data: c, error } = await db()
      .from('candidates')
      .select('id, title, external_ref, listing, entry, margin, draft, photo_checks')
      .eq('id', candidateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    // No read yet: take it from the shop page the card was costed from, keep it on the card, and carry on. Read
    // the first time she asks, so a newly approved card never waits on a script.
    const url = pageUrlOf(c);
    let unread = false;
    let fresh: Record<string, unknown> | null = null;
    // Read again when the listing now comes from another page (her supplier's), or was never read.
    const moved = Boolean(c.listing && url && (c.listing as Record<string, unknown>).source_url && (c.listing as Record<string, unknown>).source_url !== url);
    // Moved to another product with no page of its own: the old product's read is set aside, never written from.
    if (swappedTo(c) && !listingOf(c) && !url) (c as Record<string, unknown>).listing = null;
    if ((!c.listing || moved) && url) {
      const read = await readShopPage(url).catch(() => null);
      if (read) {
        fresh = read;
        (c as Record<string, unknown>).listing = read;
        await db().from('candidates').update({ listing: read }).eq('id', c.id);
      } else {
        unread = true;
        // Never write about the old product when the listing has moved to her supplier's page.
        if (moved) (c as Record<string, unknown>).listing = null;
      }
    }
    const shop = url ? new URL(url).hostname.replace(/^www\./, '') : null;

    // With no page at all, a title can still come from the search and the listing that sells; a
    // description cannot, because every line of it would be a guess.
    const held = itemFactsOf(c) ?? (String(c.draft?.supplier_text ?? '').trim() ? {} : null);
    if (!c.listing && !held && kind === 'description') {
      return json({
        error: unread
          ? `The page at ${shop} could not be read just now. Try again in a minute, or write the description by hand.`
          : 'There is no shop page on this card to write from, so the description needs writing by hand.',
      }, 400);
    }
    if (!c.listing && !held && !(c.entry as Record<string, unknown> | null)?.title) {
      return json({
        error: unread
          ? `The page at ${shop} could not be read just now, and there is no selling listing to go on. Try again in a minute, or write the title by hand.`
          : 'Nothing on this card to write a title from. Write it by hand.',
      }, 400);
    }

    const known = facts(c);
    // First four photos: enough to reach the back panel without paying for every angle.
    // Photos Keepr passed and we copied (a format we know) first, then the page's own. A photo the model cannot read
    // is dropped and the call made again without photos, rather than failing the whole piece of writing.
    // Only a check of this product's page: one made before the card moved would show the old product.
    // deno-lint-ignore no-explicit-any
    const pc = (c as Record<string, any>).photo_checks;
    const ours = pc && (pc.product ?? null) === productKey(c) && (!pc.page || pc.page === url);
    // deno-lint-ignore no-explicit-any
    const wider = ours ? ((pc.others ?? []) as any[]).filter((o) => o.ok).flatMap((o) => o.images ?? []) : [];
    const passed = ((ours ? [...(pc.images ?? []), ...wider] : []) as Array<{ ok?: boolean; copy?: string }>)
      .filter((i) => i.ok && i.copy).map((i) => i.copy as string);
    const shots = (passed.length ? passed : ((c.listing as { images?: string[] } | null)?.images ?? [])).slice(0, 4);
    const write = async (system: string, max: number) => {
      try {
        return await claude(system, known, max, shots);
      } catch (e) {
        if (shots.length && /image|media|file format|url/i.test(e instanceof Error ? e.message : String(e))) return claude(system, known, max, []);
        throw e;
      }
    };

    if (kind === 'title') {
      const text = await write(TITLE_SYSTEM, 600);
      if (/^CONFLICT:/i.test(text.trim())) {
        return json({ conflict: text.trim().replace(/^CONFLICT:\s*/i, ''), read: fresh });
      }
      const titles = parseTitles(text);
      if (!titles?.length) return json({ error: 'The suggestion came back without titles. Try again.', read: fresh }, 502);
      // Over 80 is rejected by eBay, so a long one is a wasted option.
      return json({ titles: titles.filter((t) => t.length <= 80).slice(0, 4), read: fresh });
    }

    const out = backstageOut(await write(DESC_SYSTEM, 1400));

    // Writing through a conflict means picking whichever side makes the facts agree.
    if (/^CONFLICT:/i.test(out)) {
      return json({ conflict: out.replace(/^CONFLICT:\s*/i, '').trim(), read: fresh });
    }

    // The page it read goes back too, so the open card gets the shop's facts and barcode without a reload.
    return json({ description: out, read: fresh });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
