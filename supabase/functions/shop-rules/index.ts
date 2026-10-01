// Keepr checks shop drafts before they can go on sale: the returns rules that apply, and whether it is a chemical
// whose label warning belongs next to the price. Called when a card goes to her shop, and from a product's sheet.
// Writes suggestions into derived_fields through set_product_rules (0115); never the hazard itself, which is hers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { askTool } from '../_shared/claude.ts';
import { itemFactsOf, listingOf } from '../_shared/product.ts';
import { RULES_SYSTEM, RULES_TOOL, derivedPatch, rulesFacts, tidyRules } from '../_shared/shop-rules.ts';

type Json = Record<string, any>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};
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

async function ask(facts: string, images: string[]) {
  const send = async (withImages: boolean) => {
    const { input } = await askTool(env('ANTHROPIC_API_KEY'), {
      system: RULES_SYSTEM,
      maxTokens: 900,
      tool: RULES_TOOL,
      content: [
        ...(withImages ? images.map((url) => ({ type: 'image', source: { type: 'url', url } })) : []),
        { type: 'text', text: `The product:\n${facts}${withImages && images.length ? '\n\nThe photographs are the product and its packaging.' : ''}` },
      ],
    });
    return input as Json;
  };
  try {
    return await send(images.length > 0);
  } catch (e) {
    if (images.length && /image|media|url|fetch/i.test(e instanceof Error ? e.message : String(e))) return send(false);
    throw e;
  }
}

async function check(client: ReturnType<typeof db>, p: Json) {
  let card: Json | null = null;
  if (p.candidate_id) {
    const { data } = await client.from('candidates').select('id, title, listing, draft').eq('id', p.candidate_id).maybeSingle();
    card = data ?? null;
  }
  const facts = rulesFacts(p, card ? listingOf(card) : null, card ? itemFactsOf(card) : null);
  const images = [...new Set([...(p.images ?? []), p.image_url].filter((u) => typeof u === 'string' && /^https:\/\//.test(u)))].slice(0, 3) as string[];
  const t = tidyRules(await ask(facts, images));
  const patch = derivedPatch(t, p.derived_fields ?? {});
  const { error } = await client.rpc('set_product_rules', { p_id: p.id, p_derived: patch, p_returns: 'returns_class' in patch || t.returns === 'standard' ? t.returns : null });
  if (error) throw new Error(error.message);
  return { id: p.id, returns: t.returns, chemical: t.rules.chemical, label: Boolean(t.hazard_draft) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { tenant_id: tenantId, product_ids: ids } = await req.json();
    if (!tenantId || !Array.isArray(ids) || !ids.length) return json({ error: 'tenant_id and product_ids are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: rows, error } = await client.from('store_products')
      .select('id, tenant_id, status, title, brand, category_path, description, in_the_box, specifications, source_description, image_url, images, derived_fields, candidate_id')
      .eq('tenant_id', tenantId).in('id', ids.slice(0, 40));
    if (error) return json({ error: error.message }, 500);
    // Drafts only: a product on sale was confirmed by her, and is changed only by her.
    const drafts = (rows ?? []).filter((r) => r.status === 'draft');

    const done: Json[] = [];
    const failed: Json[] = [];
    for (let i = 0; i < drafts.length; i += 3) {
      const out = await Promise.allSettled(drafts.slice(i, i + 3).map((p) => check(client, p)));
      out.forEach((r, k) => (r.status === 'fulfilled'
        ? done.push(r.value)
        : failed.push({ id: drafts[i + k].id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) })));
    }
    return json({ done, failed, skipped: ids.length - drafts.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
