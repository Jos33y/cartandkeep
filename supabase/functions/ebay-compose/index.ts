// Writes eBay titles and descriptions from facts already on the candidate.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{
        role: 'user',
        content: [
          ...images.map((url) => ({ type: 'image', source: { type: 'url', url } })),
          { type: 'text', text: user },
        ],
      }],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `Anthropic returned ${res.status}`);

  return (body.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .trim();
}

// The only facts the model may use.
function facts(c: Record<string, never>) {
  const l = (c.listing ?? {}) as Record<string, never>;
  return [
    ['Shop title', l.title],
    ['Brand', l.brand],
    ['Category', l.shop_category],
    ['Summary', l.summary],
    ['Description', l.description],
    ['Features', Array.isArray(l.features) ? (l.features as string[]).join('; ') : null],
    ['Pack size on the shelf', l.unit_price],
    ['Search this was found by', c.external_ref],
    ['A competing listing that is selling', (c.entry as Record<string, never>)?.title],
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
- If the text and the packaging disagree about quantity, size, weight or count,
  write no titles. Reply with a single line starting CONFLICT: saying what
  disagrees, for example "CONFLICT: title says 8 x 150g, the pack shows 4x".

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
- If the sources disagree about quantity, size, weight, count or contents, do not
  reconcile them and do not write a description. Reply with a single line that
  starts CONFLICT: and says what disagrees, for example
  "CONFLICT: title says 8 x 150g, the pack shows 4x".
- Open with one sentence on what it is and who it is for.
- Then a short list of what is in the pack and what matters about it.
- No postage or returns copy: eBay shows those from the policies.
- No marketing voice, no exclamation marks, no "grab yours today".
- British spelling throughout: colour, flavour, fibre, litre, analyse. Never the
  American forms, including inside a list copied from the source.
- Plain text, no HTML, no markdown headings.

Reply with the description only.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { tenant_id: tenantId, candidate_id: candidateId, kind } = await req.json();
    if (!tenantId || !candidateId) return json({ error: 'tenant_id and candidate_id are required' }, 400);
    if (kind !== 'title' && kind !== 'description') return json({ error: 'kind must be title or description' }, 400);

    const { data: c, error } = await db()
      .from('candidates')
      .select('id, title, external_ref, listing, entry')
      .eq('id', candidateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);
    if (!c.listing) return json({ error: 'Nothing has been read off the shop page for this one yet.' }, 400);

    const known = facts(c);
    // First four photos: enough to reach the back panel without paying for every angle.
    const shots = ((c.listing as Record<string, never>)?.images as string[] ?? []).slice(0, 4);

    if (kind === 'title') {
      const text = await claude(TITLE_SYSTEM, known, 600, shots);
      if (/^CONFLICT:/i.test(text.trim())) {
        return json({ conflict: text.trim().replace(/^CONFLICT:\s*/i, '') });
      }
      let titles: string[];
      try {
        titles = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch {
        return json({ error: 'The suggestion came back malformed. Try again.' }, 502);
      }
      // Over 80 is rejected by eBay, so a long one is a wasted option.
      return json({ titles: titles.filter((t) => typeof t === 'string' && t.length <= 80).slice(0, 4) });
    }

    const out = await claude(DESC_SYSTEM, known, 1400, shots);

    // Writing through a conflict means picking whichever side makes the facts agree.
    if (/^CONFLICT:/i.test(out)) {
      return json({ conflict: out.replace(/^CONFLICT:\s*/i, '').trim() });
    }

    return json({ description: out });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
