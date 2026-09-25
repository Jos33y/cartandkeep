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


// Reading the shop page here, the first time she asks, so a newly approved card never waits on a script.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const plain = (html: unknown) => String(html ?? '')
  .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const bullets = (d: string) => d.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()).filter(Boolean);

// A shop's own name in the brand field would put another retailer's name in her title.
const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
function brandOf(brand: unknown, url: string) {
  const host = squash(new URL(url).hostname.replace(/^www\./, '').split('.')[0]);
  const b = squash(brand);
  return b && host && (b === host || host.includes(b) || b.includes(host)) ? null : (brand as string) || null;
}

async function fetchText(url: string, accept: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-GB,en;q=0.9', accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  return res.ok ? await res.text() : null;
}

async function readShopPage(url: string): Promise<Record<string, unknown> | null> {
  const clean = url.split('?')[0].replace(/\/$/, '');
  let read: Record<string, unknown> | null = null;

  if (/\/products\//.test(clean)) {
    const body = await fetchText(`${clean}.json`, 'application/json').catch(() => null);
    const p = body ? JSON.parse(body)?.product : null;
    if (p) {
      const description = plain(p.body_html);
      read = {
        title: p.title,
        brand: p.vendor || null,
        images: (p.images ?? []).map((i: { src?: string }) => i.src).filter(Boolean),
        description,
        features: bullets(description),
        shop_category: p.product_type || null,
        product_code: p.variants?.[0]?.sku ?? null,
        in_stock: p.variants?.[0]?.available ?? null,
      };
    }
  }

  if (!read) {
    const html = await fetchText(url, 'text/html').catch(() => null);
    if (!html) return null;
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .flatMap((m) => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : j['@graph'] ?? [j]; } catch { return []; } });
    const p = blocks.find((b) => [].concat(b['@type']).includes('Product'));
    if (!p) return null;
    const crumbs = blocks.find((b) => [].concat(b['@type']).includes('BreadcrumbList'));
    const description = plain(p.description);
    read = {
      title: p.name,
      brand: typeof p.brand === 'string' ? p.brand : p.brand?.name ?? null,
      images: [].concat(p.image ?? []).map((i: unknown) => (typeof i === 'string' ? i : (i as { url?: string })?.url)).filter(Boolean),
      description,
      features: bullets(description),
      shop_category: crumbs?.itemListElement?.map((e: { name?: string; item?: { name?: string } }) => e.name ?? e.item?.name)
        .filter(Boolean).slice(-2, -1)[0] ?? null,
      product_code: p.sku ?? p.mpn ?? null,
    };
  }

  return { ...read, brand: brandOf(read.brand, url), summary: null, unit_price: null, source_url: url, read_at: new Date().toISOString() };
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
      .select('id, title, external_ref, listing, entry, margin')
      .eq('id', candidateId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!c) return json({ error: 'Candidate not found' }, 404);

    // No read yet: take it from the shop page the card links to, keep it on the card, and carry on.
    if (!c.listing) {
      const url = (c.margin as { shelf?: { url?: string } } | null)?.shelf?.url;
      const read = url ? await readShopPage(url).catch(() => null) : null;
      if (read) {
        (c as Record<string, unknown>).listing = read;
        await db().from('candidates').update({ listing: read }).eq('id', c.id).is('listing', null);
      }
    }

    // With no page at all, a title can still come from the search and the listing that sells; a
    // description cannot, because every line of it would be a guess.
    if (!c.listing && kind === 'description') {
      return json({ error: 'There is no shop page to write this from, so the description needs writing by hand.' }, 400);
    }

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
