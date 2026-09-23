/*
 * Creates a Stripe Checkout session and the order behind it.
 *
 * The browser sends product ids and quantities, never prices. Every figure
 * here is read from the database, because a basket that can name its own
 * totals is a basket somebody will eventually name a penny in.
 *
 * Runs with the service role, so it is the only thing that can write an order.
 * Both tables have RLS on and no policies at all.
 */
import Stripe from 'npm:stripe@17';
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


const FREE_OVER = 40;
const POSTAGE = 3.95;
const MAX_QTY = 20;

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

/*
 * The simulator, and the one thing that matters about it.
 *
 * It needs two conditions and the first one disarms it permanently. The moment
 * a real Stripe key exists in the environment this is false and cannot be made
 * true by any setting, so the flag cannot be left on by accident and carried
 * into a shop that takes money. There is no way to simulate a payment on a
 * shop that can take one.
 *
 * It exists because everything downstream of a payment, the confirmation, the
 * seller alert, the stock coming off, the tracking page, the offer being
 * spent, is untested and untestable while the key is outstanding, and those
 * are the parts nobody can fix in a hurry on the morning of a launch.
 */
const SIMULATE = !STRIPE_KEY && Deno.env.get('CHECKOUT_SIMULATE') === 'on';

/*
 * Built when it is used rather than at module scope.
 *
 * `new Stripe(undefined)` throws, so a missing key used to stop this function
 * booting at all, which is why it is written and not deployed. Lazy means the
 * function boots, refuses a real payment plainly, and can simulate one.
 */
let stripeClient: Stripe | null = null;
function getStripe() {
  if (!STRIPE_KEY) throw new Error('No Stripe key is configured.');
  stripeClient ??= new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });
  return stripeClient;
}

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// No O, I, 0 or 1. A reference gets read down a phone and written on a parcel,
// and those four are where a digit becomes a letter.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function reference() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `CK-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

function token() {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const money = (n: number) => Math.round(n * 100) / 100;

/*
 * Compared in constant time.
 *
 * A plain === leaks how much of a token is right through how long it takes to
 * say no. The same function the order, review and thread functions use.
 */
function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/*
 * Spreading an agreed price back across the lines.
 *
 * She quotes one figure for the lot, and the order still has to itemise,
 * because a confirmation that says "3 things, £130" is not a record anybody
 * can return one item against.
 *
 * Worked in pence, proportionally, with the remainder given a penny at a time
 * to the largest lines first, so the allocated totals add up to the agreed
 * price exactly rather than to a penny either side of it. The line total is
 * the figure charged; the unit price stored beside it is that total divided by
 * the quantity, which on a line where it does not divide evenly is a rounded
 * display figure rather than the truth. Nothing renders unit times quantity,
 * so nothing shows a mismatch, and the arithmetic that matters is exact.
 */
function allocate(listPence: number[], targetPence: number) {
  const listTotal = listPence.reduce((n, p) => n + p, 0);
  if (listTotal <= 0) return listPence.map(() => 0);

  const shares = listPence.map((p) => Math.floor((p * targetPence) / listTotal));
  let left = targetPence - shares.reduce((n, p) => n + p, 0);

  const order = listPence
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p);

  let at = 0;
  while (left > 0 && order.length) {
    shares[order[at % order.length].i] += 1;
    left -= 1;
    at += 1;
  }

  return shares;
}

/*
 * Which zone a postcode falls in.
 *
 * Duplicated from src/lib/postcode.js rather than imported, for the same reason
 * the CORS block is: the dashboard editor deploys one folder and uploads
 * nothing outside it. Two copies of a list is a real cost and it is smaller
 * than the cost of needing the CLI to deploy.
 *
 * Resolved here rather than trusted from the browser. The checkout page sends a
 * zone and this function used to ignore it, which was accidentally the right
 * behaviour: a zone in the request body is a number the shopper can edit, and
 * this one decides what they pay.
 *
 * The Highlands list is exceptions rather than a rule, which is why it is long.
 * Charging a surcharge to somebody in Aberdeen city, AB10 to AB16 and firmly
 * mainland, is how a shop loses a customer.
 */
