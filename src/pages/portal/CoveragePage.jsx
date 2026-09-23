import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Tip } from '@components/ui/portal/primitives';
import { CoverageFlow } from '@components/ui/portal/CoverageFlow';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useBatches, groupBatches } from '@hooks/useCandidates';
import { useQueryCoverage } from '@hooks/useQueryCoverage';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/coverage-page.module.css';

const n = (v) => Number(v).toLocaleString('en-GB');

const REASONS = {
  crowded: {
    short: 'Over 250 listings',
    label: 'Too many listings to rank on',
    tip: 'Over 250 live listings. Reaching page one there costs more in promoted listings than the margin allows.',
    figure: (q) => (q.competitors != null ? `${n(q.competitors)} listings` : null),
  },
  nothing_sold: {
    short: 'Nothing selling',
    label: 'Nothing selling',
    tip: 'None of the sampled listings has sold a unit.',
    figure: (q) => (q.competitors != null ? `${n(q.competitors)} listings, no sales` : null),
  },
  young_not_selling: {
    short: 'New sellers not selling',
    label: 'New sellers are not selling',
    tip: 'Listings under 90 days old exist in the sample, and none of them has sold. A new account would join them.',
    figure: () => null,
  },
  market_small: {
    short: 'Market too small',
    label: 'Market too small',
    tip: 'The whole sample sells fewer than 10 a month, which does not repay a listing and the sourcing time.',
    figure: (q) => (q.market_per_month != null ? `${n(q.market_per_month)} a month` : null),
  },
  below_cost: {
    short: 'Below the cost of selling',
    label: 'Sells below the cost of selling',
    tip: 'At the market price, eBay fees, postage and packaging use up the whole sale before any goods are paid for.',
    figure: (q) => (q.median_price != null ? `sells at ${formatGbp(q.median_price)}` : null),
  },
  entry_large_only: {
    short: 'Only large accounts selling',
    label: 'Only large accounts are selling it',
    tip: 'People are buying, but the smallest seller making sales has more feedback than a new account can match. A market that is closed to a newcomer is worth nothing to you, however big it is.',
    figure: (q) => (q.entry_feedback != null ? `smallest ${n(q.entry_feedback)} feedback` : null),
  },
  entry_thin: {
    short: 'Small seller barely selling',
    label: 'A small seller is on it, and barely selling',
    tip: 'Somebody your size has sold one, at a rate under one a month. One person bought a thing once, which is not a market.',
    figure: () => null,
  },
  entry_untested: {
    short: 'Untested and crowded',
    label: 'Nobody new has tried it, and it is crowded',
    tip: 'No listing under 90 days old in the sample, so there is no evidence either way, and too many listings competing to find out cheaply. In a thinner market this would still be worth a try.',
    figure: (q) => (q.competitors != null ? `${n(q.competitors)} listings` : null),
  },
  goods_high: {
    short: 'Too dear to stock',
    label: 'The goods cost more than we buy at today',
    tip: 'The market works, but a unit would tie up more money than is being put into stock while nothing has sold yet.',
    figure: (q) => (q.max_goods != null ? `buy under ${formatGbp(q.max_goods)}` : null),
  },
  goods_low: {
    short: 'Must buy too cheaply',
    label: 'The goods would have to cost almost nothing',
    tip: 'What the market pays leaves so little that the product would have to be bought for a few pounds, which UK stock rarely is.',
    figure: (q) => (q.max_goods != null ? `buy under ${formatGbp(q.max_goods)}` : null),
  },
  band_unsure: {
    short: 'Postage not known',
    label: 'Too big to cost as a standard parcel',
    tip: 'At this price the product is unlikely to post as a 5kg parcel, and a postage figure that is wrong makes every other figure wrong. It is checked again once the real size is known.',
    figure: (q) => (q.median_price != null ? `sells at ${formatGbp(q.median_price)}` : null),
  },
  no_listings: {
    short: 'Nobody listing it',
    label: 'Nobody is listing it',
    tip: 'The search returned no live listings on eBay UK.',
    figure: () => null,
  },
  held_back: {
    short: 'Shelf price too high',
    label: 'Shelf price too high',
    tip: 'The market works, but at the shelf price a sale would keep less than £2, at our price or at the price small sellers are being paid.',
    figure: (q) => (q.shelf_price != null && q.max_goods != null
      ? `shelf ${formatGbp(q.shelf_price)}, needs under ${formatGbp(q.max_goods)}` : null),
  },
  no_buy_price: {
    short: 'Must buy under £5',
    label: 'Would have to be bought for under £5',
    tip: 'The market price leaves so little room that the goods would have to cost less than £5, which UK stock rarely does.',
    figure: (q) => (q.max_goods != null ? `buy under ${formatGbp(q.max_goods)}` : null),
  },
  duplicate: {
    short: 'Same as another search',
    label: 'Same product as another search',
    tip: 'Two searches found the same listing, so it was kept once.',
    figure: () => null,
  },
  unknown: {
    short: 'Reason not recorded',
    label: 'Refused, reason not recorded',
    tip: 'The check refused it without a named reason. That is a gap on our side.',
    figure: () => null,
  },
};

