import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, MailIcon, ReturnIcon, VanIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { trackPurchase } from '@lib/analytics';
import { fetchOrder } from '@lib/checkout';
import { Conversation } from '@components/ui/store/Conversation';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/order-confirmation.module.css';

/*
 * After Stripe.
 *
 * Reaching this page is not proof of payment. Somebody can type the URL, and
 * somebody can pay and close the tab before it loads. The status shown here is
 * whatever the webhook has recorded, which is why an order can legitimately
 * read "payment confirming" for a few seconds.
 *
 * The basket is emptied only once the order actually reads as paid. Clearing
 * it on arrival would lose the basket of anyone who landed here without
 * paying.
 */
export function OrderConfirmationPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { clear } = useBasket();

  const [state, setState] = useState({ status: 'loading', order: null, items: [] });
  const [tries, setTries] = useState(0);
  const counted = useRef(false);

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
        if (order.status === 'paid') {
          clear();
          // Once. The page polls three times while the webhook lands, and a
          // purchase counted on every poll is a shop that looks four times
          // busier than it is.
          if (!counted.current) {
            counted.current = true;
            trackPurchase(order);
          }
        }
      })
      .catch(() => { if (live) setState({ status: 'notfound', order: null, items: [] }); });

    return () => { live = false; };
  }, [reference, token, tries, clear]);

  // The webhook usually lands before this page does, and occasionally does
  // not. Three polls at two seconds covers the gap without turning into a
  // spinner that never stops.
  useEffect(() => {
    if (state.status !== 'ready' || state.order?.status !== 'pending' || tries >= 3) return undefined;
    const t = setTimeout(() => setTries((n) => n + 1), 2000);
    return () => clearTimeout(t);
  }, [state, tries]);

  if (state.status === 'loading') {
    return (
      <section className={styles.page}>
        <Head title="Your order" description="Your order." path="/order" noindex />
        <p className={styles.quiet}>Finding your order.</p>
      </section>
    );
  }

  if (state.status === 'notfound') {
    return (
      <section className={styles.page}>
        <Head title="Order not found" description="Order not found." path="/order" noindex />
        <h1 className={`${styles.title} wide`}>We cannot find that order</h1>
        <p className={styles.body}>
          The link may be incomplete. The one in your confirmation email is the
          whole thing, or write to support@cartandkeep.com with your reference
          and we will look it up.
        </p>
        <Link className={styles.cta} to={STORE_ROUTES.HOME}>Back to the shop</Link>
      </section>
    );
  }

  const { order, items } = state;
  const paid = order.status === 'paid';
  const settling = order.status === 'pending' && tries < 3;
  const sent = Boolean(order.dispatched_at);
  const refunded = order.status === 'refunded';

  const sentOn = sent
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'long', timeZone: 'Europe/London',
      }).format(new Date(order.dispatched_at))
    : null;

  return (
    <section className={styles.page}>
      <Head title={`Order ${order.reference}`} description="Your order." path={`/order/${order.reference}`} noindex />

      <header className={styles.head}>
        {/* An order has two facts about it, payment and dispatch, and the
            heading has to carry whichever one is newest. Somebody coming back
            a week later should not see the screen from the moment they paid. */}
        <p className={styles.eyebrow}>
          {refunded ? 'Refunded'
            : sent ? 'On its way'
            : paid ? 'Paid'
            : settling ? 'Confirming payment'
            : 'Not paid yet'}
        </p>
        <h1 className={`${styles.title} wide`}>
          {refunded ? 'This order has been refunded'
            : sent ? 'Your order is on its way'
            : paid ? 'Thank you, that is done'
            : settling ? 'Just confirming with Stripe'
            : 'This order has not been paid'}
        </h1>
        <p className={styles.reference}>
          Reference <strong data-price>{order.reference}</strong>
        </p>
      </header>

      {paid && !sent && !refunded && (
        <ul className={styles.next}>
          <li>
            <MailIcon size={19} />
            <span>
              A confirmation is on its way to <strong>{order.email}</strong>. If it
              is not there in ten minutes, check the spam folder before writing to us.
            </span>
          </li>
          <li>
            <VanIcon size={19} />
            <span>
              Ordered before 2pm on a working day, it goes out the same day. You
              get a second email with the tracking link when it leaves.
            </span>
          </li>
        </ul>
      )}

      {sent && !refunded && (
        <div className={styles.dispatch}>
          <p className={styles.dispatchLead}>
            <VanIcon size={19} />
            Sent on {sentOn}{order.carrier ? ` with ${order.carrier}` : ''}.
          </p>

          {order.tracking_number && (
            <p className={styles.trackingNumber}>
              Tracking <strong data-price>{order.tracking_number}</strong>
            </p>
          )}

          {/* Only when there is a real link. A track button that goes nowhere
              is the fault this page exists to avoid. */}
          {order.tracking_url && (
            <a className={styles.track} href={order.tracking_url} target="_blank" rel="noreferrer noopener">
              Track your parcel <ArrowRightIcon size={16} />
            </a>
          )}

          <p className={styles.dispatchNote}>
            Most parcels arrive two to three working days after they leave. If it
            has not turned up by then, write to support@cartandkeep.com with the
            reference above.
          </p>
        </div>
      )}

      {refunded && (
        <div className={styles.dispatch}>
          <p className={styles.dispatchLead}>
            <ReturnIcon size={19} />
            The money has gone back to the card you paid with.
          </p>
          <p className={styles.dispatchNote}>
            Refunds usually show within five working days, depending on your
            bank. If it has not appeared by then, write to us with the reference.
          </p>
        </div>
      )}

      {settling && (
        <p className={styles.settling}>
          Stripe has taken the payment and we are waiting for the confirmation to
          reach us. This page updates on its own. Nothing is wrong and you do not
          need to pay again.
        </p>
      )}

      {!paid && !settling && (
        <p className={styles.settling}>
          We have not had a payment confirmation for this order. If you believe
          you have paid, write to support@cartandkeep.com with the reference
          above and do not pay again.
        </p>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardHead}>What you ordered</h2>
        <ul className={styles.items}>
          {items.map((item) => (
            <li key={`${item.slug}-${item.title}`}>
              <span className={styles.thumb}>
                {item.image_url && <img src={imageAt(item.image_url, 300)} alt="" loading="lazy" />}
                <span className={styles.qty} data-price>{item.qty}</span>
              </span>
              <span className={styles.itemTitle}>
                {item.slug
                  ? <Link to={STORE_ROUTES.PRODUCT.replace(':slug', item.slug)}>{item.title}</Link>
                  : item.title}
              </span>
              <span className={styles.itemTotal} data-price>{formatGbp(item.line_total)}</span>
            </li>
          ))}
        </ul>

        <dl className={styles.figures}>
          <div><dt>Subtotal</dt><dd data-price>{formatGbp(order.subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd data-price>{Number(order.delivery) === 0 ? 'Free' : formatGbp(order.delivery)}</dd></div>
          <div className={styles.grand}>
            <dt>{refunded ? 'Refunded' : paid ? 'Paid' : 'To pay'}</dt>
            <dd data-price>{formatGbp(order.total)}</dd>
          </div>
        </dl>

        <div className={styles.address}>
          <h3 className={styles.addressHead}>Going to</h3>
          <p>
            {order.name}<br />
            {order.address?.line1}<br />
            {order.address?.line2 && <>{order.address.line2}<br /></>}
            {order.address?.city}<br />
            {order.address?.postcode}
          </p>
        </div>

        {order.customer_note && (
          <div className={styles.address}>
            <h3 className={styles.addressHead}>Your note</h3>
            <p>{order.customer_note}</p>
          </div>
        )}
      </div>

      {/* Asking about this order, in the place they already come back to.
          No separate link and no second token: the one in this page's own
          address is what opens the conversation, which is the whole of the
          one secret rule. Only once the order is real, because a page that
          has not found a payment is not a page to start a conversation on. */}
      {paid && (
        <Conversation
          lookup={{ reference: order.reference, token }}
          heading="Ask about this order"
          opener="Something not right, or a question about when it arrives? Write it here and it reaches the shop directly. A person reads every one of these."
        />
      )}

      <p className={styles.keep}>
        Keep this page. The link works for as long as the order does, and the
        reference is what we need if you write to us about it.
      </p>

      <div className={styles.actions}>
        <Link className={styles.cta} to={STORE_ROUTES.HOME}>
          Back to the shop <ArrowRightIcon size={16} />
        </Link>

        {/* A control rather than a link in the caption above, where it was
            faint grey inside faint grey and rendering invisibly. The receipt
            takes the same token, so it is nothing new to keep. */}
        <Link
          className={styles.secondary}
          to={`/receipt/${order.reference}?token=${encodeURIComponent(token)}`}
        >
          See or print the receipt
        </Link>
      </div>
    </section>
  );
}
