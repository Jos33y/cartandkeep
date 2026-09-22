import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useActivity } from '@hooks/useActivity';
import { loadTenant } from '@lib/tenant';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/activity-page.module.css';

const COLUMNS = [
  { key: 'when', label: 'When' },
  { key: 'what', label: 'Decision' },
  { key: 'product', label: 'Product' },
  { key: 'reason', label: 'Reason' },
];

const ROWS = [{}, {}, {}, {}, {}];

const KINDS = {
  approve: { label: 'Approved', icon: 'IconCheck', tone: 'positive' },
  reject: { label: 'Rejected', icon: 'IconX', tone: 'negative' },
  defer: { label: 'Saved for later', icon: 'IconClock', tone: 'warning' },
  undone: { label: 'Taken back', icon: 'IconRefresh', tone: 'quiet' },
};

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'approve', label: 'Approved' },
  { key: 'reject', label: 'Rejected' },
  { key: 'defer', label: 'Later' },
  { key: 'undone', label: 'Taken back' },
];

const reasonLabel = (r) => (r ? REJECTION_REASONS.find((x) => x.value === r)?.label ?? r : null);
const kindOf = (e) => e.to_action ?? 'undone';

const time = (ts) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
}).format(new Date(ts));

const dayKey = (ts) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(ts));

function dayLabel(ts) {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86400000);
  const day = dayKey(ts);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return day.replace(` ${new Date().getFullYear()}`, '');
}

export function ActivityPage() {
  const [tenant, setTenant] = useState(undefined);
  const [only, setOnly] = useState('all');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows } = useActivity(tenant?.id);

  const counts = useMemo(() => rows.reduce((o, e) => {
    const k = kindOf(e);
    o[k] = (o[k] ?? 0) + 1;
    o.all += 1;
    return o;
  }, { all: 0 }), [rows]);

  const days = useMemo(() => {
    const shown = only === 'all' ? rows : rows.filter((e) => kindOf(e) === only);
    const map = new Map();
    for (const e of shown) {
      const k = dayKey(e.happened_at);
      if (!map.has(k)) map.set(k, { label: dayLabel(e.happened_at), events: [] });
      map.get(k).events.push(e);
    }
    return [...map.values()];
  }, [rows, only]);

  if (tenant === undefined || status === 'loading') return <PageSkeleton />;

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Activity"
        title="Nothing decided yet"
        icon="IconClock"
        body="Every decision with its date and reason, so you can look back at what was passed on and why."
        columns={COLUMNS}
        rows={ROWS}
        note="Rejection reasons are also what tunes the research. Enough of the same reason and the threshold moves, so this record is worth more than it looks."
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Activity</p>
        <h1 className={styles.title}>What has been decided</h1>
      </header>

      <div className={styles.filters} role="tablist" aria-label="Show">
        {FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={only === f.key}
            className={`${styles.filter} ${only === f.key ? styles.filterOn : ''}`}
            onClick={() => setOnly(f.key)}>
            {f.key !== 'all' && <i className={styles.dot} data-tone={KINDS[f.key].tone} aria-hidden="true" />}
            {f.label}
            <span className={styles.count} data-num>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {days.map((d) => (
        <section key={d.label} className={styles.day}>
          <header className={styles.dayHead}>
            <h2 className={styles.dayTitle}>{d.label}</h2>
            <span className={styles.dayCount} data-num>{d.events.length}</span>
          </header>

          <ol className={styles.log}>
            {d.events.map((e) => {
              const k = KINDS[kindOf(e)];
              const reason = reasonLabel(e.to_reason ?? e.from_reason);
              const was = kindOf(e) === 'undone' && e.from_action ? KINDS[e.from_action]?.label : null;

              return (
                <li key={e.id} className={styles.event} data-tone={k.tone}>
                  <span className={styles.badge}><Icon name={k.icon} className={styles.badgeIcon} /></span>

                  <div className={styles.body}>
                    <p className={styles.product}>{e.candidate_title ?? 'Product no longer in the batch'}</p>
                    <p className={styles.what}>
                      <span className={styles.verb}>
                        {k.label}
                        {was && <span className={styles.from}>, was {was.toLowerCase()}</span>}
                      </span>
                      {reason && <span className={styles.reason}>{reason}</span>}
                    </p>
                    {e.note && <p className={styles.note}>{e.note}</p>}
                  </div>

                  <time className={styles.time} dateTime={e.happened_at} data-num>{time(e.happened_at)}</time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {days.length === 0 && <p className={styles.none}>Nothing of that kind yet.</p>}
    </div>
  );
}
