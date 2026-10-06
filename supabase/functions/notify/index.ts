// Sends every email the platform sends. Eight kinds: four write an order_emails row, which is
// what makes a resend safe. low_stock, price_alert and message carry their own guard; pull_alert is the studio's.
//
// What each email says and looks like lives in ../_shared/email, one file per email, with the
// rights wording there too. This file loads the data, decides who hears what, and records it.
// Deployed with the CLI (supabase functions deploy notify) so the shared folder comes with it.
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as mail from '../_shared/email/index.ts';
import { FROM, send } from '../_shared/email/send.ts';

const ALLOWED = (Deno.env.get('STORE_ORIGINS')
  ?? 'https://portal.cartandkeep.com,https://cartandkeep.com,http://localhost:5180,http://127.0.0.1:5180')
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
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Same length and every character compared, so the time taken says nothing about how close a guess was.
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const PORTAL = Deno.env.get('PORTAL_URL') ?? 'https://portal.cartandkeep.com';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Read from app_config with this function's own connection, so there is no second copy to paste or drift.
async function storedSchedulerSecret() {
  const { data, error } = await db.from('app_config').select('value').eq('key', 'scheduler_secret').maybeSingle();
  if (error) console.error('[scheduler] secret not readable', error.message);
  return data?.value ?? '';
}

