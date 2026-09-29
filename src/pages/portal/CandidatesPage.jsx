import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CandidateRow, confirmSource } from '@components/ui/portal/CandidateRow';
import { CategoryTabs } from '@components/ui/portal/CategoryTabs';
import { Tip } from '@components/ui/portal/primitives';
import { PageSkeleton, RowSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useCandidates, useBatches } from '@hooks/useCandidates';
import { NEEDS, UNSORTED, categoryName, deepensAt, loadCategories, placeOf, storedTab } from '@lib/categories';
import { useSuppliers } from '@hooks/useSuppliers';
import { loadTenant } from '@lib/tenant';
import { assess, READY_MIN_SOLD } from '@lib/assess';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/candidates-page.module.css';

const FILTERS = [
  { key: 'pending', label: 'To review' },
  { key: 'approve', label: 'Approved', tone: 'positive' },
  { key: 'defer', label: 'Later', tone: 'warning' },
  { key: 'reject', label: 'Rejected', tone: 'negative' },
  { key: 'all', label: 'All' },
];

// Grouped by what stands between the card and Approve. Worked one lane at a time; "All" shows them stacked.
const LANES = [
  {
    key: 'ready',
    title: 'Worth approving',
    tip: `A small seller is selling this, your price is in the market, the cost is confirmed as the same item and pack, and it sells at least ${READY_MIN_SOLD} a month across the sample.`,
  },
  {
    key: 'pack',
    title: 'Confirm the pack',
    tip: 'In the market, with a small seller selling. The cost is the price where it was seen and the pack is not confirmed yet. Confirm it on the card, or press C, and it moves up.',
  },
  {
    key: 'slow',
    title: 'Sells slowly',
    tip: `Everything checks out, but fewer than ${READY_MIN_SOLD} sold a month across the listings sampled.`,
  },
  {
    key: 'over',
    title: 'Over the market',
    tip: 'Your price is above the small seller who is selling, or the median where there is none. Closest first. Open a card and try a cheaper cost to see where it would land.',
  },
  {
    key: 'price',
    title: 'Check the price',
    tip: 'A small seller is selling at a price outside the range this search found, so the search probably pulled a different product. Priced at the median until you open the listing and check.',
  },
  {
    key: 'untested',
    title: 'Entry untested',
    tip: 'No small seller is proved selling this yet, so whether a new account can get in is untested.',
  },
  {
    key: 'short',
    title: 'Keeps under the target',
    tip: 'The known cost keeps under your profit at this price: £3 under £15, £4 to £30, £5 above. Find it cheaper or list higher.',
  },
  {
    key: 'store',
    title: 'To list on the shop',
    tip: 'Sells on Google in the UK and is stocked by a UK shop. Listed at Google\'s lowest price when that clears your floor, otherwise at your floor.',
  },
];

const SORTS = [
  { key: 'near', label: 'Nearest to Approve' },
  { key: 'sold', label: 'Sold a month' },
  { key: 'keep', label: 'You keep' },
];

const PAGE = 60;

function nearest(x, y) {
  if (x.a.store) return (!x.a.m.need) - (!y.a.m.need) || (y.a.g.months ?? 0) - (x.a.g.months ?? 0) || (x.a.g.rank ?? 1e9) - (y.a.g.rank ?? 1e9);
  if (x.a.lane === 'ready') return (y.a.month ?? 0) - (x.a.month ?? 0) || (y.a.keep ?? 0) - (x.a.keep ?? 0);
  if (x.a.lane === 'over') return (x.a.position?.pct ?? 9) - (y.a.position?.pct ?? 9);
  return (y.a.sold ?? 0) - (x.a.sold ?? 0) || (y.a.keep ?? 0) - (x.a.keep ?? 0);
}

const SORT_FN = {
  near: nearest,
  sold: (x, y) => (y.a.sold ?? y.a.g?.months ?? -1) - (x.a.sold ?? x.a.g?.months ?? -1),
  keep: (x, y) => (y.a.keep ?? -1e9) - (x.a.keep ?? -1e9),
};

const inFilter = (row, f) => (f === 'all' ? true : f === 'pending' ? !row.decision : row.decision?.action === f);

