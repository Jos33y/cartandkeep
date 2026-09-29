import { Logo } from '@components/ui/shared/Logo';
import { formatGbp } from '@utils/formatGbp';
import { storeConfig, returnsTerms, supportEmail } from '@lib/storeConfig';
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

/*
 * The packing slip: the receipt's second copy, for whoever opens the box.
 *
 * Same till roll, same head, same rules and the same hand-set stamp, so the
 * two papers in one parcel are plainly from one shop. What differs is the job.
 * No money anywhere, because the box is often opened by somebody who was given
 * it. A tick list for the person packing, with any quantity over one set bold
 * so two of a thing never goes out as one. And a returns stub to tear off and
 * send back, so a returned parcel says whose it is and why before it is opened.
 */
function SlipCopy({ order, items }) {
  const gift = Boolean(order.is_gift);
  const address = order.address ?? {};
  const lines = [address.line1, address.line2, address.city, address.postcode].filter(Boolean);
  const count = items.reduce((n, i) => n + Number(i.qty ?? 0), 0);
  const terms = returnsTerms();
  const days = terms.days ?? 14;
  const tagline = storeConfig().voice?.tagline;
  const from = order.name;

  return (
    <article className={styles.receipt} data-variant="slip">
      <header className={styles.head}>
        <Logo size={28} />
        <p className={styles.site}>{storeConfig().domain}</p>
        <p className={styles.slipLabel}>Packing slip</p>
      </header>

      <div className={styles.rule} />

      <dl className={styles.meta}>
        <div><dt>Order</dt><dd className={styles.mono}>{order.reference}</dd></div>
        <div><dt>Placed</dt><dd className={styles.mono}>{day(order.paid_at ?? order.created_at)}</dd></div>
        <div><dt>For</dt><dd>{order.recipient_name || order.name}</dd></div>
        {gift && from && <div><dt>From</dt><dd>{from}</dd></div>}
      </dl>

      <div className={styles.rule} />

      <p className={styles.listHead}><span>In this parcel</span><span className={styles.mono}>{count} {count === 1 ? 'item' : 'items'}</span></p>
      <ul className={styles.ticks}>
        {items.map((item, i) => (
          <li key={item.id ?? `${item.slug}-${i}`} className={styles.tick}>
            <span className={styles.tickBox} aria-hidden="true" />
            <span className={styles.tickQty} data-many={Number(item.qty) > 1 || undefined}>{item.qty} x</span>
            <span className={styles.tickTitle}>
              {item.title}
              {item.variant_label && <span className={styles.variant}> · {item.variant_label}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.stampWrap}>
        <p className={styles.stamp} data-tone={gift ? 'gift' : 'packed'}>{gift ? 'A GIFT FOR YOU' : 'PACKED WITH CARE'}</p>
      </div>

      {gift && order.gift_message && (
        <p className={styles.giftNote}>
          <span className={styles.noteHead}>{from ? `From ${from.split(' ')[0]}:` : 'Their message:'}</span>
          <span className={styles.giftWords}>{order.gift_message}</span>
        </p>
      )}

      {order.customer_note && (
        <>
          <div className={styles.rule} />
          <p className={styles.note}><span className={styles.noteHead}>Delivery note: </span>{order.customer_note}</p>
        </>
      )}

      <div className={styles.rule} />

      <address className={styles.address}>
        <p className={styles.addressHead}>Send to</p>
        <p>{order.recipient_name || order.name}</p>
        {lines.map((l) => <p key={l}>{l}</p>)}
      </address>

      <p className={styles.signed}><span>Packed by</span><i /></p>

      {/* Cut along here: everything below goes back in the box with a return. */}
      <div className={styles.cut} aria-hidden="true"><span>&#9986;</span></div>

      <section className={styles.stub} aria-label="Returns slip">
        <p className={styles.stubHead}><span>Returns slip</span><span className={styles.mono}>{order.reference}</span></p>
        {gift ? (
          <p className={styles.stubTerms}>A gift that is not quite right? Write to us first and we will sort it out.</p>
        ) : (
          <p className={styles.stubTerms}>
            {days} days to change your mind.
            {terms.postagePaidBy === 'customer' ? ' Return postage is yours unless it arrived faulty.' : ' We pay the return postage.'}
          </p>
        )}
        <ul className={styles.reasons}>
          {['Changed my mind', 'Arrived faulty', 'Wrong item'].map((r) => (
            <li key={r}><span className={styles.tickBox} aria-hidden="true" />{r}</li>
          ))}
        </ul>
        <p className={styles.writeLine}><span>Anything else</span><i /></p>
        <p className={styles.stubTerms}>Tell us first at <b>{supportEmail()}</b>, then send it back with this slip inside.</p>
      </section>

      {tagline && <p className={styles.tagline}>{tagline}</p>}
      <p className={styles.foot}>* * *</p>
    </article>
  );
}

export function Receipt({ order, items = [], variant = 'customer' }) {
  return variant === 'slip'
    ? <SlipCopy order={order} items={items} />
    : <CustomerCopy order={order} items={items} variant={variant} />;
}

function CustomerCopy({ order, items, variant }) {
  const slip = variant === 'slip';
  const mark = stamps[order.status] ?? stamps.pending;
  const state = progress(order);

  const address = order.address ?? {};
  const lines = [order.recipient_name || order.name, address.line1, address.line2, address.city, address.postcode]
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
        {(slip || order.is_gift) && <p className={styles.addressHead}>{order.is_gift ? `A gift, sent to` : 'Send to'}</p>}
        {lines.map((l) => <p key={l}>{l}</p>)}
      </address>

      {order.is_gift && order.gift_message && (
        <>
          <div className={styles.rule} />
          <p className={styles.note}>
            <span className={styles.noteHead}>{slip ? `From ${order.name}: ` : 'Your message: '}</span>
            {order.gift_message}
          </p>
        </>
      )}

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
