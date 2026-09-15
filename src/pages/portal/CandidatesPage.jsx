import { useEffect, useMemo, useState } from 'react';
import { CandidateRow } from '@components/ui/portal/CandidateRow';
import { useCandidates, useBatches } from '@hooks/useCandidates';
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

// What a small seller is taking on this in a month, before goods. Written at
// import, and only where entry is proved.
//
// The fallback that used to sit here multiplied headroom by the whole sampled
// market's units whenever the column was null. That is the figure removed from
// the card for showing £3,734 a month on a caravan pump, and null is not a gap
// to fill: it means nobody her size is proved to be selling, so there is no
// rate to compute against.
const worthPerMonth = (r) => r.monthly_headroom ?? null;

// The order she should work a group in, matching the board order the hook
// returns. Sorting on worth alone put the rows with no evidence on top,
// because the ones nobody her size sells have the whole market's units behind
// them.
const trusted = (r) => r.margin?.list_trusted === true;

function byWorkOrder(a, b) {
  const rank = (r) => {
    if (r.entry?.proved && trusted(r)) return 0;
    if (r.entry?.proved) return 1;
    if (r.entry?.seller_feedback != null) return 2;
    return 3;
  };
  const sinks = (r) => (r.tier === 'slipping' ? 1 : 0);
  return sinks(a) - sinks(b)
    || rank(a) - rank(b)
    || (worthPerMonth(b) ?? 0) - (worthPerMonth(a) ?? 0)
    || (b.margin?.net ?? b.margin?.max_goods_cost ?? 0) - (a.margin?.net ?? a.margin?.max_goods_cost ?? 0);
}

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

  const batches = useBatches(tenant?.id);
  // Newest by default, because that is the one she was sent. Choosing another
  // is deliberate, so the choice lives in state and not in the URL.
  const [batchId, setBatchId] = useState(null);
  const batch = batches === undefined
    ? undefined
    : (batches.find((b) => b.id === batchId) ?? batches[0] ?? null);
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

  // Grouped by cluster, which is the eBay leaf the listing sits in. A whole
  // batch under one top level heading is one list of 178, and she reviews a
  // product type at a time. Falls back to the boundary label where a row was
  // never enriched.
  const groups = useMemo(() => {
    const map = new Map();

    for (const r of visible) {
      // The boundary label is only a fallback for a row enrichment has not
      // reached. Whether a category was agreed at signing no longer changes the
      // display: the categories move when one stops working, so a group is not
      // owed a warning for being new.
      const { label } = matchBoundary(r.ebay_category_path, boundaries);
      const key = r.cluster || label || 'Not known';
      if (!map.has(key)) map.set(key, { label: key, rows: [], worth: 0, provable: 0 });
      const g = map.get(key);
      g.rows.push(r);
      g.worth += worthPerMonth(r) ?? 0;
      if (r.entry?.proved && trusted(r)) g.provable += 1;
    }

    for (const g of map.values()) {
      g.rows.sort(byWorkOrder);
      g.slipping = g.rows.filter((r) => r.tier === 'slipping').length;
    }

    // The cluster she can actually get into first. Ranking on worth alone put
    // the groups with no entry proof on top, since worth is null there and the
    // ones with the biggest markets are the ones she cannot enter.
    return [...map.values()].sort(
      (a, b) => b.provable - a.provable || b.worth - a.worth || b.rows.length - a.rows.length,
    );
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
          <h1 className={styles.title}>{batch.category_label || 'Candidates'}</h1>
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

      {batches.length > 1 && (
        <div className={styles.batches} role="group" aria-label="Choose a batch">
          {batches.map((b) => (
            <button key={b.id} aria-pressed={b.id === batch.id}
              className={`${styles.chip} ${b.id === batch.id ? styles.chipOn : ''}`}
              onClick={() => setBatchId(b.id)}>
              {b.category_label || weekOf(b.delivered_for) || 'Batch'}
              <span className={styles.chipCount} data-num>{b.candidate_count}</span>
            </button>
          ))}
        </div>
      )}

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
