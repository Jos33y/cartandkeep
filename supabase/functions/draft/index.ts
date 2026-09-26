// One pass that fills every field of a product for her to approve. Writes only derived_fields.draft.
// No ../_shared import: the dashboard editor deploys one folder, so CORS is duplicated on purpose.
import { createClient } from 'npm:@supabase/supabase-js@2';


// The model sometimes answers "nothing" as a pair of quote marks or a word; all of those are empty.
const emptyish = (v: string) => (/^(["'`]{2}|none|n\/a|-|unknown|not stated)$/i.test(v.trim()) ? '' : v.replace(/^["']|["']$/g, '').trim());

// A last guard on customer copy: a sentence about the supplier, the photograph or the source never reaches the shop.
const BACKSTAGE = /\b(supplier|photograph|photo|image|listing|source|the details|feed|not visible|cannot be confirmed)\b/i;
function customerCopy(description: string, done: string[]) {
  const sentences = description.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [description];
  const kept = sentences.filter((x) => !BACKSTAGE.test(x));
  const moved = sentences.filter((x) => BACKSTAGE.test(x)).map((x) => `Left out of the description: ${x.trim()}`);
  return { description: kept.join('').trim(), done: [...done, ...moved] };
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

5. When two fields disagree, do not pick one. Write around the disagreement and ask in decide. A title saying 250ml over a specification saying 50ml is not a rounding error and choosing either could be a false description.

6. The photograph is evidence. Describe what is plainly visible in it. Do not infer material, dimensions or quality from it. Where the photograph and the fields disagree, ask in decide rather than quietly preferring one.

VOICE. British English. Plain, calm, specific. Short sentences. Write as a shopkeeper who has the thing in their hand, not as a marketplace listing. No emoji, no bullet symbols, no exclamation marks, no second person sales patter.

DESCRIPTION. Two to four sentences, 40 to 90 words. What it is, what it is for, and what is certain about it. Plain prose, no headings, no lists.

The description is what a customer reads on the shop. It never mentions the supplier, the photograph, the listing, the details, the source or any doubt. Anything uncertain or contradictory is left out of the description entirely and becomes a question in decide.

TITLES. Three options, each under 65 characters, each a different job:
search   the words a shopper types first, in the order they type them
short    the plainest name for the thing, under 40 characters
feature  what it is plus the one certain detail that sets it apart
Strip keyword stuffing, pipes, model codes and repeated words. A real brand may lead a title. A private label, a shop name or a generic trade name never leads: put it last or leave it out.

BRAND. The brand and whether it is real. Real means a maker a shopper would recognise or search for by name. A private label is a name printed on generic goods by whoever sells them; it is not real for this purpose. "Unbranded" is no brand: empty name, real false.

DETAILS. The product's facts as short name and value pairs, cleaned: fix casing, units and spelling, drop the eBay furniture (policy ids, "Does not apply", "Unbranded", "N/A"), merge duplicates. Complete them from what the supplier wrote when it states a fact plainly. Never add a fact the source does not state. Names in British English, sentence case, no underscores.

IN THE BOX. What a customer opening the parcel will find, taken only from the source. A short comma separated list, or empty string when the source does not say. Do not count things in the photograph and do not infer a pack size.

SECTION. Choose the one section from the list you are given where a shopper would look for this. Answer with its path exactly as given, or an empty string when none fits.

CARE. Tag the goods that need special handling, any that apply: biocide (kills or repels pests, disinfects), supplement (vitamins, food supplements, anything taken for health), electrical (mains or battery powered), branded (a real brand's own goods, where authenticity matters), sealed (hygiene goods that cannot come back once opened). Empty array when none apply.

DECIDE. The questions only the shop owner can answer, because the sources disagree or are silent on something a buyer needs. Each has a plain question and two to four short options she can tap, taken from what the sources say. When the answer fills a detail, give the detail name it fills. Example: the title says 150 kg and the details say 50 kg; question "What weight does it hold?", options ["50 kg", "150 kg"], detail "Maximum load". Never ask about something you can settle from the sources yourself. Never ask about the returns policy. Empty array when there is nothing to decide.

DONE. Short notes of what you fixed on her behalf, so she can see it was handled: "Removed the eBay policy numbers from the details", "Corrected 'Colour' spelled two ways". Only real changes. Empty array when there were none.

Write decide and done for somebody looking at a screen. Say "the details", "the title", "what the supplier wrote", "the photograph". Never write a field name with an underscore, never cite a rule by number.

RETURNS CLASS. Which UK cancellation rules apply to these goods.

standard  The default. Almost everything. The customer can send it back for any reason.
sealed    Goods not suitable for return once unsealed, for health or hygiene reasons. Cosmetics, toiletries, underwear, incontinence and continence products, anything applied to the body, anything that goes in the mouth.
none      Consumables and perishables. Food, drink, supplements. Anything made to order or personalised.

Choose standard unless the goods clearly fall in an exception. Getting this wrong in one direction costs the shop a parcel. Getting it wrong in the other denies a customer a cancellation right they have in law, which is the worse error, so when the goods are ambiguous the answer is standard.

Judge the goods, not the packaging. A saucepan in a sealed box is standard. A jar of moisturiser is sealed even if the photograph does not show a seal. Cleaning chemicals are ordinary goods, not consumables, so they are standard.

RETURNS REASON. One short sentence naming what about these goods puts them in that class. It says what the goods are, not what the rule is.

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
  description: 'Return every field of the product, filled for the shop owner to approve.',
  input_schema: {
    type: 'object',
    properties: {
      titles: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Under 65 characters, the words a shopper types first.' },
          short: { type: 'string', description: 'Under 40 characters, the plainest name.' },
          feature: { type: 'string', description: 'Under 65 characters, what it is plus one certain detail.' },
        },
        required: ['search', 'short', 'feature'],
      },
      description: { type: 'string', description: 'Two to four sentences, 40 to 90 words, plain prose, British English.' },
      brand: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The brand, or empty string when there is none.' },
          real: { type: 'boolean', description: 'True only for a maker a shopper would recognise. False for private labels and shop names.' },
        },
        required: ['name', 'real'],
      },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, value: { type: 'string' } },
          required: ['name', 'value'],
        },
      },
      in_the_box: { type: 'string', description: 'From the source only. Empty string when the source does not say.' },
      section: { type: 'string', description: 'A path from the list given, exactly, or empty string.' },
      care: {
        type: 'array',
        items: { type: 'string', enum: ['biocide', 'supplement', 'electrical', 'branded', 'sealed'] },
      },
      decide: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
            detail: { type: 'string', description: 'The detail name the answer fills, or empty string.' },
          },
          required: ['question', 'options', 'detail'],
        },
      },
      done: { type: 'array', items: { type: 'string' } },
      returns_class: { type: 'string', enum: ['standard', 'sealed', 'none'] },
      returns_reason: { type: 'string' },
    },
    required: ['titles', 'description', 'brand', 'details', 'in_the_box', 'section', 'care', 'decide', 'done', 'returns_class', 'returns_reason'],
  },
};

