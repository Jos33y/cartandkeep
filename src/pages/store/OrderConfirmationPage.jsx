import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import {
  ArrowRightIcon, CheckIcon, ClockIcon, FilesIcon, GiftIcon, MailIcon, ReturnIcon, SearchIcon, StarIcon, VanIcon,
} from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { trackPurchase } from '@lib/analytics';
import { fetchOrder } from '@lib/checkout';
import { rememberOrder } from '@lib/myOrders';
import { Conversation } from '@components/ui/store/Conversation';
import { EmptyHero } from '@components/ui/store/EmptyHero';
import { OrderJourney, orderDates, windowText } from '@components/ui/store/OrderJourney';
import { ParcelLabel } from '@components/ui/store/checkout/ParcelLabel';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/order-confirmation.module.css';

/*
 * After Stripe, and every visit after that.
 *
 * Reaching this page is not proof of payment. Somebody can type the URL, and
 * somebody can pay and close the tab before it loads. The status shown here is
 * whatever the webhook has recorded, which is why an order can legitimately
 * read "confirming" for a few seconds.
 *
 * It is the tracking page as much as the thank-you page: the same address the
 * confirmation email links to, so it leads with where the parcel has got to,
 * on the three stops the checkout label promised, and keeps the label itself
 * beside it so the address that was checked is the one on show.
 *
 * The basket is emptied only once the order actually reads as paid.
 */
