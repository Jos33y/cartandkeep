import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useOverview, nextMonday } from '@hooks/useOverview';
import { BatchScatter } from '@components/ui/portal/BatchScatter';
import { Icon } from '@components/ui/icons';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/overview-page.module.css';

const day = (d, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts }).format(d);

const SPLIT = [
  { key: 'approved', label: 'Approved', cls: 'segApproved' },
  { key: 'rejected', label: 'Rejected', cls: 'segRejected' },
  { key: 'deferred', label: 'Later', cls: 'segDeferred' },
  { key: 'pending', label: 'To review', cls: 'segPending' },
];

export function OverviewPage() {
  const [tenant, setTenant] = useState(null);
  useEffect(() => { loadTenant().then(setTenant); }, []);

  const o = useOverview(tenant?.id);
  const delivery = useMemo(() => nextMonday(), []);
  const hasBatch = Boolean(o.batch);

  // What is still on the table, which is the number that moves as she works.
  //
  // Headroom is per unit, so adding it across products totalled a set of
  // ceilings that no one product could earn twice and none could earn at the
  // same time. Forty one products at nine pounds each is not forty one times
  // nine. Multiplied by units it becomes a month of trading at current rates,
  // which is a figure she can act on, and it is the same arithmetic already
  // shown on every candidate row as "a month before goods".
  const undecidedMonthly = o.rows
    .filter((r) => !r.action && r.headroom != null)
    .reduce((a, r) => a + r.headroom * Number(r.sold_30d ?? 0), 0);

  const decided = o.counts.approved + o.counts.rejected + o.counts.deferred;
  const pct = o.counts.total ? Math.round((decided / o.counts.total) * 100) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Overview</p>
        <h1 className={styles.title}>
          {hasBatch
            ? o.counts.pending > 0
              ? `${o.counts.pending} left to review`
              : 'This week is cleared'
            : 'Nothing to review yet'}
        </h1>
        <p className={styles.sub}>
          {hasBatch ? (
            o.batches.length > 1 ? (
              <>Across {o.batches.length} batches</>
            ) : (
              <>Batch for {day(new Date(o.batch.delivered_for), { day: 'numeric', month: 'long' })}</>
            )
          ) : (
            <>First batch lands {day(delivery, { weekday: 'long', day: 'numeric', month: 'long' })}</>
          )}
        </p>

        {o.batches.length > 1 && (
          <ul className={styles.batchBreak}>
            {o.batches.map((b) => (
              <li key={b.id} className={styles.batchLine}>
                <span className={styles.num}>{b.pending}</span>
                <span className={styles.batchName}>{b.category_label || 'Batch'}</span>
                <span className={styles.batchDate}>
                  {day(new Date(b.delivered_for), { day: 'numeric', month: 'long' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </header>

      {hasBatch && (
        <section className={styles.split} aria-label="Decisions this batch">
          <div className={styles.splitBar} role="img"
            aria-label={SPLIT.map((s) => `${s.label} ${o.counts[s.key]}`).join(', ')}>
            {SPLIT.map((s) =>
              o.counts[s.key] > 0 ? (
                <span key={s.key} className={`${styles.seg} ${styles[s.cls]}`}
                  style={{ flexGrow: o.counts[s.key] }} />
              ) : null,
            )}
          </div>
          <dl className={styles.legend}>
            {SPLIT.map((s) => (
              <div key={s.key} className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles[s.cls]}`} aria-hidden="true" />
                <dt>{s.label}</dt>
                <dd>{o.counts[s.key]}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.splitMeta}>
            <span className={styles.num}>{pct}%</span> of the batch decided
          </p>
        </section>
      )}

      {hasBatch ? (
        <section className={styles.figures} aria-label="This week">
          <Figure label="To review" value={o.counts.pending}
            to={portalPath('/candidates')} cta="Open the queue" />
          <Figure label="A month before goods, undecided" value={formatGbp(undecidedMonthly)} money />
          {o.netIfSold > 0 && (
            <Figure label="Net if all sell once" value={formatGbp(o.netIfSold)} money />
          )}
          <Figure label="Live listings" value={o.listings} />
        </section>
      ) : (
        <section className={styles.flow} aria-label="What happens on Monday">
          <Step icon="IconLayers" title="Research runs"
            body="Sold listings are filtered against the gates. Only what clears them reaches you." />
          <Step icon="IconCheck" title="You decide"
            body="Approve, reject or defer. Every rejection reason tunes the next batch." />
          <Step icon="IconTag" title="Approved go live"
            body="What you approve becomes a listing, then shows up in performance." />
        </section>
      )}

      {o.batches.filter((b) => b.rows.length > 1).map((b) => (
        <section key={b.id} className={styles.block}>
          <h2 className={styles.blockLabel}>
            {o.batches.length > 1 ? b.category_label || 'The shape of this batch' : 'The shape of this batch'}
          </h2>
          <BatchScatter rows={b.rows} />
        </section>
      ))}

      {o.performance.units > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel}>Thirty days after listing</h2>
          <div className={styles.figures}>
            <Figure label="Units sold" value={o.performance.units} />
            <Figure label="Revenue" value={formatGbp(o.performance.revenue)} money />
            <Figure label="Net" value={formatGbp(o.performance.net)} money />
          </div>
        </section>
      )}

      {o.reasons.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockLabel}>Why things were rejected</h2>
          <ul className={styles.reasons}>
            {o.reasons.map(({ reason, count }) => {
              const label = REJECTION_REASONS.find((r) => r.value === reason)?.label ?? reason;
              const top = o.reasons[0].count || 1;
              return (
                <li key={reason} className={styles.reason}>
                  <span className={styles.reasonLabel}>{label}</span>
                  <span className={styles.reasonTrack}>
                    <span className={styles.reasonFill} style={{ width: `${(count / top) * 100}%` }} />
                  </span>
                  <span className={styles.num}>{count}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.blockNote}>
            Repeated reasons move the weights. Enough of one and the gate tightens on its own.
          </p>
        </section>
      )}

      <section className={styles.block}>
        <h2 className={styles.blockLabel}>Data sources</h2>
        {o.sources.length === 0 ? (
          <p className={styles.blockNote}>No sources enabled yet.</p>
        ) : (
          <ul className={styles.sources}>
            {o.sources.map((s) => (
              <li key={s.id} className={styles.source}>
                <span className={`${styles.dot} ${styles[s.lastStatus === 'ok' ? 'ok' : s.lastStatus ? 'bad' : 'idle']}`}
                  aria-hidden="true" />
                <span className={styles.sourceName}>{s.name}</span>
                <span className={styles.sourceMeta}>
                  {s.lastRunAt
                    ? day(new Date(s.lastRunAt), { day: '2-digit', month: 'short' })
                    : 'Not run'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Step({ icon, title, body }) {
  return (
    <div className={styles.step}>
      <Icon name={icon} className={styles.stepIcon} />
      <p className={styles.stepTitle}>{title}</p>
      <p className={styles.stepBody}>{body}</p>
    </div>
  );
}

function Figure({ label, value, money = false, to, cta }) {
  const body = (
    <>
      <p className={styles.figureLabel}>{label}</p>
      <p className={`${styles.figureValue} ${money ? styles.figureMoney : ''}`}>{value}</p>
      {cta ? <span className={styles.figureCta}>{cta}</span> : null}
    </>
  );

  if (to) return <Link to={to} className={`${styles.figure} ${styles.figureLink}`}>{body}</Link>;
  return <div className={styles.figure}>{body}</div>;
}
