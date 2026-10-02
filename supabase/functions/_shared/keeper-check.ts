// One draft through the shop check, end to end: read it, ask Claude, settle the answer, write it through
// set_keeper_check (0123). Used by keeper-run for a run and by shop-rules for "Check now" on one product, so both
// judge the same way.
import { askTool } from './claude.ts';
import { itemFactsOf, listingOf } from './product.ts';
import { CHECK_SYSTEM, CHECK_TOOL, LABEL_SYSTEM, LABEL_TOOL, checkFacts, costPence, duplicates, liveMatches, settle, tokensOf } from './shop-check.ts';

type Json = Record<string, any>;
// The calls made on the database here: any Supabase client works.
type Db = { from: (t: string) => any; rpc: (name: string, args: Json) => any };

const num = (name: string, fallback: number) => {
  const n = Number(Deno.env.get(name));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const anthropicKey = () => {
  const v = Deno.env.get('ANTHROPIC_API_KEY');
  if (!v) throw new Error('ANTHROPIC_API_KEY is not set on this function');
  return v;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const PHOTOS = 3;

// Claude's price per million tokens in US dollars, and the pound rate. Set on the function; checked against the
// Anthropic console on the first twenty. The token counts are kept on every job, so the cost can be worked again.
const PRICES = {
  input: num('KEEPER_PRICE_INPUT', 3),
  output: num('KEEPER_PRICE_OUTPUT', 15),
  cacheWrite: num('KEEPER_PRICE_CACHE_WRITE', 3.75),
  cacheRead: num('KEEPER_PRICE_CACHE_READ', 0.3),
  gbpPerUsd: num('KEEPER_GBP_PER_USD', 0.75),
};

const PRODUCT_FIELDS = 'id, tenant_id, status, archived_at, title, slug, brand, gtin, category_path, description, in_the_box, '
  + 'specifications, source_description, source_kind, source_ref, image_url, images, derived_fields, candidate_id, hazard, '
  + 'biocide_reg_no, price, stock, availability, section, updated_at';

// Everything on sale now, for the same-product check: a few hundred short rows, read once a call.
async function liveProducts(client: Db, tenantId: string) {
  const rows: Json[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await client.from('store_products').select('id, title, gtin, source_ref')
      .eq('tenant_id', tenantId).eq('status', 'live').range(from, from + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

// What one run reads once: her last changes to Keeper's work, which of its drafts look like the same product, and
// what is on sale already.
export async function contextFor(client: Db, tenantId: string, runId: string | null) {
  const { data: overrides } = await client.from('keeper_overrides').select('field, keeper_value, her_value')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20);
  let dups = new Map<string, string[]>();
  if (runId) {
    const { data: jobs } = await client.from('keeper_jobs').select('product_id').eq('run_id', runId);
    const ids = [...new Set((jobs ?? []).map((j: Json) => j.product_id))] as string[];
    const rows: Json[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await client.from('store_products').select('id, title, gtin').in('id', ids.slice(i, i + 200));
      rows.push(...(data ?? []));
    }
    dups = duplicates(rows);
  }
  // The shop's own principles (tenants.store.principles), true of everything it sells.
  const { data: tenant } = await client.from('tenants').select('store').eq('id', tenantId).maybeSingle();
  const principles = (Array.isArray(tenant?.store?.principles) ? tenant.store.principles : []).filter((x: unknown) => typeof x === 'string');
  return { overrides: overrides ?? [], dups, live: await liveProducts(client, tenantId), principles: principles as string[] };
}

async function ask(system: string, tool: Json, text: string, images: string[], maxTokens: number) {
  const send = (withImages: boolean) => askTool(anthropicKey(), {
    system,
    maxTokens,
    tool,
    content: [
      ...(withImages ? images.map((url) => ({ type: 'image', source: { type: 'url', url } })) : []),
      { type: 'text', text: `The product:\n${text}${withImages && images.length ? '\n\nThe photographs are the product and its packaging, the first one first.' : ''}` },
    ],
  });
  try {
    return await send(images.length > 0);
  } catch (e) {
    // eBay's photo servers sometimes refuse; the words alone still answer most of it.
    if (images.length && /image|media|url|fetch|download/i.test(message(e))) return send(false);
    throw e;
  }
}

// One draft, checked. Returns the job's result; throws only for a retry.
export async function checkOne(client: Db, job: Json, run: Json | null, ctx: Awaited<ReturnType<typeof contextFor>>): Promise<{ state: string; result: Json; cost?: number }> {
  const started = Date.now();
  // Where Keeper is with this draft, for the office's desk: real steps, written as they happen. Never fatal.
  const phase = async (name: string) => {
    if (!job?.id) return;
    try { await client.from('keeper_jobs').update({ result: { phase: name } }).eq('id', job.id).eq('state', 'working'); } catch { /* the desk waits */ }
  };
  const { data } = await client.from('store_products').select(PRODUCT_FIELDS).eq('id', job.product_id).maybeSingle();
  const p = data as Json | null;
  if (!p || p.status !== 'draft' || p.archived_at) {
    return { state: 'done', result: { tray: 'skipped', line: 'No longer a draft, so left alone.', product_title: p?.title ?? null } };
  }

  let card: Json | null = null;
  if (p.candidate_id) {
    const { data } = await client.from('candidates').select('id, listing, draft').eq('id', p.candidate_id).maybeSingle();
    card = data ?? null;
  }
  const twins = liveMatches(p, ctx.live ?? []);
  const facts = checkFacts(p, ctx.overrides, card ? listingOf(card) : null, card ? itemFactsOf(card) : null, twins.similar, ctx.principles ?? []);
  const images = [...new Set([...(Array.isArray(p.images) ? p.images : []), p.image_url].filter((u) => typeof u === 'string' && /^https:\/\//.test(u)))].slice(0, PHOTOS) as string[];

  await phase('words');
  const first = await ask(CHECK_SYSTEM, CHECK_TOOL, facts, [], 2000);
  let cost = costPence(first.payload.usage, PRICES);
  const tokens = [tokensOf(first.payload.usage)];

  let label: Json | null = null;
  if ((first.input.chemical === true || first.input.needs_photos === true) && images.length) {
    await phase('photos');
    const second = await ask(LABEL_SYSTEM, LABEL_TOOL, facts, images, 900);
    label = second.input;
    cost += costPence(second.payload.usage, PRICES);
    tokens.push(tokensOf(second.payload.usage));
  }

  await phase('writing');
  const s = settle(p, first.input, label, facts, { partners: ctx.dups.get(String(p.id)) ?? [], live: twins.similar, certain: twins.certain });
  const result: Json = {
    tray: s.tray,
    line: s.line,
    why: s.why,
    product_title: p.title,
    image: images[0] ?? null,
    title_before: p.title,
    title: s.title,
    slug: s.slug,
    returns: s.returns,
    same_as: s.patch.check?.same_as_live ?? null,
    chemical: Boolean(s.patch.rules?.chemical),
    read_photos: Boolean(label),
    ms: Date.now() - started,
    cost_pence: cost,
    tokens,
    rehearsal: Boolean(run?.rehearsal),
  };

  if (!run?.rehearsal) {
    const { data: wrote, error } = await client.rpc('set_keeper_check', {
      p_id: p.id, p_seen: p.updated_at, p_derived: s.patch, p_returns: s.returns, p_title: s.title, p_slug: s.slug,
      p_hazard: s.hazard, p_biocide_reg: s.biocideReg, p_description: s.description, p_specs: s.specs, p_fill: s.fill,
    });
    if (error) throw new Error(error.message);
    if (wrote === 'changed') {
      // She saved it while Keeper was reading: read it again later rather than write over her.
      return { state: 'queued', result: { ...result, tray: null, line: 'Changed while Keeper was reading it. Checked again at the end.' }, cost };
    }
    if (wrote !== 'written') return { state: 'done', result: { ...result, tray: 'skipped', line: 'No longer a draft, so left alone.' }, cost };
  }
  return { state: 'done', result, cost };
}

