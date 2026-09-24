/*
 * Joining the list, and leaving it.
 *
 * Both here, because they are the same table and the same trust problem: an
 * address arrives from a browser and nothing about it can be believed. The
 * table grants nothing to anon at all, so this is the only way in.
 *
 * Single opt in. The address goes on the list the moment it is typed, and the
 * row records when, from which page, and what the box said at the time. That
 * last one is the part the law actually cares about: proving consent later
 * means proving what the site said months ago, and only a copy taken at the
 * moment can do that.
 *
 * There is no ../_shared import. The dashboard editor deploys one folder, which
 * is what broke cors.ts. The CORS block below is duplicated on purpose.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = (Deno.env.get('STORE_ORIGINS')
  ?? 'https://cartandkeep.com,https://www.cartandkeep.com,http://localhost:5180,http://127.0.0.1:5180')
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

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const TENANT = Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep';

/*
 * Deliberately loose.
 *
 * A regular expression cannot tell a real address from a well formed one, and
 * every attempt to be strict rejects somebody's genuine address. This catches
 * a typo and nothing else. The proof that an address works is an email
 * arriving, which is a question for the day she first sends one.
 */
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/*
 * A token that cannot be guessed and does not need storing.
 *
 * The unsubscribe link has to work from an email with no login, so it carries
 * proof rather than asking for it. An HMAC of the address under the service key
 * means the link is unforgeable without a second column and without a lookup
 * table of tokens that would itself be a list of subscribers.
 */
async function signature(email: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsub:${email}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400, origin); }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    return json({ error: 'That does not look like an email address.' }, 400, origin);
  }

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', TENANT).maybeSingle();
  if (!tenant) return json({ error: 'Something went wrong.' }, 500, origin);

  // --- leaving ---------------------------------------------------------------

  if (body.action === 'unsubscribe') {
    const expected = await signature(email);
    if (!sameToken(String(body.token ?? ''), expected)) {
      /*
       * The same answer whether the address is on the list or not.
       *
       * Telling somebody an address is not subscribed turns this into a way to
       * test whether it is, which is a list of her customers handed out one
       * address at a time.
       */
      return json({ error: 'That link does not work.' }, 403, origin);
    }

    // A date, not a delete. The record of having left is what stops an import
    // adding them back and is the only evidence the opt out worked.
    const { error: offError } = await db.from('store_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
      .eq('email', email)
      .is('unsubscribed_at', null);

    // Telling somebody they are off the list when the write failed is the one thing this cannot say.
    if (offError) {
      console.error('[subscribe] unsubscribe', offError.message);
      return json({ error: 'That did not go through. Try the link again in a minute.' }, 500, origin);
    }

    // Said the same way whether or not a row moved. Somebody clicking twice
    // should be told they are off the list, not that nothing happened.
    return json({ ok: true, off: true }, 200, origin);
  }

  // --- joining ---------------------------------------------------------------

  const row = {
    tenant_id: tenant.id,
    email,
    name: String(body.name ?? '').trim().slice(0, 80) || null,
    // Where they were standing. Not a referrer, which the in app browsers
    // strip, but the page the form itself declares.
    source: String(body.source ?? '').trim().slice(0, 80) || null,
    // The evidence. Sent by the form so that a change to the copy does not
    // rewrite what somebody agreed to last month.
    wording: String(body.wording ?? '').trim().slice(0, 400) || null,
    consented_at: new Date().toISOString(),
    // Somebody who left and came back is back. The row reopens rather than a
    // second one appearing.
    unsubscribed_at: null,
  };

  const { error } = await db
    .from('store_subscribers')
    .upsert(row, { onConflict: 'tenant_id,email' });

  if (error) {
    console.error('[subscribe]', error.message);
    return json({ error: 'That did not save. Try again.' }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
