import { useState } from 'react';
import { LockIcon } from '@components/ui/store/icons';
import { storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/payment-marks.module.css';

const NAMES = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', 'apple-pay': 'Apple Pay', 'google-pay': 'Google Pay' };
const DEFAULT_MARKS = ['visa', 'mastercard', 'apple-pay'];

// A mark whose file is missing drops out of the row rather than showing a broken image.
function Mark({ id }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <li className={styles.chip}>
      <img src={`/payment/${id}.svg`} alt={NAMES[id] ?? id} loading="lazy" onError={() => setGone(true)} />
    </li>
  );
}

// The accepted marks, from settings where a shop has set them, and who takes the payment.
export function PaymentMarks() {
  const [stripe, setStripe] = useState(true);
  const marks = storeConfig().payment?.marks ?? DEFAULT_MARKS;

  return (
    <div className={styles.payment}>
      <ul className={styles.marks} aria-label="Ways to pay">
        {marks.map((id) => <Mark key={id} id={id} />)}
      </ul>
      <p className={styles.secure}>
        <LockIcon size={14} />
        <span>Secure checkout by</span>
        {stripe
          ? <img className={styles.stripe} src="/payment/stripe.svg" alt="Stripe" onError={() => setStripe(false)} />
          : <span className={styles.stripeText}>Stripe</span>}
      </p>
    </div>
  );
}
