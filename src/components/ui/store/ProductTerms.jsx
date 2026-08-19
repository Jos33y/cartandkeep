import { Link } from 'react-router';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/product-terms.module.css';

const FREE_OVER = 40;
const POSTAGE = 3.95;

/*
 * Delivery, dispatch and returns, as a specification list.
 *
 * It was three sentences that explained how generous the terms were, and the
 * explaining is the tell. Amazon writes "Returns: eligible for return within 30
 * days of receipt" and links out. John Lewis writes "Free standard UK delivery
 * on orders over 50 pounds". Apple writes "Free delivery. Free returns." A shop
 * that is sure of its terms states them once and offers the detail to anyone
 * who wants it.
 *
 * More important than the tone: the returns line was wrong on real products. It
 * promised an unconditional return on a gift set full of bath products and on a
 * four litre bottle of carpet cleaner. Returns are now a property of the
 * product, so a consumable says what is true of a consumable.
 *
 * Nothing here removes the right to reject faulty goods under the Consumer
 * Rights Act 2015, which is why that line is printed whichever class applies.
 */

const RETURNS = {
  standard: {
    value: '30 days',
    detail: 'Unused and in its packaging. We refund the price and standard delivery.',
  },
  sealed: {
    value: '30 days, while sealed',
    detail: 'On health and hygiene grounds this cannot come back once opened.',
  },
  none: {
    value: 'Not returnable',
    detail: 'A consumable, so the cooling off right does not apply once it is opened.',
  },
};

function Row({ label, value, note }) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        {value}
        {note && <span className={styles.note}>{note}</span>}
      </dd>
    </div>
  );
}

export function ProductTerms({ product, compact = false }) {
  const price = Number(product.price);
  const free = price >= FREE_OVER;
  const returns = RETURNS[product.returns_class] ?? RETURNS.standard;

  // Only what is known. A dispatch claim on a product with no dispatch figure
  // behind it is the same fault as the returns sentence, one field along.
  const dispatch = product.dispatch_days;

  return (
    <dl className={styles.terms} data-compact={compact || undefined}>
      <Row
        label="Delivery"
        value={free ? 'Free, UK' : `${formatGbp(POSTAGE)}, UK`}
        note={free ? null : `Free over ${formatGbp(FREE_OVER)}`}
      />

      {dispatch != null && (
        <Row
          label="Dispatch"
          value={dispatch === 0 ? 'Same day' : `${dispatch} working ${dispatch === 1 ? 'day' : 'days'}`}
          note={dispatch === 0 ? 'Ordered before 2pm' : null}
        />
      )}

      <Row
        label="Returns"
        value={returns.value}
        note={compact ? null : (product.returns_note ?? returns.detail)}
      />

      {!compact && (
        <div className={styles.row}>
          <dt className={styles.label}>Payment</dt>
          <dd className={styles.value}>
            Card or Apple Pay, taken by Stripe
          </dd>
        </div>
      )}

      {!compact && (
        <p className={styles.statutory}>
          Faulty or not as described? Your rights under the Consumer Rights Act
          2015 apply whatever it says above. <Link to="/legal/returns">Full terms</Link>
        </p>
      )}
    </dl>
  );
}
