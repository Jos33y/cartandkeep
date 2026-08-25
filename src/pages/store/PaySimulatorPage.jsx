import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { simulatePayment } from '@lib/checkout';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/pay-simulator.module.css';

/*
 * Where Stripe would be, while there is no Stripe key.
 *
 * Deliberately nothing like a Stripe page. No card fields, no padlock, no
 * borrowed styling. It says what it is at the top, because a convincing
 * imitation of a payment page is a thing that gets screenshotted and shown to
 * somebody out of context, and because imitating Stripe's own page is not ours
 * to do.
 *
 * The order already exists by the time anybody arrives here, written by the
 * same code that writes a real one. All this chooses is what Stripe would have
 * said next, and the answer is replayed through the real webhook rather than
 * through a copy of it, so what gets tested afterwards is production
 * behaviour: the confirmation, the seller alert, the stock coming off, the
 * agreed price being spent, the tracking page, the receipt.
 *
 * The route is unreachable in a shop that can take money. The function behind
 * it refuses unless there is no Stripe key at all.
 */
const OUTCOMES = [
  {
    key: 'paid',
    label: 'Payment succeeds',
    note: 'Marks the order paid, takes the stock off, spends an agreed price if there was one, and sends both emails.',
  },
  {
    key: 'failed',
    label: 'Payment is declined',
    note: 'Moves nothing. The order stays pending and nothing is charged, which is what a declined card actually does.',
  },
  {
    key: 'refunded',
    label: 'Paid, then refunded',
    note: 'Two events, as Stripe would send them. Use this to see a refunded receipt.',
  },
];

export function PaySimulatorPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const reference = params.get('reference') ?? '';
  const token = params.get('token') ?? '';

  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState(null);

  async function choose(outcome) {
    setBusy(outcome);
    setFailure(null);
    try {
      const result = await simulatePayment({ reference, token, outcome });

      // The order is read back on the other side, so a success that did not move
      // anything says so here rather than sending somebody to an unpaid page
      // wondering which of the two lied.
      if (outcome !== 'failed' && result?.status !== 'paid' && result?.status !== 'refunded') {
        throw new Error(`The webhook accepted the event but the order is still ${result?.status ?? 'unknown'}.`);
      }

      /*
       * Where Stripe would have sent them.
       *
       * Success and refund both go to the order, because a refunded order is
       * still an order and the page has to show that state. A decline goes
       * back to the basket, which is the cancel URL a real session carries.
       */
      if (outcome === 'failed') navigate(STORE_ROUTES.CART);
      else navigate(`/order/${reference}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setFailure(err.message);
      setBusy(null);
    }
  }

  if (!reference || !token) {
    return (
      <section className={styles.page}>
        <Head title="Payment" description="Payment." path="/pay/simulate" noindex />
        <p className={styles.body}>There is no order on this link.</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Head title="Payment" description="Payment." path="/pay/simulate" noindex />

      <p className={styles.flag}>Test mode. No money moves.</p>

      <h1 className={styles.title}>Stand in for Stripe</h1>
      <p className={styles.body}>
        Order <span className={styles.ref}>{reference}</span> has been written
        and is waiting to hear what happened. Choose what Stripe would have
        said. Everything after this point is the real thing.
      </p>

      <ul className={styles.options}>
        {OUTCOMES.map((o) => (
          <li key={o.key}>
            <button
              type="button"
              className={styles.option}
              disabled={Boolean(busy)}
              onClick={() => choose(o.key)}
            >
              <span className={styles.optionLabel}>
                {busy === o.key ? 'Replaying' : o.label}
              </span>
              <span className={styles.optionNote}>{o.note}</span>
            </button>
          </li>
        ))}
      </ul>

      {failure && <p className={styles.error} role="alert">{failure}</p>}
    </section>
  );
}