const reasonOf = (q) => (q.outcome === 'refused' ? q.reason ?? 'unknown' : q.outcome);

export function CoveragePage() {
  const [tenant, setTenant] = useState(undefined);
  const [only, setOnly] = useState(null);
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const batches = useBatches(tenant?.id);
  // One tab per shop, as on Candidates. Two deliveries from the same shop were
  // showing as two tabs both reading H & B.
  const groups = useMemo(() => groupBatches(batches ?? []), [batches]);
  const scope = useMemo(
    () => groups.filter((g) => !only || g.key === only).flatMap((g) => g.ids),
    [groups, only],
  );
  const { status, queries, candidates } = useQueryCoverage(batches === undefined ? null : scope);

  const funnel = useMemo(() => {
    const checked = queries.length;
    const passed = queries.filter((q) => q.outcome !== 'refused').length;
    const sent = candidates.length;
    const approved = candidates.filter((c) => c.decision?.action === 'approve' || c.ebay).length;
    const live = candidates.filter((c) => c.ebay).length;
    return [
      { key: 'checked', label: 'Checked', value: checked,
        tip: 'Every shelf product in these batches, searched against live eBay UK listings.' },
      { key: 'passed', label: 'Passed the check', value: passed,
        tip: 'Something is selling, the market is big enough, and a listing can reach page one.' },
      { key: 'sent', label: 'Sent to you', value: sent,
        tip: 'Passed, and keeps at least £2 a sale at the shelf price.' },
      { key: 'approved', label: 'Approved', value: approved, to: '/approved' },
      { key: 'live', label: 'Live on eBay', value: live, to: '/listings' },
    ];
  }, [queries, candidates]);

  const reasons = useMemo(() => {
    const map = new Map();
    for (const q of queries) {
      if (q.outcome === 'sent') continue;
      const k = reasonOf(q);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(q);
    }
    return [...map.entries()]
      .map(([key, items]) => ({ key, items, ...(REASONS[key] ?? REASONS.unknown) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [queries]);

  const flow = useMemo(() => {
    const counts = {};
    for (const q of queries) {
      const k = reasonOf(q);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const refused = queries.filter((q) => q.outcome === 'refused').length;
    const has = (c, a) => !c.ebay && c.decision?.action === a;
    return {
      counts,
      totals: { checked: queries.length, passed: queries.length - refused, refused },
      decisions: [
        { key: 'live', label: 'Live on eBay', value: candidates.filter((c) => c.ebay).length },
        { key: 'approved', label: 'Approved, not listed yet', value: candidates.filter((c) => has(c, 'approve')).length },
        { key: 'pending', label: 'Waiting for your review', value: candidates.filter((c) => !c.ebay && !c.decision).length },
        { key: 'defer', label: 'Saved for later', value: candidates.filter((c) => has(c, 'defer')).length },
        { key: 'reject', label: 'Rejected', value: candidates.filter((c) => has(c, 'reject')).length },
      ],
      labels: { sent: 'Sent to you', ...Object.fromEntries(Object.entries(REASONS).map(([k, r]) => [k, r.short])) },
    };
  }, [queries, candidates]);

  const pick = (k) => {
    if (k === 'sent') { navigate(portalPath('/candidates')); return; }
    setOpen(k);
    requestAnimationFrame(() => document.getElementById(`reason-${k}`)
      ?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };

  if (tenant === undefined || batches === undefined || status === 'loading') return <PageSkeleton rows={4} />;

  const stopped = reasons.reduce((s, r) => s + r.items.length, 0);
  const widest = reasons[0]?.items.length || 1;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Coverage</p>
        <h1 className={styles.title}>What was checked</h1>
      </header>

      {groups.length > 1 && (
        <div className={styles.scope} role="tablist" aria-label="Where these came from">
          <button type="button" role="tab" aria-selected={!only}
            className={`${styles.chip} ${!only ? styles.chipOn : ''}`} onClick={() => { setOnly(null); setOpen(null); }}>
            Everything checked
          </button>
          {groups.map((g) => (
            <button key={g.key} type="button" role="tab" aria-selected={only === g.key}
              className={`${styles.chip} ${only === g.key ? styles.chipOn : ''}`}
              onClick={() => { setOnly(g.key); setOpen(null); }}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className={`card ${styles.blank}`} role="alert">
          <p className={styles.blankTitle}>Coverage did not load</p>
          <p className={styles.blankBody}>Reload the page. If it happens again, send me a note and I will look at it.</p>
        </div>
      )}

      {status === 'ready' && queries.length === 0 && (
        <div className={`card ${styles.blank}`}>
          <span className={styles.blankIcon}><Icon name="IconMap" className={styles.blankGlyph} /></span>
          <p className={styles.blankTitle}>Nothing checked in the current batches yet</p>
          <p className={styles.blankBody}>Each batch shows here with every product that was checked and why it did or did not reach you.</p>
        </div>
      )}

      {status === 'ready' && queries.length > 0 && (
        <>
          <section className={`card ${styles.flowCard}`} aria-label="Where every checked product went">
            <CoverageFlow counts={flow.counts} totals={flow.totals} labels={flow.labels}
              decisions={flow.decisions} onPick={pick} />
          </section>

          <section className={styles.funnel} aria-label="From checked to live">
            {funnel.map((s, i) => {
              const prev = funnel[i - 1]?.value;
              const share = funnel[0].value ? s.value / funnel[0].value : 0;
              const body = (
                <>
                  <span className={styles.stageLabel}>
                    {s.label}
                    {s.tip && <Tip side={i > 2 ? 'end' : undefined}>{s.tip}</Tip>}
                  </span>
                  <span className={`display ${styles.stageValue}`}>{n(s.value)}</span>
                  <span className={styles.stageBar}>
                    <span style={{ width: `${Math.max(share * 100, s.value ? 1.5 : 0)}%` }} />
                  </span>
                </>
              );
              return (
                <div key={s.key} className={styles.stage} data-stage={s.key}>
                  {i > 0 && (
                    <span className={styles.ratio} data-num>
                      {prev ? `${Math.round((s.value / prev) * 100)}%` : 'None'}
                    </span>
                  )}
                  {s.to
                    ? <Link to={portalPath(s.to)} className={`${styles.stageBody} ${styles.stageLink}`}>{body}</Link>
                    : <div className={styles.stageBody}>{body}</div>}
                </div>
              );
            })}
          </section>

          <section className={styles.why} aria-labelledby="why-title">
            <header className={styles.whyHead}>
              <h2 id="why-title" className={styles.whyTitle}>Why the rest stopped</h2>
              <span className={styles.whyCount} data-num>{n(stopped)}</span>
              <span className={styles.key}>
                <span><i data-kind="market" />What the market said</span>
                <span><i data-kind="ours" />Our own limits</span>
              </span>
            </header>

            <ul className={styles.reasons}>
              {reasons.map((r) => (
                <li key={r.key} id={`reason-${r.key}`} className={`${styles.reason} ${open === r.key ? styles.reasonOpen : ''}`}>
                  <button type="button" className={styles.reasonRow} aria-expanded={open === r.key}
                    onClick={() => setOpen((v) => (v === r.key ? null : r.key))}>
                    <span className={styles.reasonLabel}>{r.label}</span>
                    <span className={styles.reasonBar}>
                      <span style={{ width: `${(r.items.length / widest) * 100}%` }} data-reason={r.key} />
                    </span>
                    <span className={styles.reasonCount} data-num>{n(r.items.length)}</span>
                    <Icon name="IconCaret" className={styles.caret} />
                  </button>

                  {open === r.key && (
                    <div className={styles.detail}>
                      <p className={styles.detailTip}>{r.tip}</p>
                      <ul className={styles.items}>
                        {[...r.items]
                          .sort((a, b) => (a.shelf_product ?? a.query).localeCompare(b.shelf_product ?? b.query))
                          .map((q) => (
                            <li key={q.id} className={styles.item}>
                              <span className={styles.itemName}>{q.shelf_product ?? q.query}</span>
                              <span className={styles.itemFigure} data-num>{r.figure(q)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
