// Reads her eBay account (Joseey, 8 October 2026): whether eBay has her as a private or business seller, her
// promoted listings campaigns with each listing's ad rate, and what eBay charged her over the last 90 days. Saved
// through put_ebay_read (0150), which the portal reads to price every card for the account she sells on.
//
// Called from Settings ("Read again") and by the portal once a day when the last read is older. Read only: nothing
// is changed on eBay. The token stays here; nothing personal from eBay is kept beyond the account type and user name.
//
// Body: { tenant_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { env, userToken } from '../_shared/ebay/listing.ts';
import { signerFor } from '../_shared/ebay/sign.ts';
import { readAll } from './read.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

// A member of this shop, or the service role.
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

  let tenantId: string | null = null;
  try {
    tenantId = (await req.json())?.tenant_id ?? null;
  } catch {
    return json({ error: 'Bad body' }, 400);
  }
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400);
  if (!(await allowed(req, tenantId))) return json({ error: 'Not authorised. Sign in to the portal and try again.' }, 401);

  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const save = (read: Record<string, unknown>, ads: unknown = null) =>
    client.rpc('put_ebay_read', { p_tenant: tenantId, p_read: read, p_ads: ads });

  try {
    const { data: cred } = await client.from('tenant_credentials').select('refresh_token')
      .eq('tenant_id', tenantId).eq('provider', 'ebay').maybeSingle();
    if (!cred?.refresh_token) throw new Error('This account is not connected to eBay yet.');
    const access = await userToken(cred.refresh_token);

    const { read, ads, errors } = await readAll(fetch, access, signerFor(client));
    const { data, error } = await save(read, ads);
    if (error) throw new Error(error.message);
    return json({ account: data, ads: ads?.length ?? null, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await save({ error: message });
    return json({ error: message }, 502);
  }
});
