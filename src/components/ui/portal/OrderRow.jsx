import { useState } from 'react';
import { Link } from 'react-router';
import { PORTAL_ROUTES, portalPath } from '@utils/constants';
import { formatGbp } from '@utils/formatGbp';
import { CARRIERS } from '@utils/constants';
import { isToSend } from '@hooks/useOrders';
import styles from '@styles/ui/portal/order-row.module.css';

// A button that says Mark dispatched produces a state that says Dispatched.
const STATE = {
  to_send: 'To send',
  sent: 'Dispatched',
  refunded: 'Refunded',
  pending: 'Not paid',
  failed: 'Payment failed',
  cancelled: 'Cancelled',
};

// Her images come off eBay at whatever size the lister uploaded. A 40px thumb
// does not need the full one.
const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const day = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  : null);

const dayTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : null);

/*
 * The row state, and the class that marks it.
 *
 * Mapped rather than indexed by the raw state string. `styles[state]` picked up
 * `.failed`, which is the error message class, for an order whose payment
 * failed, and `.sent` collided with the dispatch panel below. An explicit map
 * cannot do either.
 */
const ROW_CLASS = {
  to_send: 'stateWaiting',
  sent: 'stateSent',
  refunded: 'stateRefunded',
  pending: 'stateQuiet',
  failed: 'stateQuiet',
  cancelled: 'stateQuiet',
};

function stateOf(order) {
  if (isToSend(order)) return 'to_send';
  if (order.dispatched_at) return 'sent';
  return order.status;
}

/*
 * The address as one block, in the order it goes on a label.
 *
 * `country` is absent because the checkout takes UK addresses only and says so.
 * Adding a line that always reads United Kingdom would be a line she has to
 * read every time to learn nothing.
 */
function addressLines(order) {
  const a = order.address ?? {};
  return [order.name, a.line1, a.line2, a.city, a.postcode]
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter(Boolean);
}

