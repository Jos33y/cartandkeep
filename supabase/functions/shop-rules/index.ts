// Keeper checks shop drafts before they can go on sale: the returns rules that apply, whether it is a chemical whose
// label warning belongs next to the price, and the shop title of a copy from eBay. Called when a card goes to her
// shop, and from a product's sheet ("Check now"). The same check as a Keeper run (_shared/keeper-check.ts), written
// through set_keeper_check (0123); never the hazard itself, which is hers.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkOne, contextFor } from '../_shared/keeper-check.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { tenant_id: tenantId, product_ids: ids } = await req.json();
    if (!tenantId || !Array.isArray(ids) || !ids.length) return json({ error: 'tenant_id and product_ids are required' }, 400);
    if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

    const client = db();
    const { data: rows, error } = await client.from('store_products').select('id, status')
      .eq('tenant_id', tenantId).in('id', ids.slice(0, 40));
    if (error) return json({ error: error.message }, 500);
    // Drafts only: a product on sale was confirmed by her, and is changed only by her.
    const drafts = (rows ?? []).filter((r) => r.status === 'draft');
    const ctx = await contextFor(client, tenantId, null);
    const done: Json[] = [];
    const failed: Json[] = [];
    for (let i = 0; i < drafts.length; i += 3) {
      const out = await Promise.allSettled(drafts.slice(i, i + 3).map((p) => checkOne(client, { product_id: p.id }, null, ctx)));
      out.forEach((r, k) => {
        const id = drafts[i + k].id;
        if (r.status === 'rejected') { failed.push({ id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }); return; }
        const res = r.value.result ?? {};
        // She saved it while Keeper was reading: say so rather than write over her.
        if (r.value.state === 'queued') { failed.push({ id, error: 'It changed while Keeper was reading it. Check again.' }); return; }
        done.push({ id, returns: res.returns ?? null, chemical: Boolean(res.chemical), tray: res.tray ?? null, title: res.title ?? null, line: res.line ?? null });
      });
    }
    return json({ done, failed, skipped: ids.length - drafts.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
