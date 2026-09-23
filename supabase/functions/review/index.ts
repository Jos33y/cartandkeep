/*
 * Writing a review.
 *
 * The only way in is the order reference and the token the confirmation email
 * carried. There is no form on a product page and no link from the grid, which
 * is what makes the rating on a product page a fact rather than a decoration.
 *
 * Two actions, one function. Without a body it returns what can be reviewed;
 * with one it writes. Splitting them would mean two folders holding the same
 * token check, and the dashboard editor deploys one folder at a time.
 *
 * Nothing published. Every review lands as pending and she decides.
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

/*
 * Compared in constant time.
 *
 * A plain === leaks how much of a token is correct through how long the
 * comparison takes, which is enough to walk a token a character at a time given
 * patience. The tokens are 48 hex characters, so this is cheap paranoia rather
 * than expensive paranoia.
 */
function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const clean = (v: unknown, max: number) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400, origin); }

  const reference = String(body.reference ?? '').trim().toUpperCase();
  const token = String(body.token ?? '').trim();
  if (!reference || !token) return json({ error: 'That link is not complete.' }, 400, origin);

  const { data: order, error: oErr } = await db
    .from('orders')
    .select(`
      id, tenant_id, reference, access_token, name, status, dispatched_at,
      order_items ( id, product_id, variant_id, title, variant_label, image_url )
    `)
    .eq('reference', reference)
    .maybeSingle();

  if (oErr) return json({ error: 'Could not open that order.' }, 500, origin);

  /*
   * The same answer for a wrong reference and a wrong token.
   *
   * Telling somebody the reference exists but the token is wrong turns a
   * guessable reference into a target worth guessing at.
   */
  if (!order || !sameToken(order.access_token ?? '', token)) {
    return json({ error: 'That link does not work. Check it against your email.' }, 404, origin);
  }

  if (order.status !== 'paid') {
    return json({ error: 'That order is not complete.' }, 409, origin);
  }

  /*
   * Nothing is reviewed before it is sent.
   *
   * A review written the hour an order is placed is a review of the checkout,
   * and the email that asks for one goes out days after dispatch anyway. This
   * is the guard for somebody who kept the link.
   */
  if (!order.dispatched_at) {
    return json({ error: 'This one has not gone out yet. The link will work once it has.' }, 409, origin);
  }

  const items = order.order_items ?? [];
  const itemIds = items.map((i: any) => i.id);

  const { data: existing, error: rErr } = await db
    .from('store_reviews')
    .select('id, order_item_id, rating, title, body, author, status')
    .in('order_item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']);

  if (rErr) return json({ error: 'Could not open that order.' }, 500, origin);

  const byItem = new Map((existing ?? []).map((r: any) => [r.order_item_id, r]));

  // --- what can be reviewed --------------------------------------------------

  if (body.rating === undefined) {
    return json({
      name: order.name,
      reference: order.reference,
      items: items.map((i: any) => ({
        id: i.id,
        title: i.title,
        variantLabel: i.variant_label,
        image_url: i.image_url,
        // Hers, so the form can show what she already said rather than a blank
        // box that would be refused on submit.
        review: byItem.get(i.id)
          ? {
            rating: byItem.get(i.id).rating,
            title: byItem.get(i.id).title,
            body: byItem.get(i.id).body,
            author: byItem.get(i.id).author,
            // Whether it is live yet, said plainly. A customer who wrote one
            // yesterday and cannot find it on the shop should not have to
            // wonder whether it was lost.
            waiting: byItem.get(i.id).status === 'pending',
          }
          : null,
      })),
    }, 200, origin);
  }

  // --- writing one -----------------------------------------------------------

  const item = items.find((i: any) => i.id === body.orderItemId);
  if (!item) return json({ error: 'That is not on this order.' }, 400, origin);

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'Choose between one and five stars.' }, 400, origin);
  }

  const row = {
    tenant_id: order.tenant_id,
    order_item_id: item.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    rating,
    title: clean(body.title, 120),
    // Long enough for somebody with something to say, short enough that a
    // pasted essay does not become the product page.
    body: clean(body.body, 2000),
    // Falls back to the name on the order, first word only. A review signed
    // with a full name is a review somebody regrets, and one signed with an
    // email address is one nobody leaves twice.
    author: clean(body.author, 60) ?? (order.name ? String(order.name).split(' ')[0] : null),
    status: 'pending',
  };

  /*
   * Upsert rather than insert.
   *
   * One review per line is a database constraint, and somebody who wants to
   * change theirs should edit it rather than be told they already had their
   * turn. Changing it puts it back in front of her, which is the point: the
   * words she approved are not the words that would be showing.
   */
  const { error: wErr } = await db
    .from('store_reviews')
    .upsert(row, { onConflict: 'order_item_id' });

  if (wErr) {
    console.error('[review]', reference, wErr.message);
    return json({ error: 'That did not save. Try again.' }, 500, origin);
  }

  return json({ ok: true, waiting: true }, 200, origin);
});