const typing = (el) => el?.closest?.('input, textarea, select, [contenteditable="true"]');

const DONE = { approve: 'Approved', reject: 'Rejected', defer: 'Saved for later', confirm: 'Pack confirmed', move: 'Moved' };

const SUB_NAME = { [UNSORTED]: 'Not sorted yet', [NEEDS]: 'Needs a category' };

// Counts of a list by a key, largest first.
function tally(list, keyOf) {
  const m = new Map();
  for (const x of list) {
    const k = keyOf(x);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function weekOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function CandidatesPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('pending');
  const [find, setFind] = useState('');
  const [tab, setTab] = useState(() => { try { return storedTab(localStorage.getItem('ck.portal.category')); } catch { return 'all'; } });
  const [sub, setSub] = useState({ l2: null, l3: null });
  const [from, setFrom] = useState('');
  const [, setNamesLoaded] = useState(0);
  const [lanePick, setLanePick] = useState(null);
  const [sort, setSort] = useState('near');
  const [limit, setLimit] = useState(PAGE);
  const [activeId, setActiveId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [toast, setToast] = useState(null);
  const [tryFor, setTryFor] = useState(null);
  const moved = useRef(false);
  const anchor = useRef(null);
  const sentinel = useRef(null);

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const batches = useBatches(tenant?.id);
  const liveIds = useMemo(() => (batches ?? []).map((b) => b.id), [batches]);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const { status, rows, index, decide, clear, addNote, addSource, setCategory } = useCandidates(liveIds, { top: tab });

  // Names for the categories in use, and each card's own category (Healthcare filters one level deeper).
  useEffect(() => {
    const ids = index.rows.flatMap((r) => [r.category_top_id, r.category_level2_id, r.category_id]);
    if (!ids.length) return;
    loadCategories(ids).then(() => setNamesLoaded((n) => n + 1)).catch(() => {});
  }, [index.rows]);

  // Tabs: Google top categories with cards in the chosen status, largest first. The one she is on always shows.
  const inStatus = useMemo(() => index.rows.filter((r) => inFilter(r, filter)), [index.rows, filter]);
  const tabs = tally(inStatus, (r) => r.category_top_id).map(([id, count]) => ({ key: id, label: categoryName(id) ?? `Category ${id}`, count }));
  if (tab !== 'all' && !tabs.some((t) => t.key === tab)) tabs.push({ key: tab, label: categoryName(tab) ?? `Category ${tab}`, count: 0 });
  tabs.unshift({ key: 'all', label: 'All', count: inStatus.length });

  // Inside a tab: level two, with Healthcare split one level deeper, and the two unplaced chips.
  const inTab = useMemo(() => (tab === 'all' ? inStatus : inStatus.filter((r) => r.category_top_id === tab)), [inStatus, tab]);
  const subs = tab === 'all' ? [] : tally(inTab, (r) => placeOf(r).l2);
  const deeper = sub.l2 != null && deepensAt(sub.l2)
    ? tally(inTab.filter((r) => placeOf(r).l2 === sub.l2), (r) => placeOf(r).l3)
    : [];
  const fromOptions = tally(inTab.flatMap((r) => r.source_labels ?? []), (x) => x);

  // The rows she is looking at: this tab (a card moved away leaves it), this filter, where it came from.
  const inView = useMemo(() => rows.filter((r) => {
    if (tab !== 'all' && r.category_top_id !== tab) return false;
    if (sub.l2 != null) {
      const p = placeOf(r);
      if (p.l2 !== sub.l2) return false;
      if (sub.l3 != null && p.l3 !== sub.l3) return false;
    }
    if (from && !(r.source_labels ?? []).includes(from)) return false;
    return true;
  }), [rows, tab, sub, from]);

  // Worked out once per load, not on every keystroke in Find.
  const assessed = useMemo(() => inView.map((row) => ({ row, a: assess(row) })), [inView]);

  const counts = useMemo(() => Object.fromEntries(
    FILTERS.map((f) => [f.key, assessed.filter(({ row }) => inFilter(row, f.key)).length]),
  ), [assessed]);

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    return assessed
      .filter(({ row }) => inFilter(row, filter))
      .filter(({ a }) => !q || a.title.toLowerCase().includes(q));
  }, [assessed, filter, find]);

  const lanes = useMemo(() => LANES
    .map((l) => ({ ...l, items: shown.filter(({ a }) => a.lane === l.key).sort(SORT_FN[sort]) }))
    .filter((l) => l.items.length > 0), [shown, sort]);

  // The lane she picked, or the first one with cards in it.
  const lane = lanePick === 'all' ? 'all' : (lanes.find((l) => l.key === lanePick) ? lanePick : lanes[0]?.key ?? null);
  const view = lane === 'all' ? lanes : lanes.filter((l) => l.key === lane);
  const order = useMemo(() => view.flatMap((l) => l.items), [view]);

  const resetView = () => { setLimit(PAGE); setOpenId(null); setRejectingId(null); setSelected(new Set()); setBulkRejecting(false); };

  // More rows as the end of the list comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= order.length) return undefined;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setLimit((n) => n + PAGE); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, order.length]);

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

  // T opens the card and puts the cursor in its cost field once it has drawn.
  useEffect(() => {
    if (!tryFor || openId !== tryFor) return undefined;
    const f = requestAnimationFrame(() => {
      document.querySelector(`[data-candidate="${tryFor}"] [data-try]`)?.focus();
      setTryFor(null);
    });
    return () => cancelAnimationFrame(f);
  }, [tryFor, openId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toast.failed ? 10000 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const confirmPack = useCallback(async ({ row, a }) => {
    const fields = confirmSource(row, a);
    if (!fields) return;
    await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
    await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from ?? null });
    setToast({ ids: [row.id], title: a.title, action: 'confirm' });
  }, [addSource, remember, tenant]);

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
    setToast({ ids: [row.id], title: a.title, action: payload.action });
  }, [filter, order, openId, decide, tenant]);

  // One decision for every selected card, each written as her own decision.
  const actOnSelected = useCallback(async (payload) => {
    const ids = order.map((o) => o.row.id).filter((id) => selected.has(id));
    if (!ids.length) return;
    setSelected(new Set());
    setBulkRejecting(false);
    for (const id of ids) {
      await decide({ candidateId: id, tenantId: tenant.id, ...payload });
    }
    setToast({ ids, title: `${ids.length} ${ids.length === 1 ? 'card' : 'cards'}`, action: payload.action });
  }, [order, selected, decide, tenant]);

  // Her choice of category. Undo puts back the old category with how it had been set.
  const move = useCallback(async ({ row, a }, category) => {
    const before = { category: row.category_id, source: row.category_source, flag: row.category_flag };
    await setCategory({ candidateId: row.id, category });
    const back = before.category != null
      ? () => setCategory({ candidateId: row.id, category: before.category, restoreSource: before.source ?? 'default', restoreFlag: before.flag })
      : null;
    setToast({ ids: [row.id], title: `${a.title} to ${categoryName(category) ?? 'its new category'}`, action: 'move', back });
  }, [setCategory]);

  const undo = useCallback(async (ids) => {
    setToast(null);
    try {
      for (const id of ids) await clear({ candidateId: id });
      setActiveId(ids[0]);
    } catch (e) {
      setToast({ failed: e?.message ?? 'Undo did not save. Try again.' });
    }
  }, [clear]);

  const select = useCallback((id, range) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const ids = order.map((o) => o.row.id);
      if (range && anchor.current && ids.includes(anchor.current)) {
        const [from, to] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((p, q) => p - q);
        ids.slice(from, to + 1).forEach((x) => next.add(x));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }, [order]);

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const i = order.findIndex((o) => o.row.id === activeId);
      const cur = order[i];
      const go = (n) => {
        const j = Math.max(0, Math.min(order.length - 1, i + n));
        const next = order[j];
        if (!next) return;
        if (j >= limit - 5) setLimit((l) => l + PAGE);
        moved.current = true;
        setActiveId(next.row.id);
      };
      const safe = (p) => p.catch((err) => setToast({ failed: err?.message ?? 'Not saved. Try again.' }));
      const many = selected.size > 0;

      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); go(1); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); go(-1); return; }
      if (e.key === 'Escape') {
        if (many) { setSelected(new Set()); setBulkRejecting(false); return; }
        setRejectingId(null); setOpenId(null); return;
      }
      if (many) {
        if (e.key.toLowerCase() === 'x' && cur) select(cur.row.id, e.shiftKey);
        else if (e.key === 'a') safe(actOnSelected({ action: 'approve' }));
        else if (e.key === 'l') safe(actOnSelected({ action: 'defer' }));
        else if (e.key === 'r') setBulkRejecting((v) => !v);
        else if (bulkRejecting && /^[1-9]$/.test(e.key)) {
          const reason = REJECTION_REASONS[Number(e.key) - 1];
          if (reason) safe(actOnSelected({ action: 'reject', reason: reason.value }));
        }
        return;
      }
      if (!cur) return;
      if (e.key.toLowerCase() === 'x') { select(cur.row.id, e.shiftKey); return; }
      if (e.key === 'o') { setOpenId((v) => (v === cur.row.id ? null : cur.row.id)); return; }
      if (e.key === 't') { e.preventDefault(); setOpenId(cur.row.id); setTryFor(cur.row.id); return; }
      if (cur.row.decision) {
        if (e.key === 'u') safe(undo([cur.row.id]));
        return;
      }
      if (e.key === 'c') safe(confirmPack(cur));
      else if (e.key === 'a') safe(act(cur, { action: 'approve' }));
      else if (e.key === 'l') safe(act(cur, { action: 'defer' }));
      else if (e.key === 'r') setRejectingId((v) => (v === cur.row.id ? null : cur.row.id));
      else if (rejectingId === cur.row.id && /^[1-9]$/.test(e.key)) {
        const reason = REJECTION_REASONS[Number(e.key) - 1];
        if (reason) safe(act(cur, { action: 'reject', reason: reason.value }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, activeId, rejectingId, act, undo, confirmPack, selected, select, actOnSelected, bulkRejecting, limit]);

  if (tenant === undefined || batches === undefined) return <PageSkeleton />;

  if (!liveIds.length) {
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
  const latest = (batches ?? []).reduce((d, b) => (b.delivered_for > d ? b.delivered_for : d), '');
  const week = weekOf(latest);
  const tabName = tab === 'all' ? 'Every category' : categoryName(tab) ?? 'Candidates';
  const total = rows.length || 1;
  // A tab of store cards reads in store columns. One eBay card among them would misread, so it takes all of them.
  const storeTab = assessed.length > 0 && assessed.every(({ a }) => a.store);

  // The rows drawn so far, lane by lane, up to the limit.
  let left = limit;
  const drawn = view.map((l) => {
    const items = l.items.slice(0, Math.max(0, left));
    left -= items.length;
    return { ...l, items };
  }).filter((l) => l.items.length > 0);

  const pickCategory = (key) => {
    setTab(key);
    setSub({ l2: null, l3: null });
    setFrom('');
    setLanePick(null);
    resetView();
    try { localStorage.setItem('ck.portal.category', String(key)); } catch { /* private mode */ }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">{tabName}{week ? `, latest ${week}` : ''}</p>
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

      <CategoryTabs groups={tabs} current={tab} onPick={pickCategory} />

      {(subs.length > 1 || sub.l2 != null || subs.some(([k]) => deepensAt(k))) && (
        <div className={styles.subs} role="tablist" aria-label={`Inside ${tabName}`}>
          <button type="button" role="tab" aria-selected={sub.l2 == null} className={styles.sub}
            onClick={() => { setSub({ l2: null, l3: null }); resetView(); }}>
            All in this tab <span className={styles.count} data-num>{inTab.length.toLocaleString('en-GB')}</span>
          </button>
          {subs.map(([key, count]) => (
            <button key={key} type="button" role="tab" aria-selected={sub.l2 === key} className={styles.sub}
              data-unplaced={key === UNSORTED || key === NEEDS || undefined}
              onClick={() => { setSub({ l2: key, l3: null }); resetView(); }}>
              {SUB_NAME[key] ?? categoryName(key) ?? `Category ${key}`}
              <span className={styles.count} data-num>{count.toLocaleString('en-GB')}</span>
            </button>
          ))}
        </div>
      )}

      {deeper.length > 0 && (
        <div className={`${styles.subs} ${styles.deeper}`} role="tablist" aria-label={`Inside ${categoryName(sub.l2) ?? 'Healthcare'}`}>
          <button type="button" role="tab" aria-selected={sub.l3 == null} className={styles.sub}
            onClick={() => { setSub((v) => ({ ...v, l3: null })); resetView(); }}>
            All of {categoryName(sub.l2) ?? 'Healthcare'}
          </button>
          {deeper.map(([key, count]) => (
            <button key={key} type="button" role="tab" aria-selected={sub.l3 === key} className={styles.sub}
              onClick={() => { setSub((v) => ({ ...v, l3: key })); resetView(); }}>
              {categoryName(key) ?? `Category ${key}`}
              <span className={styles.count} data-num>{count.toLocaleString('en-GB')}</span>
            </button>
          ))}
        </div>
      )}

      <section className={styles.bar} aria-label="Progress and filters">
        <div className={styles.barTop}>
          <p className={styles.progressText}>
            <span className="figure" data-num>{decided.toLocaleString('en-GB')}</span>
            <span> of <span data-num>{rows.length.toLocaleString('en-GB')}</span> decided</span>
          </p>
          <div className={styles.meter} role="img"
            aria-label={`${counts.approve} approved, ${counts.reject} rejected, ${counts.defer} later, ${counts.pending} to review`}>
            <span className={styles.segPositive} style={{ width: `${(counts.approve / total) * 100}%` }} />
            <span className={styles.segNegative} style={{ width: `${(counts.reject / total) * 100}%` }} />
            <span className={styles.segWarning} style={{ width: `${(counts.defer / total) * 100}%` }} />
          </div>

          <div className={styles.status} role="tablist" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
                className={styles.statusTab}
                onClick={() => { setFilter(f.key); resetView(); }}>
                {f.tone && <i className={styles.dot} data-tone={f.tone} aria-hidden="true" />}
                {f.label}
                <span className={styles.count} data-num>{counts[f.key].toLocaleString('en-GB')}</span>
              </button>
            ))}
          </div>

          <span className={styles.findWrap}>
            <Icon name="IconSearch" className={styles.findIcon} />
            <input className={styles.find} value={find} placeholder="Find"
              onChange={(e) => { setFind(e.target.value); setLimit(PAGE); }} aria-label="Find a candidate" />
          </span>

          <Tip side="end" label="Keyboard shortcuts" place="below">
            J and K move, O opens, A approves, L saves for later, R rejects then 1 to 7 picks the reason, U undoes. C confirms the pack, T tries a cost. X selects, Shift X selects a run, and then A, L and R act on every selected card.
          </Tip>
        </div>

        {lanes.length > 0 && (
          <div className={styles.lanes} role="tablist" aria-label="Lanes">
            {lanes.length > 1 && (
              <button type="button" role="tab" aria-selected={lane === 'all'} className={styles.laneChip}
                onClick={() => { setLanePick('all'); resetView(); }}>
                Every lane <span className={styles.count} data-num>{shown.length.toLocaleString('en-GB')}</span>
              </button>
            )}
            {lanes.map((l) => (
              <button key={l.key} type="button" role="tab" aria-selected={lane === l.key} className={styles.laneChip}
                data-lane={l.key} title={l.tip}
                onClick={() => { setLanePick(l.key); resetView(); }}>
                <i className={styles.laneDot} aria-hidden="true" />
                {l.title}
                <span className={styles.count} data-num>{l.items.length.toLocaleString('en-GB')}</span>
              </button>
            ))}
            <span className={styles.lanesEnd}>
              {fromOptions.length > 0 && (
                <label className={styles.sortWrap}>
                  <span className="visually-hidden">Where it came from</span>
                  <select className={styles.sort} value={from} data-on={from ? '' : undefined}
                    onChange={(e) => { setFrom(e.target.value); resetView(); }}>
                    <option value="">From anywhere</option>
                    {fromOptions.map(([label, count]) => <option key={label} value={label}>{label} ({count})</option>)}
                  </select>
                </label>
              )}
              <label className={styles.sortWrap}>
                <span className="visually-hidden">Sort</span>
                <select className={styles.sort} value={sort} onChange={(e) => { setSort(e.target.value); setLimit(PAGE); }}>
                  {SORTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
              </label>
            </span>
          </div>
        )}
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
            <span />
            <span>Product</span>
            <span className={styles.right}>{storeTab ? 'Google' : 'Sold a month'}</span>
            <span>List at, on the market</span>
            <span className={styles.right}>Gap</span>
            <span className={styles.right}>You keep</span>
            <span />
          </div>

          {drawn.map((l) => (
            <section key={l.key} className={styles.lane} aria-labelledby={`lane-${l.key}`}>
              {lane === 'all' && (
                <header className={styles.laneHead} data-lane={l.key}>
                  <h2 id={`lane-${l.key}`} className={styles.laneTitle}>{l.title}</h2>
                  <span className={styles.laneCount} data-num>{(lanes.find((x) => x.key === l.key)?.items.length ?? 0).toLocaleString('en-GB')}</span>
                  <Tip>{l.tip}</Tip>
                  {l.key === 'over' && l.items[0]?.a.position && (
                    <span className={styles.laneLine}>closest <span data-num>+{formatGbp(l.items[0].a.position.over)}</span></span>
                  )}
                </header>
              )}

              <div className={styles.sheet}>
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
                      selected={selected.has(row.id)}
                      onSelect={(range) => select(row.id, range)}
                      onActivate={() => setActiveId(row.id)}
                      onToggle={() => setOpenId((v) => (v === row.id ? null : row.id))}
                      onReject={() => setRejectingId((v) => (v === row.id ? null : row.id))}
                      onDecide={(payload) => act(item, payload)}
                      onClear={() => undo([row.id])}
                      onNote={(body) => addNote({ candidateId: row.id, tenantId: tenant.id, body })}
                      onMove={(category) => move(item, category)}
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

          {limit < order.length && (
            <div ref={sentinel} className={styles.more}>
              <button type="button" className={styles.moreButton} onClick={() => setLimit((n) => n + PAGE)}>
                Show more, <span data-num>{(order.length - limit).toLocaleString('en-GB')}</span> to go
              </button>
            </div>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className={styles.bulk} role="region" aria-label="Selected cards">
          <span className={styles.bulkCount}><span data-num>{selected.size}</span> selected</span>
          {bulkRejecting ? (
            <>
              <span className={styles.bulkLabel}>Why</span>
              {REJECTION_REASONS.map((r, i) => (
                <button key={r.value} type="button" className={styles.bulkReason}
                  onClick={() => actOnSelected({ action: 'reject', reason: r.value }).catch((e) => setToast({ failed: e?.message ?? 'Not saved.' }))}>
                  <kbd>{i + 1}</kbd>{r.label}
                </button>
              ))}
              <button type="button" className={styles.bulkQuiet} onClick={() => setBulkRejecting(false)}>Back</button>
            </>
          ) : (
            <>
              <button type="button" className={styles.bulkQuiet} onClick={() => actOnSelected({ action: 'defer' })}>Later <kbd>L</kbd></button>
              <button type="button" className={styles.bulkQuiet} onClick={() => setBulkRejecting(true)}>Reject <kbd>R</kbd></button>
              <button type="button" className={styles.bulkApprove} onClick={() => actOnSelected({ action: 'approve' })}>Approve <kbd>A</kbd></button>
              <button type="button" className={styles.bulkQuiet} onClick={() => setSelected(new Set())}>Clear</button>
            </>
          )}
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
              {toast.action === 'move' ? toast.back && (
                <button type="button" className={styles.toastUndo}
                  onClick={() => { setToast(null); toast.back().catch((e) => setToast({ failed: e?.message ?? 'Undo did not save. Try again.' })); }}>
                  Undo
                </button>
              ) : toast.action !== 'confirm' && (
                <button type="button" className={styles.toastUndo} onClick={() => undo(toast.ids)}>Undo</button>
              )}
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
