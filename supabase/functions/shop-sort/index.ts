// Sections for her shop, proposed on Google's tree (0129). Signed-in members of the shop only; nothing is written
// here: the portal shows the proposal and she applies it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sortShop } from './sort.ts';

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
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function memberOf(req: Request, tenantId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.rpc('has_tenant', { t: tenantId });
  return !error && data === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body: Json;
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400); }
  const tenantId = String(body.tenant_id ?? '');
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
  try {
    if (!(await memberOf(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    return json(await sortShop(db, tenantId, env('ANTHROPIC_API_KEY')));
  } catch (err) {
    console.error('[shop-sort]', message(err));
    return json({ error: message(err) }, 500);
  }
});
