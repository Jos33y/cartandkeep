import { useEffect, useMemo, useState } from 'react';
import { CandidateRow } from '@components/ui/portal/CandidateRow';
import { useCandidates, useLatestBatch } from '@hooks/useCandidates';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/candidates-page.module.css';

const FILTERS = [
  { key: 'pending', label: 'To review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function CandidatesPage() {
  const [tenant, setTenant] = useState(null);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { loadTenant().then(setTenant); }, []);

  const batch = useLatestBatch(tenant?.id);
  const { status, rows, decide } = useCandidates(batch?.id);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'pending') return rows.filter((r) => !r.decision);
    if (filter === 'approved') return rows.filter((r) => r.decision?.action === 'approve');
    return rows.filter((r) => r.decision?.action === 'reject');
  }, [rows, filter]);

  const reviewed = rows.filter((r) => r.decision).length;
  const approved = rows.filter((r) => r.decision?.action === 'approve');
  const potential = approved.reduce((a, r) => a + (r.margin?.net ?? 0), 0);

  if (!batch) {
    return (
      <div className={styles.empty}>
        <p className="micro">No batch yet</p>
        <h1 className={styles.emptyTitle}>The first candidates land Monday</h1>
        <p className={styles.emptyBody}>
          Each week brings filtered products with the margin already worked out.
          You approve, reject or defer. Nothing to do until then.
        </p>
      </div>
    );
  }

  const week = new Date(batch.delivered_for).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long',
  });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headline}>
          <p className="micro">Week of {week}</p>
          <h1 className={styles.title}>Candidates</h1>
        </div>

        <dl className={styles.stats}>
          <Stat label="Reviewed" value={`${reviewed}/${rows.length}`} />
          <Stat label="Approved" value={approved.length} />
          <Stat label="Net if all sell once" value={formatGbp(potential)} />
        </dl>
      </header>

      <div className={styles.track} role="progressbar" aria-valuemin={0}
        aria-valuemax={rows.length} aria-valuenow={reviewed} aria-label="Candidates reviewed">
        <div className={styles.trackFill}
          style={{ width: rows.length ? `${(reviewed / rows.length) * 100}%` : '0%' }} />
      </div>

      <div className={styles.filters} role="group" aria-label="Filter candidates">
        {FILTERS.map((f) => (
          <button key={f.key} aria-pressed={filter === f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {status === 'loading' ? 'Loading batch' : ''}
      </p>

      {status === 'ready' && visible.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nothing left here</h2>
          <p className={styles.emptyBody}>Every candidate in this view has been handled.</p>
        </div>
      )}

      <div className={styles.ledger}>
        {visible.map((c) => (
          <CandidateRow key={c.id} candidate={c}
            onDecide={(payload) => decide({ candidateId: c.id, tenantId: tenant.id, ...payload })} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
    </div>
  );
}
