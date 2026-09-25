import { Logo } from '@components/ui/shared/Logo';
import { formatGbp } from '@utils/formatGbp';
import { storeConfig, returnsTerms } from '@lib/storeConfig';
import { legalTrader, traderIdentity } from '@data/legal';
import styles from '@styles/ui/shared/receipt.module.css';

/*
 * One receipt, two copies.
 *
 * The customer's, reached with the order token and kept as the record of the
 * purchase, and the packing slip she prints to go in the parcel. Same body,
 * because a slip that disagrees with the receipt in the box is how a dispute
 * starts, and the differences are only what each side needs: the legal returns
 * block belongs to the customer's copy, and the address on a slip is the one
 * the parcel is going to.
 *
 * It reads the order as it stands rather than as it was at the moment of
 * payment. Somebody who keeps this link sees dispatched next week and refunded
 * if a refund goes through, which is the only reason a receipt page is worth
 * having over an emailed PDF.
 *
 * Colour appears twice and nowhere else: the payment stamp and the one word
 * naming where the order has got to. Everything else is ink on white, because
 * a receipt that is decorated stops reading as a record.
 */

const stamps = {
  paid: { word: 'PAID IN FULL', tone: 'paid' },
  pending: { word: 'AWAITING PAYMENT', tone: 'pending' },
  refunded: { word: 'REFUNDED', tone: 'refunded' },
  cancelled: { word: 'CANCELLED', tone: 'cancelled' },
};

/*
 * Where it has got to, and nothing the database does not know.
 *
 * There is no delivered state on an order, so this does not claim one. A
 * receipt that says delivered because a courier's page said so, when nothing
 * on the shop recorded it, is a receipt that will one day be wrong in front of
 * somebody holding an undelivered parcel.
 */
function progress(order) {
  if (order.status === 'cancelled') return { word: 'Cancelled', tone: 'quiet' };
  if (order.status === 'refunded') return { word: 'Refunded', tone: 'refunded' };
  if (order.dispatched_at) return { word: 'Dispatched', tone: 'sent' };
  if (order.status === 'paid') return { word: 'Confirmed', tone: 'ink' };
  return { word: 'Not paid yet', tone: 'pending' };
}

const stamp = (l) => new Date(l).toLocaleString('en-GB', {
  timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

const day = (l) => new Date(l).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
});

export function Receipt({ order, items = [], variant = 'customer' }) {
  const slip = variant === 'slip';
  const mark = stamps[order.status] ?? stamps.pending;
  const state = progress(order);

  const address = order.address ?? {};
  const lines = [order.name, address.line1, address.line2, address.city, address.postcode]
    .filter(Boolean);

  return (
    <article className={styles.receipt} data-variant={variant}>
      <header className={styles.head}>
        <Logo size={28} />
        <p className={styles.site}>{storeConfig().domain}</p>
        {slip && <p className={styles.slipLabel}>Packing slip</p>}
      </header>

      <div className={styles.rule} />

      <dl className={styles.meta}>
        <div><dt>Order</dt><dd className={styles.mono}>{order.reference}</dd></div>
        <div><dt>Placed</dt><dd className={styles.mono}>{stamp(order.created_at)}</dd></div>
        {order.paid_at && (
          <div><dt>Paid</dt><dd className={styles.mono}>{stamp(order.paid_at)}</dd></div>
        )}
        {order.dispatched_at && (
          <div><dt>Sent</dt><dd className={styles.mono}>{day(order.dispatched_at)}</dd></div>
        )}
      </dl>

      <div className={styles.rule} />

      <ul className={styles.lines}>
        {items.map((item, i) => (
          <li key={item.id ?? `${item.slug}-${i}`} className={styles.line}>
            <p className={styles.lineTitle}>
              {item.title}
              {item.variant_label && <span className={styles.variant}> · {item.variant_label}</span>}
            </p>
            <p className={styles.lineFigures}>
              <span className={styles.mono}>{item.qty} @ {formatGbp(item.unit_price)}</span>
              <span className={styles.mono}>{formatGbp(item.line_total)}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className={styles.rule} />

      {/* Money, and only where a slip has any business showing it. A packing
          slip with a total on it is a price left in the parcel of somebody who
          was given a gift. */}
      {!slip && (
        <>
          <dl className={styles.totals}>
            <div><dt>Subtotal</dt><dd className={styles.mono}>{formatGbp(order.subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd className={styles.mono}>{formatGbp(order.delivery)}</dd></div>
            <div className={styles.grand}>
              <dt>Total {order.currency ?? 'GBP'}</dt>
              <dd className={styles.mono}>{formatGbp(order.total)}</dd>
            </div>

            {/* A refund does not rewrite what was charged. The lines above
                stand and this sits underneath, because a receipt that quietly
                becomes zero is not a record of anything. */}
            {order.status === 'refunded' && (
              <div className={styles.refund}>
                <dt>Refunded</dt>
                <dd className={styles.mono}>-{formatGbp(order.total)}</dd>
              </div>
            )}
          </dl>

          <div className={styles.stampWrap}>
            <p className={styles.stamp} data-tone={mark.tone}>{mark.word}</p>
          </div>
        </>
      )}

      <dl className={styles.meta}>
        {!slip && <div><dt>Method</dt><dd>Card via Stripe</dd></div>}
        <div>
          <dt>Status</dt>
          <dd className={styles.state} data-tone={state.tone}>{state.word}</dd>
        </div>
        {order.carrier && (
          <div><dt>Carrier</dt><dd>{order.carrier}</dd></div>
        )}
        {order.tracking_number && (
          <div><dt>Tracking</dt><dd className={styles.mono}>{order.tracking_number}</dd></div>
        )}
      </dl>

      <div className={styles.rule} />

      <address className={styles.address}>
        {slip && <p className={styles.addressHead}>Send to</p>}
        {lines.map((l) => <p key={l}>{l}</p>)}
      </address>

      {order.customer_note && (
        <>
          <div className={styles.rule} />
          <p className={styles.note}>
            <span className={styles.noteHead}>They asked: </span>
            {order.customer_note}
          </p>
        </>
      )}

      <div className={styles.rule} />

      {/* The customer's copy carries the terms. A slip does not, because it is
          an instruction to a person packing a box rather than a document
          anybody has rights under. */}
      {!slip ? (
        <div className={styles.terms}>
          {order.status === 'refunded' ? (
            <p>Refunded to the card it was paid with. It usually shows within three working days.</p>
          ) : (
            <p>
              {returnsTerms().days ?? 30} days to change your mind.
              {returnsTerms().postagePaidBy === 'customer'
                ? ' Return postage is yours to pay unless it is faulty.'
                : ' We pay the return postage.'}
            </p>
          )}
          <p>Nothing here removes your statutory rights.</p>
          {/* Receipts must carry a sole trader's own name and address. Companies Act 2006, s. 1202. */}
          {traderIdentity() && legalTrader().address && (
            <p>{traderIdentity()}, {legalTrader().address}.</p>
          )}
        </div>
      ) : (
        <p className={styles.terms}>
          {items.reduce((n, i) => n + Number(i.qty ?? 0), 0)} items in this parcel.
        </p>
      )}

      <p className={styles.foot}>* * *</p>
    </article>
  );
}
