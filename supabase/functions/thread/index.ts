// The tables grant nothing to anon, so this is the only way in from a shopfront.
//
// One secret per conversation, held as a constraint in 0067: a product thread
// carries its own token, an order thread uses the order's. That is why there is
// no open call for an order, sending on one creates it.
//
// Emails go through notify. The portal answers from a browser and cannot hold a
// Resend key, so the template has to live there anyway.
//
// CORS is duplicated below on purpose: the dashboard editor deploys one folder.
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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TENANT = Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Constant time: === leaks how much of a token is right through how long it
// takes to say no.
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

// clean collapses every run of whitespace, which is right for a name and wrong
// for three paragraphs. Spaces collapse, breaks survive.
const cleanBody = (v: unknown, max: number) => {
  const s = String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s ? s.slice(0, max) : null;
};

const looksLikeEmail = (s: string | null) => Boolean(s && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s));

// 48 hex, generated the same way the order token is, from two uuids rather
// than from a crypto import, so this does not depend on anything being in the
// runtime that is not already proven in the checkout.
const newToken = () =>
  (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 48);

// Ids and quantities from the browser, everything else from the database. An
// offer is quoted against this, so a price the customer supplied would be a
// price the customer set. Frozen: the conversation is about what they had.
// Anything no longer sold is dropped rather than failing the whole ask.
const MAX_LINES = 40;
const MAX_QTY = 20;

async function priceBasket(sent: any[], tenantId: string) {
  const wanted = sent.slice(0, MAX_LINES).map((l) => ({
    productId: String(l?.productId ?? l?.id ?? '').trim(),
    variantId: l?.variantId ? String(l.variantId).trim() : null,
    qty: Math.min(MAX_QTY, Math.max(1, Math.floor(Number(l?.qty) || 1))),
  })).filter((l) => /^[0-9a-f-]{36}$/i.test(l.productId));

  if (!wanted.length) return [];

  const { data: products } = await db
    .from('store_products')
    .select('id, title, slug, price, image_url')
    .eq('tenant_id', tenantId)
    .neq('status', 'draft')
    .in('id', wanted.map((l) => l.productId));

  const byProduct = new Map((products ?? []).map((p: any) => [p.id, p]));

  const variantIds = wanted.map((l) => l.variantId).filter(Boolean) as string[];
  const byVariant = new Map<string, any>();
  if (variantIds.length) {
    const { data: variants } = await db
      .from('store_variants')
      .select('id, product_id, label, price, image_url')
      .eq('tenant_id', tenantId)
      .in('id', variantIds);
    for (const v of variants ?? []) byVariant.set(v.id, v);
  }

  const lines = [];
  for (const l of wanted) {
    const p = byProduct.get(l.productId);
    if (!p) continue;

    // Tested as somebody trying rather than somebody mistyping.
    const v = l.variantId ? byVariant.get(l.variantId) : null;
    if (l.variantId && (!v || v.product_id !== p.id)) continue;

    // Null means the product's price applies, or one goes stale when she changes it.
    const price = Number(v?.price ?? p.price);
    if (!Number.isFinite(price)) continue;

    lines.push({
      product_id: p.id,
      variant_id: v?.id ?? null,
      slug: p.slug,
      title: p.title,
      variant_label: v?.label ?? null,
      qty: l.qty,
      price: Math.round(price * 100) / 100,
      image_url: v?.image_url ?? p.image_url ?? null,
    });
  }

  return lines;
}

// Refusing quietly would lose a real question from somebody who is shopping, so
// it says what to do instead.
async function overCeiling(email: string, tenantId: string) {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db
    .from('store_threads')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .gt('created_at', hourAgo);

  return (count ?? 0) >= 5
    ? 'That is a lot of questions at once. Add the next one to a conversation you have already started and we will answer them together.'
    : null;
}

// The same answer for a thread that does not exist, a wrong token and an order
// somebody guessed. Three different answers tell somebody which half they got
// right and which to keep guessing at.
const NOT_FOUND = 'That link does not work. Check it against your email.';

