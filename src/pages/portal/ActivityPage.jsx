import { useEffect, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { useActivity } from '@hooks/useActivity';
import { loadTenant } from '@lib/tenant';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/activity-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

const COLUMNS = [
  { key: 'when', label: 'When' },
  { key: 'what', label: 'Decision' },
  { key: 'product', label: 'Product' },
  { key: 'reason', label: 'Reason' },
];

const ROWS = [{}, {}, {}, {}, {}];

const ACTION = { approve: 'Approved', reject: 'Rejected', defer: 'Saved for later' };

const reasonLabel = (r) => (r ? REJECTION_REASONS.find((x) => x.value === r)?.label ?? r : null);

const when = (ts) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(ts));

// A cleared decision has no to_action. Saying so is the point of the log.
function describe(e) {
  if (!e.to_action) return { verb: 'Undecided', from: ACTION[e.from_action] ?? null };
  return { verb: ACTION[e.to_action] ?? e.to_action, from: e.from_action ? ACTION[e.from_action] : null };
}

export function ActivityPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows } = useActivity(tenant?.id);

  if (tenant === undefined || status === 'loading') {
    return <PageSkeleton />;
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Activity"
        title="Nothing recorded yet"
        icon="IconClock"
        body="Every decision with its date and reason, so you can look back at what you passed on and why."
        columns={COLUMNS}
        rows={ROWS}
        note="Your rejection reasons are also what tunes the research. Enough of the same reason and the threshold moves on its own, so this record is worth more than it looks."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Activity</p>
        <h1 className={styles.title}>What has been decided</h1>
        <p className={styles.lead}>
          Every decision and every change to one, in order. A row that says Undecided
          is a decision that was taken back.
        </p>
      </header>

      <ol className={styles.log}>
        {rows.map((e) => {
          const { verb, from } = describe(e);
          const reason = reasonLabel(e.to_reason ?? e.from_reason);

          return (
            <li key={e.id} className={styles.event}>
              <p className={styles.when} data-num>{when(e.happened_at)}</p>

              <div className={styles.body}>
                <p className={styles.what}>
                  <span className={`${styles.verb} ${styles[e.to_action ?? 'cleared']}`}>{verb}</span>
                  {from && <span className={styles.from}> was {from}</span>}
                </p>
                <p className={styles.product}>{e.candidate_title ?? 'Product no longer in the batch'}</p>
                {e.note && <p className={styles.note}>{e.note}</p>}
              </div>

              <p className={styles.reason}>{reason ?? ''}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