export function OrderConfirmationPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { clearIfPaid } = useBasket();

  const [state, setState] = useState({ status: 'loading', order: null, items: [] });
  const [tries, setTries] = useState(0);
  const counted = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reference || !token) {
      setState({ status: 'notfound', order: null, items: [] });
      return undefined;
    }
    let live = true;

    fetchOrder(reference, token)
      .then(({ order, items }) => {
        if (!live) return;
        setState({ status: 'ready', order, items });
        // Kept on this device, so "Track an order" can show it without the email.
        rememberOrder(order, items, token);
        if (order.status === 'paid') {
          clearIfPaid(order.reference);
          if (!counted.current) {
            counted.current = true;
            trackPurchase(order);
          }
        }
      })
      .catch(() => { if (live) setState({ status: 'notfound', order: null, items: [] }); });

    return () => { live = false; };
  }, [reference, token, tries, clearIfPaid]);

  // The webhook usually lands before this page does, and occasionally does not.
  useEffect(() => {
    if (state.status !== 'ready' || state.order?.status !== 'pending' || tries >= 3) return undefined;
    const t = setTimeout(() => setTries((n) => n + 1), 2000);
    return () => clearTimeout(t);
  }, [state, tries]);

  if (state.status === 'loading') {
    return (
      <section className={styles.page}>
        <Head title="Your order" description="Your order." path="/order" noindex />
        <div className={styles.loading} aria-busy="true"><span /><span /><span /></div>
        <p className="visually-hidden" role="status">Finding your order</p>
      </section>
    );
  }

  if (state.status === 'notfound') {
    return (
      <section className={styles.page}>
        <Head title="Order not found" description="Order not found." path="/order" noindex />
        <EmptyHero
          Icon={SearchIcon}
          kicker="Your order"
          title="We cannot find that order"
          cta={{ to: STORE_ROUTES.ORDER_LOOKUP, label: 'Find it with your reference' }}
          secondary={{ to: STORE_ROUTES.HOME, label: 'Back to the shop' }}
        >
          <p>The link may be incomplete. The one in your confirmation email is the whole thing, or look the order up with its reference and the email you ordered with.</p>
        </EmptyHero>
      </section>
    );
  }

  const { order, items } = state;
  const paid = order.status === 'paid';
  const settling = order.status === 'pending' && tries < 3;
  const sent = Boolean(order.dispatched_at);
  const refunded = order.status === 'refunded';
  const gift = Boolean(order.is_gift);
  const dates = orderDates(order);
  const firstOf = (name) => String(name ?? '').trim().split(/\s+/)[0] || null;
  const them = firstOf(order.recipient_name) ?? 'them';

  const stage = refunded ? { Icon: ReturnIcon, word: 'Refunded', title: 'This order has been refunded' }
    : sent ? { Icon: VanIcon, word: 'On its way', title: gift ? `On its way to ${them}` : 'Your order is on its way' }
      : paid ? { Icon: CheckIcon, word: 'Paid', title: 'Thank you, that is done' }
        : settling ? { Icon: ClockIcon, word: 'Confirming payment', title: 'Just confirming with Stripe' }
          : { Icon: ClockIcon, word: 'Not paid yet', title: 'This order has not been paid' };

  const receiptPath = `/receipt/${order.reference}?token=${encodeURIComponent(token)}`;
  const reviewPath = `${STORE_ROUTES.REVIEW.replace(':reference', order.reference)}?token=${encodeURIComponent(token)}`;

  // The parcel label, as it was checked at checkout, now with what was paid.
  const address = {
    line1: order.address?.line1 ?? '',
    line2: order.address?.line2 ?? '',
    city: order.address?.city ?? '',
    postcode: order.address?.postcode ?? '',
  };
  const lines = items.map((i) => ({
    id: `${i.slug ?? i.title}`,
    variantId: i.variant_label ?? null,
    title: i.title,
    variantLabel: i.variant_label ?? null,
    image_url: i.image_url,
    qty: Number(i.qty),
    price: Number(i.unit_price ?? (Number(i.line_total) / Number(i.qty || 1))),
  }));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const figures = {
    subtotal: Number(order.subtotal),
    delivery: Number(order.delivery),
    total: Number(order.total),
    toFree: 0,
    freeOver: 0,
    totalLabel: refunded ? 'Refunded' : paid ? 'Paid' : 'To pay',
  };

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(order.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* the reference is on screen to copy by hand */ }
  }

  return (
    <section className={styles.page}>
      <Head title={`Order ${order.reference}`} description="Your order." path={`/order/${order.reference}`} noindex />

      <header className={styles.hero} data-stage={refunded ? 'refunded' : sent ? 'sent' : paid ? 'paid' : 'pending'}>
        <div className={styles.heroTop}>
          <div>
            <p className={styles.kicker}><stage.Icon size={16} /> {stage.word}</p>
            <h1 className={`${styles.title} wide`}>{stage.title}</h1>
          </div>
          <button type="button" className={styles.reference} onClick={copyReference} aria-label={`Order reference ${order.reference}. Copy it`}>
            <span className={styles.referenceLabel}>{copied ? 'Copied' : 'Reference'}</span>
            <span className={styles.referenceCode} data-price>{order.reference}</span>
            {copied ? <CheckIcon size={15} /> : <FilesIcon size={15} />}
          </button>
        </div>

        {(paid || sent) && !refunded && (
          <div className={styles.journey}>
            <OrderJourney order={order} />
          </div>
        )}
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          {settling && (
            <p className={styles.settling} role="status">
              Stripe has taken the payment and we are waiting for the confirmation to reach us. This page updates on its own. Nothing is wrong and you do not need to pay again.
            </p>
          )}

          {!paid && !settling && !refunded && (
            <p className={styles.settling}>
              We have not had a payment confirmation for this order. If you believe you have paid, write to support@cartandkeep.com with the reference above and do not pay again.
            </p>
          )}

          {sent && !refunded && (
            <section className={styles.panel} data-tone="sage" aria-labelledby="order-sent">
              <h2 id="order-sent" className={styles.panelHead}><VanIcon size={18} /> {dates.due ? `Due ${gift ? `with ${them}` : 'with you'} now` : `Arriving ${windowText(dates.from, dates.to)}`}</h2>
              <p className={styles.panelBody}>
                It left us {order.carrier ? `with ${order.carrier} ` : ''}and should arrive {windowText(dates.from, dates.to)}.
                {' '}If it has not turned up a few working days after that, ask below and we will chase it.
              </p>
              {order.tracking_number && (
                <p className={styles.tracking}>Tracking number <strong data-price>{order.tracking_number}</strong></p>
              )}
              {order.tracking_url && (
                <a className={styles.primary} href={order.tracking_url} target="_blank" rel="noreferrer noopener">
                  Follow it with {order.carrier || 'the carrier'} <ArrowRightIcon size={16} />
                </a>
              )}
            </section>
          )}

          {paid && !sent && !refunded && (
            <section className={styles.panel} aria-labelledby="order-next">
              <h2 id="order-next" className={styles.panelHead}>What happens now</h2>
              <ul className={styles.next}>
                <li>
                  <MailIcon size={18} />
                  <span>A confirmation is on its way to <strong>{order.email}</strong>. If it is not there in ten minutes, check the spam folder.</span>
                </li>
                <li>
                  <VanIcon size={18} />
                  <span>We pack on weekday mornings. Yours should leave us <strong>{formatDay(dates.leaves, dates.todayIso)}</strong>, and a second email with the tracking link follows when it does.</span>
                </li>
                {gift && (
                  <li>
                    <GiftIcon size={18} />
                    <span>
                      A gift, so no prices anywhere in the box{order.gift_message ? ', and your message on the slip' : ''}.
                      {order.notify_recipient ? ` We will email ${them} when it leaves us, without saying what it is.` : ` We will not contact ${them}.`}
                    </span>
                  </li>
                )}
              </ul>
              {gift && order.gift_message && <p className={styles.giftMessage}>{order.gift_message}</p>}
            </section>
          )}

          {refunded && (
            <section className={styles.panel} aria-labelledby="order-refund">
              <h2 id="order-refund" className={styles.panelHead}><ReturnIcon size={18} /> The money has gone back</h2>
              <p className={styles.panelBody}>
                It has gone back to the card you paid with. Refunds usually show within five working days, depending on your bank. If it has not appeared by then, ask below with the reference.
              </p>
            </section>
          )}

          {/* Once it should have arrived: the only place a rating can come from is somebody who received it. */}
          {dates.due && !refunded && (
            <section className={styles.panel} data-tone="warm" aria-labelledby="order-review">
              <h2 id="order-review" className={styles.panelHead}><StarIcon size={18} /> {gift ? `Has it reached ${them}?` : 'Has it arrived?'}</h2>
              <p className={styles.panelBody}>
                Tell other shoppers what you think of it. It takes a minute, and the rating on the product page only ever comes from people who bought.
              </p>
              <Link className={styles.secondary} to={reviewPath}>Rate what you bought <ArrowRightIcon size={16} /></Link>
            </section>
          )}

          {(paid || sent || refunded) && (
            <div className={styles.conversation}>
              <Conversation
                lookup={{ reference: order.reference, token }}
                heading="Ask about this order"
                opener="Something not right, or a question about when it arrives? Write it here and it reaches the shop directly. A person reads every one of these."
              />
            </div>
          )}

          <div className={styles.actions}>
            <Link className={styles.secondary} to={receiptPath}>See or print the receipt</Link>
            <Link className={styles.quietLink} to={STORE_ROUTES.HOME}>Back to the shop</Link>
          </div>
          <p className={styles.keep}>
            This page is your order. Its link is in your confirmation email, and it stays on this device under Track an order.
          </p>
        </div>

        <div className={styles.side}>
          <ParcelLabel
            gift={gift}
            deliverTo={gift ? order.recipient_name : order.name}
            from={firstOf(order.name)}
            address={address}
            lines={lines}
            figures={figures}
            arrival={null}
            count={count}
          />
        </div>
      </div>
    </section>
  );
}

// "today" or "Tuesday 29 September", for the sentence about when it leaves.
function formatDay(iso, todayIso) {
  if (iso === todayIso) return 'today';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
}
