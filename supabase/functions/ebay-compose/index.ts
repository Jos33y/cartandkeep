// Writes eBay titles and descriptions from facts already on the candidate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pageUrlOf, parseTitles, readShopPage } from '../_shared/shop-page.ts';
import { askText } from '../_shared/claude.ts';
import { backstageOut } from '../_shared/copy.ts';
import { itemFactsOf, listingOf, productKey, swappedTo } from '../_shared/product.ts';
import { cleanAspects } from '../_shared/ebay/item.ts';
import { metered } from '../_shared/usage.ts';

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

/*
 * The titles of the eBay listings selling this same product (the research's market read), most sold first: the words
 * buyers search with, for the title. Never facts: a size, a pack or a claim in them is that seller's say-so.
 */
// deno-lint-ignore no-explicit-any
export function sellingTitles(c: Record<string, any>, n = 8): string | null {
  if (swappedTo(c)) return null;
  // deno-lint-ignore no-explicit-any
  const ls = ((c.competition?.listings ?? []) as any[]).filter((l) => l?.title);
  if (!ls.length) return null;
  const ranked = [...ls].sort((a, b) => Number(b.sold ?? 0) - Number(a.sold ?? 0));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of ranked) {
    const t = String(l.title).replace(/\s+/g, ' ').trim();
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(`${t}${Number(l.sold) > 0 ? ` (${l.sold} sold)` : ''}`);
    if (out.length >= n) break;
  }
  return out.join(' | ');
}

// The only facts the model may use. Once the card moved to another product's eBay listing, what eBay holds for
// that listing (brand, model, barcode, item details, its seller's description) is a source of facts; its wording
// never is, and the research's search words are the old product's.
// deno-lint-ignore no-explicit-any
function facts(c: Record<string, any>, keeper = false) {
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
    // Keeper judges the product by the card and her supplier, never by the research's search words: a search for one
    // thing often found another (the Kylie bed pad, 4 October), and the words read as a different product when they are not.
    ['Search this was found by', moved || keeper ? null : c.external_ref],
    ['ANOTHER EBAY SELLER\'S listing title (same caution)', (c.draft?.entry ?? c.entry)?.title],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}


const TITLE_SYSTEM = `You write eBay UK listing titles that win the search.

Rules:
- 80 characters maximum. Aim for 70 to 80: eBay ranks full titles better.
- Only use facts given. Never invent a size, a colour, a quantity, a material or a model.
- Front-load the words a buyer types. Brand, product, then qualifiers.
- Build it in this order where the facts give each part: brand, model name or number,
  what the product is in the plain words buyers search, the key spec (size, capacity,
  power, colour, material), then the pack or quantity ("Pack of 2", "4L").
- WORDS BUYERS SEARCH, when given, are the titles of listings selling this same product,
  most sold first. Use the words that recur in them, and their order, where the facts
  support them: that is how buyers find this product. Never copy one whole, and never
  take a size, a count or a claim from them that the facts do not give.
- A model number or a set number goes in as written (LEGO 76459, Aico ei3016): buyers
  search by it.
- No punctuation for decoration, no ALL CAPS, no emoji, no "BNIB" or "FAST POST".
- British spelling throughout: colour, flavour, fibre, litre.
- Sizes and weights in metric: convert pounds, ounces and inches (0.44 lb is 200 g).
- The photographs are the manufacturer's packaging. A pack count or size printed
  clearly on them is a fact like any other.
- The source marked FROM HER SUPPLIER is the product she sends. Where the shop's page
  or another UK shop's page disagrees with it (a size, a grade, a pack, a variant),
  that page is another product: follow her supplier and leave the other out. That is
  never a conflict.
- Only if her supplier and the packaging in the photographs disagree about quantity,
  size, weight or count, write no titles. With no supplier source, the same goes for
  the shop's page against the packaging. Reply with a single line starting CONFLICT:
  saying what disagrees, for example "CONFLICT: title says 8 x 150g, the pack shows 4x".
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

Otherwise reply with JSON only, no preamble and no markdown fence: an array of 2 strings.`;