// The prompt asks for screen words; this enforces it, because the model has already slipped twice.
const FIELD_WORDS: Array<[RegExp, string]> = [
  [/\b(the )?current_returns_class\b/gi, 'the returns policy'],
  [/\b(the )?returns_class\b/gi, 'the returns policy'],
  [/\b(the )?supplier_text\b/gi, 'what the supplier wrote'],
  [/\b(the )?in_the_box\b/gi, 'what is in the box'],
  [/\b(the )?category_path\b/gi, 'the section'],
  [/\b(the )?image_url\b/gi, 'the photograph'],
  [/\b(the )?current_title\b/gi, 'the title'],
  [/\b(the )?price_gbp\b/gi, 'the price'],
  [/\b(the )?specifications\b/gi, 'the details'],
];

const NOT_A_FINDING = [
  /\b(returns?|cancellation) (policy|class|rules?)\b/i,
  /\bper (rule|policy|guideline)/i,
];

function screenWords(raw: unknown) {
  let text = String(raw ?? '').trim();
  for (const [pattern, word] of FIELD_WORDS) text = text.replace(pattern, word);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const clip = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();

function tidyDone(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(screenWords).filter((t) => t && !NOT_A_FINDING.some((p) => p.test(t)));
}

// Ids are stable per question text, so an answer given before a redraft still finds its question.
function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'question';
}

