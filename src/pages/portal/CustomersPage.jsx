import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCustomers, searchCustomers } from '@hooks/useCustomers';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import styles from '@styles/pages/portal/customers-page.module.css';

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'returning', label: 'Came back' },
  { key: 'new', label: 'Bought once' },
];

const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
}) : '');

function ago(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

const initials = (p) => String(p.name || p.email || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// A stable colour per person, from the data palette, so the same face is the same colour everywhere.
const hueOf = (s) => [...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 5;

const lines = (order) => (order.order_items ?? [])
  .map((i) => `${i.qty > 1 ? `${i.qty} x ` : ''}${i.title}${i.variant_label ? `, ${i.variant_label}` : ''}`);

function Person({ person, index, example }) {
  const [open, setOpen] = useState(false);
  const place = [person.address?.city, person.address?.postcode].filter(Boolean).join(', ');

  return (
    <li className={styles.person} data-open={open || undefined} data-example={example || undefined}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      {example && <span className={styles.exampleTag}>Example</span>}
      <button type="button" className={styles.row} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.avatar} data-hue={hueOf(person.email)} aria-hidden="true">{initials(person)}</span>
        <span className={styles.who}>
          <span className={styles.name}>{person.name || 'No name given'}</span>
          <span className={styles.meta}>{person.email}{place ? ` · ${place}` : ''}</span>
        </span>
        <span className={styles.badges}>
          {person.returning && (
            <span className={styles.back}>
              <Icon name="IconRefresh" width="12" height="12" />{person.orders} orders
            </span>
          )}
          {person.toSend > 0 && (
            <span className={styles.toSend}><Icon name="IconBox" width="12" height="12" />{person.toSend} to send</span>
          )}
        </span>
        <span className={styles.dots} aria-hidden="true">
          {person.history.slice(0, 6).reverse().map((o) => <i key={o.id} data-sent={Boolean(o.dispatched_at) || undefined} />)}
        </span>
        <span className={styles.money}>
          <b data-num>{formatGbp(person.spent)}</b>
          <small>last {ago(person.last_order)}</small>
        </span>
        <Icon name="IconCaret" width="14" height="14" className={styles.caret} />
      </button>

      {open && (
        <div className={styles.detail}>
          <dl className={styles.facts}>
            <div><dt>First order</dt><dd data-num>{date(person.first_order)}</dd></div>
            <div><dt>Orders</dt><dd data-num>{person.orders}</dd></div>
            <div><dt>Average</dt><dd data-num>{formatGbp(person.average)}</dd></div>
            <div><dt>Spent</dt><dd data-num>{formatGbp(person.spent)}</dd></div>
          </dl>
          <div className={styles.split}>
            {person.address && (
              <address className={styles.address}>
                <span className={styles.label}>Sends to</span>
                {[person.address.line1, person.address.line2, person.address.city, person.address.postcode]
                  .filter(Boolean).map((l) => <span key={l}>{l}</span>)}
              </address>
            )}
            <ol className={styles.history}>
              {person.history.map((o) => (
                <li key={o.id} className={styles.order}>
                  <span className={styles.orderDot} data-sent={Boolean(o.dispatched_at) || undefined} />
                  <span className={styles.orderMain}>
                    <span className={styles.orderTop}>
                      {example
                        ? <span className={styles.ref} data-num>{o.reference}</span>
                        : <Link className={styles.ref} to={portalPath(PORTAL_ROUTES.ORDERS)} data-num>{o.reference}</Link>}
                      <span className={styles.orderDate}>{date(o.paid_at)}</span>
                      <span className={styles.orderState} data-sent={Boolean(o.dispatched_at) || undefined}>
                        {o.dispatched_at ? 'Sent' : 'To send'}
                      </span>
                    </span>
                    <span className={styles.items}>{lines(o).join(', ')}</span>
                  </span>
                  <span className={styles.orderTotal} data-num>{formatGbp(Number(o.total))}</span>
                </li>
              ))}
            </ol>
          </div>
          {!example && (
            <a className={styles.mail} href={`mailto:${person.email}`}>
              <Icon name="IconEnvelope" width="14" height="14" />Email {person.name?.split(' ')[0] || 'them'}
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function Hero({ rows, counts, first }) {
  const spent = rows.reduce((n, r) => n + r.spent, 0);
  const orders = rows.reduce((n, r) => n + r.orders, 0);
  const share = counts.all ? counts.returning / counts.all : 0;
  const top = rows[0];

  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <p className={styles.heroLabel}>People who have paid</p>
        <p className={styles.heroFigure} data-num>{counts.all}</p>
        <p className={styles.heroNote}>
          {first ? 'Your first sale starts the count.' : <>
          <span data-num>{formatGbp(spent)}</span> across <span data-num>{orders}</span> {orders === 1 ? 'order' : 'orders'}
          {orders ? <>, <span data-num>{formatGbp(spent / orders)}</span> on average</> : ''}
          </>}
        </p>
      </div>

      <div className={styles.loyal}>
        <span className={styles.ring} style={{ '--p': share }} aria-hidden="true">
          {first ? <Icon name="IconRefresh" width="22" height="22" /> : <b data-num>{Math.round(share * 100)}%</b>}
        </span>
        <span className={styles.loyalText}>
          <b className={styles.loyalTitle}>
            Came back
            <Tip side="end" place="below" tone="light">Somebody who has paid for more than one order, matched on their email address.</Tip>
          </b>
          <span>
            {counts.all
              ? <><span data-num>{counts.returning}</span> of <span data-num>{counts.all}</span> ordered again</>
              : 'Anyone who orders twice shows here'}
          </span>
        </span>
      </div>

      <div className={styles.best}>
        <p className={styles.heroLabel}>Best customer</p>
        {top ? (
          <>
            <p className={styles.bestName}>
              <span className={styles.avatar} data-hue={hueOf(top.email)} aria-hidden="true">{initials(top)}</span>
              {top.name || top.email}
            </p>
            <p className={styles.bestNote}><span data-num>{formatGbp(top.spent)}</span> over <span data-num>{top.orders}</span> {top.orders === 1 ? 'order' : 'orders'}</p>
          </>
        ) : (
          <>
            <p className={styles.bestName}>
              <span className={styles.ghost} aria-hidden="true" />
              <span className={styles.ghostLine} aria-hidden="true" />
            </p>
            <p className={styles.bestNote}>Your first buyer takes this spot.</p>
          </>
        )}
      </div>
    </section>
  );
}

const SAMPLE = [
  {
    email: 'margaret.h@example.com', name: 'Margaret Hughes', orders: 3, spent: 81.32, average: 27.11, returning: true, toSend: 1,
    first_order: '2026-06-02', last_order: new Date(Date.now() - 2 * 86400000).toISOString(),
    address: { line1: '14 Elm Road', city: 'Leeds', postcode: 'LS6 2AB' },
    history: [
      { id: 'a', reference: 'CK-1063', total: 23.41, paid_at: new Date(Date.now() - 2 * 86400000).toISOString(), dispatched_at: null, order_items: [{ title: 'Bed Rails for Elderly Adults', qty: 1 }] },
      { id: 'b', reference: 'CK-1037', total: 34.67, paid_at: '2026-08-11', dispatched_at: '2026-08-12', order_items: [{ title: 'Behringer UCA222 USB Audio Interface', qty: 1 }] },
      { id: 'c', reference: 'CK-1004', total: 23.24, paid_at: '2026-06-02', dispatched_at: '2026-06-03', order_items: [{ title: 'Salter Mechanical Bathroom Scale', qty: 1 }] },
    ],
  },
  {
    email: 'tom.b@example.com', name: 'Tom Bell', orders: 1, spent: 39.22, average: 39.22, returning: false, toSend: 0,
    first_order: '2026-09-01', last_order: '2026-09-01',
    address: { line1: '2 Mill Lane', city: 'Bristol', postcode: 'BS3 4QT' },
    history: [{ id: 'd', reference: 'CK-1055', total: 39.22, paid_at: '2026-09-01', dispatched_at: '2026-09-02', order_items: [{ title: 'LED Makeup Mirror with Lights', qty: 1 }] }],
  },
];

function FirstCustomers() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Customers</h1>
        <p className={styles.sub}>Nobody yet. Everyone who pays on your shop appears here by themselves.</p>
      </header>
      <Hero rows={[]} counts={{ all: 0, returning: 0 }} first />
      <div className={styles.first}>
        <section>
          <p className={styles.firstLabel}>This is how they will look. Press one to open it.</p>
          <ul className={styles.list}>
            {SAMPLE.map((p, i) => <Person key={p.email} person={p} index={i} example />)}
          </ul>
        </section>
        <Card>
          <CardHead title="How the list fills" />
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}><Icon name="IconBought" width="16" height="16" /></span><span><b>Somebody pays</b>They appear, with what they bought and where it goes.</span></li>
            <li><span className={styles.stepIcon}><Icon name="IconRefresh" width="16" height="16" /></span><span><b>They order again</b>Matched on their email, they get a Came back badge.</span></li>
            <li><span className={styles.stepIcon}><Icon name="IconStar" width="16" height="16" /></span><span><b>They rise to the top</b>The list is sorted by what each person has spent.</span></li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, counts, error, reload } = useCustomers(tenant?.id);
  const [filter, setFilter] = useState('all');
  const [term, setTerm] = useState('');

  const visible = useMemo(() => {
    const byFilter = filter === 'returning' ? rows.filter((r) => r.returning)
      : filter === 'new' ? rows.filter((r) => !r.returning) : rows;
    return searchCustomers(byFilter, term);
  }, [rows, filter, term]);

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The customers did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (counts.all === 0) return <FirstCustomers />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Customers</h1>
        <p className={styles.sub}>Sorted by what each person has spent. Press one to see everything they bought.</p>
      </header>

      <Hero rows={rows} counts={counts} />

      <div className={styles.controls}>
        <div className={styles.tabs} role="group" aria-label="Filter customers">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={styles.tab} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}<span data-num>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Icon name="IconSearch" width="16" height="16" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name, email, postcode or order"
            aria-label="Search customers" />
        </label>
      </div>

      {visible.length === 0 ? (
        <Card className={styles.none}><p>Nobody matches that.</p></Card>
      ) : (
        <ul className={styles.list}>
          {visible.map((p, i) => <Person key={p.email} person={p} index={i} />)}
        </ul>
      )}
    </div>
  );
}
