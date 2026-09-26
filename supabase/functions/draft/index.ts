/*
 * Drafts a description and a title for one product.
 *
 * It writes to `derived_fields.draft` and never to `description` or `title`.
 * The model drafts and she ships, and nothing generated reaches a customer
 * without a person having read it and pressed something.
 *
 * One product per call rather than the Batch API. All 78 come to roughly $0.49
 * sent this way against $0.25 batched, so the saving is about nineteen pence
 * against a stored job id, a poll loop, a retrieval path and a wait that can
 * run to 24 hours. Sync also means drafts land one at a time and she can start
 * reading while the rest run. Revisit if a job ever gets large enough to matter.
 *
 * There is no ../_shared import. The dashboard editor deploys one folder, which
 * is what broke cors.ts. The CORS block below is duplicated on purpose.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';


// The model sometimes answers "nothing" as a pair of quote marks or a word; all of those are empty.
const emptyish = (v: string) => (/^(["'`]{2}|none|n\/a|-|unknown|not stated)$/i.test(v.trim()) ? '' : v.replace(/^["']|["']$/g, '').trim());

// A last guard on customer copy: any sentence about the supplier, the photograph or the source moves to flags, never to the shop.
const BACKSTAGE = /\b(supplier|photograph|photo|image|listing|source|the details|feed|not visible|cannot be confirmed)\b/i;
function customerCopy(description: string, flags: string[]) {
  const sentences = description.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [description];
  const kept = sentences.filter((x) => !BACKSTAGE.test(x));
  const moved = sentences.filter((x) => BACKSTAGE.test(x)).map((x) => `Left out of the description: ${x.trim()}`);
  return { description: kept.join('').trim(), flags: [...flags, ...moved] };
}

const ALLOWED = (Deno.env.get('STORE_ORIGINS')
  ?? 'https://portal.cartandkeep.com,http://localhost:5180,http://127.0.0.1:5180')
  .split(',')
  .map((o) => o.trim());

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const MODEL = Deno.env.get('DRAFT_MODEL') ?? 'claude-sonnet-5';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/*
 * Keys in `specifications` that are not facts about the goods.
 *
 * Every row in this catalogue carries the seller's eBay business policy ids,
 * and Specifications.jsx renders that object straight onto the product page, so
 * without this a shopper reads "Payment Policies: 264890263017". They are also
 * the sort of thing a model will happily weave into a sentence if handed it.
 *
 * Matched case insensitively on the whole key, not on a substring, so a real
 * spec called "Returns" is not swallowed by the rule about "Returns Policy ID".
 */
const SPEC_NOISE = new Set([
  // Kept in step with src/utils/specs.js by hand. The dashboard editor deploys
  // one folder and cannot import from src, which is the same constraint that
  // duplicates the CORS block and the postcode list in the other functions.
  // If a key is added there, add it here.

  'payment policies', 'returns policy id', 'shipping policies',
  'personalise', 'personalisation instructions', 'classic part',
  'performance part', 'universal fitment', 'handmade', 'antique',
]);

function cleanSpecs(specs: Record<string, unknown> | null) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(specs ?? {})) {
    if (SPEC_NOISE.has(key.trim().toLowerCase())) continue;
    const v = String(value ?? '').replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '').trim();
    if (v) out[key] = v;
  }
  return out;
}

/*
 * The supplier blurb, cut down before it is sent.
 *
 * These run to four thousand characters of Amazon product page: emoji bullets,
 * "Best Sellers Rank 325 in Garden", leaked JavaScript from a page expander,
 * repeated headings, and on one row "4.3 out of 5 stars (377)", which is an
 * invented rating waiting to be laundered into her copy. The schema markup
 * already refuses to emit a rating with nothing behind it and this is the same
 * rule one layer up.
 *
 * Trimmed rather than dropped, because it is also the only place a real fact
 * sometimes lives, like what is actually in an eight piece gift set.
 */
function cleanSource(text: string | null) {
  if (!text) return null;
  return text
    // Emoji and the decorative ticks the feeds use as bullets.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    // The page script that came through with one supplier's description. The
    // trailing group matters: the call nests two closures, so a non greedy
    // match stops at the inner `});` and leaves the outer one in the prose.
    .replace(/P\.when\([\s\S]*?\}\);(?:\s*\}\);)*/g, ' ')
    // Directional marks. eBay's feed carries them in front of numbers and they
    // survive every other clean, so a dimension arrives with an invisible
    // character glued to it.
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    // Marketplace furniture that is about the listing rather than the goods.
    .replace(/^.*(Best Sellers Rank|out of 5 stars|Customer reviews|ASIN\b|Guaranteed software updates).*$/gim, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2500) || null;
}

