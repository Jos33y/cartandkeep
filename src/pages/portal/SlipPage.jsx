import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import '@fontsource-variable/archivo/wdth.css';
import { Receipt } from '@components/ui/shared/Receipt';
import { Icon } from '@components/ui/icons';
import { supabase } from '@lib/supabase';
import { loadStoreConfig } from '@lib/storeConfig';
import { stampFor, usePrintName } from '@hooks/usePrintName';
import { PORTAL_ROUTES, portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/slip-page.module.css';

/*
 * The print desk.
 *
 * The packing slip and the receipt are two copies of one till roll, and this
 * is where she prints either or both. A normal order defaults to both, so a
 * receipt goes in the box. A gift cannot print both: the receipt says what the
 * buyer paid and the box goes to somebody else, so the choice is switched off
 * and says why, rather than trusting her to remember at the printer.
 *
 * The papers are drawn twice: once on the desk to look at, once in a root of
 * their own that is the only thing on the page when it prints, so the portal's
 * layout can never add a blank sheet or push a receipt onto a second page.
 */

const CHOICES = [
  { id: 'slip', label: 'Packing slip' },
  { id: 'receipt', label: 'Receipt' },
  { id: 'both', label: 'Both' },
];
const REMEMBER = 'ck.portal.print';
const PRINT_LABEL = { slip: 'Print slip', receipt: 'Print receipt', both: 'Print both' };

const remembered = () => {
  try { return CHOICES.some((c) => c.id === localStorage.getItem(REMEMBER)) ? localStorage.getItem(REMEMBER) : null; } catch { return null; }
};
const firstOf = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'the buyer';

const ORDER_FIELDS = 'id, reference, status, name, email, address, customer_note, subtotal, delivery, total, currency, paid_at, created_at, dispatched_at, carrier, tracking_number, is_gift, recipient_name, gift_message';

function useOrderToPrint(reference) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    (async () => {
      // Row level security scopes this to her shop, so there is no tenant filter doing the policy's job.
      const [{ data: order, error }] = await Promise.all([
        supabase.from('orders').select(ORDER_FIELDS).eq('reference', String(reference).toUpperCase()).maybeSingle(),
        // The receipt reads her return days, postage and trading details from the shop's settings, which the portal does not otherwise load.
        loadStoreConfig(),
      ]);
      if (!live) return;
      if (error || !order) { setState({ status: 'missing' }); return; }
      const { data: items } = await supabase
        .from('order_items')
        .select('id, title, variant_label, qty, unit_price, line_total, image_url')
        .eq('order_id', order.id)
        .order('created_at');
      if (live) setState({ status: 'ready', order, items: items ?? [] });
    })();
    return () => { live = false; };
  }, [reference]);
  return state;
}

// What to look at twice before the box is closed, from the order itself.
function checks(order, items, papers) {
  const out = [];
  items.filter((i) => Number(i.qty) > 1).forEach((i) => out.push({ key: `q${i.id}`, text: <><b>{i.qty} x</b> {i.title}</> }));
  if (order.is_gift && order.gift_message) out.push({ key: 'm', text: <>Their message is printed on the slip: <q>{order.gift_message}</q></> });
  if (order.customer_note) out.push({ key: 'n', text: <>Delivery note: <q>{order.customer_note}</q></> });
  if (order.is_gift && papers.includes('receipt')) {
    out.push({ key: 'g', warn: true, text: <>This receipt shows what {firstOf(order.name)} paid. It is for {firstOf(order.name)}, not for the box.</> });
  }
  return out;
}

function Papers({ order, items, papers, className = '' }) {
  return (
    <div className={`${styles.papers} ${className}`}>
      {papers.map((p) => (
        <div key={p} className={styles.paper}>
          <Receipt order={order} items={items} variant={p === 'slip' ? 'slip' : 'customer'} />
        </div>
      ))}
    </div>
  );
}

