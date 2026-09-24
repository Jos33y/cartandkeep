import { useEffect, useMemo, useState } from 'react';
import { OrderRow, Journey, waited, waitedHours } from '@components/ui/portal/OrderRow';
import { useOrders, usePublicCatalogue, isToSend, isSent } from '@hooks/useOrders';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/orders-page.module.css';

const FILTERS = [
  { key: 'to_send', label: 'To send' },
  { key: 'sent', label: 'Dispatched' },
  { key: 'all', label: 'All' },
];

const sameMonth = (iso, now) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const dayKey = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

function Desk({ rows, first, live }) {
  const toSend = rows.filter(isToSend).sort((a, b) => waitedHours(b) - waitedHours(a));
  const oldest = toSend[0];
  const waitingValue = toSend.reduce((n, r) => n + Number(r.total ?? 0), 0);
  const now = new Date();
  const month = rows.filter((r) => sameMonth(r.paid_at, now) && r.status !== 'refunded');
  const taken = month.reduce((n, r) => n + Number(r.total ?? 0), 0);

  // Orders paid each of the last fourteen days.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const k = dayKey(d);
    return { k, n: rows.filter((r) => r.paid_at && dayKey(new Date(r.paid_at)) === k).length, today: i === 13 };
  });
  const peak = Math.max(1, ...days.map((d) => d.n));
  const late = oldest && waitedHours(oldest) >= 72;
  const due = oldest && waitedHours(oldest) >= 24;

  return (
    <section className={styles.desk} data-first={first || undefined}>
      <div className={styles.deskMain} data-tone={late ? 'late' : due ? 'due' : toSend.length ? 'fresh' : 'clear'}>
        <p className={styles.deskLabel}>To send</p>
        <p className={styles.deskFigure} data-num>{toSend.length}</p>
        <p className={styles.deskNote}>
          {first ? (live === 0 ? 'Nothing is live on the shop yet, so nobody can buy.' : 'The first paid order appears here within a minute.')
            : toSend.length
              ? <>Oldest waiting <b>{waited(oldest)}</b>, <span data-num>{formatGbp(waitingValue)}</span> to go out</>
              : 'Everything has gone out.'}
        </p>
      </div>

      <div className={styles.deskChart}>
        <p className={styles.deskLabel}>Paid orders, last 14 days</p>
        <ol className={styles.bars} aria-label="Paid orders per day">
          {days.map((d) => (
            <li key={d.k} data-today={d.today || undefined} title={`${d.k}: ${d.n}`}>
              <i style={{ height: `${first ? 0 : (d.n / peak) * 100}%` }} />
            </li>
          ))}
        </ol>
        <p className={styles.axis}><span>2 weeks ago</span><span>Today</span></p>
      </div>

      <div className={styles.deskMonth}>
        <p className={styles.deskLabel}>
          This month
          <Tip side="end" place="below" tone="light">Paid orders on your shop since the 1st, including delivery, with refunds taken out. eBay sales are under Finance.</Tip>
        </p>
        {first ? <p className={styles.deskNote} data-gap="">Starts with the first sale on your shop.</p> : (
          <>
            <p className={styles.monthFigure} data-num>{formatGbp(taken)}</p>
            <p className={styles.deskNote}><span data-num>{month.length}</span> {month.length === 1 ? 'order' : 'orders'}</p>
          </>
        )}
      </div>
    </section>
  );
}

const EXAMPLE = {
  id: 'example',
  reference: 'CK-1063',
  status: 'paid',
  name: 'Margaret Hughes',
  email: 'margaret.h@example.com',
  phone: null,
  address: { line1: '14 Elm Road', city: 'Leeds', postcode: 'LS6 2AB' },
  customer_note: 'Please leave it with number 16 if nobody is in.',
  subtotal: 23.41,
  delivery: 3.49,
  total: 26.9,
  paid_at: new Date(Date.now() - 26 * 3600000).toISOString(),
  created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
  dispatched_at: null,
  itemCount: 1,
  emails: { confirmation: { kind: 'confirmation', status: 'sent', created_at: new Date(Date.now() - 26 * 3600000).toISOString() } },
};

