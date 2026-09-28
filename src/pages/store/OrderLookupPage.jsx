import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, VanIcon } from '@components/ui/store/icons';
import { EmptyHero } from '@components/ui/store/EmptyHero';
import { orderDates, windowText } from '@components/ui/store/OrderJourney';
import { fetchOrder } from '@lib/checkout';
import { MY_ORDERS_EVENT, forgetMyOrders, readMyOrders, stageOf } from '@lib/myOrders';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/store/order-lookup.module.css';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

/*
 * Track an order.
 *
 * With orders on this device, the page is those orders: each one a parcel
 * card with its three stops and the one date that matters now, fetched fresh
 * as the page opens. Finding a different order is one tap away rather than a
 * form that fills the page for the person who does not need it.
 *
 * With none, it is the form, in the same warm card as every other page that
 * starts empty. Reference plus email: the reference alone is short enough to
 * guess, and the email is the second thing only the customer has.
 */
export function OrderLookupPage() {
  const [mine, setMine] = useState(readMyOrders);
  const [fresh, setFresh] = useState({});
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const sync = () => setMine(readMyOrders());
    window.addEventListener(MY_ORDERS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(MY_ORDERS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  // Each order as it stands now, not as it stood when last opened.
  const refs = mine.map((o) => `${o.reference}:${o.token}`).join(',');
  useEffect(() => {
    let live = true;
    readMyOrders().forEach((o) => {
      fetchOrder(o.reference, o.token)
        .then(({ order }) => { if (live) setFresh((f) => ({ ...f, [o.reference]: order })); })
        .catch(() => { if (live) setFresh((f) => ({ ...f, [o.reference]: 'gone' })); });
    });
    return () => { live = false; };
  }, [refs]);

  const shown = mine.filter((o) => fresh[o.reference] !== 'gone');

  if (!shown.length) {
    return (
      <section className={styles.pageWide}>
        <Head title="Track an order" description="Track an order with its reference and the email you used." path="/orders" noindex />
        <EmptyHero
          Icon={VanIcon}
          kicker="Track an order"
          title="Find your order"
          extra={<FindForm />}
        >
          <p>The link in your confirmation email is the quickest way back. If it has gone, the reference and the email address you ordered with will do.</p>
        </EmptyHero>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Head title="Track an order" description="Your orders on this device." path="/orders" noindex />

      <header className={styles.head}>
        <p className={styles.kicker}><VanIcon size={16} /> Track an order</p>
        <h1 className={`${styles.title} wide`}>Your orders</h1>
        <p className={styles.body}>The ones you have opened on this device, most recent first, with where each has got to.</p>
      </header>

      <ul className={styles.list}>
        {shown.map((o) => <OrderCard key={o.reference} saved={o} order={typeof fresh[o.reference] === 'object' ? fresh[o.reference] : null} />)}
      </ul>

      <div className={styles.more}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <SearchIcon size={18} />
          <span className={styles.toggleText}>
            <b>Looking for a different order?</b>
            <span>Find it with its reference and your email</span>
          </span>
          <ChevronDownIcon size={18} />
        </button>
        <div className={styles.reveal} id={panelId} data-open={open || undefined}>
          <div className={styles.revealInner}>
            {open && <FindForm autoFocus />}
          </div>
        </div>
      </div>

      <p className={styles.small}>
        Tracking also arrives by email when a parcel leaves.{' '}
        <button type="button" className={styles.forget} onClick={() => { forgetMyOrders(); setFresh({}); }}>Forget these orders on this device</button>
      </p>
    </section>
  );
}

// One order as a parcel card: its photo, what is in it, three stops, and the date that matters now.
function OrderCard({ saved, order }) {
  const stage = order ? stageOf(order) : saved.stage;
  const dates = order ? orderDates(order) : null;
  const image = imageAt(saved.image, 200);
  const stops = stage === 'sent' ? 2 : stage === 'paid' ? 1 : 0;

  const now = !order ? 'Checking where it is'
    : stage === 'refunded' ? 'Refunded'
      : stage === 'pending' ? 'Waiting for payment'
        : stage === 'sent' ? (dates.due ? `Due ${saved.gift ? 'with them' : 'with you'} now` : `Arriving ${windowText(dates.from, dates.to)}`)
          : `Leaves us ${windowText(dates.leaves, dates.leaves)}, with you ${windowText(dates.from, dates.to)}`;

  return (
    <li>
      <Link className={styles.order} to={`/order/${saved.reference}?token=${encodeURIComponent(saved.token)}`} data-stage={stage}>
        <span className={styles.thumb}>{image ? <img src={image} alt="" loading="lazy" /> : null}</span>
        <span className={styles.orderMain}>
          <span className={styles.orderTop}>
            <span className={styles.orderRef} data-price>{saved.reference}</span>
            <span className={styles.orderMeta}>
              {saved.placed ? DATE.format(new Date(saved.placed)) : ''}{saved.placed ? ' · ' : ''}<span data-price>{formatGbp(saved.total)}</span>
            </span>
          </span>
          <span className={styles.orderWhat}>
            {(saved.firstQty ?? 1) > 1 ? `${saved.firstQty} × ` : ''}{saved.first ?? 'Your order'}
            {(saved.lines ?? 1) > 1 ? `, and ${saved.lines - 1} more` : ''}
            {saved.gift ? ', a gift' : ''}
          </span>
          {stage !== 'refunded' && stage !== 'pending' && (
            <span className={styles.mini} aria-hidden="true" data-stops={stops}>
              <i data-on={stops >= 1 || undefined} />
              <i data-on={stops >= 2 || undefined} />
              <i data-on={stops >= 3 || undefined} />
            </span>
          )}
          <span className={styles.now} data-tone={stage}>
            {stage === 'sent' || stage === 'paid' ? <VanIcon size={14} /> : stage === 'refunded' ? <CheckIcon size={14} /> : null}
            {now}
          </span>
        </span>
        <ChevronRightIcon size={18} />
      </Link>
    </li>
  );
}

// Reference plus email. One message for any miss, because saying which half was right tells a guesser which half to keep.
function FindForm({ autoFocus = false }) {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef(null);

  useEffect(() => { if (autoFocus) first.current?.focus({ preventScroll: true }); }, [autoFocus]);

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
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span className={styles.label}>Order reference</span>
          <input
            ref={first}
            data-reference
            value={reference}
            onChange={(e) => { setReference(e.target.value); setFailed(false); }}
            placeholder="CK-A4KP-9RMT"
            autoComplete="off"
            spellCheck="false"
            disabled={busy}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Email you ordered with</span>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFailed(false); }}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={busy}
          />
        </label>
      </div>

      {failed && (
        <p className={styles.failed} role="alert">
          We cannot find an order with those details. Check the reference and the address, and if it still will not come up write to support@cartandkeep.com and we will look it up by hand.
        </p>
      )}

      <button type="submit" className={styles.go} disabled={busy}>
        {busy ? 'Looking' : <>Find it <ArrowRightIcon size={16} /></>}
      </button>
    </form>
  );
}
