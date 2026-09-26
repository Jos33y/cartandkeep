import { Link } from 'react-router';
import { returnsTerms } from '@lib/storeConfig';
import styles from '@styles/ui/store/product-terms.module.css';

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
 * four litre bottle of carpet cleaner. Only sealed hygiene goods lose the
 * right once opened; an opened consumable is a reduced refund, not a refusal.
 *
 * Nothing here removes the right to reject faulty goods under the Consumer
 * Rights Act 2015, which is why that line is printed whichever class applies.
 */

function returnsFor(returnsClass) {
  const { days = 30, postagePaidBy } = returnsTerms();
  const post = postagePaidBy === 'customer' ? '' : ' Free return postage.';
  if (returnsClass === 'sealed') {
    return {
      value: `${days} days, while sealed`,
      detail: 'On health and hygiene grounds this cannot come back once the seal is broken, unless it is faulty.',
    };
  }
  // 'none' renders as standard: opened consumables are not an exception the regulations allow.
  return { value: `${days} days`, detail: `Change your mind for any reason.${post}` };
}

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

// Returns and payment. Delivery is said once, by the delivery card above the button.
export function ProductTerms({ product }) {
  const returns = returnsFor(product.returns_class);

  return (
    <dl className={styles.terms}>
      <Row label="Returns" value={returns.value} note={product.returns_note ?? returns.detail} />

      <div className={styles.row}>
        <dt className={styles.label}>Payment</dt>
        <dd className={styles.value}>Card or Apple Pay, taken by Stripe</dd>
      </div>

      <p className={styles.statutory}>
        Faulty or not as described? Your rights under the Consumer Rights Act
        2015 apply whatever it says above. <Link to="/legal/returns">Full terms</Link>
      </p>
    </dl>
  );
}