const DESC_SYSTEM = `You write eBay UK listing descriptions.

Rules:
- Only use facts given. Never invent a specification, a claim or a use.
- Never make a claim more specific than the source. If it says "fully recyclable",
  do not say which part is. If it says "natural ingredients", do not name them.
- Keep factual lines verbatim: contents, weights, sizes, ingredients, pack counts.
- Keep every suitability limit exactly as written: ages, species, sizes, allergens,
  "not suitable for". These prevent wrong purchases and returns; never drop one.
- Do not calculate figures the source does not state, such as a total weight. One
  exception: give sizes and weights in metric for UK buyers. Convert pounds and ounces to
  grams or kilograms and inches to centimetres, rounded sensibly (0.44 lb is 200 g,
  5.25 inches is 13.3 cm). Keep litres, millilitres and other metric figures as written.
- The photographs are the manufacturer's packaging. Use printed text on them only
  where it is clearly legible, and treat it as a source like any other. Anything
  small, blurred or partly hidden is left out, not guessed.
- The source marked FROM HER SUPPLIER is the product she sends. Where the shop's page
  or another UK shop's page disagrees with it (a size, a grade, a pack, a variant),
  that page is another product: follow her supplier and leave the other out. That is
  never a conflict (6 October: her 1 litre 5W-30 oil, another shop's 5 litre 15W-50).
- Only if her supplier and the packaging in the photographs disagree about quantity,
  size, weight, count or contents, do not reconcile them and do not write a
  description. With no supplier source, the same goes for the shop's page against the
  packaging. Reply with a single line that starts CONFLICT: and says what disagrees,
  for example "CONFLICT: title says 8 x 150g, the pack shows 4x".
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
- Lay it out like this, leaving out any part the facts do not cover:
  1. One or two sentences on what it is and who it is for.
  2. A line reading "Key features", a blank line, then four to eight lines that each
     start with "- ": what it does and what matters about it, most important first.
  3. A line reading "What's in the box", a blank line, then a "- " line for each item,
     only when the facts say what is included.
  4. A line reading "Size and weight", a blank line, then "- " lines with the product's
     own dimensions and weight from the facts, with their units.
  5. A line reading "Good to know", a blank line, then "- " lines for care, use,
     compatibility, batteries, ages or other suitability limits, when the facts give them.
  Separate each part with a blank line.
- No postage or returns copy: eBay shows those from the policies.
- No marketing voice, no exclamation marks, no "grab yours today".
- British spelling throughout: colour, flavour, fibre, litre, analyse. Never the
  American forms, including inside a list copied from the source.
- Plain text, no HTML, no markdown headings.
- The description is what a buyer reads. Never mention the photographs, the images, the listing, the source, the
  supplier, what is or is not confirmed, or advise the buyer to check anything. What is not known is simply left out.

Reply with the description only.`;


/*
 * When Keeper writes (keeper-task-03), it writes. Joseey, 4 October: "when things are too complicated or strict it
 * causes error". Ten of the first twelve cards were refused over details such as a coverage figure or a battery line.
 * Her supplier's page is the product she sends, matched by its barcode, so it settles what the others disagree on;
 * what is still unclear is left out. Only a different product is said, and the card is still written from her
 * supplier's page.
 */
export const KEEPER_MODE = `

KEEPER'S MODE. This overrides every rule above about replying CONFLICT:
- Never reply CONFLICT and never refuse. Always write.
- The source marked FROM HER SUPPLIER is the product she sends, matched by its barcode.
  Where any other source disagrees with it (the shop's title or page, another shop,
  another eBay seller), follow her supplier and leave the other out.
- Where her supplier's page disagrees with itself (a count, a size, a coverage figure,
  a battery type, a finish, what it suits), use the product details table's figure. If
  that is still unclear, leave that detail out. Never guess between two figures.
- Only if her supplier's page is a different product from the shop's title (another
  flavour, variant, model or pack size), still write from her supplier's page, and put
  first a single line reading "DIFFERENT: " and what differs in a few words, for example
  "DIFFERENT: Amazon sells Chicken, the card says Beef". Otherwise write no such line.
  Judge that only from the shop's title and her supplier's page, never from how the
  product was found. These are NOT a different product, so write no DIFFERENT line for
  them: the brand written differently or left out ("HydroSnake" against "Gravitas
  HydroSnake"), other words for the same thing, or details you left out because the
  sources disagree (say nothing of those; they are simply not written).
- Leave out any detail that cannot belong to this kind of product, even when a table
  states it: a supplier's details table is often filled from a template or another
  product (lumens or a bulb type on a smoke alarm module, a screen size on a pillow, a
  wattage on a soft toy). Write only what a buyer of this product would expect to read.`;

// A title cut to eBay's 80 at the last whole word, without a dangling joiner or mark.
export function cutTitle(t: string, max = 80) {
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1).replace(/\s+\S*$/, '');
  return cut.replace(/[\s,;:&/+-]+(and|with|for|in|of)?$/i, '').replace(/[\s,;:&/+-]+$/, '').slice(0, max);
}

