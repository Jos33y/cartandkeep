import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CandidateRow } from '@components/ui/portal/CandidateRow';
import { Tip } from '@components/ui/portal/primitives';
import { PageSkeleton, RowSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useCandidates, useBatches, groupBatches } from '@hooks/useCandidates';
import { useSuppliers } from '@hooks/useSuppliers';
import { loadTenant } from '@lib/tenant';
import { assess } from '@lib/assess';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/candidates-page.module.css';

const FILTERS = [
  { key: 'pending', label: 'To review', tone: 'open' },
  { key: 'approve', label: 'Approved', tone: 'positive' },
  { key: 'defer', label: 'Later', tone: 'warning' },
  { key: 'reject', label: 'Rejected', tone: 'negative' },
  { key: 'all', label: 'All' },
];

const LANES = [
  {
    key: 'ready',
    title: 'Worth approving',
    tip: 'A small seller is converting on this. With a real cost it lists at their price when that pays your profit, otherwise at your floor. Without one, it is priced from the most their price allows the goods to cost, so it sits a little above them until you find it cheaper.',
  },
  {
    key: 'call',
    title: 'Your call',
    tip: 'Either no small seller is proved to be selling it, or the price is the market median rather than one a small seller is being paid.',
  },
  {
    key: 'store',
    title: 'To list on the shop',
    tip: 'Sells on Google in the UK and is stocked by a UK shop, so it can be sourced once an order comes in. Listed at Google\'s lowest price when that clears your floor, otherwise at your floor, and the card says where that sits against Google. Your floor is the cheapest cost, Royal Mail for its weight, packing, the card fee, a returns allowance and your profit.',
  },
  {
    key: 'short',
    title: 'Keeps under the target',
    tip: 'The known cost, from the same pack on a shelf or a supplier you added, keeps under your profit at this price: £3 under £15, £4 to £30, £5 above. Find it cheaper or list higher.',
  },
];

const RANK = (a) => (a.entry?.proved ? 0 : a.entry ? 1 : 2);

function byLane(x, y) {
  if (x.a.store) return (!x.a.m.need) - (!y.a.m.need) || (y.a.g.months ?? 0) - (x.a.g.months ?? 0) || (x.a.g.rank ?? 1e9) - (y.a.g.rank ?? 1e9);
  if (x.a.lane === 'ready') return (y.a.month ?? 0) - (x.a.month ?? 0) || (y.a.keep ?? 0) - (x.a.keep ?? 0);
  return RANK(x.a) - RANK(y.a) || (y.a.keep ?? 0) - (x.a.keep ?? 0);
}

const inFilter = (row, f) => (f === 'all' ? true : f === 'pending' ? !row.decision : row.decision?.action === f);

const typing = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

const DONE = { approve: 'Approved', reject: 'Rejected', defer: 'Saved for later' };

function weekOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function CandidatesPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('pending');
  const [find, setFind] = useState('');
  const [source, setSource] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [toast, setToast] = useState(null);
  const moved = useRef(false);

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const batches = useBatches(tenant?.id);
  const groups = useMemo(() => (batches === undefined ? undefined : groupBatches(batches)), [batches]);
  const group = groups === undefined
    ? undefined
    : (groups.find((g) => g.key === source) ?? groups[0] ?? null);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const { status, rows, decide, clear, addNote, addSource } = useCandidates(group?.ids ?? []);

  const assessed = useMemo(() => rows.map((row) => ({ row, a: assess(row) })), [rows]);

  const counts = useMemo(() => Object.fromEntries(
    FILTERS.map((f) => [f.key, assessed.filter(({ row }) => inFilter(row, f.key)).length]),
  ), [assessed]);

  const lanes = useMemo(() => {
    const q = find.trim().toLowerCase();
    const shown = assessed
      .filter(({ row }) => inFilter(row, filter))
      .filter(({ a }) => !q || a.title.toLowerCase().includes(q));
    return LANES
      .map((l) => ({ ...l, items: shown.filter(({ a }) => a.lane === l.key).sort(byLane) }))
      .filter((l) => l.items.length > 0);
  }, [assessed, filter, find]);

  const order = useMemo(() => lanes.flatMap((l) => l.items), [lanes]);

  // Keep a row active so the keyboard always has somewhere to act.
  useEffect(() => {
    if (!order.length) return;
    if (!order.some(({ row }) => row.id === activeId)) setActiveId(order[0].row.id);
  }, [order, activeId]);

  useEffect(() => {
    if (!moved.current || !activeId) return;
    moved.current = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(`[data-candidate="${activeId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [activeId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.failed ? 10000 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(async ({ row, a }, payload) => {
    // The decided row leaves every view but All, so the next one takes its place.
    if (filter !== 'all') {
      const i = order.findIndex((o) => o.row.id === row.id);
      const next = order[i + 1] ?? order[i - 1] ?? null;
      setActiveId(next?.row.id ?? null);
      if (openId === row.id) setOpenId(null);
    }
    setRejectingId(null);
    await decide({ candidateId: row.id, tenantId: tenant.id, ...payload });
    setToast({ id: row.id, title: a.title, action: payload.action });
  }, [filter, order, openId, decide, tenant]);

  const undo = useCallback(async (id) => {
    setToast(null);
    try {
      await clear({ candidateId: id });
      setActiveId(id);
    } catch (e) {
      setToast({ failed: e?.message ?? 'Undo did not save. Try again.' });
    }
  }, [clear]);

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const i = order.findIndex((o) => o.row.id === activeId);
      const cur = order[i];
      const go = (n) => {
        const next = order[Math.max(0, Math.min(order.length - 1, i + n))];
        if (!next) return;
        moved.current = true;
        setActiveId(next.row.id);
      };
      const safe = (p) => p.catch((err) => setToast({ failed: err?.message ?? 'Not saved. Try again.' }));

      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); go(1); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); return; }
      if (!cur) return;
      if (e.key === 'Escape') { setRejectingId(null); setOpenId(null); return; }
      if (e.key === 'o') { setOpenId((v) => (v === cur.row.id ? null : cur.row.id)); return; }
      if (cur.row.decision) {
        if (e.key === 'u') safe(undo(cur.row.id));
        return;
      }
      if (e.key === 'a') safe(act(cur, { action: 'approve' }));
      else if (e.key === 'l') safe(act(cur, { action: 'defer' }));
      else if (e.key === 'r') setRejectingId((v) => (v === cur.row.id ? null : cur.row.id));
      else if (rejectingId === cur.row.id && /^[1-9]$/.test(e.key)) {
        const reason = REJECTION_REASONS[Number(e.key) - 1];
        if (reason) safe(act(cur, { action: 'reject', reason: reason.value }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, activeId, rejectingId, act, undo]);

  if (tenant === undefined || group === undefined) return <PageSkeleton />;

  if (!group) {
    return (
      <div className={styles.page}>
        <div className={`card ${styles.blank}`}>
          <span className={styles.blankIcon}><Icon name="IconLayers" className={styles.blankGlyph} /></span>
          <h1 className={styles.blankTitle}>The first candidates land on Monday</h1>
          <p className={styles.blankBody}>Each one arrives costed against a real shelf price and checked against who is selling it on eBay.</p>
        </div>
      </div>
    );
  }

  const decided = counts.approve + counts.reject;
  const approved = assessed.filter(({ row }) => row.decision?.action === 'approve');
  const monthly = approved.reduce((s, { a }) => s + (a.month ?? 0), 0);
  const unproved = approved.filter(({ a }) => a.month == null).length;
  const week = weekOf(group.latest);
  const total = rows.length || 1;
  // A tab of store cards reads in store columns. One eBay card among them would misread, so it takes all of them.
  const storeTab = assessed.length > 0 && assessed.every(({ a }) => a.store);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">{group.label}{week ? `, to ${week}` : ''}</p>
          <h1 className={styles.title}>Candidates</h1>
        </div>

        {storeTab ? (
          <div className={styles.worth}>
            <span className={styles.worthLabel}>Approved to list</span>
            <span className={`figure ${styles.worthValue}`} data-num>{approved.length}</span>
            <span className={styles.worthFoot}>of {rows.length}</span>
          </div>
        ) : (
        <div className={styles.worth}>
          <span className={styles.worthLabel}>
            Approved here
            <Tip side="end">What the approved rows would keep a month after goods, each at its proving seller&apos;s own price and rate. Rows without a proved rate are counted, not guessed.</Tip>
          </span>
          {monthly > 0 ? (
            <span className={`figure ${styles.worthValue} ${styles.positive}`}>{formatGbp(monthly)}</span>
          ) : (
            <span className={styles.worthWord}>{approved.length ? 'No proved rate yet' : 'Nothing yet'}</span>
          )}
          <span className={styles.worthFoot}>
            {monthly > 0 && 'a month'}
            {monthly > 0 && unproved > 0 && ', '}
            {unproved > 0 && `${unproved} without a proved rate`}
          </span>
        </div>
        )}
      </header>

      {groups.length > 1 && (
        <div className={styles.batches} role="tablist" aria-label="Where these came from">
          {groups.map((g) => (
            <button key={g.key} type="button" role="tab" aria-selected={g.key === group.key}
              className={`${styles.batch} ${g.key === group.key ? styles.batchOn : ''}`}
              onClick={() => { setSource(g.key); setOpenId(null); setRejectingId(null); }}>
              <span className={styles.batchName}>{g.label}</span>
              <span className={styles.batchCount} data-num>{g.count}</span>
            </button>
          ))}
        </div>
      )}

      <section className={styles.board} aria-label="Progress and filters">
        <div className={styles.progress}>
          <p className={styles.progressText}>
            <span className="figure" data-num>{decided}</span>
            <span> of <span data-num>{rows.length}</span> decided</span>
          </p>
          <div className={styles.bar} role="img"
            aria-label={`${counts.approve} approved, ${counts.reject} rejected, ${counts.defer} later, ${counts.pending} to review`}>
            <span className={styles.segPositive} style={{ width: `${(counts.approve / total) * 100}%` }} />
            <span className={styles.segNegative} style={{ width: `${(counts.reject / total) * 100}%` }} />
            <span className={styles.segWarning} style={{ width: `${(counts.defer / total) * 100}%` }} />
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.filters} role="tablist" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
                className={`${styles.filter} ${filter === f.key ? styles.filterOn : ''}`}
                onClick={() => { setFilter(f.key); setOpenId(null); setRejectingId(null); }}>
                {f.tone && <i className={styles.dot} data-tone={f.tone} aria-hidden="true" />}
                {f.label}
                <span className={styles.count} data-num>{counts[f.key]}</span>
              </button>
            ))}
          </div>

          <span className={styles.findWrap}>
            <Icon name="IconSearch" className={styles.findIcon} />
            <input className={styles.find} value={find} placeholder="Find"
              onChange={(e) => setFind(e.target.value)} aria-label="Find a candidate" />
          </span>

          <Tip side="end" label="Keyboard shortcuts">
            J and K move between rows, O opens one. A approves, L saves for later, R rejects, then 1 to 7 picks the reason. U undoes a decision.
          </Tip>
        </div>
      </section>

      {status === 'loading' && (
        <div className={`card ${styles.loading}`}>
          {[0, 1, 2, 3, 4].map((i) => <RowSkeleton key={i} i={i} />)}
        </div>
      )}

      {status === 'error' && (
        <div className={`card ${styles.blank}`} role="alert">
          <h2 className={styles.blankTitle}>These did not load</h2>
          <p className={styles.blankBody}>Reload the page. If it happens again, send me a note and I will look at it.</p>
        </div>
      )}

      {status === 'ready' && order.length === 0 && (
        <div className={`card ${styles.blank}`}>
          {filter === 'pending' && !find.trim() ? (
            <>
              <span className={`${styles.blankIcon} ${styles.blankDone}`}><Icon name="IconCheck" className={styles.blankGlyph} /></span>
              <h2 className={styles.blankTitle}>Every candidate here is decided</h2>
              {counts.approve > 0 && (
                <Link className={styles.blankAction} to={portalPath('/approved')}>
                  Price and list the {counts.approve} approved
                </Link>
              )}
            </>
          ) : (
            <p className={styles.blankBody}>Nothing matches.</p>
          )}
        </div>
      )}

      {status === 'ready' && order.length > 0 && (
        <div className={styles.list}>
          <div className={styles.columns} aria-hidden="true">
            <span />
            <span>Product</span>
            {storeTab ? (
              <>
                <span className={`${styles.colTip} ${styles.right}`}>
                  Google rank
                  <Tip>Its place among the best sellers on Google in the UK for this category, and how many of the months checked it ranked in.</Tip>
                </span>
                <span className={`${styles.colTip} ${styles.right}`}>
                  List at
                  <Tip side="end">Google&apos;s lowest price when it clears your floor, otherwise your floor: the cheapest cost, Royal Mail for its weight, the card fee and your profit, rounded up to .49 or .99.</Tip>
                </span>
                <span className={`${styles.colTip} ${styles.right}`}>
                  You keep
                  <Tip side="end">Per sale at that price, after the cost, Royal Mail and the card fee.</Tip>
                </span>
              </>
            ) : (
              <>
                <span className={`${styles.colTip} ${styles.right}`}>
                  Sold a month
                  <Tip>Units a month across the ten listings the check sampled, so it is the size of the market rather than what one seller takes.</Tip>
                </span>
                <span className={`${styles.colTip} ${styles.right}`}>
                  List at
                  <Tip side="end">From the cheapest real cost: eBay fees, postage for its weight, packing, returns and your profit, rounded up to .49 or .99. With no cost yet, from the most the eBay price allows the goods to cost. Underneath, where it sits against the eBay median.</Tip>
                </span>
                <span className={`${styles.colTip} ${styles.right}`}>
                  You keep
                  <Tip side="end">Per sale at that price. Amber means no shop price yet: it keeps this only if the goods cost what is shown or less.</Tip>
                </span>
              </>
            )}
            <span />
          </div>

          {lanes.map((l) => (
            <section key={l.key} className={styles.lane} aria-labelledby={`lane-${l.key}`}>
              <header className={styles.laneHead} data-lane={l.key}>
                <h2 id={`lane-${l.key}`} className={styles.laneTitle}>{l.title}</h2>
                <span className={styles.laneCount} data-num>{l.items.length}</span>
                <Tip>{l.tip}</Tip>
              </header>

              <div className={styles.rows}>
                {l.items.map((item) => {
                  const { row, a } = item;
                  return (
                    <CandidateRow
                      key={row.id}
                      candidate={row}
                      a={a}
                      active={row.id === activeId}
                      open={row.id === openId}
                      rejecting={row.id === rejectingId}
                      onActivate={() => setActiveId(row.id)}
                      onToggle={() => setOpenId((v) => (v === row.id ? null : row.id))}
                      onReject={() => setRejectingId((v) => (v === row.id ? null : row.id))}
                      onDecide={(payload) => act(item, payload)}
                      onClear={() => undo(row.id)}
                      onNote={(body) => addNote({ candidateId: row.id, tenantId: tenant.id, body })}
                      suppliers={suppliers}
                      onSource={async (fields) => {
                        await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
                        await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
                      }}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast.failed ? (
            <span className={styles.toastText}>{toast.failed}</span>
          ) : (
            <>
              <span className={styles.toastText}>
                <strong>{DONE[toast.action]}</strong> {toast.title}
              </span>
              <button type="button" className={styles.toastUndo} onClick={() => undo(toast.id)}>Undo</button>
            </>
          )}
          <button type="button" className={styles.toastClose} aria-label="Dismiss" onClick={() => setToast(null)}>
            <Icon name="IconX" className={styles.toastIcon} />
          </button>
        </div>
      )}
    </div>
  );
}