function tidyDecide(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out = [];
  for (const d of raw as Array<Record<string, unknown>>) {
    const question = screenWords(d?.question);
    const options = [...new Set((Array.isArray(d?.options) ? d.options : []).map((o) => clip(o, 60)).filter(Boolean))].slice(0, 4);
    if (!question || options.length < 2 || NOT_A_FINDING.some((p) => p.test(question))) continue;
    const id = slug(question);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, question, options, detail: clip(d?.detail, 60) || null });
  }
  return out;
}

// The model's removals stand (eBay filler like "Item Height: uca222"), but each one is named so nothing goes silently.
// Brand has its own field, so it is not repeated in the details.
function mergeDetails(raw: unknown, original: Record<string, string>) {
  const out: Array<{ name: string; value: string }> = [];
  const names = new Set<string>();
  for (const d of (Array.isArray(raw) ? raw : []) as Array<Record<string, unknown>>) {
    const name = clip(d?.name, 60);
    const value = emptyish(clip(d?.value, 200));
    if (!name || !value || names.has(name.toLowerCase()) || /^brand$/i.test(name)) continue;
    names.add(name.toLowerCase());
    out.push({ name, value });
  }
  const kept = new Set(out.map((d) => d.value.toLowerCase()));
  const removed = Object.entries(original)
    .filter(([name, value]) => !/^brand$/i.test(name.trim()) && !names.has(name.trim().toLowerCase()) && !kept.has(value.toLowerCase()))
    .map(([name, value]) => `Took "${name.trim()}: ${value}" out of the details`);
  return { details: out, removed };
}

const CARE = new Set(['biocide', 'supplement', 'electrical', 'branded', 'sealed']);

type Section = { path: string; label: string };

async function draftFor(product: Record<string, any>, sections: Section[]) {
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
    current_returns_class: product.returns_class ?? 'standard',
    supplier_text: source,
    sections: sections.map((s) => ({ path: s.path, name: s.label })),
  };

  const content: Array<Record<string, unknown>> = [];
  // Image first: shown the fields first, the model reads the photograph as confirmation rather than as a check.
  if (image) content.push({ type: 'image', source: { type: 'url', url: image } });
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
      max_tokens: 3000,
      system: SYSTEM,
      tools: [DRAFT_TOOL],
      tool_choice: { type: 'tool', name: 'draft' },
      messages: [{ role: 'user', content }],
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message ?? `Anthropic ${res.status}`);

  const call = (payload.content ?? []).find((b: any) => b.type === 'tool_use');
  if (!call) {
    console.error('[draft] no tool call', JSON.stringify(payload).slice(0, 800));
    if (payload.stop_reason === 'max_tokens') throw new Error('The draft was cut off before it finished. Try again.');
    throw new Error('The draft came back empty. Try again.');
  }

  const parsed = call.input ?? {};
  const titles = parsed.titles ?? {};
  const brandName = emptyish(clip(parsed.brand?.name, 60));
  const paths = new Set(sections.map((s) => s.path));
  const merged = mergeDetails(parsed.details, specs);
  const copy = customerCopy(String(parsed.description ?? '').trim(), [...tidyDone(parsed.done), ...merged.removed]);

  return {
    version: 2,
    titles: {
      search: clip(titles.search, 80),
      short: clip(titles.short, 80),
      feature: clip(titles.feature, 80),
    },
    description: copy.description,
    brand: { name: brandName, real: Boolean(parsed.brand?.real) && Boolean(brandName) },
    details: merged.details,
    in_the_box: emptyish(clip(parsed.in_the_box, 400)),
    section: paths.has(parsed.section) ? parsed.section : null,
    care: (Array.isArray(parsed.care) ? parsed.care : []).filter((c: string) => CARE.has(c)),
    decide: tidyDecide(parsed.decide),
    done: copy.done,
    // Anything unexpected falls back to standard, the class that grants the most rights.
    returns_class: ['standard', 'sealed', 'none'].includes(parsed.returns_class) ? parsed.returns_class : 'standard',
    returns_reason: clip(parsed.returns_reason, 240),
    // What answered, not the floating alias that was asked for.
    model: String(payload.model ?? MODEL),
    requested: MODEL,
    drafted_at: new Date().toISOString(),
  };
}