/*
 * eBay serves the same image at several widths and the stored URL is the 300px
 * one. 800 is around 850 tokens and is where the model can actually count how
 * many things are in the shot, which is the whole reason the image is here.
 */
const bigger = (url: string | null) =>
  (url ? url.replace(/\/s-l\d+\./, '/s-l800.') : null);

const SYSTEM = `You write product copy for a small independent UK general store. You are drafting for the shop owner to read, edit and approve. Nothing you write is published as it stands.

The source data is a bulk marketplace feed that nobody has checked. It is frequently wrong and it frequently contradicts itself. Your first job is accuracy and your second is the writing.

RULES, in order of importance.

1. Use only what you are given. No invented dimensions, materials, capacities, weights, counts, origins, certifications or ingredients. If the specifications do not carry a capacity, the description does not mention a capacity.

2. Never make a safety, medical, health or efficacy claim. Not "soothes", not "relieves", not "antibacterial", not "kills 99%". These appear throughout the source text and they do not survive into your draft. Describe what a thing is and what it is for, not what it will do to a person.

3. Never mention returns, refunds, delivery, guarantees, warranties or gifting occasions. The shop states its own terms and yours would contradict them.

4. Never repeat a rating, review count, sales rank, price, discount or urgency. No superlatives about quality nobody has verified: no premium, luxury, best, perfect, ultimate.

5. When two fields disagree, do not pick one. Write around the disagreement and record it in flags. A title saying 250ml over a specification saying 50ml is not a rounding error and choosing either could be a false description.

6. The photograph is evidence. Describe what is plainly visible in it. Do not infer material, dimensions or quality from it. Where the photograph and the fields disagree, say so in flags rather than quietly preferring one.

VOICE. British English. Plain, calm, specific. Short sentences. Write as a shopkeeper who has the thing in their hand, not as a marketplace listing. No emoji, no bullet symbols, no exclamation marks, no second person sales patter.

DESCRIPTION. Two to four sentences, 40 to 90 words. What it is, what it is for, and what is certain about it. Plain prose, no headings, no lists.

The description is what a customer reads on the shop. It never mentions the supplier, the photograph, the listing, the details, the source or any doubt. Anything uncertain or contradictory is left out of the description entirely and goes in flags. A customer must never read "the supplier says" or "not visible in the photograph".

TITLE. Under 65 characters. What the thing is, the brand if there is a real one, and the one distinguishing detail that is certain. Strip the feed's keyword stuffing, pipes, model codes and repeated words. "Unbranded" is not a brand.

FLAGS. Short factual notes for the shop owner about problems in the source data. Each one names the fields and what they say. Empty array when there is nothing wrong. Never put marketing in here.

Write them for somebody looking at a screen, not at this prompt.

Name fields as the screen names them. The keys you are given are internal. Say "the details", not specifications or specs. Say "the title". Say "what the supplier wrote", not supplier_text. Say "the returns policy", not current_returns_class or returns_class. Say "the photograph". Never write a field name with an underscore in it.

Never cite a rule by number. "per rule 2", "excluded per policy" and "not carried into the description per guidelines" mean nothing to the reader. Either say plainly what was left out and why in ordinary words, or leave it out of the flags entirely.

Do not flag the returns policy. Disagreeing with it is what the returns class field is for, it is shown separately with its own reason, and repeating it here means the same finding is read twice and cleared in two places.

Do not flag your own decisions. A flag is a problem in the source data, not a note about what you chose to write. "Marketing claims not included" is not a finding; leaving them out is simply the job.

RETURNS CLASS. Which UK cancellation rules apply to these goods.

standard  The default. Almost everything. The customer can send it back for any reason.
sealed    Goods not suitable for return once unsealed, for health or hygiene reasons. Cosmetics, toiletries, underwear, incontinence and continence products, anything applied to the body, anything that goes in the mouth.
none      Consumables and perishables. Food, drink, supplements. Anything made to order or personalised.

Choose standard unless the goods clearly fall in an exception. Getting this wrong in one direction costs the shop a parcel. Getting it wrong in the other denies a customer a cancellation right they have in law, which is the worse error, so when the goods are ambiguous the answer is standard.

Judge the goods, not the packaging. A saucepan in a sealed box is standard. A jar of moisturiser is sealed even if the photograph does not show a seal. Cleaning chemicals are ordinary goods, not consumables, so they are standard.

RETURNS REASON. One short sentence naming what about these goods puts them in that class. It is read by somebody deciding whether to accept your suggestion, so it says what the goods are, not what the rule is.

IN THE BOX. What a customer opening the parcel will find, taken only from the source. A short comma separated list, or empty string when the source does not say. Do not count things in the photograph and do not infer a pack size.

Return your answer through the draft tool. It is the only way to answer.`;

