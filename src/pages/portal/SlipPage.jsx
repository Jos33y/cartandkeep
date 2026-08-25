import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Receipt } from '@components/ui/shared/Receipt';
import { supabase } from '@lib/supabase';
import { PORTAL_ROUTES, portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/slip-page.module.css';

/*
 * The slip that goes in the parcel.
 *
 * Its own screen rather than a hidden block inside the orders list. Printing
 * from inside a list prints the list, and every way around that relies on a
 * rule hiding everything else on the page, which in a bundled stylesheet then
 * applies to every other page in the build. A route costs one file and cannot
 * do that.
 *
 * Same body as the customer's receipt, because a slip that disagrees with the
 * receipt in the box is how a dispute starts. What it drops is the money and
 * the returns terms: a price left in a parcel is a price shown to whoever was
 * given the gift, and a statutory notice is for the person who bought it
 * rather than for whoever is packing the box.
 */
export function SlipPage() {
  const { reference } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let live = true;

    (async () => {
      // Row level security scopes this to her shop, so there is no tenant
      // filter here doing work the policy is supposed to do.
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, reference, status, name, email, phone, address, customer_note, subtotal, delivery, total, currency, paid_at, created_at, dispatched_at, carrier, tracking_number')
        .eq('reference', String(reference).toUpperCase())
        .maybeSingle();

      if (!live) return;
      if (error || !order) return setState({ status: 'missing' });

      const { data: items } = await supabase
        .from('order_items')
        .select('id, slug, title, variant_label, unit_price, qty, line_total')
        .eq('order_id', order.id)
        .order('created_at');

      if (live) setState({ status: 'ready', order, items: items ?? [] });
    })();

    return () => { live = false; };
  }, [reference]);

  if (state.status === 'loading') {
    return <p className={styles.status} role="status">Finding the order</p>;
  }

  if (state.status === 'missing') {
    return (
      <div className={styles.page}>
        <p className={styles.status}>No order with that reference.</p>
        <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.ORDERS)}>Back to orders</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Packing slip</h1>
        <div className={styles.controls}>
          <button type="button" className={styles.primary} onClick={() => window.print()}>
            Print it
          </button>
          <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.ORDERS)}>Back to orders</Link>
        </div>
      </header>

      <div className={styles.paper}>
        <Receipt order={state.order} items={state.items} variant="slip" />
      </div>
    </div>
  );
}
