import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Tip } from '@components/ui/portal/primitives';
import { CoverageFlow } from '@components/ui/portal/CoverageFlow';
import { CategoryTabs } from '@components/ui/portal/CategoryTabs';
import { StoreRoute } from '@components/ui/portal/StoreRoute';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useBatches } from '@hooks/useCandidates';
import { useQueryCoverage } from '@hooks/useQueryCoverage';
import { useStoreCoverage } from '@hooks/useStoreCoverage';
import { HER_TOPS, categoryName, loadCategories } from '@lib/categories';
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
  crowded_but_selling: {
    short: 'Crowded, but selling',
    label: 'Crowded, and the shelves are turning anyway',
    tip: 'Over the 250 listing ceiling, so reaching page one costs more in promoted listings than the pricing allows. It is here rather than refused because a seller your size is selling and the market moves enough to argue with.',
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

const ROUTE_KEY = 'ck.portal.coverage.route';
// A store batch is one Google category: "Home & Garden" on the batch is the Home & Garden tab.
const topOfBatch = (b) => HER_TOPS.find((id) => categoryName(id) === (b.category_label ?? '').trim()) ?? (b.category_label ?? 'Google best sellers');
const isStore = (b) => (b.sources_used ?? []).includes('google_best_sellers') || (b.term ?? '').startsWith('store-');

export function CoveragePage() {
  const [tenant, setTenant] = useState(undefined);
  const [route, setRoute] = useState(() => { try { return localStorage.getItem(ROUTE_KEY) === 'google' ? 'google' : 'ebay'; } catch { return 'ebay'; } });
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);
  const [names, setNamesLoaded] = useState(0);
  const navigate = useNavigate();

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const batches = useBatches(tenant?.id);
  const ebayIds = useMemo(() => (batches ?? []).filter((b) => !isStore(b)).map((b) => b.id), [batches]);
  const storeBatches = useMemo(() => (batches ?? []).filter(isStore), [batches]);
  const storeIds = useMemo(() => storeBatches.map((b) => b.id), [storeBatches]);

  const ebay = useQueryCoverage(batches === undefined ? null : ebayIds);
  const store = useStoreCoverage(batches === undefined ? null : storeIds);
  const { queries } = ebay;

  // Names for the tabs: her top categories, and whatever the eBay cards sit in.
  useEffect(() => {
    const ids = [...HER_TOPS, ...ebay.candidates.map((c) => c.category_top_id)];
    loadCategories(ids, false).then(() => setNamesLoaded((x) => x + 1)).catch(() => {});
  }, [ebay.candidates]);

  const tabs = useMemo(() => {
    if (route === 'ebay') {
      const m = new Map();
      for (const c of ebay.candidates) if (c.category_top_id != null) m.set(c.category_top_id, (m.get(c.category_top_id) ?? 0) + 1);
      return [{ key: 'all', label: 'All', count: ebay.candidates.length },
        ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ key: id, label: categoryName(id) ?? `Category ${id}`, count }))];
    }
    const m = new Map();
    for (const b of storeBatches) {
      const key = topOfBatch(b);
      const g = m.get(key) ?? { key, label: typeof key === 'number' ? categoryName(key) : key, count: 0, ids: [] };
      g.ids.push(b.id);
      g.count += store.candidates.filter((c) => c.batch_id === b.id).length;
      m.set(key, g);
    }
    return [{ key: 'all', label: 'All', count: store.candidates.length, ids: storeIds }, ...[...m.values()].sort((a, b) => b.count - a.count)];
    // names: the tab labels redraw once the category names have loaded.
  }, [route, ebay.candidates, store.candidates, storeBatches, storeIds, names]);

  const tab = tabs.find((t) => t.key === cat) ?? tabs[0];
  const catName = tab.key === 'all' ? null : tab.label;

  const pickRoute = (r) => {
    setRoute(r);
    setCat('all');
    setOpen(null);
    try { localStorage.setItem(ROUTE_KEY, r); } catch { /* private mode */ }
  };
  const pickCat = (k) => { setCat(k); setOpen(null); };

  // eBay searches are not sorted by category; the tab applies from the cards on.
  const candidates = useMemo(
    () => (catName && route === 'ebay' ? ebay.candidates.filter((c) => c.category_top_id === tab.key) : ebay.candidates),
    [ebay.candidates, catName, route, tab.key],
  );

  const funnel = useMemo(() => {
    const checked = queries.length;
    const passed = queries.filter((q) => q.outcome !== 'refused').length;
    const sent = candidates.length;
    const approved = candidates.filter((c) => c.decision?.action === 'approve' || c.ebay).length;
    const live = candidates.filter((c) => c.ebay).length;
    return [
      { key: 'checked', label: 'Checked', value: checked,
        tip: 'Every shelf product in these searches, looked up against live eBay UK listings.' },
      { key: 'passed', label: 'Passed the check', value: passed,
        tip: 'Something is selling, the market is big enough, and a listing can reach page one.' },
      { key: 'sent', label: catName ? `Sent to you, ${catName}` : 'Sent to you', value: sent,
        tip: 'Passed, and keeps at least £2 a sale at the shelf price.', cut: !!catName },
      { key: 'approved', label: 'Approved', value: approved, to: '/approved' },
      { key: 'live', label: 'Live on eBay', value: live, to: '/listings' },
    ];
  }, [queries, candidates, catName]);

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

  if (tenant === undefined || batches === undefined || ebay.status === 'loading' || store.status === 'loading') return <PageSkeleton rows={4} />;

  const stopped = reasons.reduce((s, r) => s + r.items.length, 0);
  const widest = reasons[0]?.items.length || 1;
  const cardsEbay = ebay.candidates.length;
  const cardsStore = store.candidates.length;
  const sentSearches = flow.counts.sent ?? 0;
  const short = !catName ? sentSearches - cardsEbay : 0;
  const ranked = store.summary.reduce((t, r) => t + r.products, 0);
  const failed = route === 'ebay' ? ebay.status === 'error' : store.status === 'error';

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Coverage</p>
        <h1 className={styles.title}>What was checked</h1>
        {cardsEbay + cardsStore > 0 && (
          <p className={styles.lede}>
            <span data-num>{n(cardsEbay + cardsStore)}</span> cards sent to you: <span data-num>{n(cardsEbay)}</span> from eBay searches,{' '}
            <span data-num>{n(cardsStore)}</span> from Google best sellers.
          </p>
        )}
      </header>

      <div className={styles.routes} role="tablist" aria-label="Route">
        {[['ebay', 'eBay searches', queries.length, 'searched'], ['google', 'Google best sellers', ranked || cardsStore, ranked ? 'ranked' : 'cards']].map(([k, label, count, unit]) => (
          <button key={k} type="button" role="tab" aria-selected={route === k}
            className={styles.route} onClick={() => pickRoute(k)}>
            <span className={styles.routeName}>{label}</span>
            <span className={styles.routeCount} data-num>{n(count)} {unit}</span>
          </button>
        ))}
      </div>

      {tabs.length > 1 && <CategoryTabs groups={tabs} current={tab.key} onPick={pickCat} />}

      {failed && (
        <div className={`card ${styles.blank}`} role="alert">
          <p className={styles.blankTitle}>Coverage did not load</p>
          <p className={styles.blankBody}>Reload the page. If it happens again, send me a note and I will look at it.</p>
        </div>
      )}

      {route === 'google' && !failed && (
        <StoreRoute status={store.status} batchIds={tab.ids ?? storeIds} cards={tab.count}
          summary={store.summary.filter((r) => (tab.ids ?? storeIds).includes(r.batch_id))}
          candidates={store.candidates.filter((c) => (tab.ids ?? storeIds).includes(c.batch_id))} />
      )}

      {route === 'ebay' && ebay.status === 'ready' && queries.length === 0 && (
        <div className={`card ${styles.blank}`}>
          <span className={styles.blankIcon}><Icon name="IconMap" className={styles.blankGlyph} /></span>
          <p className={styles.blankTitle}>Nothing searched on eBay yet</p>
          <p className={styles.blankBody}>Each search shows here with every product that was checked and why it did or did not reach you.</p>
        </div>
      )}

      {route === 'ebay' && ebay.status === 'ready' && queries.length > 0 && (
        <>
          {catName && (
            <p className={styles.scopeNote}>
              Searches are not sorted by category, so Checked and the reasons below cover every eBay search. From Sent to you on, only {catName}.
            </p>
          )}
          <section className={`card ${styles.flowCard}`} aria-label="Where every checked product went">
            <CoverageFlow counts={flow.counts} totals={flow.totals} labels={flow.labels}
              decisions={flow.decisions} onPick={pick}
              zoomTitle={catName ? `Your ${n(candidates.length)} ${catName} cards` : `Your ${n(candidates.length)} cards from these searches`}
              note={short > 0 ? `${n(short)} fewer cards than searches sent` : null} />
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
                  {i > 0 && !s.cut && (
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
