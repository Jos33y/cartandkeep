// Every email the shop sends. Six kinds: four write an order_emails row, which is
// what makes a resend safe. low_stock and message carry their own guard.
// Schedule 2 wording lives here because a confirmation is the durable medium.
// CORS is duplicated below: the dashboard editor deploys one folder.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!;

const FROM = Deno.env.get('MAIL_FROM') ?? 'Cart & Keep <notify@relay.cartandkeep.com>';
const PORTAL = Deno.env.get('PORTAL_URL') ?? 'https://portal.cartandkeep.com';

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// --- formatting --------------------------------------------------------------

const money = (n: unknown) => `£${Number(n ?? 0).toFixed(2)}`;

const escape = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Everything else here is a sentence we wrote, so escape is enough. A message is
// not: three short paragraphs arrive as one run-on line without this.
const lines = (s: unknown) => escape(s).replace(/\r?\n/g, '<br>');

// London civil time. getUTCHours against a wall clock cutoff told somebody at
// 14:30 BST their parcel went out today, for seven months of the year.
const LONDON = 'Europe/London';

function londonParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { iso: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

function longDate(d: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
}

// England and Wales bank holidays. Hand written and dated, because a wrong
// estimate is worse than a vague one and this list has to be checked each year.
const HOLIDAYS = new Set([
  '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31',
  '2027-12-27', '2027-12-28',
]);

function isWorking(d: Date) {
  const { iso } = londonParts(d);
  // Weekday taken from the London calendar day rather than the instant, so an
  // order placed at 00:30 BST on a Monday is not read as the Sunday before it.
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAYS.has(iso);
}

function addWorkingDays(from: Date, days: number) {
  // Anchored at midday rather than stepped from the original instant, so the
  // two mornings a year when the clocks move cannot skip or repeat a day.
  const d = new Date(`${londonParts(from).iso}T12:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorking(d)) left -= 1;
  }
  return d;
}

// --- the shell ---------------------------------------------------------------

// Tables and inline styles. Email clients are twenty years behind a browser and
// no amount of wishing changes it.
function shell(title: string, body: string) {
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#FAF6EF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EF;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E6DECF;border-radius:14px;">
<tr><td style="padding:28px 28px 8px;font:600 17px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2A2723;letter-spacing:-0.01em;">Cart &amp; Keep</td></tr>
<tr><td style="padding:0 28px 28px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2A2723;">
${body}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const RULE = '<hr style="border:0;border-top:1px solid #E6DECF;margin:24px 0;">';

function itemRows(items: Array<Record<string, unknown>>) {
  return items.map((i) => `<tr>
<td style="padding:6px 0;vertical-align:top;">${escape(i.title)}</td>
<td style="padding:6px 12px;vertical-align:top;text-align:right;white-space:nowrap;color:#5C564D;">${escape(i.qty)}</td>
<td style="padding:6px 0;vertical-align:top;text-align:right;white-space:nowrap;">${money(i.line_total)}</td>
</tr>`).join('');
}

// --- the rights block, which is the statutory part ---------------------------

// Schedule 2 items l, m, o and p. Every clause is conditional on the shop having
// the fact: nothing is asserted that legal.js has not been told.
function rightsBlock(
  items: Array<Record<string, unknown>>,
  trader: Record<string, unknown>,
  shopUrl: string,
) {
  const sealed = items.filter((i) => i.returns_class === 'sealed');
  const none = items.filter((i) => i.returns_class === 'none');

  // Two routes once there is an address, one until then.
  const how = trader.address
    ? `replying to this email or by writing to ${escape(trader.address)}`
    : 'replying to this email';

  // Fourteen statutory, thirty her policy, and the window itself. Separate, or
  // they collapse into a promise she did not make.
  const parts = [
    `<p style="margin:0 0 12px;">You have 14 days from the day it arrives to cancel this order for any reason, which is your statutory right, and we extend that to 30 days as a term of sale. You do not have to give a reason. Tell us by ${how}.</p>`,
    `<p style="margin:0 0 12px;">Send the goods back within 14 days of telling us. If an item comes back showing more handling than it would have had in a shop, we may reduce the refund by the value lost.</p>`,
    `<p style="margin:0 0 12px;">We refund the price you paid plus the standard delivery charge on the outbound order, within 14 days of the goods reaching us or of you showing us proof of postage, whichever is sooner.</p>`,
  ];

  if (sealed.length) {
    // 30 rather than 14, matching ProductTerms. The exception is about the seal,
    // not the clock, so the window applies until it is broken.
    parts.push(`<p style="margin:0 0 12px;">${sealed.map((i) => escape(i.title)).join(', ')} can be returned within the same 30 days, but only while the seal is unbroken. Once opened, the right to cancel does not apply to ${sealed.length > 1 ? 'them' : 'it'}, on health and hygiene grounds.</p>`);
  }

  if (none.length) {
    parts.push(`<p style="margin:0 0 12px;">${none.map((i) => escape(i.title)).join(', ')} cannot be returned once opened.</p>`);
  }

  parts.push(`<p style="margin:0 0 12px;">None of this affects your right to a refund, repair or replacement if something arrives faulty or is not as described. That right is separate and it does not run out when the 30 days do.</p>`);
  parts.push(`<p style="margin:0;"><a href="${shopUrl}/legal/returns" style="color:#AD5438;">A cancellation form, if you would rather use one</a></p>`);

  return parts.join('');
}

// Schedule 2 items b and c. Whatever is present, never a placeholder: TO CONFIRM
// in a legal block is worse than an absent line.
function traderBlock(trader: Record<string, unknown>) {
  const lines = [trader.legal_name, trader.address, trader.company_number
    ? `Company number ${trader.company_number}` : null, trader.email]
    .filter(Boolean).map((l) => escape(l));

  if (!lines.length) return '';
  return `<p style="margin:16px 0 0;font-size:13px;color:#857D70;">${lines.join(' · ')}</p>`;
}

const identityComplete = (t: Record<string, unknown>) =>
  Boolean(t.legal_name && t.address);

// --- templates ---------------------------------------------------------------

function confirmation(order: any, trader: any, cfg: any) {
  const shopUrl = `https://${cfg.domain ?? 'cartandkeep.com'}`;
  const now = new Date();
  const cutoff = Number(cfg.delivery?.cutoff_hour ?? 14);

  // A day name rather than a duration: "2 to 3 days" makes somebody count.
  const outDay = (isWorking(now) && londonParts(now).hour < cutoff)
    ? now : addWorkingDays(now, 1);
  const arrive = addWorkingDays(outDay, Number(cfg.delivery?.transit_max ?? 3));

  const outWord = londonParts(outDay).iso === londonParts(now).iso
    ? 'today' : longDate(outDay);
  const outcode = String(order.address?.postcode ?? '').split(' ')[0];

  const address = [order.name, order.address?.line1, order.address?.line2,
    order.address?.city, order.address?.postcode].filter(Boolean).map(escape).join(', ');

  const body = `
<p style="margin:0 0 20px;font-size:16px;">Paid. We pack on weekday mornings, so this goes out ${escape(outWord)} and should reach ${escape(outcode || 'you')} by ${escape(longDate(arrive))}.</p>

<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#857D70;">Order ${escape(order.reference)}</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-collapse:collapse;">
${itemRows(order.items)}
<tr><td colspan="2" style="padding:10px 0 6px;border-top:1px solid #E6DECF;color:#5C564D;">Delivery</td><td style="padding:10px 0 6px;border-top:1px solid #E6DECF;text-align:right;">${money(order.delivery)}</td></tr>
<tr><td colspan="2" style="padding:0;font-weight:600;">Total</td><td style="padding:0;text-align:right;font-weight:600;">${money(order.total)}</td></tr>
</table>

<p style="margin:20px 0 0;color:#5C564D;">Going to ${address}. Reply to this email if any of that is wrong and we will fix it before it goes.</p>

${RULE}

<p style="margin:0 0 12px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#857D70;">Your rights</p>
${rightsBlock(order.items, trader, shopUrl)}
${traderBlock(trader)}`;

  return {
    to: order.email,
    subject: `Order ${order.reference} is paid`,
    html: shell(`Order ${order.reference} is paid`, body),
  };
}

function sellerAlert(order: any, trader: any) {
  const outcode = String(order.address?.postcode ?? '').split(' ')[0];
  const units = order.items.reduce((n: number, i: any) => n + Number(i.qty ?? 0), 0);

  const address = [order.name, order.address?.line1, order.address?.line2,
    order.address?.city, order.address?.postcode]
    .filter(Boolean).map((l: string) => `${escape(l)}<br>`).join('');

  // The subject carries the whole thing, because she reads this between other
  // work and should not have to open it to know what happened.
  const warning = identityComplete(trader) ? '' :
    `<p style="margin:0 0 16px;padding:12px;background:#FAEEE9;color:#AD5438;font-size:14px;">The confirmation went out without your trading name and address. Those are required on it. Fill them in and the next one is complete.</p>`;

  // Anything that went below zero, named, so she knows before the customer does.
  const oversold = order.items.filter((i: any) => typeof i.stock === 'number' && i.stock < 0);
  const oversoldBlock = oversold.length
    ? `<p style="margin:0 0 16px;padding:12px;background:#FAEEE9;color:#AD5438;font-size:14px;">Sold more than you have of ${oversold.map((i: any) => `${escape(i.title)} (${i.stock} left)`).join(', ')}. Somebody else has bought the same item. Refund one of them from Stripe, or tell them it is on its way when you restock.</p>`
    : '';

  const body = `${warning}${oversoldBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
${itemRows(order.items)}
</table>
<p style="margin:20px 0 0;">${address}</p>
<p style="margin:16px 0 0;"><a href="${PORTAL}/orders" style="color:#AD5438;">Open it in the portal</a></p>`;

  return {
    to: null, // filled by the caller from the tenant's own address
    subject: `Sale: ${money(order.total)}, ${order.reference}, ${units} ${units === 1 ? 'item' : 'items'} to ${outcode}`,
    html: shell(`Sale ${order.reference}`, body),
  };
}

function dispatch(order: any, cfg: any) {
  const arrive = addWorkingDays(new Date(), Number(cfg.delivery?.transit_max ?? 3));
  const chase = addWorkingDays(arrive, 3);

  // No repeat of the rights block. They already have it, and a second copy
  // trains people to ignore both.
  const body = `
<p style="margin:0 0 16px;font-size:16px;">It left today${order.carrier ? ` by ${escape(order.carrier)}` : ''}.</p>
${order.tracking_number ? `<p style="margin:0 0 8px;">Tracking: ${escape(order.tracking_number)}</p>` : ''}
${order.tracking_url ? `<p style="margin:0 0 8px;"><a href="${escape(order.tracking_url)}" style="color:#AD5438;">Follow it on the carrier's site</a></p>` : ''}
<p style="margin:16px 0 0;">It should reach you by ${escape(longDate(arrive))}. If it has not arrived by ${escape(longDate(chase))}, reply to this email and we will chase it.</p>`;

  return {
    to: order.email,
    subject: `Order ${order.reference} is on its way`,
    html: shell(`Order ${order.reference} is on its way`, body),
  };
}

// Seven days after dispatch, not after payment, so it asks about a thing they
// have actually held.
function reviewRequest(order: any, cfg: any) {
  const site = cfg.domain ? `https://${cfg.domain}` : 'https://cartandkeep.com';
  const link = `${site}/review/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token)}`;

  // Named, so the ask is about a thing rather than an order number.
  const items = order.items ?? [];
  const named = items.slice(0, 2).map((i: any) =>
    escape(i.variant_label ? `${i.title}, ${i.variant_label}` : i.title));
  const rest = items.length - named.length;

  // Comma before the remainder, not a second "and".
  const what = named.length
    ? `${named.join(' and ')}${rest > 0 ? `, and the ${rest === 1 ? 'other one' : `other ${rest}`}` : ''}`
    : 'what you ordered';

  const body = `
<p style="margin:0 0 16px;font-size:16px;">Your order should have arrived by now. How did you get on with ${what}?</p>
<p style="margin:0 0 20px;">It takes a minute, and it is the sort of thing that decides whether the next person buys. Stars are enough. Words are a bonus.</p>
<p style="margin:0 0 20px;">
  <a href="${escape(link)}" style="display:inline-block;background:#BA5A3D;color:#ffffff;padding:12px 20px;border-radius:3px;text-decoration:none;font-weight:500;">Say how it went</a>
</p>
<p style="margin:0;font-size:13px;color:#6B6459;">Nothing goes on the shop until it has been read. If something went wrong instead, reply to this email and it gets sorted rather than published.</p>`;

  return {
    to: order.email,
    // Not "Leave a review", which reads as a demand from a company. This is a
    // question, and a question is answerable.
    subject: `How was it?`,
    html: shell('How was it?', body),
  };
}

// One email per drop rather than one per order, which is what store_stock_alerts
// is for.
function lowStock(items: any[]) {
  const rows = items.map((i: any) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #E8E0D3;">${escape(i.label ? `${i.title}, ${i.label}` : i.title)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #E8E0D3;text-align:right;">${Number(i.stock)} left</td>
    </tr>`).join('');

  const body = `
<p style="margin:0 0 16px;font-size:16px;">${items.length === 1 ? 'One thing is' : `${items.length} things are`} nearly out.</p>
<table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 20px;">${rows}</table>
<p style="margin:0 0 20px;">
  <a href="${escape(PORTAL)}/products?filter=live" style="color:#AD5438;">Open Products</a>
</p>
<p style="margin:0;font-size:13px;color:#6B6459;">You will not get this again for the same thing until it has been restocked and runs low a second time. Anything you have not put a count against is left alone.</p>`;

  // No `to`. The caller supplies the trader address, so this function cannot
  // accidentally send a stock report to a shopper.
  return {
    subject: items.length === 1
      ? `Nearly out: ${escape(items[0].label ? `${items[0].title}, ${items[0].label}` : items[0].title).slice(0, 60)}`
      : `${items.length} things are nearly out`,
    html: shell('Nearly out', body),
  };
}

// Reply-to is the shop's own address. An email answered directly never reaches
// the thread, so the record splits and the median stops measuring anything.
function messageToShop(thread: any, message: any, about: string, basketBlock = '') {
  const body = `
<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#857D70">${escape(about)}</p>
${basketBlock}
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${lines(message.body)}</p>
<p style="margin:0 0 20px;color:#5C564D;">From ${escape(thread.name || thread.email)}.</p>
<p style="margin:0 0 20px;">
  <a href="${escape(PORTAL)}/messages" style="display:inline-block;background:#BA5A3D;color:#ffffff;padding:12px 20px;border-radius:3px;text-decoration:none;font-weight:500;">Answer it</a>
</p>
<p style="margin:0;font-size:13px;color:#6B6459;">Answer in the portal rather than by replying here, so your reply reaches them and stays with the conversation.</p>`;

  return {
    subject: `Question about ${about}`,
    html: shell(`Question about ${about}`, body),
  };
}

// The acknowledgement goes once, on the first message: it carries the only route
// back to the conversation. It answers nothing, so it is not an automated reply.
function messageToCustomer(
  thread: any, message: any, link: string, about: string, first: boolean, offer: any = null,
) {
  // The figure and the date it runs to, and nothing else. A former price beside it
  // turns a price given to one person into a price claim about the shop.
  const price = offer ? `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
<tr><td style="padding:14px 16px;background:#EEF2EC;border-radius:3px;">
<p style="margin:0 0 4px;font-size:20px;font-weight:500;color:#2A2723;">${money(offer.price)} for this</p>
<p style="margin:0;font-size:14px;color:#5C564D;">Yours until ${escape(new Date(offer.expires_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long' }))}. Open the conversation to take it.</p>
</td></tr></table>` : '';

  const body = first
    ? `
<p style="margin:0 0 16px;font-size:16px;">We have your question about ${escape(about)}.</p>
<p style="margin:0 0 20px;">A person reads every one of these and answers it themselves, so this is not an automatic answer and there will be a real one. You will get an email when it is there.</p>
<p style="margin:0 0 20px;">
  <a href="${escape(link)}" style="display:inline-block;background:#BA5A3D;color:#ffffff;padding:12px 20px;border-radius:3px;text-decoration:none;font-weight:500;">See your question</a>
</p>
<p style="margin:0;font-size:13px;color:#6B6459;">Keep this email. That link is the way back to the conversation, and only you have it.</p>`
    : `
<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#857D70">${escape(about)}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${lines(message.body)}</p>
${price}
<p style="margin:0 0 20px;">
  <a href="${escape(link)}" style="display:inline-block;background:#BA5A3D;color:#ffffff;padding:12px 20px;border-radius:3px;text-decoration:none;font-weight:500;">${offer ? 'Take this price' : 'Write back'}</a>
</p>
<p style="margin:0;font-size:13px;color:#6B6459;">Only you have that link. Nothing in the conversation appears anywhere else on the shop.</p>`;

  return {
    subject: first ? `We have your question` : `About ${about}`,
    html: shell(first ? 'We have your question' : `About ${about}`, body),
  };
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
      .select('title').eq('id', thread.product_id).maybeSingle();
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

// --- sending -----------------------------------------------------------------

async function send(to: string, subject: string, html: string, replyTo: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html, reply_to: replyTo }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message ?? `Resend ${res.status}`);
  return String(payload?.id ?? '');
}

async function loadOrder(orderId: string) {
  const { data, error } = await db
    .from('orders')
    .select(`
      id, tenant_id, reference, status, email, name, phone, address,
      subtotal, delivery, total, carrier, tracking_number, tracking_url,
      dispatched_at,
      // The token, for the review link only. It is never in a confirmation body.
      access_token,
      order_items ( title, qty, unit_price, line_total, product_id, variant_label )
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

  // Two callers: the webhook with the service key, the portal with a user's JWT.
  let allowed = token === SERVICE_KEY;
  if (!allowed && token) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data } = await asUser.auth.getUser();
    allowed = Boolean(data?.user);
  }
  if (!allowed) return json({ error: 'Not authorised' }, 401, origin);

  let body: { orderId?: string; kind?: string; resend?: boolean };
  try { body = await req.json(); } catch { return json({ error: 'Bad body' }, 400, origin); }

  const { orderId, kind, resend } = body;

  // Not about an order, so no order_emails row. Handled before the orderId check.
  if (kind === 'low_stock') {
    if (token !== SERVICE_KEY) return json({ error: 'Not authorised' }, 401, origin);

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return json({ sent: 'nothing', count: 0 }, 200, origin);

    const { data: tenant } = await db.from('tenants')
      .select('store')
      .eq('slug', Deno.env.get('FEED_TENANT_SLUG') ?? 'cart-and-keep')
      .maybeSingle();

    const to = tenant?.store?.email ?? tenant?.store?.trader?.email;
    if (!to) return json({ error: 'No address to send to' }, 409, origin);

    const mail = lowStock(items);
    try {
      const providerId = await send(to, mail.subject, mail.html, to);
      return json({ sent: 'low_stock', count: items.length, id: providerId }, 200, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[notify] low_stock', message);
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

      const site = cfg.domain ? `https://${cfg.domain}` : 'https://cartandkeep.com';
      const trader = cfg.trader ?? {};
      const shopAddress = String(cfg.email ?? trader.email ?? 'support@cartandkeep.com');

      // A basket has no title, so it is named by what is in it.
      const basketLines = Array.isArray(thread.basket) ? thread.basket : null;
      const basketAbout = basketLines?.length
        ? `a basket of ${basketLines.reduce((n: number, l: any) => n + Number(l.qty ?? 0), 0)} ${
          basketLines.reduce((n: number, l: any) => n + Number(l.qty ?? 0), 0) === 1 ? 'thing' : 'things'}, ${
          money(basketLines.reduce((n: number, l: any) => n + Number(l.qty ?? 0) * Number(l.price ?? 0), 0))}`
        : null;

      const about = product?.title
        ?? basketAbout
        ?? (order?.reference ? `order ${order.reference}` : 'the shop');

      // No total. With a price quoted, a total in the subject puts the higher
      // figure directly above the lower one. Found by rendering, not reading.
      const units = basketLines?.reduce((n: number, l: any) => n + Number(l.qty ?? 0), 0) ?? 0;
      const theirAbout = product?.title
        ?? (basketLines?.length ? `a basket of ${units} ${units === 1 ? 'thing' : 'things'}` : null)
        ?? (order?.reference ? `order ${order.reference}` : 'the shop');

      // What she is being asked about, listed, so she can answer without
      // opening the portal to find out what the four things were.
      const basketBlock = basketLines?.length
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;border-collapse:collapse;margin:0 0 20px;">${
          basketLines.map((l: any) => `<tr>
<td style="padding:6px 0;border-bottom:1px solid #E8E0D3;">${escape(l.variant_label ? `${l.title}, ${l.variant_label}` : l.title)}</td>
<td style="padding:6px 12px;border-bottom:1px solid #E8E0D3;text-align:right;color:#5C564D;white-space:nowrap;">${escape(l.qty)}</td>
<td style="padding:6px 0;border-bottom:1px solid #E8E0D3;text-align:right;white-space:nowrap;">${money(Number(l.qty) * Number(l.price))}</td>
</tr>`).join('')}</table>`
        : '';

      // An order thread is reached on the order page with the token the confirmation
      // already carried. Everything else with its own.
      const link = thread.order_id && order
        ? `${site}/order/${encodeURIComponent(order.reference)}?token=${encodeURIComponent(order.access_token)}`
        : `${site}/thread/${thread.id}?token=${encodeURIComponent(thread.access_token ?? '')}`;

      const sends: Array<{ to: string; mail: { subject: string; html: string } }> = [];

      if (message.sender === 'customer') {
        sends.push({ to: shopAddress, mail: messageToShop(thread, message, about, basketBlock) });

        // The acknowledgement, once, on the first thing said. Later messages
        // in the same thread get nothing, because they already hold the link.
        if (count <= 1) {
          sends.push({
            to: thread.email,
            mail: messageToCustomer(thread, message, link, theirAbout, true),
          });
        }
      } else {
        sends.push({
          to: thread.email,
          mail: messageToCustomer(thread, message, link, theirAbout, false, offer),
        });
      }

      let last = '';
      for (const s of sends) last = await send(s.to, s.mail.subject, s.mail.html, shopAddress);

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
  if (!['confirmation', 'dispatch', 'seller_alert', 'review_request'].includes(kind)) {
    return json({ error: 'Unknown kind' }, 400, origin);
  }

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
    if (already) return json({ skipped: 'already sent' }, 200, origin);
  }

  try {
    const { order, cfg } = await loadOrder(orderId);
    const trader = cfg.trader ?? {};
    const replyTo = String(trader.email ?? 'support@cartandkeep.com');

    let mail;
    if (kind === 'confirmation') mail = confirmation(order, trader, cfg);
    else if (kind === 'dispatch') mail = dispatch(order, cfg);
    else if (kind === 'review_request') mail = reviewRequest(order, cfg);
    else {
      mail = sellerAlert(order, trader);
      mail.to = replyTo;
    }

    if (!mail.to) return json({ error: 'No recipient' }, 400, origin);

    const providerId = await send(mail.to, mail.subject, mail.html, replyTo);

    // Upsert, so a success after an earlier failed attempt replaces that row rather than
    // colliding with it, and the result is read: an unrecorded send is sent again next time.
    const { error: recordError } = await db.from('order_emails').upsert({
      tenant_id: order.tenant_id,
      order_id: order.id,
      kind,
      recipient: mail.to,
      subject: mail.subject,
      identity_complete: identityComplete(trader),
      provider_id: providerId,
      status: 'sent',
      error: null,
    }, { onConflict: 'order_id,kind' });
    if (recordError) console.error('[notify] sent but not recorded', kind, orderId, recordError.message);

    return json({ sent: kind, id: providerId }, 200, origin);
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

    return json({ error: message }, 500, origin);
  }
});