export function SlipPage() {
  const { reference } = useParams();
  const state = useOrderToPrint(reference);
  const [choice, setChoice] = useState(() => remembered() ?? 'both');

  const order = state.order;
  const gift = Boolean(order?.is_gift);
  const effective = gift && choice === 'both' ? 'slip' : choice;
  const papers = effective === 'both' ? ['slip', 'receipt'] : [effective];

  const who = order ? (order.recipient_name || order.name || '') : '';
  const kind = { slip: 'Packing slip', receipt: 'Receipt', both: 'Packing slip and receipt' }[effective];
  // Saved as "Packing slip CK-3HCV-AB7M Ada Friend 2026-09-28 18-34", so a folder of them sorts and says whose box each is.
  const fileName = order
    ? `${kind} ${order.reference} ${effective === 'receipt' ? order.name ?? '' : who} ${stampFor(order.paid_at ?? order.created_at)}`.replace(/\s+/g, ' ').trim()
    : null;
  usePrintName(fileName);

  function pick(id) {
    setChoice(id);
    try { localStorage.setItem(REMEMBER, id); } catch { /* private mode: the choice lasts the visit */ }
  }

  if (state.status === 'loading') return <p className={styles.status} role="status">Finding the order</p>;

  if (state.status === 'missing') {
    return (
      <div className={styles.page}>
        <p className={styles.status}>No order with that reference.</p>
        <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.ORDERS)}>Back to orders</Link>
      </div>
    );
  }

  const { items } = state;
  const toCheck = checks(order, items, papers);
  const sheets = papers.length;

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.ORDERS)}>
          <Icon name="IconCaret" width="14" height="14" className={styles.back} />Orders
        </Link>
        <div className={styles.which}>
          <span className={styles.ref} data-num>{order.reference}</span>
          <span className={styles.for}>{gift ? `A gift for ${who}, from ${order.name}` : `For ${who}`}</span>
        </div>
        <button type="button" className={styles.primary} onClick={() => window.print()}>
          <Icon name="IconNote" width="16" height="16" />{PRINT_LABEL[effective]}
        </button>
      </header>

      <div className={styles.desk}>
        <aside className={styles.panel}>
          <div className={styles.block}>
            <h2 className={styles.panelHead}>What to print</h2>
            <div className={styles.choose} role="radiogroup" aria-label="What to print">
              {CHOICES.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={effective === c.id}
                  className={styles.option} disabled={gift && c.id === 'both'} onClick={() => pick(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            {gift && <p className={styles.why}>Both is off for a gift. The receipt shows what {firstOf(order.name)} paid, so it stays out of the box.</p>}
          </div>

          <div className={styles.block}>
            <h2 className={styles.panelHead}>Before you print</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Prints on</dt>
                <dd>{sheets} {sheets === 1 ? 'sheet' : 'sheets'} of A4{sheets > 1 ? ': the slip, then the receipt' : ''}</dd>
              </div>
              <div>
                <dt>Saves as</dt>
                <dd className={styles.file} data-num>{fileName}.pdf</dd>
              </div>
              {papers.includes('receipt') && (
                <div>
                  <dt>The receipt says</dt>
                  <dd>
                    {order.dispatched_at
                      ? `Dispatched${order.carrier ? ` with ${order.carrier}` : ''}${order.tracking_number ? `, tracking ${order.tracking_number}` : ''}.`
                      : 'Confirmed. Printed after you mark it dispatched, it carries the carrier and tracking number.'}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className={styles.block}>
            <h2 className={styles.panelHead}>Look twice before closing the box</h2>
            {toCheck.length ? (
              <ul className={styles.checks}>
                {toCheck.map((c) => <li key={c.key} data-warn={c.warn || undefined}>{c.text}</li>)}
              </ul>
            ) : (
              <p className={styles.quiet}>Nothing unusual in this one.</p>
            )}
          </div>
        </aside>

        <Papers order={order} items={items} papers={papers} />
      </div>

      {createPortal(
        <div className={styles.printRoot}>
          {papers.map((p) => (
            <div key={p} className={styles.printPage}>
              <Papers order={order} items={items} papers={[p]} className={styles.printPapers} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