export function OrderRow({ order, onSave, onResend }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [number, setNumber] = useState(order.tracking_number ?? '');
  const [link, setLink] = useState(order.tracking_url ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(null);

  const state = stateOf(order);
  const lines = addressLines(order);
  const first = order.items?.[0];
  const more = Math.max(0, (order.items?.length ?? 0) - 1);

  // A failed write used to vanish, leaving the row looking dispatched until the
  // next reload put it back.
  async function save() {
    setBusy(true);
    setFailed(null);
    try {
      await onSave({
        carrier,
        trackingNumber: number,
        trackingUrl: link,
        dispatchedAt: order.dispatched_at ?? null,
      });
      setEditing(false);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  /*
   * The one control that saves her a step. Everything else on this row is
   * reading; this is the thing she does next, which is paste an address into a
   * label. Guarded rather than assumed, because a browser without the clipboard
   * API should lose the button and not the panel.
   */
  async function resend(kind) {
    setResending(kind);
    setFailed(null);
    try {
      await onResend({ kind });
    } catch (e) {
      setFailed(e?.message ?? 'Not sent. Try again.');
    } finally {
      setResending(null);
    }
  }

  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.writeText);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed('Could not copy. Select the address and copy it.');
    }
  }

  return (
    <article className={`${styles.row} ${styles[ROW_CLASS[state]] ?? ''} ${open ? styles.rowOpen : ''}`}>
      <div
        className={styles.head}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}
      >
        <p className={styles.ref} data-num>{order.reference}</p>

        <div className={styles.middle}>
          <h3 className={styles.title}>
            {first ? first.title : 'No items recorded'}
            {more > 0 && <span className={styles.more}> and {more} more</span>}
          </h3>
          <p className={styles.meta}>
            <span className={styles.state}>{STATE[state] ?? state}</span>
            {order.paid_at && <> · paid <span data-num>{day(order.paid_at)}</span></>}
            {order.name && <> · {order.name}</>}
            {order.address?.postcode && <>, <span data-num>{order.address.postcode}</span></>}
          </p>
        </div>

        <div className={styles.money}>
          <p className={`figure ${styles.total}`}>{formatGbp(order.total)}</p>
          <p className={styles.count}>
            <span data-num>{order.itemCount}</span> {order.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>

        <span className={styles.caret} aria-hidden="true" data-open={open || undefined}>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </span>
      </div>

      {open && (
        <div className={styles.detail}>
          <section className={styles.panel}>
            <h4 className="micro">What was bought</h4>
            <ul className={styles.items}>
              {(order.items ?? []).map((item) => (
                <li key={item.id} className={styles.item}>
                  {item.image_url
                    ? <img className={styles.thumb} src={thumb(item.image_url)} alt="" loading="lazy" />
                    : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemQty}>
                    <span data-num>{item.qty}</span> × <span data-num>{formatGbp(item.unit_price)}</span>
                  </span>
                  <span className={`${styles.itemTotal}`} data-num>{formatGbp(item.line_total)}</span>
                </li>
              ))}
            </ul>

            <dl className={styles.sums}>
              <div><dt>Goods</dt><dd data-num>{formatGbp(order.subtotal)}</dd></div>
              <div><dt>Delivery</dt><dd data-num>{formatGbp(order.delivery)}</dd></div>
              <div className={styles.sumTotal}>
                <dt>Taken</dt><dd data-num>{formatGbp(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h4 className="micro">Where it goes</h4>
              {canCopy && (
                <button type="button" className={styles.copy} onClick={copyAddress}>
                  {copied ? 'Copied' : 'Copy address'}
                </button>
              )}
            </div>

            <address className={styles.address}>
              {lines.map((line) => <span key={line}>{line}</span>)}
            </address>

            <p className={styles.contact}>
              <a href={`mailto:${order.email}`}>{order.email}</a>
              {order.phone && <> · <a href={`tel:${order.phone}`} data-num>{order.phone}</a></>}
            </p>

            {order.customer_note && (
              <p className={styles.customerNote}>
                <span className="micro">They wrote</span>
                {order.customer_note}
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <h4 className="micro">Dispatch</h4>

            {order.dispatched_at && !editing ? (
              <div className={styles.dispatched}>
                <p className={styles.sentLine}>
                  Left <span data-num>{dayTime(order.dispatched_at)}</span>
                  {order.carrier && <> by {order.carrier}</>}
                </p>
                {order.tracking_number && (
                  <p className={styles.sentLine}>
                    Tracking <span data-num>{order.tracking_number}</span>
                  </p>
                )}
                {order.tracking_url && (
                  <p className={styles.sentLine}>
                    <a href={order.tracking_url} target="_blank" rel="noreferrer">Open the carrier page</a>
                  </p>
                )}
                <button type="button" className={styles.ghost} onClick={() => setEditing(true)}>
                  Edit<span className="visually-hidden"> dispatch details for {order.reference}</span>
                </button>
              </div>
            ) : (
              <div className={styles.form}>
                <label className={styles.field}>
                  <span className={styles.label}>Carrier</span>
                  <select
                    className={styles.select}
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  >
                    <option value="">Choose one</option>
                    {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Tracking number, if there is one</span>
                  <input
                    className={styles.input}
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>

                {/*
                  * The whole link, not a number pushed into a template. Every
                  * carrier changes their URL shape eventually and a broken
                  * tracking link on a customer's order page is worse than none.
                  */}
                <label className={styles.field}>
                  <span className={styles.label}>Tracking link, if there is one</span>
                  <input
                    className={styles.input}
                    type="url"
                    inputMode="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>

                <div className={styles.actions}>
                  {/* Opened rather than printed from here. Printing from
                      inside a list prints the list. */}
                  <Link
                    className={styles.ghost}
                    to={portalPath(PORTAL_ROUTES.SLIP.replace(':reference', order.reference))}
                  >
                    Packing slip
                  </Link>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={busy || !carrier}
                    onClick={save}
                  >
                    {order.dispatched_at ? 'Save' : 'Mark dispatched'}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={busy}
                      onClick={() => {
                        setCarrier(order.carrier ?? '');
                        setNumber(order.tracking_number ?? '');
                        setLink(order.tracking_url ?? '');
                        setEditing(false);
                        setFailed(null);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {/*
                  * A carrier is enough. Requiring a tracking number would make
                  * her invent one for anything that went second class in an
                  * envelope, and an invented number is worse than an empty
                  * field on the customer's page.
                  */}
                {!carrier && (
                  <p className={styles.hint}>Pick who took it. The tracking fields can stay empty.</p>
                )}
              </div>
            )}

            {failed && <p className={styles.error} role="alert">{failed}</p>}
          </section>

          {/*
            * What the customer was actually told.
            *
            * The confirmation is a statutory requirement and the dispatch email
            * is the only thing that tells somebody their parcel left, so a
            * failed send has to be visible rather than sitting in a log. Both
            * are shown even when they worked, because "sent 18 Aug 14:02" is
            * also the answer to a customer who says they never heard anything.
            */}
          <section className={styles.panel}>
            <h4 className="micro">What we sent them</h4>
            <ul className={styles.sends}>
              <Send
                label="Confirmation"
                record={order.emails?.confirmation}
                pending={order.status !== 'paid'}
                busy={resending === 'confirmation'}
                onResend={() => resend('confirmation')}
              />
              <Send
                label="Dispatch"
                record={order.emails?.dispatch}
                pending={!order.dispatched_at}
                busy={resending === 'dispatch'}
                onResend={() => resend('dispatch')}
              />
            </ul>

            {order.emails?.confirmation?.identity_complete === false && (
              <p className={styles.hint}>
                This went out without your trading name and address, which are
                required on it. Filling those in makes the next one complete.
              </p>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

/*
 * One line per email.
 *
 * Three states worth distinguishing, because they call for different things.
 * Not sent yet because the moment has not arrived is normal and needs no
 * action. Sent is a fact with a time on it. Failed is the one that needs her,
 * and it is the only one carrying a button.
 */
function Send({ label, record, pending, busy, onResend }) {
  if (!record && pending) {
    return (
      <li className={styles.send}>
        <span className={styles.sendLabel}>{label}</span>
        <span className={styles.sendState}>not yet</span>
      </li>
    );
  }

  const ok = record?.status === 'sent';

  return (
    <li className={styles.send}>
      <span className={styles.sendLabel}>{label}</span>
      <span className={ok ? styles.sendState : styles.sendFailed}>
        {ok
          ? <>sent <span data-num>{dayTime(record.created_at)}</span></>
          : 'not sent'}
      </span>
      <button type="button" className={styles.resend} disabled={busy} onClick={onResend}>
        {busy ? 'Sending' : ok ? 'Send again' : 'Try again'}
      </button>
    </li>
  );
}