// Keeper's DIFFERENT line off the top of an answer: what differs, and the rest of the answer.
export function differentOf(text: string): { different: string | null; rest: string } {
  const m = /^\s*DIFFERENT:\s*(.+?)\s*(?:\n|$)/i.exec(text);
  return m ? { different: m[1].replace(/\.$/, ''), rest: text.slice(m[0].length).trim() } : { different: null, rest: text };
}

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
    const { tenant_id: tenantId, candidate_id: candidateId, kind, keeper = false, lessons = null } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);
    if (kind !== 'title' && kind !== 'description') return json({ error: 'kind must be title or description' }, 400);

    const { data: c, error } = await db()
      .from('candidates')
      .select('id, title, external_ref, listing, entry, margin, draft, photo_checks, competition')
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

    // The selling listings' words, for the title only: the description is written from the facts alone.
    const words = kind === 'title' ? sellingTitles(c) : null;
    const learned = keeper && lessons ? `\nWHAT KEEPER HAS LEARNED from her past cards and her changes (follow these where they fit this product; they are how she wants it written, never facts about it):\n${String(lessons).slice(0, 2000)}` : '';
    const known = (words
      ? `${facts(c, keeper)}\nWORDS BUYERS SEARCH (titles of listings selling this same product; words only, never facts): ${words}`
      : facts(c, keeper)) + learned;
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
    // The writing works from the facts in words (4 October: photos were most of the bill, and every one had been
    // checked already). Photos only when there are no words to go on: no supplier text, no shop page, no eBay details.
    const hasWords = Boolean(String(c.draft?.supplier_text ?? '').trim() || c.listing || itemFactsOf(c));
    const shots = hasWords ? [] : (passed.length ? passed : ((c.listing as { images?: string[] } | null)?.images ?? [])).slice(0, 2);
    const write = async (system: string, max: number) => {
      try {
        return await claude(system, known, max, shots);
      } catch (e) {
        if (shots.length && /image|media|file format|url/i.test(e instanceof Error ? e.message : String(e))) return claude(system, known, max, []);
        throw e;
      }
    };

    if (kind === 'title') {
      const said = await write(keeper ? TITLE_SYSTEM + KEEPER_MODE : TITLE_SYSTEM, 600);
      if (!keeper && /^CONFLICT:/i.test(said.trim())) {
        return json({ conflict: said.trim().replace(/^CONFLICT:\s*/i, ''), read: fresh });
      }
      const { different, rest: text } = keeper ? differentOf(said) : { different: null, rest: said };
      let titles = parseTitles(text);
      if (!titles?.length) return json({ error: 'The suggestion came back without titles. Try again.', read: fresh }, 502);
      // Over 80 is rejected by eBay, so a long one is a wasted option. Every one over (a long product name, the KSR
      // downlight on 4 October) is asked for once more with the lengths said, then the shortest is cut at a word.
      if (!titles.some((t) => t.length <= 80)) {
        const again = await write(`${keeper ? TITLE_SYSTEM + KEEPER_MODE : TITLE_SYSTEM}

YOUR LAST TITLES WERE TOO LONG (${titles.map((t) => t.length).join(', ')} characters). eBay refuses anything over 80.
Write them again, every one 80 characters or fewer: drop the least searched words first.`, 600);
        const more = parseTitles(keeper ? differentOf(again).rest : again) ?? [];
        titles = more.some((t) => t.length <= 80) ? more : [cutTitle([...titles, ...more].sort((x, y) => x.length - y.length)[0])];
      }
      return json({ titles: titles.filter((t) => t.length <= 80).slice(0, 4), different, read: fresh });
    }

    const raw = await write(keeper ? DESC_SYSTEM + KEEPER_MODE : DESC_SYSTEM, 1400);
    const { different, rest } = keeper ? differentOf(raw) : { different: null, rest: raw };
    const out = backstageOut(rest);

    // Writing through a conflict means picking whichever side makes the facts agree. Keeper's mode never stops here.
    if (!keeper && /^CONFLICT:/i.test(out)) {
      return json({ conflict: out.replace(/^CONFLICT:\s*/i, '').trim(), read: fresh });
    }
    if (!out.trim() || /^CONFLICT:/i.test(out)) return json({ error: 'No description came back. Try again.', read: fresh }, 502);

    // The page it read goes back too, so the open card gets the shop's facts and barcode without a reload.
    return json({ description: out, different, read: fresh });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}));