/*
 * The shape of a draft, declared to the model as a tool.
 *
 * The first version asked for "JSON only" in the prompt and parsed the text,
 * which a model can decline by writing a sentence first, and that is what it
 * did on the first real product. The second version tried to start the reply
 * with an opening brace, and this model refuses a conversation that does not
 * end with a user message.
 *
 * A tool schema is what both of those were reaching for. The API returns a
 * structured object rather than text, so there is no format to disobey and
 * nothing to parse. Forced with tool_choice, so answering in prose is not an
 * available move.
 */
const DRAFT_TOOL = {
  name: 'draft',
  description: 'Return the drafted description, title and any problems found in the source data.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Two to four sentences, 40 to 90 words, plain prose, British English.',
      },
      title: {
        type: 'string',
        description: 'Under 65 characters. No keyword stuffing, no pipes, no model codes.',
      },
      flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Contradictions in the source data, each naming the fields and what they say. Empty when there are none.',
      },
      returns_class: {
        type: 'string',
        enum: ['standard', 'sealed', 'none'],
        description: 'Which cancellation rules apply. standard unless the goods clearly fall in an exception.',
      },
      returns_reason: {
        type: 'string',
        description: 'One short sentence on what about these goods puts them in that class.',
      },
      in_the_box: {
        type: 'string',
        description: 'What a customer opening the parcel finds, from the source only. Empty string when the source does not say.',
      },
    },
    required: ['description', 'title', 'flags', 'returns_class', 'returns_reason', 'in_the_box'],
  },
};

/*
 * The flags, tidied on the way out.
 *
 * The prompt asks for all of this and a prompt is a request a model can
 * decline. It declined twice already: `current_returns_class` and "per rule 2"
 * both reached her screen, in two separate drafts, after the instruction was
 * written. So the instruction stays and this enforces it.
 *
 * Names are rewritten rather than dropped, because a flag that mentions an
 * internal key is usually a real contradiction wearing the wrong word, and
 * throwing it away would lose the finding to fix the phrasing.
 */
const FIELD_WORDS: Array<[RegExp, string]> = [
  [/\bcurrent_returns_class\b/gi, 'the returns policy'],
  [/\breturns_class\b/gi, 'the returns policy'],
  [/\bsupplier_text\b/gi, 'what the supplier wrote'],
  [/\bin_the_box\b/gi, "what is in the box"],
  [/\bcategory_path\b/gi, 'the section'],
  [/\bimage_url\b/gi, 'the photograph'],
  [/\bcurrent_title\b/gi, 'the title'],
  [/\bprice_gbp\b/gi, 'the price'],
  [/\bspecifications\b/gi, 'the details'],
];

/*
 * Two kinds of line that are not findings at all.
 *
 * A disagreement about the returns policy has its own field, its own panel and
 * its own button, so repeating it here means she reads it twice and clears it
 * in two places. And a note saying marketing claims were left out is a
 * description of the job rather than a problem with the record.
 */
const NOT_A_FINDING = [
  /\b(returns?|cancellation) (policy|class|rules?)\b/i,
  /\b(not (included|repeated|carried)|omitted|excluded)\b.*\b(claim|marketing|superlative|efficacy)/i,
  /\b(claim|marketing|superlative|efficacy)\b.*\b(not (included|repeated|carried)|omitted|excluded)/i,
  /\bper (rule|policy|guideline)/i,
];

function tidyFlags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => {
      let text = String(f).trim();
      for (const [pattern, word] of FIELD_WORDS) text = text.replace(pattern, word);
      // A replacement at the start of a sentence lowercases it, so
      // "Specifications list Type as Backpack" became "the details list...".
      // Restored rather than left, because a line of hers should not start in
      // lower case on a screen where every other line does not.
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .filter((text) => text && !NOT_A_FINDING.some((p) => p.test(text)));
}