// The tenant comes off the thread rather than off a slug, or client two sends
// from client one's address.
async function loadMessage(messageId: string) {
  const { data: message, error } = await db
    .from('store_messages')
    .select('id, tenant_id, thread_id, sender, body, author_name, sent_at, created_at')
    .eq('id', messageId)
    .single();

  if (error || !message) throw new Error(error?.message ?? 'Message not found');

  const { data: thread } = await db
    .from('store_threads')
    .select('id, tenant_id, subject_kind, product_id, order_id, access_token, email, name, basket')
    .eq('id', message.thread_id)
    .single();

  if (!thread) throw new Error('Thread not found');

  const { data: tenant } = await db
    .from('tenants').select('store').eq('id', thread.tenant_id).single();

  let product = null;
  if (thread.product_id) {
    const { data } = await db.from('store_products')
      .select('title, image_url, price, stock').eq('id', thread.product_id).maybeSingle();
    product = data ?? null;
  }

  let order = null;
  if (thread.order_id) {
    const { data } = await db.from('orders')
      .select('reference, access_token').eq('id', thread.order_id).maybeSingle();
    order = data ?? null;
  }

  // From the view, so expired and withdrawn both come back as no offer.
  const { data: offer } = await db
    .from('store_live_offers')
    .select('id, price, expires_at')
    .eq('thread_id', thread.id)
    .maybeSingle();

  // Whether this is the first thing anybody has said, which decides whether
  // the customer gets the acknowledgement carrying their link.
  const { count } = await db
    .from('store_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id);

  return { message, thread, cfg: tenant?.store ?? {}, product, order, offer: offer ?? null, count: count ?? 0 };
}

// access_token builds the order, receipt and review links. It goes only to the buyer's own address.
// No comments inside the select: the text goes to the database, which rejects them.
async function loadOrder(orderId: string) {
  const { data, error } = await db
    .from('orders')
    .select(`
      id, tenant_id, reference, status, email, name, phone, address,
      is_gift, recipient_name, recipient_email, notify_recipient, gift_message,
      subtotal, delivery, total, carrier, tracking_number, tracking_url,
      created_at, paid_at, dispatched_at,
      access_token,
      order_items ( title, qty, unit_price, line_total, product_id, variant_label, image_url )
    `)
    .eq('id', orderId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Order not found');

  // Off the product rather than the order line, because a line is a snapshot and a
  // returns class is a fact about the thing.
  const ids = (data.order_items ?? []).map((i: any) => i.product_id).filter(Boolean);
  const classes = new Map<string, string>();
  const stock = new Map<string, number | null>();

  if (ids.length) {
    const { data: products } = await db
      .from('store_products')
      .select('id, returns_class, stock')
      .in('id', ids);
    for (const p of products ?? []) {
      classes.set(p.id, p.returns_class ?? 'standard');
      stock.set(p.id, p.stock);
    }
  }

  const items = (data.order_items ?? []).map((i: any) => ({
    ...i,
    returns_class: classes.get(i.product_id) ?? 'standard',
    stock: stock.get(i.product_id),
  }));

  const { data: tenant } = await db
    .from('tenants').select('store').eq('id', data.tenant_id).single();

  return { order: { ...data, items }, cfg: tenant?.store ?? {} };
}

// --- handler -----------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');

  // Three callers: the webhook with the service key, the database's scheduled jobs with their own secret,
  // and the portal with a user's JWT.
  const sentSecret = req.headers.get('x-scheduler-secret');
  const scheduled = sentSecret ? sameSecret(sentSecret, await storedSchedulerSecret()) : false;
  if (sentSecret && !scheduled) {
    console.error('[scheduler] secret sent but did not match app_config');
    return json({ error: 'Not authorised', reason: 'scheduler secret does not match app_config' }, 401, origin);
  }
  const trusted = scheduled || token === SERVICE_KEY;
  let allowed = trusted;
  if (!allowed && token) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data } = await asUser.auth.getUser();
    allowed = Boolean(data?.user);
  }
  if (!allowed) return json({ error: 'Not authorised' }, 401, origin);

  let body: { orderId?: string; kind?: string; resend?: boolean; items?: any[]; messageId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400, origin); }

  const { orderId, kind, resend } = body;

  // Not about an order, so no order_emails row. Handled before the orderId check.
  if (kind === 'low_stock') {
    if (!trusted) return json({ error: 'Not authorised' }, 401, origin);

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return json({ sent: 'nothing', count: 0 }, 200, origin);

    const { data: tenant } = await db.from('tenants')
      .select('store')
      .eq('slug', Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep')
      .maybeSingle();

    const to = tenant?.store?.email ?? tenant?.store?.trader?.email;
    if (!to) return json({ error: 'No address to send to' }, 409, origin);

    // A photo beside each name, off the variant when it has its own.
    const pids = items.map((i: any) => i.product_id).filter(Boolean);
    const vids = items.map((i: any) => i.variant_id).filter(Boolean);
    const [{ data: ps }, { data: vs }] = await Promise.all([
      pids.length ? db.from('store_products').select('id, image_url').in('id', pids) : Promise.resolve({ data: [] }),
      vids.length ? db.from('store_variants').select('id, image_url').in('id', vids) : Promise.resolve({ data: [] }),
    ]);
    const pImg = new Map((ps ?? []).map((p: any) => [p.id, p.image_url]));
    const vImg = new Map((vs ?? []).map((v: any) => [v.id, v.image_url]));
    const shown = items.map((i: any) => ({ ...i, image_url: vImg.get(i.variant_id) ?? pImg.get(i.product_id) ?? null }));

    const m = mail.stock(shown, mail.shopFrom(tenant?.store ?? {}, PORTAL));
    try {
      const providerId = await send(to, m, to);
      return json({ sent: 'low_stock', count: items.length, id: providerId }, 200, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[notify] low_stock', message);
      return json({ error: message }, 500, origin);
    }
  }

  // A live listing's cost changed (supplier-read, after the morning check). To the shop's own address only, so the
  // caller names the shop, never the address. Trusted callers only. Nothing recorded here: the reading on the card
  // says what was last told (supplier_read.told), which is what stops a repeat.
  if (kind === 'price_alert') {
    if (!trusted) return json({ error: 'Not authorised' }, 401, origin);
    const items = (Array.isArray(body.items) ? body.items : [])
      .filter((i: any) => i && i.title && i.listing_id && Number(i.to) > 0);
    if (items.length === 0) return json({ sent: 'nothing', count: 0 }, 200, origin);

    const tenantId = String((body as Record<string, any>).tenant_id ?? '');
    const { data: tenant } = tenantId
      ? await db.from('tenants').select('store').eq('id', tenantId).maybeSingle()
      : await db.from('tenants').select('store').eq('slug', Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep').maybeSingle();
    const to = tenant?.store?.email ?? tenant?.store?.trader?.email ?? 'support@cartandkeep.com';

    const m = mail.price(items, mail.shopFrom(tenant?.store ?? {}, PORTAL));
    try {
      const providerId = await send(to, m, to);
      return json({ sent: 'price_alert', count: items.length, id: providerId }, 200, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[notify] price_alert', message);
      return json({ error: message }, 500, origin);
    }
  }

  // The studio's own alert. Trusted callers only, because the address comes in the body.
  if (kind === 'pull_alert') {
    if (!trusted) return json({ error: 'Not authorised' }, 401, origin);

    const a = body as Record<string, any>;
    const to = String(a.to ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: 'A valid to address is required' }, 400, origin);
    if (!a.tenant || !a.source || !['failing', 'recovered'].includes(a.state)) {
      return json({ error: 'tenant, source and state are required' }, 400, origin);
    }

    // Same verified address as every other email, under a name that reads as an alert rather than the shop.
    const address = FROM.match(/<([^>]+)>/)?.[1] ?? FROM;
    const m = mail.pull({ tenant: a.tenant, source: a.source, state: a.state, error: a.error, last_ok_at: a.last_ok_at }, mail.shopFrom({}, PORTAL));
    try {
      const providerId = await send(to, m, to, `${a.tenant} alerts <${address}>`);
      return json({ sent: 'pull_alert', id: providerId }, 200, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[notify] pull_alert', message);
      return json({ error: message }, 500, origin);
    }
  }

  // Also not about an order. sent_at on the message stops it repeating. Both
  // callers allowed: a user caller has the row re-read through their own session.
  if (kind === 'message') {
    const messageId = String(body.messageId ?? '');
    if (!messageId) return json({ error: 'messageId is required' }, 400, origin);

    if (token !== SERVICE_KEY) {
      const asUser = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const { data: visible } = await asUser
        .from('store_messages').select('id').eq('id', messageId).maybeSingle();
      if (!visible) return json({ error: 'Not authorised' }, 403, origin);
    }

    try {
      const { message, thread, cfg, product, order, offer, count } = await loadMessage(messageId);

      // Said once. A second call for the same message is a retry that already
      // succeeded, and a customer told twice about one reply is a customer who
      // stops reading.
      if (message.sent_at && !resend) return json({ skipped: 'already sent' }, 200, origin);

      const shop = mail.shopFrom(cfg, PORTAL);
      const shopAddress = String(cfg.email ?? shop.trader.email ?? 'support@cartandkeep.com');

      // What it is about: one product, a basket (named by what is in it), or an order.
      const topic = {
        product,
        basket: Array.isArray(thread.basket) && thread.basket.length ? thread.basket : null,
        order,
      };

      // An order thread is reached on the order page with the token the confirmation
      // already carried. Everything else with its own.
      const link = thread.order_id && order
        ? `${shop.site}/order/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token)}`
        : `${shop.site}/thread/${thread.id}?token=${encodeURIComponent(thread.access_token ?? '')}`;

      const sends: Array<{ to: string; m: mail.Mail }> = [];

      if (message.sender === 'customer') {
        sends.push({ to: shopAddress, m: mail.toShop(message, thread, topic, shop) });

        // The acknowledgement, once, on the first thing said. Later messages
        // in the same thread get nothing, because they already hold the link.
        if (count <= 1) sends.push({ to: thread.email, m: mail.asked(message, topic, link, shop) });
      } else {
        sends.push({ to: thread.email, m: mail.reply(message, topic, link, offer, shop) });
      }

      let last = '';
      for (const s of sends) last = await send(s.to, s.m, shopAddress);

      await db.from('store_messages')
        .update({ sent_at: new Date().toISOString(), sent_via: 'email', send_error: null })
        .eq('id', message.id);

      return json({ sent: 'message', count: sends.length, id: last }, 200, origin);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error('[notify] message', messageId, reason);

      // Recorded on the row rather than swallowed, so the portal can show that
      // somebody was not told and offer it again. A failure nobody can see is
      // worse than one they can.
      await db.from('store_messages')
        .update({ send_error: reason.slice(0, 500) })
        .eq('id', messageId);

      return json({ error: reason }, 500, origin);
    }
  }

  if (!orderId || !kind) return json({ error: 'orderId and kind are required' }, 400, origin);
  if (!['confirmation', 'dispatch', 'seller_alert', 'review_request', 'recipient_dispatch'].includes(kind)) {
    return json({ error: 'Unknown kind' }, 400, origin);
  }

  const first = await sendOrderMail(orderId, kind, resend);

  // The recipient hears once the buyer's own dispatch email has gone, and only if the buyer asked.
  if (kind === 'dispatch' && first.status === 200 && !first.body.skipped) {
    const second = await sendOrderMail(orderId, 'recipient_dispatch', false);
    if (second.status !== 200) console.error('[notify] recipient note', orderId, second.body);
  }
  return json(first.body, first.status, origin);
});

// One email about one order, guarded so a retry never sends it twice.
async function sendOrderMail(orderId: string, kind: string, resend?: boolean): Promise<{ status: number; body: Record<string, unknown> }> {
  // A retried Stripe event must not send a second confirmation. The order_emails
  // row is the guard, and resend is the only way past it.
  if (resend) {
    await db.from('order_emails').delete().eq('order_id', orderId).eq('kind', kind);
  } else {
    // Filtered on sent, not on existence. A previous attempt that failed left a
    // row behind, and a Stripe retry finding it and skipping would turn one
    // transient Resend outage into a customer who is never told anything.
    const { data: already } = await db.from('order_emails')
      .select('id').eq('order_id', orderId).eq('kind', kind)
      .eq('status', 'sent').maybeSingle();
    if (already) return { status: 200, body: { skipped: 'already sent' } };
  }

  try {
    const { order, cfg } = await loadOrder(orderId);
    const trader = cfg.trader ?? {};
    const replyTo = String(trader.email ?? 'support@cartandkeep.com');

    // Nothing to send, and nothing to record: an order for the buyer, or a gift they did not want announced.
    if (kind === 'recipient_dispatch' && !(order.is_gift && order.notify_recipient && order.recipient_email)) {
      return { status: 200, body: { skipped: 'not asked for' } };
    }

    const shop = mail.shopFrom(cfg, PORTAL);
    const pick: Record<string, () => { to: string | null; m: mail.Mail }> = {
      confirmation: () => ({ to: order.email, m: mail.confirmation(order, shop) }),
      dispatch: () => ({ to: order.email, m: mail.dispatch(order, shop) }),
      recipient_dispatch: () => ({ to: order.recipient_email, m: mail.recipient(order, shop) }),
      review_request: () => ({ to: order.email, m: mail.review(order, shop) }),
      // To the shop's own address, never one that came in with the order.
      seller_alert: () => ({ to: replyTo, m: mail.sale(order, shop) }),
    };
    const { to, m } = pick[kind]();

    if (!to) return { status: 400, body: { error: 'No recipient' } };

    const providerId = await send(to, m, replyTo);

    // Upsert, so a success after an earlier failed attempt replaces that row rather than
    // colliding with it, and the result is read: an unrecorded send is sent again next time.
    const { error: recordError } = await db.from('order_emails').upsert({
      tenant_id: order.tenant_id,
      order_id: order.id,
      kind,
      recipient: to,
      subject: m.subject,
      identity_complete: mail.identityComplete(trader),
      provider_id: providerId,
      status: 'sent',
      error: null,
    }, { onConflict: 'order_id,kind' });
    if (recordError) console.error('[notify] sent but not recorded', kind, orderId, recordError.message);

    return { status: 200, body: { sent: kind, id: providerId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[notify]', kind, orderId, message);

    // Recorded on the row, so the portal can show that somebody was not told. A
    // failure nobody can see is worse than one they can.
    const { data: owner } = await db.from('orders')
      .select('tenant_id').eq('id', orderId).maybeSingle();

    if (owner?.tenant_id) {
      await db.from('order_emails').upsert({
        tenant_id: owner.tenant_id,
        order_id: orderId,
        kind,
        recipient: 'unknown',
        subject: 'not sent',
        status: 'failed',
        error: message.slice(0, 500),
      }, { onConflict: 'order_id,kind' });
    }

    return { status: 500, body: { error: message } };
  }
}
