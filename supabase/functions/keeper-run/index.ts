// Keeper's runs (keeper-task-01-shop-drafts.md): works the shop check, one worker per run at a time, at the pace
// she chose, and carries on with the portal closed. Kicked every minute by kick_keeper (0123) and by the portal.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { db, env, message, work } from './work.ts';

type Json = Record<string, any>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// Constant time, so a wrong secret takes as long to refuse as a nearly right one.
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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

  try {
    // The schedule works every shop; it proves itself with the scheduler secret.
    const sent = req.headers.get('x-scheduler-secret');
    if (sent) {
      const { data } = await db().from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
      if (!sameSecret(sent, data?.value ?? '')) return json({ error: 'Not authorised' }, 401);
      return json(await work(db(), null));
    }
    // The portal works its own shop, so she does not wait for the next minute.
    const tenantId = String(body.tenant_id ?? '');
    if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
    if (!(await memberOf(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);
    return json(await work(db(), tenantId));
  } catch (err) {
    console.error('[keeper-run]', message(err));
    return json({ error: message(err) }, 500);
  }
});
