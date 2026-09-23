/*
 * Marks an order paid, and triggers the two emails that a payment produces.
 *
 * The success URL is not proof of payment. A shopper can reach it by typing
 * it, and can also pay and then close the tab before it loads, so the order
 * status comes from Stripe telling us and from nothing else.
 *
 * No CORS here. Stripe calls this server to server and a browser has no
 * business reaching it.
 */
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

/*
 * The simulated door, and why it cannot be left open.
 *
 * Two conditions, and the first one shuts it permanently. Once a real Stripe
 * key exists this is false and no setting can make it true, so a shop that can
 * take money cannot accept an unsigned event. There is no window where both
 * are possible.
 *
 * It exists so the simulator does not need a second copy of the handler below.
 * A second copy of the code that takes stock off and spends an agreed price
 * would drift from this one inside a week, and the test would then be proving
 * the copy.
 */
const SIMULATE = !STRIPE_KEY && Deno.env.get('CHECKOUT_SIMULATE') === 'on';

// Built when used. `new Stripe(undefined)` throws, and this function has to
// boot in order to refuse politely.
let stripeClient: Stripe | null = null;
function getStripe() {
  stripeClient ??= new Stripe(STRIPE_KEY, { apiVersion: '2024-12-18.acacia' });
  return stripeClient;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/*
 * Sending lives in the notify function rather than here.
 *
 * The confirmation carries statutory wording under Schedule 2 of the Consumer
 * Contracts Regulations, and the portal sends the dispatch email from the same
 * templates. Two copies of a legal paragraph is two paragraphs that disagree
 * within a month, so this makes a call rather than holding a second copy. The
 * dashboard editor deploys one folder and cannot share a module between them,
 * which is the constraint that makes a hop the right answer instead of an
 * import.
 *
 * Failures here are logged and swallowed. A 500 from this handler makes Stripe
 * retry the whole event, and retrying a payment that was already applied is how
 * one order becomes two. The notify function is idempotent on its own account,
 * so the retry is safe, but the order state is what matters and it is already
 * correct by this point.
 */
async function notify(orderId: string, kind: 'confirmation' | 'seller_alert') {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, kind }),
    });
    if (!res.ok) console.error('[webhook] notify', kind, res.status, await res.text());
  } catch (err) {
    console.error('[webhook] notify', kind, err);
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  /*
   * A simulated event, presented with the service key rather than a signature.
   *
   * The header has to match the service role key exactly, so only something
   * that already holds it can post one, which in practice is the checkout
   * function and nothing in a browser. Compared in constant time for the same
   * reason every other secret on this platform is.
   */
  const simulated = req.headers.get('x-simulated-event');
  const bySimulation = SIMULATE
    && Boolean(simulated)
    && sameToken(String(simulated), SERVICE_KEY);

  if (!signature && !bySimulation) return new Response('No signature', { status: 400 });

  // The raw body, not the parsed one. Verification is over the exact bytes and
  // JSON.parse then re-stringify fails it in ways that look like a Stripe bug.
  const raw = await req.text();

  let event: Stripe.Event;

  if (bySimulation) {
    try {
      event = JSON.parse(raw) as Stripe.Event;
    } catch {
      return new Response('Bad body', { status: 400 });
    }
  } else {
    try {
      event = await getStripe().webhooks.constructEventAsync(raw, signature!, SECRET);
    } catch (err) {
      console.error('[webhook] signature', err);
      return new Response('Bad signature', { status: 400 });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;

        // Matched on the session id rather than the metadata, because the
        // session id is the thing Stripe guarantees and metadata is a string
        // we put there.
        //
        // `select()` so we get the row back. The `.eq('status', 'pending')`
        // means a retry of an already applied event updates nothing and
        // returns nothing, which is exactly the signal not to email again.
        const { data: updated, error } = await db.from('orders').update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        }).eq('stripe_session_id', session.id).eq('status', 'pending').select('id');

        if (error) {
          console.error('[webhook] paid update', error);
          break;
        }

        const orderId = updated?.[0]?.id;
        if (!orderId) break;

        /*
         * Stock comes off here, and the position in this block is the whole
         * safety of it.
         *
         * `apply_order_stock` is not idempotent on its own. Called twice on one
         * order it takes the count off twice, which was checked against a real
         * Postgres rather than assumed. What makes it safe is the
         * `.eq('status', 'pending')` above: a Stripe retry of an already applied
         * event updates no row, `orderId` comes back undefined, and this line is
         * never reached. Moved above that guard and a retried webhook empties
         * her shelf.
         *
         * Before both emails, because her alert reads the count back off the
         * product to name anything that went below zero. Logged and swallowed
         * like everything else here: a counting failure is not a reason to
         * withhold a confirmation that regulation 16 requires.
         */
        const { error: stockErr } = await db.rpc('apply_order_stock', { p_order_id: orderId });
        if (stockErr) console.error('[webhook] stock', stockErr);

        /*
         * An agreed price is spent here, and only here.
         *
         * Not when the checkout starts. A shopper who reaches Stripe and then
         * closes the tab has not bought anything, and burning her price on
         * that would send them back to a conversation whose offer had
         * vanished with no explanation.
         *
         * Inside the pending guard for the same reason the stock line is: a
         * retried event never reaches this. The `.eq('status', 'open')` is the
         * second guard, so even reached twice it writes once, and the unique
         * index on order_id in 0070 is the third.
         *
         * Logged and swallowed like everything else in this block. An offer
         * left open is a price she may honour again; a 500 here is Stripe
         * retrying a payment that already applied.
         */
        const offerId = session.metadata?.offer_id;
        if (offerId) {
          const { error: offerErr } = await db.from('store_offers').update({
            status: 'accepted',
            order_id: orderId,
            accepted_at: new Date().toISOString(),
          }).eq('id', offerId).eq('status', 'open');

          if (offerErr) console.error('[webhook] offer', offerId, offerErr);
        }

        /*
         * The buyer first, then her.
         *
         * Sequential rather than parallel, and the order is deliberate.
         * Regulation 16 requires the confirmation on a durable medium, so if
         * only one of the two ever sends it has to be that one. Her alert is
         * useful and it is not the law.
         */
        await notify(orderId, 'confirmation');
        await notify(orderId, 'seller_alert');
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await db.from('orders')
          .update({ status: 'cancelled' })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending');
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await db.from('orders')
            .update({ status: 'refunded' })
            .eq('stripe_payment_intent', String(charge.payment_intent));
        }

        // No email from us. Stripe emails the customer about a refund itself,
        // and a second message saying the same thing is noise.
        break;
      }

      default:
        // Everything else is acknowledged and ignored. Returning anything but
        // a 200 makes Stripe retry an event we were never going to act on.
        break;
    }
  } catch (err) {
    // Logged and acknowledged. A 500 here means Stripe retries, and a retry of
    // something already applied is how one order becomes two.
    console.error('[webhook]', event.type, err);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