// Constant time, so a wrong secret takes as long to refuse as a nearly right one.
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function storedSchedulerSecret() {
  const { data } = await db.from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
  return data?.value ?? '';
}

function cleanSections(raw: unknown): Section[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && typeof s.path === 'string' && s.path)
    .slice(0, 80)
    .map((s) => ({ path: s.path.slice(0, 200), label: String(s.label ?? s.path).slice(0, 80) }));
}

const PRODUCT_FIELDS = 'id, tenant_id, title, brand, condition, category_path, price, specifications, in_the_box, source_description, image_url, returns_class';
const PER_CALL = 4;
const AT_ONCE = 2;

async function runJob(job: Record<string, any>) {
  try {
    const { data: product, error } = await db.from('store_products').select(PRODUCT_FIELDS)
      .eq('id', job.product_id).eq('tenant_id', job.tenant_id).single();
    if (error || !product) throw new Error('The product is no longer there.');

    const draft = await draftFor(product, cleanSections(job.sections));
    if (!draft.description) throw new Error('The draft came back empty.');

    const { error: wErr } = await db.rpc('set_product_draft', { p_id: product.id, p_draft: draft });
    if (wErr) throw new Error(wErr.message);

    await db.from('keeper_jobs').update({
      state: 'done', finished_at: new Date().toISOString(), error: null,
      result: { questions: draft.decide.length, sorted: draft.done.length },
    }).eq('id', job.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[draft] job', job.id, message);
    // Three tries, then it stops and says why; a busy moment at Anthropic usually clears on the next go.
    await db.from('keeper_jobs').update(job.attempts >= 3
      ? { state: 'failed', finished_at: new Date().toISOString(), error: message }
      : { state: 'queued', error: message }).eq('id', job.id);
    return false;
  }
}

async function workQueue(tenant: string | null) {
  const { data: jobs, error } = await db.rpc('claim_keeper_jobs', { p_limit: PER_CALL, p_tenant: tenant });
  if (error) throw new Error(error.message);
  const list = (jobs ?? []) as Array<Record<string, any>>;
  let done = 0;
  for (let i = 0; i < list.length; i += AT_ONCE) {
    const results = await Promise.all(list.slice(i, i + AT_ONCE).map(runJob));
    done += results.filter(Boolean).length;
  }
  return { claimed: list.length, done };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: { productId?: string; sections?: Section[]; queue?: boolean; tenant_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400, origin); }

  // The schedule works every shop's queue; it proves itself with the scheduler secret.
  const sent = req.headers.get('x-scheduler-secret');
  if (sent) {
    if (!sameSecret(sent, await storedSchedulerSecret())) return json({ error: 'Not authorised' }, 401, origin);
    try { return json(await workQueue(null), 200, origin); } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500, origin);
    }
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not authorised' }, 401, origin);
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Not authorised' }, 401, origin);

  // The portal kicks its own shop's queue so she does not wait for the next minute.
  if (body.queue) {
    if (!body.tenant_id) return json({ error: 'tenant_id is required' }, 400, origin);
    const { data: member } = await asUser.rpc('has_tenant', { t: body.tenant_id });
    if (member !== true) return json({ error: 'Not authorised' }, 401, origin);
    try { return json(await workQueue(body.tenant_id), 200, origin); } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500, origin);
    }
  }

  if (!body.productId) return json({ error: 'productId is required' }, 400, origin);

  try {
    // Under her own session, so the tenant policy decides which products she can draft.
    const { data: product, error } = await asUser.from('store_products').select(PRODUCT_FIELDS)
      .eq('id', body.productId).single();
    if (error || !product) return json({ error: 'No such product' }, 404, origin);

    const draft = await draftFor(product, cleanSections(body.sections));
    if (!draft.description) throw new Error('The draft came back empty.');

    const { error: wErr } = await db.rpc('set_product_draft', { p_id: product.id, p_draft: draft });
    if (wErr) throw new Error(wErr.message);

    return json({ draft }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[draft]', body.productId, message);
    return json({ error: message }, 500, origin);
  }
});