// An order with a good token and no thread yet is not a failure, it is somebody
// about to ask something. The order comes back with a null thread.
async function resolve(body: Record<string, any>, tenantId: string) {
  const token = String(body.token ?? '').trim();
  if (!token) return { error: NOT_FOUND };

  if (body.reference) {
    const reference = String(body.reference).trim().toUpperCase();

    const { data: order } = await db
      .from('orders')
      .select('id, tenant_id, reference, access_token, email, name, status')
      .eq('tenant_id', tenantId)
      .eq('reference', reference)
      .maybeSingle();

    if (!order || !sameToken(order.access_token ?? '', token)) return { error: NOT_FOUND };

    const { data: thread } = await db
      .from('store_threads')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();

    return { order, thread: thread ?? null };
  }

  const id = String(body.threadId ?? '').trim();
  if (!id) return { error: NOT_FOUND };

  const { data: thread } = await db
    .from('store_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  // An order thread's access_token is null by constraint. Refused by name rather
  // than by comparing against an empty string.
  if (!thread || !thread.access_token || !sameToken(thread.access_token, token)) {
    return { error: NOT_FOUND };
  }

  return { thread, order: null };
}

async function messagesFor(threadId: string) {
  const { data } = await db
    .from('store_messages')
    .select('id, sender, body, author_name, created_at')
    .eq('thread_id', threadId)
    .order('created_at');
  return data ?? [];
}

// The email, the token and the internal ids do not come back. The page is
// reached by a link that can be forwarded.
async function view(thread: any, order: any) {
  let product = null;
  if (thread.product_id) {
    const { data } = await db
      .from('store_products')
      .select('slug, title, image_url, price')
      .eq('id', thread.product_id)
      .maybeSingle();
    product = data ?? null;
  }

  // From the view, so the clock is not a predicate somebody has to remember here.
  const { data: offer } = await db
    .from('store_live_offers')
    .select('id, price, expires_at, lines')
    .eq('thread_id', thread.id)
    .maybeSingle();

  return {
    id: thread.id,
    subject: thread.subject_kind,
    status: thread.status,
    product,
    offer: offer ?? null,
    // The snapshot as it was written, so the page shows what the conversation
    // is about rather than what is in the basket now.
    basket: thread.basket ?? null,
    reference: order?.reference ?? null,
    messages: await messagesFor(thread.id),
  };
}

// The row is saved by now, so an outage means somebody is told late rather than a
// question lost. sent_at stays null, which is what a retry looks for.
async function tell(messageId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'message', messageId }),
    });
  } catch (e) {
    console.error('[thread] notify', e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400, origin); }

  // Hidden from people, filled in by bots. A cheerful reply and no row, so
  // whatever is submitting learns nothing.
  if (clean(body.website, 40)) return json({ ok: true }, 200, origin);

  const { data: tenant } = await db
    .from('tenants').select('id').eq('slug', TENANT).maybeSingle();
  if (!tenant) return json({ error: 'Something went wrong.' }, 500, origin);

  const action = String(body.action ?? 'read');

  // --- opening one about a product -------------------------------------------

  if (action === 'open') {
    const text = cleanBody(body.body, 2000);
    const email = clean(body.email, 160)?.toLowerCase() ?? null;

    if (!text) return json({ error: 'Write your question first.' }, 400, origin);
    if (!looksLikeEmail(email)) {
      return json({ error: 'We need an email address to answer you.' }, 400, origin);
    }

    // Never reused: folding a second basket into an open thread would put a
    // question about four things under a snapshot of three.
    if (Array.isArray(body.basket)) {
      const snapshot = await priceBasket(body.basket, tenant.id);
      if (!snapshot.length) {
        return json({ error: 'There is nothing in that basket we still sell.' }, 400, origin);
      }

      const capped = await overCeiling(email, tenant.id);
      if (capped) return json({ error: capped }, 429, origin);

      const { data: made, error: bErr } = await db
        .from('store_threads')
        .insert({
          tenant_id: tenant.id,
          subject_kind: 'basket',
          basket: snapshot,
          access_token: newToken(),
          email,
          name: clean(body.name, 80),
        })
        .select('*')
        .single();

      if (bErr || !made) {
        console.error('[thread] open on basket', bErr?.message);
        return json({ error: 'That did not send. Try again.' }, 500, origin);
      }

      const { data: first, error: fErr } = await db
        .from('store_messages')
        .insert({ tenant_id: tenant.id, thread_id: made.id, sender: 'customer', body: text })
        .select('id')
        .single();

      if (fErr || !first) {
        console.error('[thread] basket message', fErr?.message);
        return json({ error: 'That did not send. Try again.' }, 500, origin);
      }

      await tell(first.id);
      return json({ ok: true, id: made.id, token: made.access_token }, 200, origin);
    }

    const productId = String(body.productId ?? '').trim();
    if (!productId) return json({ error: 'Something went wrong.' }, 400, origin);

    // Archived is allowed on purpose. An archived page stays readable per 0065.
    const { data: product } = await db
      .from('store_products')
      .select('id, status')
      .eq('tenant_id', tenant.id)
      .eq('id', productId)
      .neq('status', 'draft')
      .maybeSingle();

    if (!product) return json({ error: 'That product is not here.' }, 404, origin);

    // Two questions about one lamp from one person is one conversation.
    const { data: existing } = await db
      .from('store_threads')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('product_id', product.id)
      .eq('email', email)
      .eq('status', 'open')
      .maybeSingle();

    let thread = existing ?? null;

    if (!thread) {
      const capped = await overCeiling(email, tenant.id);
      if (capped) return json({ error: capped }, 429, origin);

      const { data: made, error: tErr } = await db
        .from('store_threads')
        .insert({
          tenant_id: tenant.id,
          subject_kind: 'product',
          product_id: product.id,
          access_token: newToken(),
          email,
          name: clean(body.name, 80),
        })
        .select('*')
        .single();

      if (tErr || !made) {
        console.error('[thread] open', tErr?.message);
        return json({ error: 'That did not send. Try again.' }, 500, origin);
      }
      thread = made;
    }

    const { data: message, error: mErr } = await db
      .from('store_messages')
      .insert({
        tenant_id: tenant.id, thread_id: thread.id, sender: 'customer', body: text,
      })
      .select('id')
      .single();

    if (mErr || !message) {
      console.error('[thread] first message', mErr?.message);
      return json({ error: 'That did not send. Try again.' }, 500, origin);
    }

    await tell(message.id);

    // So the page can show the conversation without waiting on the email.
    return json({ ok: true, id: thread.id, token: thread.access_token }, 200, origin);
  }

  // The checkout page holds an offer id rather than a thread id, so it cannot use
  // the read above. Nothing here is charged: the checkout reads the record again.
  if (action === 'offer') {
    const id = String(body.offerId ?? '').trim();
    const token = String(body.token ?? '').trim();
    if (!id || !token) return json({ error: NOT_FOUND }, 404, origin);

    const { data: offer } = await db
      .from('store_live_offers')
      .select('id, thread_id, lines, price, expires_at')
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .maybeSingle();

    const { data: thread } = offer
      ? await db.from('store_threads')
        .select('id, access_token').eq('id', offer.thread_id).maybeSingle()
      : { data: null };

    // One answer for an id that does not exist, a price that has run out and a
    // wrong token.
    if (!offer || !thread?.access_token || !sameToken(thread.access_token, token)) {
      return json({
        error: 'That price is not available any more. The conversation is still there, so ask again and we will look at it.',
      }, 404, origin);
    }

    return json({
      offer: {
        id: offer.id,
        threadId: offer.thread_id,
        lines: offer.lines,
        price: offer.price,
        expires_at: offer.expires_at,
      },
    }, 200, origin);
  }

  // --- reading one -----------------------------------------------------------

  const found = await resolve(body, tenant.id);
  if (found.error) return json({ error: found.error }, 404, origin);

  if (action === 'read') {
    // Not an error: somebody on their own order page, about to ask something.
    if (!found.thread) return json({ thread: null, reference: found.order?.reference ?? null }, 200, origin);
    return json({ thread: await view(found.thread, found.order) }, 200, origin);
  }

  // --- writing to one --------------------------------------------------------

  if (action !== 'send') return json({ error: 'Bad request' }, 400, origin);

  const text = cleanBody(body.body, 2000);
  if (!text) return json({ error: 'Write something first.' }, 400, origin);

  let thread = found.thread;

  // The order token already proved who they are, and the address comes off the
  // order because that is where the answer has to go.
  if (!thread) {
    const order = found.order!;
    const { data: made, error: tErr } = await db
      .from('store_threads')
      .insert({
        tenant_id: tenant.id,
        subject_kind: 'order',
        order_id: order.id,
        email: String(order.email).toLowerCase(),
        name: order.name,
      })
      .select('*')
      .single();

    if (tErr || !made) {
      console.error('[thread] open on order', tErr?.message);
      return json({ error: 'That did not send. Try again.' }, 500, origin);
    }
    thread = made;
  }

  if (thread.status === 'closed') {
    return json({ error: 'This conversation has been closed. Start a new one and we will pick it up.' }, 409, origin);
  }

  const { data: message, error: mErr } = await db
    .from('store_messages')
    .insert({
      tenant_id: thread.tenant_id, thread_id: thread.id, sender: 'customer', body: text,
    })
    .select('id')
    .single();

  if (mErr || !message) {
    console.error('[thread] send', mErr?.message);
    return json({ error: 'That did not send. Try again.' }, 500, origin);
  }

  await tell(message.id);

  return json({ thread: await view(thread, found.order) }, 200, origin);
});
