import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { OrderRow } from '@components/ui/portal/OrderRow';
import { useOrders, usePublicCatalogue, isToSend, isSent } from '@hooks/useOrders';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/orders-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

const FILTERS = [
  { key: 'to_send', label: 'To send' },
  { key: 'sent', label: 'Dispatched' },
  { key: 'all', label: 'All' },
];

/*
 * The shape of the screen before there is anything in it.
 *
 * Net is not a column here and it was in the version this replaces. There is no
 * cost on store_products, and candidate_id is null on all 78 seeded rows
 * because they came off her eBay listings rather than out of the pipeline, so
 * what was left after fulfilment is not a number this database can produce.
 * Showing a column for it would be promising an answer nothing can fill.
 */
const PREVIEW_COLUMNS = [
  { key: 'ref', label: 'Order' },
  { key: 'items', label: 'Items' },
  { key: 'state', label: 'State' },
  { key: 'total', label: 'Taken', align: 'right' },
];

const PREVIEW_ROWS = [{}, {}, {}];

function sameMonth(iso, now) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function OrdersPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('to_send');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, truncated, reload, saveDispatch, resendEmail } = useOrders(tenant?.id);
  const live = usePublicCatalogue(tenant?.id);

  const counts = useMemo(() => ({
    to_send: rows.filter(isToSend).length,
    sent: rows.filter(isSent).length,
    all: rows.length,
  }), [rows]);

  /*
   * The month, computed from the rows that loaded.
   *
   * Refunded orders are out of the money figure because the money went back.
   * `total` includes delivery, which the label says, because a figure called
   * takings that quietly means something else is the kind of number that gets
   * repeated in a meeting.
   */
  const month = useMemo(() => {
    const now = new Date();
    const paid = rows.filter((r) => sameMonth(r.paid_at, now));
    const kept = paid.filter((r) => r.status !== 'refunded');
    return {
      orders: paid.length,
      taken: kept.reduce((n, r) => n + Number(r.total ?? 0), 0),
    };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'sent') return rows.filter(isSent);
    return rows.filter(isToSend);
  }, [rows, filter]);

  // undefined means still resolving. Only a settled null is an empty state.
  if (tenant === undefined) {
    return <PageSkeleton />;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>The orders did not load</h1>
        <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.retry} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Your own store"
        title="The first order lands here"
        icon="IconBox"
        body="What was bought, where it goes, and somewhere to put the tracking number."
        columns={PREVIEW_COLUMNS}
        rows={PREVIEW_ROWS}
        note={live === 0
          ? 'Nothing in the catalogue is public yet, so the shop is empty to anyone who is not signed in. Approve the products and it opens. eBay orders stay in eBay: this screen covers the store we are building for you.'
          : 'eBay orders stay in eBay. This screen covers the store we are building for you.'}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headline}>
          <p className="micro">Your own store</p>
          <h1 className={styles.title}>Orders</h1>
        </div>

        <dl className={styles.stats}>
          <Stat label="To send" value={counts.to_send} />
          <Stat label="Paid this month" value={month.orders} />
          <Stat
            label="Taken this month"
            value={formatGbp(month.taken)}
            foot="including delivery, refunds out"
          />
        </dl>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
            <span className={styles.chipCount} data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {status === 'loading' ? 'Loading orders' : ''}
      </p>

      {/* Says so rather than quietly summing over a partial page. */}
      {truncated && (
        <p className={styles.truncated}>
          Showing the most recent 200 orders. The figures above cover those.
        </p>
      )}

      {status === 'ready' && visible.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {filter === 'to_send' ? 'Every order has gone out' : 'Nothing dispatched yet'}
          </h2>
          <p className={styles.emptyBody}>
            {filter === 'to_send'
              ? 'Anything new lands at the top of this list.'
              : 'Orders you mark dispatched move here.'}
          </p>
        </div>
      )}

      <div className={styles.ledger}>
        {visible.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onSave={(fields) => saveDispatch({ id: order.id, ...fields })}
            onResend={({ kind }) => resendEmail({ id: order.id, kind })}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, foot }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
      {foot && <dd className={styles.statFoot}>{foot}</dd>}
    </div>
  );
}