const HIGHLAND_AREAS = new Set(['HS', 'IV', 'KW', 'ZE']);

const HIGHLAND_RANGES: Record<string, number[][]> = {
  AB: [[31, 38], [40, 56]],
  FK: [[17, 21]],
  KA: [[27, 28]],
  PA: [[20, 49], [60, 78]],
  PH: [[4, 44], [49, 50]],
};

function postcodeZone(postcode: string) {
  const bare = String(postcode ?? '').toUpperCase().replace(/\s+/g, '');
  const out = bare.length > 3 ? bare.slice(0, -3) : bare;
  const area = out.replace(/\d.*$/, '');
  const match = out.match(/^[A-Z]+(\d+)/);
  const district = match ? Number(match[1]) : null;

  if (area === 'GY' || area === 'JE') return 'channel_islands';
  if (area === 'IM') return 'isle_of_man';
  if (area === 'BT') return 'northern_ireland';
  if (area === 'TR' && district !== null && district >= 21 && district <= 25) return 'isles_of_scilly';
  if (HIGHLAND_AREAS.has(area)) return 'highlands';

  const ranges = HIGHLAND_RANGES[area];
  if (ranges && district !== null && ranges.some(([lo, hi]) => district >= lo && district <= hi)) {
    return 'highlands';
  }

  return 'mainland';
}

/*
 * Replaying what Stripe would have said.
 *
 * The simulated outcome is posted to the webhook as an event, unsigned, with
 * the service key. That is deliberate: the alternative is a second copy of the
 * paid handler, and a second copy of the thing that takes stock off and spends
 * an offer would drift from the real one within a week. This way the test
 * exercises the handler that runs in production rather than one that looks
 * like it.
 *
 * The browser never holds the service key. It asks this function, which
 * already proved the order token before it got here.
 */
