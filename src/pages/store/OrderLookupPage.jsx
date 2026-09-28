import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon, MailIcon, SearchIcon, VanIcon } from '@components/ui/store/icons';
import { fetchOrder } from '@lib/checkout';
import { MY_ORDERS_EVENT, forgetMyOrders, readMyOrders, stageOf } from '@lib/myOrders';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/order-lookup.module.css';

const STAGE = {
  pending: { word: 'Waiting for payment', tone: 'gold' },
  paid: { word: 'Paid, packing next', tone: 'sage' },
  sent: { word: 'On its way', tone: 'sage' },
  refunded: { word: 'Refunded', tone: 'grey' },
};
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });

/*
 * Track an order.
 *
 * First, the orders this device has already opened, newest first, each one tap
 * from its own page: somebody who was looking at their order a minute ago
 * should not meet a blank form. Their status is fetched fresh as the page
 * opens, so a parcel that left since the last visit says so.
 *
 * Then the way in for everything else: reference plus email. The reference
 * alone is short enough to guess given enough attempts, and the email is the
 * second thing only the customer has. A wrong pair and a reference that does
 * not exist give the same answer.
 */
export function OrderLookupPage() {
  const navigate = useNavigate();
  const [mine, setMine] = useState(readMyOrders);
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = () => setMine(readMyOrders());
    window.addEventListener(MY_ORDERS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(MY_ORDERS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  // Where each one has got to now, rather than where it was when last opened.
  const [fresh, setFresh] = useState({});
  const refs = mine.map((o) => `${o.reference}:${o.token}`).join(',');
  useEffect(() => {
    let live = true;
    readMyOrders().forEach((o) => {
      fetchOrder(o.reference, o.token)
        .then(({ order }) => { if (live) setFresh((f) => ({ ...f, [o.reference]: stageOf(order) })); })
        .catch(() => { if (live) setFresh((f) => ({ ...f, [o.reference]: 'gone' })); });
    });
    return () => { live = false; };
  }, [refs]);

  async function submit(event) {
    event.preventDefault();
    setFailed(false);
    const ref = reference.trim().toUpperCase();
    if (!ref || !email.trim()) { setFailed(true); return; }
    setBusy(true);
    try {
      const { token } = await fetchOrder(ref, null, email.trim());
      navigate(`/order/${ref}?token=${token}`);
    } catch {
      // One message. Telling somebody the reference was right and the email wrong tells them which half to keep guessing at.
      setFailed(true);
      setBusy(false);
    }
  }

  const shown = mine.filter((o) => fresh[o.reference] !== 'gone');
  const has = shown.length > 0;

  return (
    <section className={styles.page}>
      <Head title="Track an order" description="Track an order with its reference and the email you used." path="/orders" noindex />

      <header className={styles.head}>
        <p className={styles.kicker}><VanIcon size={16} /> Track an order</p>
        <h1 className={`${styles.title} wide`}>{has ? 'Your orders' : 'Find your order'}</h1>
        <p className={styles.body}>
          {has
            ? 'The orders you have opened on this device, newest first. For anything else, find it with its reference below.'
            : 'The link in your confirmation email is the quickest way back. If it has gone, the reference and the email address you ordered with will do.'}
        </p>
      </header>

      {has && (
        <section className={styles.mine} aria-labelledby="my-orders">
          <h2 id="my-orders" className="visually-hidden">Orders on this device</h2>
          <ul className={styles.list}>
            {shown.map((o) => {
              const stage = STAGE[fresh[o.reference] ?? o.stage] ?? STAGE.pending;
              const image = imageAt(o.image, 200);
              return (
                <li key={o.reference}>
                  <Link className={styles.order} to={`/order/${o.reference}?token=${encodeURIComponent(o.token)}`}>
                    <span className={styles.thumb}>{image ? <img src={image} alt="" loading="lazy" /> : null}</span>
                    <span className={styles.orderMain}>
                      <span className={styles.orderRef} data-price>{o.reference}</span>
                      <span className={styles.orderWhat}>
                        {(o.firstQty ?? 1) > 1 ? `${o.firstQty} \u00d7 ` : ''}{o.first ?? 'Your order'}
                        {(o.lines ?? 1) > 1 ? `, and ${o.lines - 1} more` : ''}
                        {o.gift ? ', a gift' : ''}
                      </span>
                      <span className={styles.orderMeta}>
                        {o.placed ? DATE.format(new Date(o.placed)) : ''}{o.placed ? ' · ' : ''}<span data-price>{formatGbp(o.total)}</span>
                      </span>
                    </span>
                    <span className={styles.stage} data-tone={stage.tone}>{stage.word}</span>
                    <ChevronRightIcon size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
          <button type="button" className={styles.forget} onClick={() => { forgetMyOrders(); setFresh({}); }}>
            Forget these on this device
          </button>
        </section>
      )}

      <section className={styles.find} aria-labelledby="find-order">
        <h2 id="find-order" className={styles.findHead}><SearchIcon size={18} /> {has ? 'Find another order' : 'Find it with its reference'}</h2>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span className={styles.label}>Order reference</span>
            <input
              data-reference
              value={reference}
              onChange={(e) => { setReference(e.target.value); setFailed(false); }}
              placeholder="CK-A4KP-9RMT"
              autoComplete="off"
              spellCheck="false"
              disabled={busy}
            />
            <span className={styles.hint}>On your confirmation email, starting CK.</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFailed(false); }}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={busy}
            />
          </label>

          {failed && (
            <p className={styles.failed} role="alert">
              We cannot find an order with those details. Check the reference and the address, and if it still will not come up write to support@cartandkeep.com and we will look it up by hand.
            </p>
          )}

          <button type="submit" className={styles.go} disabled={busy}>
            {busy ? 'Looking' : <>Find it <ArrowRightIcon size={16} /></>}
          </button>
        </form>
      </section>

      <div className={styles.aside}>
        <MailIcon size={18} />
        <p>Tracking arrives by email when the parcel leaves, so if you have had a dispatch email the link in that one goes straight there.</p>
      </div>
    </section>
  );
}
