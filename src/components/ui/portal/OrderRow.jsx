import { useState } from 'react';
import { Link } from 'react-router';
import { PORTAL_ROUTES, portalPath, CARRIERS } from '@utils/constants';
import { formatGbp } from '@utils/formatGbp';
import { isToSend } from '@hooks/useOrders';
import { formatPhone } from '@lib/phone';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/order-row.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const dayTime = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : null);

// Carriers she uses most sit as one-tap choices; the rest are behind More.
const QUICK_CARRIERS = ['Royal Mail', 'Evri', 'DPD', 'Yodel'];

export function waitedHours(order) {
  const from = order.paid_at ?? order.created_at;
  return from ? (Date.now() - new Date(from).getTime()) / 3600000 : 0;
}

export function waited(order) {
  const h = waitedHours(order);
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

// Over a working day is worth a look; over three is a customer wondering where it is.
const urgency = (order) => (waitedHours(order) >= 72 ? 'late' : waitedHours(order) >= 24 ? 'due' : 'fresh');

function stateOf(order) {
  if (isToSend(order)) return 'to_send';
  if (order.dispatched_at) return 'sent';
  return order.status;
}

const STATE = {
  to_send: 'To send', sent: 'Dispatched', refunded: 'Refunded', pending: 'Not paid', failed: 'Payment failed', cancelled: 'Cancelled',
};

const firstOf = (name) => String(name ?? '').trim().split(/\s+/)[0] || 'They';

function addressLines(order) {
  const a = order.address ?? {};
  // The parcel's name: the recipient on a gift, the buyer otherwise.
  return [order.recipient_name || order.name, a.line1, a.line2, a.city, a.postcode]
    .map((line) => (typeof line === 'string' ? line.trim() : '')).filter(Boolean);
}

// The order's life as five stops, each lit from the record rather than assumed.
export function journeyOf(order) {
  const mail = (k) => order.emails?.[k];
  const mailState = (k) => (mail(k) ? (mail(k).status === 'sent' ? 'done' : 'failed') : 'next');
  return [
    { key: 'paid', label: 'Paid', state: order.paid_at ? 'done' : 'next', when: order.paid_at },
    { key: 'confirmation', label: 'Receipt emailed', state: mailState('confirmation'), when: mail('confirmation')?.created_at },
    { key: 'sent', label: 'Dispatched', state: order.dispatched_at ? 'done' : 'next', when: order.dispatched_at },
    { key: 'dispatch', label: 'Tracking emailed', state: order.dispatched_at ? mailState('dispatch') : 'next', when: mail('dispatch')?.created_at },
    ...(order.notify_recipient ? [{ key: 'recipient', label: `${firstOf(order.recipient_name)} told`, state: order.dispatched_at ? mailState('recipient_dispatch') : 'next', when: mail('recipient_dispatch')?.created_at }] : []),
    { key: 'review', label: 'Review asked', state: mailState('review_request') === 'next' ? 'next' : mailState('review_request'), when: mail('review_request')?.created_at },
  ];
}

export function Journey({ order, compact }) {
  const stops = journeyOf(order);
  const reached = stops.reduce((n, s, i) => (s.state !== 'next' ? i : n), -1);
  return (
    <ol className={styles.journey} data-compact={compact || undefined}
      style={{ '--reach': reached < 0 ? 0 : reached / (stops.length - 1), '--stops': stops.length }}>
      {stops.map((s) => (
        <li key={s.key} className={styles.stop} data-state={s.state} title={s.when ? `${s.label}, ${dayTime(s.when)}` : s.label}>
          <span className={styles.node} aria-hidden="true">
            {s.state === 'done' && <Icon name="IconCheck" width="10" height="10" />}
            {s.state === 'failed' && <Icon name="IconX" width="10" height="10" />}
          </span>
          {!compact && (
            <span className={styles.stopText}>
              <b>{s.label}</b>
              <span data-num>{s.state === 'failed' ? 'did not send' : s.when ? dayTime(s.when) : ''}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function OrderRow({ order, onSave, onResend, onDispatched, example, index = 0 }) {
  const state = stateOf(order);
  const [open, setOpen] = useState(state === 'to_send' && index === 0);
  const [editing, setEditing] = useState(false);
  // The example shows a carrier picked, so the dispatch button reads as it will when she uses it.
  const [carrier, setCarrier] = useState(order.carrier ?? (example ? 'Royal Mail' : ''));
  const [more, setMore] = useState(Boolean(order.carrier) && !QUICK_CARRIERS.includes(order.carrier));
  const [number, setNumber] = useState(order.tracking_number ?? '');
  const [link, setLink] = useState(order.tracking_url ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(null);

  const lines = addressLines(order);
  const items = order.items ?? [];
  const where = [order.address?.city, order.address?.postcode].filter(Boolean).join(', ');
  const mailFailed = Object.values(order.emails ?? {}).some((e) => e.status === 'failed');

  async function save() {
    if (example) return;
    setBusy(true);
    setFailed(null);
    try {
      const first = !order.dispatched_at;
      await onSave({ carrier, trackingNumber: number, trackingUrl: link, dispatchedAt: order.dispatched_at ?? null });
      setEditing(false);
      if (first) onDispatched?.(order);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend(kind) {
    if (example) return;
    setResending(kind);
    setFailed(null);
    try { await onResend({ kind }); } catch (e) { setFailed(e?.message ?? 'Not sent. Try again.'); } finally { setResending(null); }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed('Could not copy. Select the address and copy it.');
    }
  }

  const form = (
    <div className={styles.form}>
      <div className={styles.field}>
        <span className={styles.label}>Who took it</span>
        <div className={styles.carriers} role="radiogroup" aria-label="Carrier">
          {QUICK_CARRIERS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={carrier === c} className={styles.carrier}
              onClick={() => { setCarrier(c); setMore(false); }}>{c}</button>
          ))}
          {more ? (
            <select className={styles.select} value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Another carrier">
              <option value="">Choose one</option>
              {CARRIERS.filter((c) => !QUICK_CARRIERS.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <button type="button" className={styles.carrierMore} onClick={() => { setMore(true); setCarrier(''); }}>Another</button>
          )}
        </div>
      </div>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span className={styles.label}>Tracking number, if there is one</span>
          <input className={styles.input} data-num value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" spellCheck="false" placeholder="AB123456789GB" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Tracking link, if there is one</span>
          <input className={styles.input} type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" autoComplete="off" spellCheck="false" />
        </label>
      </div>
      <div className={styles.actions}>
        {example
          ? <span className={styles.ghost}><Icon name="IconNote" width="14" height="14" />Slip and receipt</span>
          : (
            <Link className={styles.ghost} to={portalPath(PORTAL_ROUTES.SLIP.replace(':reference', order.reference))}>
              <Icon name="IconNote" width="14" height="14" />Slip and receipt
            </Link>
          )}
        {editing && (
          <button type="button" className={styles.ghost} disabled={busy} onClick={() => {
            setCarrier(order.carrier ?? ''); setNumber(order.tracking_number ?? ''); setLink(order.tracking_url ?? '');
            setEditing(false); setFailed(null);
          }}>Cancel</button>
        )}
        <button type="button" className={styles.primary} disabled={busy || !carrier} onClick={save}>
          <Icon name="IconBox" width="16" height="16" />
          {order.dispatched_at ? 'Save' : busy ? 'Sending' : 'Mark dispatched'}
        </button>
      </div>
      {!carrier && (
        <p className={styles.hint}>
          Pick who took it. Marking it dispatched emails {order.is_gift ? firstOf(order.name) : 'them'} straight away{order.notify_recipient ? `, and tells ${firstOf(order.recipient_name)} it is coming, as they asked` : ''}.
        </p>
      )}
    </div>
  );

  return (
    <article className={styles.card} data-state={state} data-urgency={state === 'to_send' ? urgency(order) : undefined}
      data-open={open || undefined} data-example={example || undefined} style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      {example && <span className={styles.exampleTag}>Example</span>}

      <button type="button" className={styles.head} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.stack} aria-hidden="true">
          {items.slice(0, 3).map((it) => (thumb(it.image_url)
            ? <img key={it.id} src={thumb(it.image_url)} alt="" loading="lazy" />
            : <span key={it.id} className={styles.thumbEmpty} />))}
        </span>
        <span className={styles.main}>
          <span className={styles.top}>
            <span className={styles.ref} data-num>{order.reference}</span>
            <span className={styles.state}>{STATE[state] ?? state}</span>
            {state === 'to_send' && (
              <span className={styles.wait}><Icon name="IconClock" width="12" height="12" />waiting {waited(order)}</span>
            )}
            {order.is_gift && <span className={styles.gift}><Icon name="IconHeart" width="11" height="11" />Gift</span>}
            {mailFailed && <span className={styles.warn}>An email did not send</span>}
          </span>
          <span className={styles.what}>
            {items[0]?.title ?? 'No items recorded'}
            {items.length > 1 && <span className={styles.plus}> and {items.length - 1} more</span>}
          </span>
          <span className={styles.who}>
            {order.is_gift ? <>{order.recipient_name}, from {order.name}</> : order.name}{where && <> <Icon name="IconPin" width="12" height="12" /> {where}</>}
          </span>
        </span>
        {state !== 'to_send' && <span className={styles.mini}><Journey order={order} compact /></span>}
        <span className={styles.money}>
          <b data-num>{formatGbp(order.total)}</b>
          <small><span data-num>{order.itemCount}</span> {order.itemCount === 1 ? 'item' : 'items'}</small>
        </span>
        <Icon name="IconCaret" width="14" height="14" className={styles.caret} />
      </button>

      {open && (
        <div className={styles.detail}>
          <Journey order={order} />

          <div className={styles.grid}>
            <section className={styles.panel}>
              <h4 className={styles.panelTitle}>In the box</h4>
              <ul className={styles.items}>
                {items.map((it) => (
                  <li key={it.id} className={styles.item}>
                    {thumb(it.image_url) ? <img src={thumb(it.image_url)} alt="" loading="lazy" /> : <span className={styles.thumbEmpty} />}
                    <span className={styles.itemTitle}>{it.title}</span>
                    {/* The unit price only says something when there is more than one; for one it repeats the line total. */}
                    <span className={styles.qty} data-num>{it.qty > 1 ? `${it.qty} x ${formatGbp(it.unit_price)}` : ''}</span>
                    <span className={styles.itemTotal} data-num>{formatGbp(it.line_total)}</span>
                  </li>
                ))}
              </ul>
              <dl className={styles.sums}>
                <div><dt>Goods</dt><dd data-num>{formatGbp(order.subtotal)}</dd></div>
                <div><dt>Delivery</dt><dd data-num>{Number(order.delivery) > 0 ? formatGbp(order.delivery) : 'Free'}</dd></div>
                <div className={styles.sumTotal}><dt>Taken</dt><dd data-num>{formatGbp(order.total)}</dd></div>
              </dl>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h4 className={styles.panelTitle}>Goes to</h4>
                <button type="button" className={styles.copy} onClick={copyAddress}>
                  <Icon name={copied ? 'IconCheck' : 'IconNote'} width="12" height="12" />{copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <address className={styles.label2}>
                {lines.map((l, i) => <span key={l} className={i === 0 ? styles.addrName : undefined}>{l}</span>)}
              </address>
              {order.is_gift && order.recipient_phone && (
                <p className={styles.contact}><a href={`tel:${order.recipient_phone}`} data-num>{formatPhone(order.recipient_phone)}</a><span>for the courier</span></p>
              )}
              {order.is_gift && <p className={styles.boughtBy}>Bought by {order.name}</p>}
              <p className={styles.contact}>
                <a href={`mailto:${order.email}`}>{order.email}</a>
                {order.phone && <a href={`tel:${order.phone}`} data-num>{formatPhone(order.phone)}</a>}
              </p>
              {order.is_gift && (
                <p className={styles.giftNote}>
                  <span>A gift. The slip carries no prices{order.gift_message ? ' and prints their message' : ''}.</span>
                  {order.gift_message && <q>{order.gift_message}</q>}
                </p>
              )}
              {order.customer_note && (
                <p className={styles.note}><span>They wrote</span>{order.customer_note}</p>
              )}
            </section>
          </div>

          <section className={styles.dispatch} data-done={(order.dispatched_at && !editing) || undefined}>
            {order.dispatched_at && !editing ? (
              <div className={styles.sent}>
                <span className={styles.sentMark}><Icon name="IconCheck" width="16" height="16" /></span>
                <span className={styles.sentText}>
                  <b>Left {dayTime(order.dispatched_at)}{order.carrier ? ` with ${order.carrier}` : ''}</b>
                  <span>
                    {order.tracking_number ? <>Tracking <span data-num>{order.tracking_number}</span></> : 'No tracking number'}
                    {order.tracking_url && <> · <a href={order.tracking_url} target="_blank" rel="noreferrer">carrier page</a></>}
                  </span>
                </span>
                <button type="button" className={styles.ghost} onClick={() => setEditing(true)}>
                  Edit<span className="visually-hidden"> dispatch details for {order.reference}</span>
                </button>
              </div>
            ) : state === 'to_send' || editing ? form : null}
            {failed && <p className={styles.error} role="alert">{failed}</p>}
          </section>

          <section className={styles.emails}>
            {['confirmation', 'dispatch', 'recipient_dispatch', 'review_request'].map((kind) => {
              const rec = order.emails?.[kind];
              const label = kind === 'confirmation' ? 'Receipt' : kind === 'dispatch' ? 'Tracking'
                : kind === 'recipient_dispatch' ? `Note to ${firstOf(order.recipient_name)}` : 'Review request';
              if (!rec) return null;
              const ok = rec.status === 'sent';
              return (
                <span key={kind} className={styles.mail} data-ok={ok || undefined}>
                  <Icon name={ok ? 'IconEnvelope' : 'IconX'} width="12" height="12" />
                  {label} {ok ? <>sent <span data-num>{dayTime(rec.created_at)}</span></> : 'did not send'}
                  {kind !== 'review_request' && (
                    <button type="button" className={styles.resend} disabled={resending === kind || example} onClick={() => resend(kind)}>
                      {resending === kind ? 'Sending' : ok ? 'Send again' : 'Try again'}
                    </button>
                  )}
                </span>
              );
            })}
          </section>
          {order.emails?.confirmation?.identity_complete === false && (
            <p className={styles.hint}>
              The receipt went out without your trading name and address, which the law asks for. Filling those in under Settings makes the next one complete.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