function FirstOrders({ live, shelf }) {
  const item = shelf[0] ?? { title: 'Bed Rails for Elderly Adults Adjustable Bed Assist Rail', image_url: null };
  const example = { ...EXAMPLE, items: [{ id: 'i1', title: item.title, image_url: item.image_url, qty: 1, unit_price: 23.41, line_total: 23.41 }] };
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.sub}>Nothing yet. Orders from your own shop land here, ready to pack. eBay orders stay in eBay.</p>
        </div>
      </header>
      <Desk rows={[]} first live={live} />
      <div className={styles.first}>
        <section>
          <p className={styles.firstLabel}>This is how one will arrive. It opens ready to dispatch.</p>
          <OrderRow order={example} example index={0} onSave={() => {}} onResend={() => {}} />
        </section>
        <Card>
          <CardHead title="How an order moves" />
          <div className={styles.flowDemo}><Journey order={{ ...example, dispatched_at: null }} compact /></div>
          <ol className={styles.steps}>
            <li><b>Paid</b>It lands here and the receipt is emailed to them by itself.</li>
            <li><b>You pack it</b>Print the packing slip, copy the address onto the label.</li>
            <li><b>Mark dispatched</b>Pick the carrier and they get the tracking email straight away.</li>
            <li><b>A week later</b>One email asks how it went, and the review comes to you.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState(null);
  const [toast, setToast] = useState(null);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, truncated, reload, saveDispatch, resendEmail } = useOrders(tenant?.id);
  const live = usePublicCatalogue(tenant?.id);
  const [shelf, setShelf] = useState([]);

  const counts = useMemo(() => ({ to_send: rows.filter(isToSend).length, sent: rows.filter(isSent).length, all: rows.length }), [rows]);
  const active = filter ?? (counts.to_send ? 'to_send' : 'all');

  const visible = useMemo(() => {
    if (active === 'all') return rows;
    if (active === 'sent') return rows.filter(isSent);
    // Oldest first: the one that has waited longest is the one to pack next.
    return rows.filter(isToSend).sort((a, b) => waitedHours(b) - waitedHours(a));
  }, [rows, active]);

  // The example on the first screen uses one of her own products.
  useEffect(() => {
    if (!tenant?.id || rows.length) return;
    supabase.from('store_products').select('title, image_url')
      .eq('tenant_id', tenant.id).eq('status', 'live').not('image_url', 'is', null).order('created_at').limit(1)
      .then(({ data }) => setShelf(data ?? []));
  }, [tenant?.id, rows.length]);

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The orders did not load</h1>
        <p className={styles.failureBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (rows.length === 0) return <FirstOrders live={live} shelf={shelf} />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.sub}>
            {counts.to_send
              ? <><span data-num>{counts.to_send}</span> to pack and send, oldest first.</>
              : 'Every order has gone out. New ones land at the top.'}
          </p>
        </div>
      </header>

      <Desk rows={rows} live={live} />

      <div className={styles.tabs} role="group" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={styles.tab} aria-pressed={active === f.key} onClick={() => setFilter(f.key)}>
            {f.key === 'to_send' && counts.to_send > 0 && <i className={styles.pulse} aria-hidden="true" />}
            {f.label}<span data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {truncated && <p className={styles.truncated}>The most recent 200 orders. The figures above cover those.</p>}

      {visible.length === 0 ? (
        <Card className={styles.none}>
          <span className={styles.noneMark}><Icon name="IconCheck" width="24" height="24" /></span>
          <p className={styles.noneTitle}>{active === 'to_send' ? 'Everything has gone out' : 'Nothing dispatched yet'}</p>
          <p className={styles.noneBody}>{active === 'to_send' ? 'New orders land here, oldest at the top.' : 'Orders you mark dispatched move here.'}</p>
        </Card>
      ) : (
        <div className={styles.list}>
          {visible.map((order, i) => (
            <OrderRow key={order.id} order={order} index={i}
              onSave={(fields) => saveDispatch({ id: order.id, ...fields })}
              onResend={({ kind }) => resendEmail({ id: order.id, kind })}
              onDispatched={(o) => {
                setToast(`${o.reference} is on its way. ${o.name?.split(' ')[0] ?? 'They'} ${o.name ? 'has' : 'have'} the tracking email.`);
                setTimeout(() => setToast(null), 3200);
              }} />
          ))}
        </div>
      )}

      {toast && (
        <p className={styles.toast} role="status">
          <span className={styles.toastMark}><Icon name="IconCheck" width="14" height="14" /></span>{toast}
        </p>
      )}
    </div>
  );
}
