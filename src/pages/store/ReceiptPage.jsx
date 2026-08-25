import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { Receipt } from '@components/ui/shared/Receipt';
import { fetchOrder } from '@lib/checkout';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/receipt-page.module.css';

/*
 * The receipt, kept.
 *
 * Reached with the order reference and the token the confirmation carried, so
 * there is no new secret and no account. It reads the order as it stands
 * rather than as it was, which is the whole argument for a page over an
 * emailed PDF: the same link says dispatched next week and refunded if a
 * refund goes through.
 *
 * Not indexed. It is somebody's address and what they spent.
 */
export function ReceiptPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    fetchOrder(reference, token)
      .then((data) => setState({ status: 'ready', ...data }))
      .catch((e) => setState({ status: 'error', error: e.message }));
  }, [reference, token]);

  if (state.status === 'loading') {
    return (
      <section className={styles.page}>
        <Head title="Receipt" description="Receipt." path="/receipt" noindex />
        <p className={styles.status} role="status">Finding the order</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className={styles.page}>
        <Head title="Receipt" description="Receipt." path="/receipt" noindex />
        <h1 className={styles.title}>We cannot find that order</h1>
        <p className={styles.body}>
          The link in your confirmation email is the one that works. If it has
          gone, look the order up with the reference and the address you
          ordered with.
        </p>
        <Link className={styles.ghost} to={STORE_ROUTES.ORDER_LOOKUP}>Find an order</Link>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Head title={`Receipt ${state.order.reference}`} description="Receipt." path="/receipt" noindex />

      <Receipt order={state.order} items={state.items} />

      {/* Below the paper, and gone when it prints. */}
      <div className={styles.controls}>
        <button type="button" className={styles.primary} onClick={() => window.print()}>
          Print this receipt
        </button>
        <Link
          className={styles.ghost}
          to={`/order/${state.order.reference}?token=${encodeURIComponent(token)}`}
        >
          Track it
        </Link>
      </div>

      <p className={styles.keep}>
        Keep this link. It is the receipt, and it stays right as the order moves.
      </p>
    </section>
  );
}
