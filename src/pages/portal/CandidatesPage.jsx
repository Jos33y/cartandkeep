import { useEffect, useMemo, useState } from 'react';
import { CandidateRow } from '@components/ui/portal/CandidateRow';
import { useCandidates, useLatestBatch } from '@hooks/useCandidates';
import { useBoundaries } from '@hooks/useBoundaries';
import { useSuppliers } from '@hooks/useSuppliers';
import { loadTenant } from '@lib/tenant';
import { matchBoundary } from '@utils/category';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/candidates-page.module.css';

const FILTERS = [
  { key: 'pending', label: 'To review' },
  { key: 'approved', label: 'Approved' },
  { key: 'deferred', label: 'Later' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

// A defer is a decision to look again, not a review. Counting it as reviewed
// tells her she is finished when there is a pile still waiting.
const isSettled = (r) => r.decision?.action === 'approve' || r.decision?.action === 'reject';

function weekOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function CandidatesPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const batch = useLatestBatch(tenant?.id);
  const boundaries = useBoundaries(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const { status, rows, decide, clear, addNote, addSource } = useCandidates(batch?.id);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'pending') return rows.filter((r) => !r.decision);
    if (filter === 'deferred') return rows.filter((r) => r.decision?.action === 'defer');
    if (filter === 'approved') return rows.filter((r) => r.decision?.action === 'approve');
    return rows.filter((r) => r.decision?.action === 'reject');
  }, [rows, filter]);

  // Grouped, because a score of 72 on a cat bowl and 72 on a dog bed are built
  // the same way and mean different things. Ranking compares within a group.
  const groups = useMemo(() => {
    const map = new Map();

    for (const r of visible) {
      const { label, agreed } = matchBoundary(r.ebay_category_path, boundaries);
      const key = label ?? 'Not known';
      if (!map.has(key)) map.set(key, { label: key, agreed, rows: [] });
      map.get(key).rows.push(r);
    }

    // Holding first inside a group. A slipping product is worth seeing, not
    // worth ranking against one that is not slipping.
    for (const g of map.values()) {
      g.rows.sort((a, b) => {
        const t = (r) => (r.tier === 'slipping' ? 1 : 0);
        return t(a) - t(b) || (b.score ?? 0) - (a.score ?? 0);
      });
      g.slipping = g.rows.filter((r) => r.tier === 'slipping').length;
    }

    return [...map.values()].sort((a, b) => {
      if (a.agreed !== b.agreed) return a.agreed ? -1 : 1;
      return b.rows.length - a.rows.length;
    });
  }, [visible, boundaries]);

  const counts = useMemo(() => ({
    pending: rows.filter((r) => !r.decision).length,
    deferred: rows.filter((r) => r.decision?.action === 'defer').length,
    approved: rows.filter((r) => r.decision?.action === 'approve').length,
    rejected: rows.filter((r) => r.decision?.action === 'reject').length,
    all: rows.length,
  }), [rows]);

  const reviewed = rows.filter(isSettled).length;
  const approved = rows.filter((r) => r.decision?.action === 'approve');

  // Headroom is before goods cost, so this is not profit and is not labelled as
  // profit. Rows with no figure are excluded and counted rather than read as nil.
  const priced = approved.filter((r) => (r.headroom ?? r.margin?.headroom) != null);
  const headroom = priced.reduce((a, r) => a + (r.headroom ?? r.margin.headroom), 0);
  const unpriced = approved.length - priced.length;

  // undefined means still resolving. Only a settled null is an empty state.
  if (tenant === undefined || batch === undefined) {
    return (
      <p className={styles.status} role="status" aria-live="polite">Loading</p>
    );
  }

  if (!batch) {
    return (
      <div className={styles.empty}>
        <p className="micro">No batch yet</p>
        <h1 className={styles.emptyTitle}>The first candidates land Monday</h1>
        <p className={styles.emptyBody}>
          Each week brings filtered products with the numbers already worked out.
          You approve, reject or defer. Nothing to do until then.
        </p>
      </div>
    );
  }

  const week = weekOf(batch.delivered_for);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headline}>
          <p className="micro">{week ? `Week of ${week}` : 'Latest batch'}</p>
          <h1 className={styles.title}>Candidates</h1>
        </div>

        <dl className={styles.stats}>
          <Stat label="Reviewed" value={`${reviewed}/${rows.length}`} />
          <Stat label="Approved" value={approved.length} />
          <Stat
            label="Headroom approved"
            value={formatGbp(headroom)}
            foot={unpriced ? `${unpriced} without a figure` : 'per unit, before goods'}
          />
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
            <span className={styles.chipCount} data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {status === 'loading' ? 'Loading batch' : ''}
      </p>

      {status === 'error' && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>The batch did not load</h2>
          <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        </div>
      )}

      {status === 'ready' && visible.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {filter === 'pending' ? 'Every candidate is decided' : 'Nothing in this view'}
          </h2>
          <p className={styles.emptyBody}>
            {filter === 'pending'
              ? 'The approved ones are ready to list.'
              : 'Try another filter.'}
          </p>
        </div>
      )}

      <div className={styles.groups}>
      {groups.map((g) => (
        <section key={g.label} className={styles.group}>
          <header className={styles.groupHead}>
            <h2 className={styles.groupLabel}>{g.label}</h2>
            <p className={styles.groupCount}>
              <span data-num>{g.rows.length}</span> {g.rows.length === 1 ? 'product' : 'products'}
              {g.slipping > 0 && <>, <span data-num>{g.slipping}</span> slipping</>}
              {!g.agreed && <span className={styles.outside}>outside the agreed categories</span>}
            </p>
          </header>

          <div className={styles.ledger}>
            {g.rows.map((c) => (
              <CandidateRow key={c.id} candidate={c}
                onDecide={(payload) => decide({ candidateId: c.id, tenantId: tenant.id, ...payload })}
                onClear={() => clear({ candidateId: c.id })}
                onNote={(body) => addNote({ candidateId: c.id, tenantId: tenant.id, body })}
                suppliers={suppliers}
                onSource={async (fields) => {
                  await addSource({ candidateId: c.id, tenantId: tenant.id, ...fields });
                  await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
                }} />
            ))}
          </div>
        </section>
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