async function replay(event: Record<string, unknown>) {
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The gateway wants an Authorization header before the function is
      // reached at all. Real Stripe sends none, so verify_jwt has to be off on
      // stripe-webhook for a live event to get through either.
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
      'x-simulated-event': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    },
    body: JSON.stringify(event),
  });

  if (res.ok) return null;

  // Returned rather than logged. This swallowed a refusal and reported success,
  // so the page navigated to an order that had not moved and the only evidence
  // was in a log nobody had a reason to open.
  const detail = await res.text();
  console.error('[checkout] replay', res.status, detail);
  return `The webhook refused the replayed event: ${res.status} ${detail}. Check STRIPE_SECRET_KEY is unset and CHECKOUT_SIMULATE is on for stripe-webhook too.`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405, origin);

  try {
    const body = await req.json();

    /*
     * The simulated outcome, chosen on a page that is plainly not Stripe.
     *
     * Proved with the order's own token, the same secret the confirmation link
     * carries, so this cannot be pointed at somebody else's order.
     */
    if (body?.action === 'simulate') {
      if (!SIMULATE) return json({ error: 'Not available.' }, 404, origin);

      const reference = String(body.reference ?? '').trim().toUpperCase();
      const given = String(body.token ?? '');
      const outcome = String(body.outcome ?? '');

      const { data: order } = await db
        .from('orders')
        .select('id, access_token, stripe_session_id, status')
        .eq('reference', reference)
        .maybeSingle();

      if (!order || !sameToken(order.access_token ?? '', given)) {
        return json({ error: 'Not found' }, 404, origin);
      }

      const intent = `sim_pi_${order.id.slice(0, 8)}`;

      if (outcome === 'paid' || outcome === 'refunded') {
        const failed = await replay({
          type: 'checkout.session.completed',
          data: { object: { id: order.stripe_session_id, payment_status: 'paid', payment_intent: intent } },
        });
        if (failed) return json({ error: failed }, 502, origin);
      }

      // A refund is a payment that happened and then came back, so it is two
      // events rather than one, exactly as it would be from Stripe.
      if (outcome === 'refunded') {
        const failed = await replay({
          type: 'charge.refunded',
          data: { object: { payment_intent: intent } },
        });
        if (failed) return json({ error: failed }, 502, origin);
      }

      // A declined card leaves the order pending and returns them to the cancel
      // URL. Writing 'cancelled' here would simulate something Stripe does not do.
      //
      // Read back, so the page can say plainly whether the order actually moved
      // rather than reporting that the request was accepted.
      const { data: after } = await db
        .from('orders').select('status, paid_at').eq('id', order.id).maybeSingle();

      return json({ ok: true, outcome, status: after?.status ?? null }, 200, origin);
    }

    const {
      items, contact, tenantSlug = 'cart-and-keep', returnTo, sessionId,
      offerId = null, token: offerToken = '',
    } = body;

    /*
     * An agreed price arrives as an id and the token of the conversation it
     * was given in, and nothing else. No lines and no figure: both are read
     * back out of the offer record, because a price the browser could name is
     * a price the customer could set, and this one was already negotiated.
     */
    const byOffer = typeof offerId === 'string' && offerId.length > 0;

    if (!byOffer && (!Array.isArray(items) || items.length === 0)) {
      return json({ error: 'Your basket is empty' }, 400, origin);
    }
    if (!contact?.email || !String(contact.email).includes('@')) {
      return json({ error: 'A valid email address is needed' }, 400, origin);
    }
    if (!contact?.name?.trim()) {
      return json({ error: 'A name is needed' }, 400, origin);
    }
    if (!contact?.address?.line1?.trim() || !contact?.address?.postcode?.trim()) {
      return json({ error: 'A delivery address and postcode are needed' }, 400, origin);
    }

    const { data: tenant, error: tErr } = await db
      .from('tenants').select('id, name, currency, store').eq('slug', tenantSlug).single();
    if (tErr || !tenant) return json({ error: 'Shop not found' }, 404, origin);

    /*
     * Delivery terms come off the tenant row, not out of this file.
     *
     * FREE_OVER and POSTAGE were literals here and also written out in five
     * components, so the basket and the payment could disagree and nothing
     * checked that they did not. Migration 0040 exists to end that, and this
     * function was still not reading it.
     *
     * The constants stay as a fallback rather than being deleted. A shop that
     * cannot take a payment because a jsonb key is missing is a worse failure
     * than one charging last month's postage.
     */
    const delivery_cfg = (tenant.store as Record<string, any>)?.delivery ?? {};
    const freeOver = Number(delivery_cfg.free_over ?? FREE_OVER);
    const postage = Number(delivery_cfg.postage ?? POSTAGE);
    const zones = delivery_cfg.zones ?? {};

    /*
     * Quantities are clamped rather than trusted, and keyed by product and
     * variant together.
     *
     * Keying on the product alone would fold two sizes of one bed sheet into a
     * single line, so somebody ordering a double and a king would be charged for
     * two of whichever arrived first. The basket learned this at the same time
     * and for the same reason.
     */
    /*
     * The offer, and the proof that it belongs to whoever is holding it.
     *
     * Read from store_live_offers rather than the table, so expired,
     * withdrawn and already used all come back as no offer and the clock lives
     * in one place. Then the token of the conversation, compared in constant
     * time, because an offer id on its own is a guess somebody could make.
     */
    let offer: any = null;

    if (byOffer) {
      const { data: live } = await db
        .from('store_live_offers')
        .select('id, thread_id, lines, price')
        .eq('tenant_id', tenant.id)
        .eq('id', offerId)
        .maybeSingle();

      const { data: thread } = live
        ? await db.from('store_threads')
          .select('id, access_token').eq('id', live.thread_id).maybeSingle()
        : { data: null };

      // One answer for an id that does not exist, a price that has run out and
      // a wrong token. Three answers would tell somebody which half to keep
      // guessing at.
      if (!live || !thread?.access_token || !sameToken(thread.access_token, String(offerToken))) {
        return json({
          error: 'That price is not available any more. The conversation is still there, so ask again and we will look at it.',
        }, 409, origin);
      }

      offer = live;
    }

    /*
     * What is being bought: the offer's own lines, or the basket.
     *
     * Either way it is ids and quantities, and every figure below is read from
     * the database.
     */
    const source: any[] = byOffer
      ? (offer.lines ?? []).map((l: any) => ({ id: l.product_id, variantId: l.variant_id, qty: l.qty }))
      : items;

    const wanted = new Map<string, { productId: string; variantId: string | null; qty: number }>();
    for (const item of source) {
      const qty = Math.min(MAX_QTY, Math.max(1, Number(item?.qty) || 0));
      if (typeof item?.id !== 'string' || !qty) continue;
      const variantId = typeof item?.variantId === 'string' ? item.variantId : null;
      const key = variantId ? `${item.id}:${variantId}` : item.id;
      const found = wanted.get(key);
      if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
      else wanted.set(key, { productId: item.id, variantId, qty });
    }
    if (wanted.size === 0) return json({ error: 'Your basket is empty' }, 400, origin);

    const productIds = [...new Set([...wanted.values()].map((w) => w.productId))];
    const variantIds = [...wanted.values()].map((w) => w.variantId).filter(Boolean) as string[];

    const [{ data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
      db.from('store_products')
        .select('id, slug, title, price, image_url, status, is_sample, availability')
        .eq('tenant_id', tenant.id)
        .in('id', productIds),
      variantIds.length
        ? db.from('store_variants')
          .select('id, product_id, label, price, image_url, availability')
          .eq('tenant_id', tenant.id)
          .in('id', variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (pErr || vErr) return json({ error: 'Could not read the catalogue' }, 500, origin);

    const variantById = new Map((variants ?? []).map((v) => [v.id, v]));

    const gone = (a?: string | null) => a === 'out_of_stock' || a === 'discontinued';

    /*
     * Every line resolved and priced from the database, never from the payload.
     *
     * A variant that belongs to a different product is refused rather than
     * priced, because the variant id arrives from a browser and a basket that
     * can name its own combinations is one somebody will eventually use to buy
     * a king size at a cot price.
     *
     * A null variant price means the product price applies, which is the same
     * fallback the storefront renders, so the figure on the basket and the
     * figure charged come from one rule rather than two.
     */
    const lines: Array<Record<string, any>> = [];
    const unavailable: string[] = [];
    const names: string[] = [];

    for (const [key, want] of wanted) {
      const product = (products ?? []).find((p) => p.id === want.productId);
      const variant = want.variantId ? variantById.get(want.variantId) : null;

      const badProduct = !product
        || product.status !== 'live'
        || product.is_sample
        || gone(product.availability);

      const badVariant = want.variantId
        && (!variant || variant.product_id !== want.productId || gone(variant.availability));

      if (badProduct || badVariant) {
        unavailable.push(key);
        if (product) names.push(variant ? `${product.title}, ${variant.label}` : product.title);
        continue;
      }

      const unit = money(Number(variant?.price ?? product!.price));
      lines.push({
        product: product!,
        variant: variant ?? null,
        qty: want.qty,
        unit,
        lineTotal: money(unit * want.qty),
      });
    }

    // Refused by name, so the shopper is told which item rather than handed a
    // generic failure and left to work it out.
    if (unavailable.length) {
      return json({
        error: names.length
          ? `No longer available: ${names.join(', ')}`
          : 'Something in your basket is no longer available',
        unavailable,
      }, 409, origin);
    }
    if (lines.length === 0) return json({ error: 'Your basket is empty' }, 400, origin);

    /*
     * An agreed price replaces the list total, and the lines are rewritten to
     * add up to it.
     *
     * Availability is still checked above and still refuses by name. An offer
     * is a promise about a price, never about stock, and selling something
     * that has gone because it was quoted last Tuesday is worse than saying so.
     */
    if (byOffer) {
      const shares = allocate(
        lines.map((l) => Math.round(l.lineTotal * 100)),
        Math.round(Number(offer.price) * 100),
      );

      lines.forEach((l, i) => {
        l.lineTotal = money(shares[i] / 100);
        l.unit = money(l.lineTotal / l.qty);
      });
    }

    const subtotal = money(lines.reduce((n, l) => n + l.lineTotal, 0));

    const zone = postcodeZone(String(contact.address.postcode));
    const zoneCfg = zones[zone] ?? {};

    /*
     * Blocked before anything is charged. Guernsey and Jersey sit outside the
     * UK customs and VAT territory, so an order there is an export with a
     * customs declaration attached, which is a different business rather than a
     * different postage rate.
     */
    if (zoneCfg.blocked) {
      return json({
        error: 'We cannot deliver to the Channel Islands yet. Everywhere else in the UK is fine.',
        zone,
      }, 409, origin);
    }

    /*
     * The surcharge applies whether or not delivery is free.
     *
     * Free delivery is a promise about the standard rate. It is not a promise
     * to absorb what a carrier charges extra to reach Shetland, and a threshold
     * that quietly swallowed the surcharge would lose money on exactly the
     * orders that cost the most to fulfil.
     *
     * Every surcharge is zero today, so this changes no figure until her rate
     * card is entered. What it changes now is that the columns are populated,
     * which is what makes it checkable later.
     */
    const surcharge = money(Math.max(0, Number(zoneCfg.surcharge ?? 0)));
    // Named for what it is rather than `base`, which is already the return URL
    // further down. Two `const base` in one block is a parse error, so the
    // function did not boot at all and every checkout returned a worker error.
    // Against the agreed price where there is one, not the list price. She
    // decided what this order is worth, and the threshold is a promise about
    // what an order comes to rather than about what it would have come to.
    const basePostage = subtotal >= freeOver ? 0 : postage;
    const delivery = money(basePostage + surcharge);
    const total = money(subtotal + delivery);

    const ref = reference();
    const access = token();

    const { data: order, error: oErr } = await db.from('orders').insert({
      tenant_id: tenant.id,
      reference: ref,
      access_token: access,
      email: String(contact.email).trim().toLowerCase(),
      name: String(contact.name).trim(),
      phone: contact.phone ? String(contact.phone).trim() : null,
      address: contact.address,
      customer_note: contact.note ? String(contact.note).slice(0, 1000) : null,
      subtotal,
      delivery,
      total,
      // Recorded so a surcharge that was charged can be checked later against
      // what the carrier actually billed. 0041 added both columns and nothing
      // has ever written to them.
      delivery_zone: zone,
      delivery_surcharge: surcharge,
      currency: tenant.currency ?? 'GBP',
      // The analytics session that produced this order. Nothing is stored on
      // the visitor's device, so this row is the only thing that survives the
      // trip to Stripe and back, and it is what makes purchase attribution
      // possible without a cookie.
      session_id: typeof sessionId === 'string' ? sessionId.slice(0, 64) : null,
      // The conversation this sale came out of. The only way anybody ever
      // finds out whether talking to people sells anything.
      from_thread_id: offer?.thread_id ?? null,
    }).select('id').single();
    if (oErr || !order) {
      console.error('[checkout] order insert', oErr);
      return json({ error: 'Could not start the order' }, 500, origin);
    }

    const { error: iErr } = await db.from('order_items').insert(lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      variant_id: l.variant?.id ?? null,
      // Copied, not joined. Renaming a size must not rewrite an old invoice,
      // which is the same reason the title and the price are copied.
      variant_label: l.variant?.label ?? null,
      slug: l.product.slug,
      title: l.product.title,
      image_url: l.variant?.image_url ?? l.product.image_url,
      unit_price: l.unit,
      qty: l.qty,
      line_total: l.lineTotal,
    })));
    if (iErr) {
      console.error('[checkout] items insert', iErr);
      return json({ error: 'Could not start the order' }, 500, origin);
    }

    const base = returnTo && String(returnTo).startsWith('http')
      ? String(returnTo)
      : (origin ?? 'https://cartandkeep.com');

    /*
     * A simulated session, which is a row and a redirect and nothing else.
     *
     * The order above was written by exactly the code that writes a real one:
     * same figures, same lines, same from_thread_id. Only the trip to Stripe
     * is replaced, so what gets tested afterwards is the real thing.
     */
    if (SIMULATE) {
      const fake = `sim_${crypto.randomUUID()}`;
      await db.from('orders').update({ stripe_session_id: fake }).eq('id', order.id);

      return json({
        url: `${base}/pay/simulate?reference=${ref}&token=${access}`,
        reference: ref,
        token: access,
        simulated: true,
      }, 200, origin);
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: String(contact.email).trim().toLowerCase(),
      client_reference_id: ref,
      // Pence, from the database. Never from the request body.
      /*
       * One line for an agreed price, itemised otherwise.
       *
       * Allocating £130 across three lines produces unit prices like £43.33
       * that nobody agreed to and that read as arithmetic gone wrong on the
       * last page before paying. The figure they agreed is the figure shown.
       * The order itself still itemises, which is what a return is worked
       * against.
       */
      line_items: byOffer
        ? [{
          quantity: 1,
          price_data: {
            currency: (tenant.currency ?? 'GBP').toLowerCase(),
            unit_amount: Math.round(subtotal * 100),
            product_data: {
              name: `Agreed price, ${lines.reduce((n, l) => n + l.qty, 0)} ${
                lines.reduce((n, l) => n + l.qty, 0) === 1 ? 'item' : 'items'}`,
            },
          },
        }]
        : lines.map((l) => ({
          quantity: l.qty,
          price_data: {
            currency: (tenant.currency ?? 'GBP').toLowerCase(),
            unit_amount: Math.round(l.unit * 100),
            product_data: {
              // The variant in the name, because the Stripe page is the last
              // thing somebody reads before paying and "Bed Sheet" alone does
              // not tell them which one they are buying.
              name: l.variant ? `${l.product.title}, ${l.variant.label}` : l.product.title,
              images: (l.variant?.image_url ?? l.product.image_url)
                ? [l.variant?.image_url ?? l.product.image_url] : undefined,
            },
          },
        })),
      // Always present, at zero when it is free, so the shopper sees the line
      // and the total on Stripe matches the total on the basket exactly.
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: delivery > 0 ? 'UK delivery' : 'Free UK delivery',
          fixed_amount: { amount: Math.round(delivery * 100), currency: 'gbp' },
        },
      }],
      /*
       * The offer travels on the session rather than on a second column.
       *
       * store_offers.order_id already records the link in the direction that
       * matters and it is written when the money moves. A column on orders
       * would be the same fact twice, and the webhook needs to know which
       * offer to spend rather than to guess from the thread, which would spend
       * the wrong one if she requoted while they were paying.
       */
      metadata: { order_id: order.id, reference: ref, offer_id: offer?.id ?? '' },
      success_url: `${base}/order/${ref}?token=${access}`,
      cancel_url: `${base}/cart`,
    });

    await db.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);

    return json({ url: session.url, reference: ref, token: access }, 200, origin);
  } catch (err) {
    console.error('[checkout]', err);
    return json({ error: 'Checkout could not start. Nothing has been charged.' }, 500, origin);
  }
});