async function draftFor(product: Record<string, any>) {
  const specs = cleanSpecs(product.specifications);
  const source = cleanSource(product.source_description);
  const image = bigger(product.image_url);

  const facts = {
    current_title: product.title ?? null,
    brand: product.brand ?? null,
    condition: product.condition ?? null,
    category: product.category_path ?? null,
    price_gbp: product.price ?? null,
    specifications: specs,
    in_the_box: product.in_the_box ?? null,
    // What the enrichment script guessed from the title alone, so the model can
    // agree or disagree with it rather than starting from nothing. It has the
    // specifications, the supplier text and the photograph, which the script
    // did not.
    current_returns_class: product.returns_class ?? 'standard',
    supplier_text: source,
  };

  const content: Array<Record<string, unknown>> = [];

  // The image first, then the fields. A model shown the fields first tends to
  // read the photograph as confirmation of them rather than as a check on them,
  // and catching the disagreement is the reason it is here at all.
  if (image) {
    content.push({ type: 'image', source: { type: 'url', url: image } });
  }
  content.push({
    type: 'text',
    text: `${image ? 'The photograph above is the product.\n\n' : 'There is no photograph.\n\n'}${JSON.stringify(facts, null, 2)}`,
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      // Raised from 1000. A product with four contradictions in it writes four
      // flags, and a reply that runs out mid object parses as nothing at all,
      // which is indistinguishable from the model ignoring the format.
      max_tokens: 1500,
      system: SYSTEM,
      tools: [DRAFT_TOOL],
      // Forced, not offered. Left to choose, a model asked a question about a
      // product will sometimes answer it in prose instead of calling the tool.
      tool_choice: { type: 'tool', name: 'draft' },
      messages: [{ role: 'user', content }],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message ?? `Anthropic ${res.status}`);

  /*
   * The tool call, found by type rather than by position.
   *
   * A reply can carry a text block before the tool_use block, so indexing into
   * content would read the model thinking out loud as the draft. Selectors by
   * position in a growing structure have been wrong five times on this project.
   */
  const call = (payload.content ?? []).find((b: any) => b.type === 'tool_use');

  if (!call) {
    // Kept loud and kept whole. The first version of this threw the reply away
    // and left nothing to diagnose with, which cost a round trip.
    console.error('[draft] no tool call', JSON.stringify(payload).slice(0, 800));
    if (payload.stop_reason === 'max_tokens') {
      throw new Error('The draft was cut off before it finished. Try again.');
    }
    const said = (payload.content ?? [])
      .filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    throw new Error(said
      ? `The model answered in prose instead of drafting. It said: ${said.slice(0, 120)}`
      : 'The model returned nothing to draft from.');
  }

  const parsed = call.input ?? {};

  return {
    ...customerCopy(String(parsed.description ?? '').trim(), tidyFlags(parsed.flags)),
    title: String(parsed.title ?? '').trim(),
    /*
     * Validated against the three the column accepts rather than trusted.
     *
     * The enum in the schema is an instruction, and this value ends up
     * selecting which statutory paragraph goes into a customer's confirmation
     * email. Anything unexpected falls back to standard, which is the class
     * that grants the most rights, so a bad value cannot quietly take one away.
     */
    returns_class: ['standard', 'sealed', 'none'].includes(parsed.returns_class)
      ? parsed.returns_class : 'standard',
    returns_reason: String(parsed.returns_reason ?? '').trim(),
    in_the_box: emptyish(String(parsed.in_the_box ?? '').trim()),
    /*
     * What answered, not what was asked for.
     *
     * `claude-sonnet-5` is an alias with no date on it, so it floats to
     * whatever the current snapshot is and her shop voice could shift without
     * anything being deployed. The API returns the model it actually resolved
     * to, so that is what gets stored. Recording the alias would mean a draft
     * read in November says nothing about what wrote it.
     *
     * `requested` is kept beside it because the two disagreeing is the
     * interesting case: it is how a pinned DRAFT_MODEL that silently did not
     * take becomes visible.
     */
    model: String(payload.model ?? MODEL),
    requested: MODEL,
    // So a draft can be judged against when it was written, and a stale one is
    // visible rather than assumed current.
    drafted_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  /*
   * A signed in portal user, verified against the auth server rather than
   * decoded and trusted. There is no service role caller here: nothing on the
   * platform drafts on its own, because a draft only exists to be read by her.
   */
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not authorised' }, 401, origin);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Not authorised' }, 401, origin);

  let body: { productId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400, origin); }
  if (!body.productId) return json({ error: 'productId is required' }, 400, origin);

  try {
    /*
     * Read under the user's own session, not the service role.
     *
     * The service role would happily draft for another tenant's product on a
     * guessed id. Going through `asUser` means the 0048 policy decides, so a
     * product she cannot see is a product she cannot draft.
     */
    const { data: product, error } = await asUser
      .from('store_products')
      .select(`
        id, title, brand, condition, category_path, price,
        specifications, in_the_box, source_description, image_url,
        returns_class
      `)
      .eq('id', body.productId)
      .single();

    if (error || !product) return json({ error: 'No such product' }, 404, origin);

    const draft = await draftFor(product);
    if (!draft.description) throw new Error('The draft came back empty.');

    // Merged rather than written, so the returns and hazard flags beside it
    // survive. 0057 is what makes that one statement.
    const { error: wErr } = await db.rpc('set_product_draft', {
      p_id: product.id,
      p_draft: draft,
    });
    if (wErr) throw new Error(wErr.message);

    return json({ draft }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[draft]', body.productId, message);
    return json({ error: message }, 500, origin);
  }
});
