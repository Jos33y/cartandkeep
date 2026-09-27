import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Logo } from '@components/ui/shared/Logo';
import { Icon } from '@components/ui/icons';
import { supabase } from '@lib/supabase';
import { useTenant } from '@hooks/useTenant';
import { PORTAL_ROUTES, portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/slip-page.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric',
}) : '');

// Goes in the box, so it is read by whoever opens it, often not the buyer: no prices anywhere.
// Her returns terms in her words: the days she set, and who pays the postage back.
function returnsLine(returns) {
  const days = Number(returns?.days) || 14;
  return returns?.postage_paid_by === 'customer'
    ? `Not right? You have ${days} days to change your mind. Return postage is yours to pay unless it arrived faulty.`
    : `Not right? You have ${days} days to change your mind and we pay the return postage.`;
}

export function PackingSlip({ order, items, returns }) {
  const a = order.address ?? {};
  const lines = [a.line1, a.line2, a.city, a.postcode].filter(Boolean);
  const count = items.reduce((n, i) => n + Number(i.qty ?? 0), 0);

  return (
    <article className={styles.sheet}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <Logo size={30} />
          <span className={styles.kind}>Packing slip</span>
        </div>
        <div className={styles.ref}>
          <span className={styles.refLabel}>Order</span>
          <span className={styles.refValue} data-num>{order.reference}</span>
          <span className={styles.refDate}>{day(order.paid_at ?? order.created_at)}</span>
        </div>
      </header>

      <section className={styles.addresses}>
        <div className={styles.to}>
          <span className={styles.label}>Deliver to</span>
          <p className={styles.toName}>{order.name}</p>
          {lines.map((l) => <p key={l}>{l}</p>)}
        </div>
        {order.customer_note && (
          <div className={styles.note}>
            <span className={styles.label}>Delivery note</span>
            <p>{order.customer_note}</p>
          </div>
        )}
      </section>

      <section>
        <div className={styles.listHead}>
          <span className={styles.label}>In this parcel</span>
          <span className={styles.label}><span data-num>{count}</span> {count === 1 ? 'item' : 'items'}</span>
        </div>
        <ol className={styles.items}>
          {items.map((it) => (
            <li key={it.id} className={styles.item}>
              <span className={styles.box} aria-hidden="true" />
              <span className={styles.qty} data-num>{it.qty}</span>
              {thumb(it.image_url) ? <img className={styles.pic} src={thumb(it.image_url)} alt="" /> : <span className={styles.pic} />}
              <span className={styles.title}>
                {it.title}
                {it.variant_label && <span className={styles.variant}>{it.variant_label}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className={styles.packed}>
          <span>Packed by</span><i />
          <span>Checked</span><i />
        </div>
      </section>

      <footer className={styles.foot}>
        <p className={styles.thanks}>Thank you for shopping with us.</p>
        <p>
          {returnsLine(returns)}{' '}
          Keep this slip and quote <b data-num>{order.reference}</b> when you get in touch.
        </p>
      </footer>
    </article>
  );
}

export function SlipPage() {
  const { reference } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const tenant = useTenant();

  useEffect(() => {
    let live = true;
    (async () => {
      // Row level security scopes this to her shop, so there is no tenant filter doing the policy's job.
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, reference, status, name, address, customer_note, paid_at, created_at, dispatched_at')
        .eq('reference', String(reference).toUpperCase())
        .maybeSingle();
      if (!live) return;
      if (error || !order) return setState({ status: 'missing' });
      const { data: items } = await supabase
        .from('order_items')
        .select('id, title, variant_label, qty, image_url')
        .eq('order_id', order.id)
        .order('created_at');
      if (live) setState({ status: 'ready', order, items: items ?? [] });
    })();
    return () => { live = false; };
  }, [reference]);

  if (state.status === 'loading' || tenant === undefined) return <p className={styles.status} role="status">Finding the order</p>;

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
      <header className={styles.bar}>
        <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.ORDERS)}>
          <Icon name="IconCaret" width="14" height="14" className={styles.back} />Orders
        </Link>
        <p className={styles.barNote}>What goes in the box. No prices on it, so it is safe for a gift.</p>
        <button type="button" className={styles.primary} onClick={() => window.print()}>
          <Icon name="IconNote" width="16" height="16" />Print
        </button>
      </header>
      <div className={styles.desk}>
        <PackingSlip order={state.order} items={state.items} returns={tenant?.store?.returns} />
      </div>
    </div>
  );
}
