/*
 * Reads one order back.
 *
 * Needs the reference and the token that came with it. The reference alone is
 * guessable given enough attempts and the token is what stops a guess turning
 * into somebody else's delivery address.
 *
 * Compared in constant time, because a comparison that returns early on the
 * first wrong character is a comparison that can be measured.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

/*
 * CORS, inline.
 *
 * This was a shared module at ../_shared/cors.ts, which works with the CLI
 * because it bundles the whole functions directory. The dashboard editor
 * deploys one folder and uploads nothing outside it, so the import fails to
 * resolve. Twenty duplicated lines is the price of not needing the CLI.
 *
 * Origins are listed rather than starred: a wildcard on a function that
 * creates orders is an invitation.
 */
const ALLOWED = (Deno.env.get('STORE_ORIGINS')
  ?? 'https://cartandkeep.com,http://localhost:5180,http://127.0.0.1:5180')
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

function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405, origin);

  try {
    const { reference, token, email, tenantSlug = 'cart-and-keep' } = await req.json();
    // Either the token from the confirmation link, or the email the order was
    // placed with. The reference is short enough to say down a phone, so on
    // its own it is guessable given enough attempts and one of these two has
    // to be right.
    if (!reference || (!token && !email)) return json({ error: 'Not found' }, 404, origin);

    const { data: tenant } = await db.from('tenants').select('id').eq('slug', tenantSlug).single();
    if (!tenant) return json({ error: 'Not found' }, 404, origin);

    const { data: order } = await db
      .from('orders')
      .select('id, reference, access_token, status, email, name, address, subtotal, delivery, total, currency, customer_note, paid_at, created_at, dispatched_at, carrier, tracking_number, tracking_url, is_gift, recipient_name, recipient_phone, notify_recipient, gift_message')
      .eq('tenant_id', tenant.id)
      .eq('reference', String(reference).toUpperCase())
      .maybeSingle();

    const byToken = Boolean(token) && Boolean(order) && sameToken(order.access_token, String(token));
    const byEmail = Boolean(email) && Boolean(order)
      && sameToken(order.email.toLowerCase(), String(email).trim().toLowerCase());

    // The same answer for a reference that does not exist, a wrong token and a
    // wrong email. Three different answers tell somebody which part they got
    // right and which to keep guessing at.
    if (!order || (!byToken && !byEmail)) {
      return json({ error: 'Not found' }, 404, origin);
    }

    const { data: items } = await db
      .from('order_items')
      // variant_label, because a receipt that says "Bed sheet" on an order for a
      // king and a double is a receipt somebody has to ring up about.
      .select('slug, title, variant_label, image_url, unit_price, qty, line_total')
      .eq('order_id', order.id)
      .order('created_at');

    const { access_token, id: _id, ...safe } = order;

    // The token goes back only to somebody who proved themselves with the
    // email, so the lookup page can send them on to the real order page. A
    // request that already had the token gets nothing new.
    return json({
      order: safe,
      items: items ?? [],
      ...(byEmail && !byToken ? { token: access_token } : {}),
    }, 200, origin);
  } catch (err) {
    console.error('[order]', err);
    return json({ error: 'Could not read the order' }, 500, origin);
  }
});
