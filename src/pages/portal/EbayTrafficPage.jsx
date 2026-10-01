import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useEbayTraffic, diagnose, VERDICTS, atStake, benchmarkOf } from '@hooks/useEbayTraffic';
import { useKeeper } from '@hooks/useKeeper';
import { useCategoryNames } from '@hooks/useCategoryNames';
import { KeeperDock, DockNote } from '@components/ui/portal/KeeperDock';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import { loadTenant } from '@lib/tenant';
import { Icon } from '@components/ui/icons';
import { PageSkeleton, RowSkeleton } from '@components/ui/portal/Skeleton';
import styles from '@styles/pages/portal/ebay-traffic-page.module.css';

/*
 * What eBay does with her listings.
 *
 * Three rewrites in, the lesson is that the page was explaining itself instead
 * of showing itself. Three equal figures with a sentence under each, a
 * paragraph at the top saying what the columns meant, and a filter you could
 * apply but not see. All of it is now a mark, a number, and an explanation that
 * waits until it is asked for.
 */

const ORDER = ['unseen', 'ignored', 'unconvincing', 'selling'];

const n = (v) => Number(v ?? 0).toLocaleString('en-GB');
const pct = (v, dp = 1) => (v == null ? '--' : `${(Number(v) * 100).toFixed(dp)}%`);
const gbp = (v, c = 'GBP') => (v == null ? null
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v));

const dayName = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const COLUMNS = [
  { key: 'impressions', label: 'Shown', help: 'Times eBay put it in front of somebody' },
  { key: 'views', label: 'Opened', help: 'Times somebody clicked into it' },
  { key: 'last', label: 'Sold', help: 'Units bought in this window. Sorted, the most recent sale comes first' },
  { key: 'stake', label: 'At stake', help: 'What this listing would have taken if it converted like the ones that do sell' },
];

/* Explanation that waits to be asked for. On the page permanently, it was four
   lines of prose wrapped around three numbers. */
function Info({ children }) {
  return (
    <span className={styles.info} tabIndex={0} role="note">
      <Icon name="IconInfo" className={styles.infoIcon} />
      <span className={styles.tip}>{children}</span>
    </span>
  );
}

/*
 * The funnel, drawn.
 *
 * 158,223 and 2,632 and 30 set at the same size made the collapse invisible,
 * which is the one thing this measures. The bars are the numbers.
 */
function Funnel({ total, benchmark, count, latest, units = null }) {
  /*
   * Each bar is its share of the step before it, not of impressions.
   *
   * Measured against impressions, opened renders at 1.7% and bought at 0.02%,
   * so all three read as an empty track and the bars said nothing. Retention
   * from the previous step is the question anyway: of everyone shown it, how
   * many opened it, and of those, how many paid.
   */
  const steps = [
    {
      icon: 'IconImpression',
      label: 'Shown',
      value: total.impressions,
      fill: 1,
      foot: `across ${n(count)} listings`,
      tip: 'Times eBay put a listing in front of somebody, in search results or a browse page.',
    },
    {
      icon: 'IconOpened',
      label: 'Opened',
      value: total.views,
      rate: total.click_rate,
      fill: total.click_rate ?? 0,
      lost: (total.impressions ?? 0) - (total.views ?? 0),
      lostWord: 'scrolled past',
      tip: 'Times somebody clicked into the listing. What they saw first was the photograph, the title and the price.',
    },
    /*
     * Units, from her orders. eBay's own figure counts purchases: three of one thing in one go is one, so it
     * undercounts what she sold. The rate stays eBay's, purchases per open, because that is the share of people.
     */
    {
      icon: 'IconBought',
      label: 'Bought',
      value: units != null && units >= (total.transactions ?? 0) ? units : total.transactions,
      rate: total.conversion_rate,
      fill: total.conversion_rate ?? 0,
      lost: (total.views ?? 0) - (total.transactions ?? 0),
      lostWord: 'left without buying',
      strong: true,
      purchases: units != null && units > (total.transactions ?? 0) ? total.transactions : null,
      tip: 'Units paid for, from your orders. eBay counts a purchase of three as one; this counts it as three. The rate is purchases per open.',
    },
  ];

  return (
    <div className={styles.funnel}>
      {steps.map((s) => (
        <div key={s.label} className={`${styles.step} ${s.strong ? styles.stepWon : ''}`}>
          <p className={styles.stepHead}>
            <Icon name={s.icon} className={styles.stepIcon} />
            <span>{s.label}</span>
            <Info>{s.tip}</Info>
          </p>

          <p className={`figure ${styles.stepValue}`}>{n(s.value)}</p>

          <span className={styles.stepBar} aria-hidden="true">
            <span style={{ width: `${Math.max(1.5, s.fill * 100)}%` }} />
          </span>

          <p className={styles.stepRate}>
            {s.rate != null
              ? <>{s.purchases != null && <><span data-num>{n(s.purchases)}</span> purchases, </>}<span data-num>{pct(s.rate)}</span> carried through, <span data-num>{n(s.lost)}</span> {s.lostWord}</>
              : s.foot}
          </p>

          {s.strong && latest && (
            <p className={styles.stepLatest}>
              Latest sale <span data-num>{dayName(latest.sold_at)}</span>,{' '}
              {latest.href
                ? <a href={latest.href} target="_blank" rel="noreferrer noopener">{latest.title}</a>
                : latest.title}
            </p>
          )}
        </div>
      ))}

      {benchmark != null && (
        <p className={styles.bench}>
          <Icon name="IconChart" className={styles.benchIcon} />
          Listings that do sell convert <span data-num>{pct(benchmark)}</span> of the people who open them
          <Info>
            The middle value across every listing that has sold in this window. It is
            what the at stake column measures a listing against.
          </Info>
        </p>
      )}
    </div>
  );
}

function Trend({ days, soldOn }) {
  const [at, setAt] = useState(null);
  if (days.length < 2) return null;

  const w = 720;
  const h = 108;
  const top = Math.max(1, ...days.map((d) => d.impressions ?? 0));
  const topViews = Math.max(1, ...days.map((d) => d.views ?? 0));
  const x = (i) => (i / (days.length - 1)) * w;

  const area = [
    `M 0 ${h}`,
    ...days.map((d, i) => `L ${x(i).toFixed(1)} ${(h - ((d.impressions ?? 0) / top) * h).toFixed(1)}`),
    `L ${w} ${h}`,
    'Z',
  ].join(' ');

  const line = days
    .map((d, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${(h - ((d.views ?? 0) / topViews) * h * 0.78).toFixed(1)}`)
    .join(' ');

  const peak = days.reduce((best, d, i) => ((d.impressions ?? 0) > (days[best].impressions ?? 0) ? i : best), 0);
  const cur = at != null ? days[at] : days[peak];

  const months = days
    .map((d, i) => ({ d, i }))
    .filter(({ d }, i) => i === 0 || d.day.slice(5, 7) !== days[i - 1].day.slice(5, 7));

  return (
    <figure className={styles.trend}>
      <p className={styles.read}>
        <strong>{dayName(cur.day)}</strong>
        <span><span data-num>{n(cur.impressions)}</span> shown</span>
        <span><span data-num>{n(cur.views)}</span> opened</span>
        {cur.transactions > 0 && <span className={styles.won}><span data-num>{cur.transactions}</span> sold</span>}
        {soldOn?.get(cur.day)?.length > 0 && (
          <span className={styles.readSold}>{soldOn.get(cur.day).join(', ')}</span>
        )}
        {at == null && <span className={styles.peakTag}>busiest day</span>}
        {at != null && <span className={styles.hint}>hover to read any day</span>}
      </p>

      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.chart}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setAt(Math.max(0, Math.min(days.length - 1,
            Math.round(((e.clientX - box.left) / box.width) * (days.length - 1)))));
        }}
        onMouseLeave={() => setAt(null)}
        role="img" aria-label={`Impressions and views over ${days.length} days`}>

        <defs>
          <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-scale-2)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--c-scale-2)" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <path d={area} className={styles.area} />
        <path d={line} className={styles.line} fill="none" />

        {days.map((d, i) => (d.transactions > 0
          ? <circle key={d.day} cx={x(i)} cy={h - 4} r="2.8" className={styles.sold} />
          : null))}

        {at != null && <line x1={x(at)} x2={x(at)} y1="0" y2={h} className={styles.cursor} vectorEffect="non-scaling-stroke" />}
        <circle cx={x(peak)} cy={h - ((days[peak].impressions ?? 0) / top) * h} r="3.5" className={styles.peak} />
      </svg>

      <figcaption className={styles.axis}>
        {months.map(({ d, i }) => (
          <span key={d.day} style={{ left: `${(i / (days.length - 1)) * 100}%` }}>
            {new Date(d.day).toLocaleDateString('en-GB', { month: 'short' })}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function EbayTrafficPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, total, listings, days, sales, refunds, error, pulling, pull, onShop, bringToShop } = useEbayTraffic(tenant?.id);
  const keeper = useKeeper(tenant?.id);
  const agent = tenant?.store?.agent?.name || 'Your assistant';
  const names = useCategoryNames(tenant?.id);
  const sections = useMemo(() => names.departments.map((d) => ({ path: d.path, label: d.label })), [names.departments]);
  const [bringing, setBringing] = useState(null);
  const [brought, setBrought] = useState(null);

  async function bring(ids) {
    if (bringing || !ids.length) return;
    setBrought(null);
    setBringing({ done: 0, total: ids.length });
    const result = await bringToShop(ids, sections, (done, all) => setBringing({ done, total: all }));
    setBringing(null);
    setBrought(result);
    await keeper.adopt();
  }
  const [only, setOnly] = useState(null);
  // Live, ended, or both. Ended is a listing that sold out or ran out inside the window: its traffic and sales stay.
  const [life, setLife] = useState('all');
  const [sort, setSort] = useState({ key: 'stake', dir: -1 });
  const [find, setFind] = useState('');

  const benchmark = useMemo(() => benchmarkOf(listings), [listings]);

  // By item id; a title only when no other listing shares it, so an order is never pinned on the wrong one.
  const listingOf = useMemo(() => {
    const byId = new Map(listings.map((r) => [String(r.listing_id), r]));
    const titles = new Map();
    for (const r of listings) {
      const t = (r.title ?? '').toLowerCase();
      if (t) titles.set(t, titles.has(t) ? null : r);
    }
    return (s) => byId.get(String(s.external_sku)) ?? titles.get((s.title ?? '').toLowerCase()) ?? null;
  }, [listings]);

  const ordersBy = useMemo(() => {
    const map = new Map();
    for (const s of sales ?? []) {
      const r = listingOf(s);
      if (!r) continue;
      if (!map.has(r.listing_id)) map.set(r.listing_id, []);
      map.get(r.listing_id).push(s);
    }
    return map;
  }, [sales, listingOf]);

  const latest = useMemo(() => {
    const s = (sales ?? [])[0];
    if (!s) return null;
    const r = listingOf(s);
    return { ...s, href: r ? `https://www.ebay.co.uk/itm/${r.listing_id}` : null };
  }, [sales, listingOf]);

  // Day by day, what sold, for the chart's readout. London days, as the traffic report counts them.
  const soldOn = useMemo(() => {
    const map = new Map();
    for (const s of sales ?? []) {
      const day = new Date(s.sold_at).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(s.title.length > 42 ? `${s.title.slice(0, 40)}...` : s.title);
    }
    return map;
  }, [sales]);

  // Units refunded in full per listing, by its item number, or by title for an order eBay filed without one.
  const backBy = useMemo(() => {
    const squash = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const map = new Map();
    for (const r of refunds ?? []) {
      for (const k of [r.external_sku && `id:${r.external_sku}`, `t:${squash(r.title)}`].filter(Boolean)) {
        const at = map.get(k) ?? { units: 0, reasons: new Set() };
        at.units += Number(r.qty ?? 1);
        if (r.refund_reason) at.reasons.add(r.refund_reason);
        map.set(k, at);
      }
    }
    return (row) => map.get(`id:${row.listing_id}`) ?? map.get(`t:${squash(row.title)}`) ?? null;
  }, [refunds]);

  const withStake = useMemo(
    () => listings.map((r) => {
      const orders = ordersBy.get(r.listing_id) ?? [];
      // The traffic report can lag an order it has not counted yet; the order is the stronger fact.
      const inWindow = orders.filter((o) => total && o.sold_at.slice(0, 10) >= total.window_start
        && o.sold_at.slice(0, 10) <= total.window_end).reduce((a, o) => a + (o.qty ?? 1), 0);
      const sold = Math.max(r.transactions ?? 0, inWindow);
      const row = { ...r, transactions: sold };
      const lastSoldAt = orders[0]?.sold_at ?? null;
      return {
        ...row,
        ended: Boolean(r.ended_at),
        back: backBy(r),
        // An ended listing cannot convert any more, so nothing is at stake on it.
        stake: r.ended_at ? 0 : atStake(row, benchmark),
        verdict: diagnose(row),
        lastSoldAt,
        afterWindow: Boolean(lastSoldAt && total && lastSoldAt.slice(0, 10) > total.window_end),
        last: lastSoldAt ? Date.parse(lastSoldAt) : (sold ? 1 : 0),
      };
    }),
    [listings, benchmark, ordersBy, total, backBy],
  );

  const endedCount = withStake.filter((r) => r.ended).length;
  const inLife = useMemo(
    () => withStake.filter((r) => life === 'all' || (life === 'ended' ? r.ended : !r.ended)),
    [withStake, life],
  );

  const groups = useMemo(() => {
    const map = { unseen: [], ignored: [], unconvincing: [], selling: [] };
    for (const r of inLife) map[r.verdict].push(r);
    return map;
  }, [inLife]);

  const shown = useMemo(() => {
    let rows = only ? groups[only] : inLife;
    if (find.trim()) {
      const q = find.trim().toLowerCase();
      rows = rows.filter((r) => (r.title ?? '').toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * sort.dir);
  }, [groups, inLife, only, sort, find]);

  const lost = groups.unconvincing.reduce((a, r) => a + r.stake, 0);
  // Units sold in the window, from her orders: what the headline counts, so a purchase of three reads as three.
  const unitsInWindow = total && sales?.length
    ? sales.filter((o) => o.sold_at.slice(0, 10) >= total.window_start && o.sold_at.slice(0, 10) <= total.window_end)
      .reduce((a, o) => a + (Number(o.qty) || 1), 0)
    : null;

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={8} />;

  const click = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const filtered = only || find.trim() || life !== 'all';
  // Only a live listing can be brought to the shop from here; an ended one has nothing on eBay to copy from.
  const notYet = shown.filter((r) => !r.ended && !onShop.has(String(r.listing_id)));
  const skippedWhy = brought?.skipped?.length
    ? `${brought.skipped.length} not added: ${brought.skipped[0].reason}${brought.skipped.length > 1 ? ', and others' : ''}.` : null;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">eBay</p>
          <h1 className={styles.title}>Traffic</h1>
        </div>

        <div className={styles.headSide}>
          {total && (
            <p className={styles.window}>
              {dayName(total.window_start)} to {dayName(total.window_end)}
            </p>
          )}
          <button type="button" className={styles.button} disabled={pulling} onClick={() => pull(90)}>
            <Icon name="IconRefresh" className={`${styles.btnIcon} ${pulling ? styles.spin : ''}`} />
            {pulling ? 'Pulling' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <p className={styles.failed} role="alert">{error}</p>}

      {status === 'empty' && !error && (
        <div className="card">
          <p className={styles.quiet}>
            eBay holds ninety days of impressions, views and sales per listing.
            Pull it once and every listing is sorted by what is wrong with it.
          </p>
        </div>
      )}

      {/* One card, not two. The funnel and the series are the same account of
          the same window, and giving them a card each made neither the
          headline. */}
      {total && (
        <section className="card">
          <Funnel total={total} benchmark={benchmark} count={listings.length} latest={latest} units={unitsInWindow} />
          {days?.length > 1 && <Trend days={days} soldOn={soldOn} />}
        </section>
      )}

      {status === 'ready' && listings.length > 0 && (
        <section className="card">
          {/* Bands and their note are one component, not a row of buttons with
              a loose sentence under it. Pressed, the band joins a panel in its
              own colour: the answer is attached to the thing that asked. */}
          <div className={styles.bands}>
            <div className={styles.split} role="tablist" aria-label="Filter by what is wrong">
              {ORDER.map((key) => {
                const count = groups[key].length;
                if (!count) return null;
                return (
                  <button key={key} type="button" role="tab" aria-selected={only === key}
                    className={`${styles.segment} ${styles[key]} ${only && only !== key ? styles.dimmed : ''}`}
                    style={{ flexGrow: count }}
                    onClick={() => setOnly(only === key ? null : key)}>
                    <span className={styles.segmentValue} data-num>{count}</span>
                    <span className={styles.segmentLabel}>{VERDICTS[key].label}</span>
                  </button>
                );
              })}
            </div>

            {only && (
              <div className={`${styles.panel} ${styles[only]}`} role="tabpanel">
                <p className={styles.panelNote}>{VERDICTS[only].note}</p>
                <button type="button" className={styles.panelClear} onClick={() => setOnly(null)}>
                  <Icon name="IconX" className={styles.panelX} />
                  All listings
                </button>
              </div>
            )}
          </div>

          {!only && lost > 0 && (
            <div className={styles.finding}>
              <p className={styles.findingLabel}>Unrealised</p>
              <p className={`figure ${styles.findingValue}`}>{gbp(lost)}</p>
              <p className={styles.findingNote}>
                across <span data-num>{groups.unconvincing.length}</span> listings that were
                opened and not bought, measured at the rate the selling listings convert at.
              </p>
            </div>
          )}

          <div className={styles.tools}>
            {endedCount > 0 && (
              <div className={styles.life} role="group" aria-label="Live or ended">
                {[['all', 'All', withStake.length], ['live', 'Live', withStake.length - endedCount], ['ended', 'Ended', endedCount]].map(([key, label, count]) => (
                  <button key={key} type="button" aria-pressed={life === key} className={styles.lifeOption}
                    onClick={() => { setLife(key); setOnly(null); }}>
                    {label} <span data-num>{count}</span>
                  </button>
                ))}
              </div>
            )}
            <span className={styles.findWrap}>
              <Icon name="IconSearch" className={styles.findIcon} />
              <input className={styles.find} value={find} placeholder="Find a listing"
                onChange={(e) => setFind(e.target.value)} aria-label="Find a listing" />
            </span>

            {/* A filter you can see and dismiss. Applying one was a click on a
                band and removing it was the same click again, which nobody
                finds by accident. */}
            {notYet.length > 0 && (
              <button type="button" className={styles.bring} disabled={Boolean(bringing)} onClick={() => bring(notYet.map((r) => String(r.listing_id)))}>
                Add {notYet.length === 1 ? 'it' : `these ${notYet.length}`} to your shop
              </button>
            )}

            {filtered ? (
              <button type="button" className={styles.chip}
                onClick={() => { setOnly(null); setFind(''); setLife('all'); }}>
                <Icon name="IconFilter" className={styles.chipIcon} />
                <span data-num>{shown.length}</span> of <span data-num>{listings.length}</span>
                <Icon name="IconX" className={styles.chipX} />
              </button>
            ) : (
              <span className={styles.count}>
                <span data-num>{listings.length}</span> listings
              </span>
            )}
          </div>

          <div className={`${styles.table} ${only === 'unseen' ? styles.tableNarrow : ''}`}>
            <div className={styles.headRow}>
              <span />
              <span>Listing</span>
              <span className={styles.dropCol}>Open rate</span>
              {/* At stake measures a listing against what it would have taken
                  if it converted. With no opens there is nothing to measure,
                  so in that view the column is a row of dashes. */}
              {COLUMNS.filter((c) => !(only === 'unseen' && c.key === 'stake')).map((c) => (
                <button key={c.key} type="button" title={c.help}
                  className={`${styles.sortable} ${sort.key === c.key ? styles.sorted : ''}`}
                  onClick={() => click(c.key)}>
                  {c.label}
                  <Icon name="IconCaret"
                    className={`${styles.caret} ${sort.key === c.key ? styles.caretOn : ''} ${sort.key === c.key && sort.dir === 1 ? styles.caretUp : ''}`} />
                </button>
              ))}
            </div>

            {pulling && Array.from({ length: 6 }, (_, i) => <RowSkeleton key={`s${i}`} i={i} />)}

            {!pulling && shown.map((r, i) => (
              <div key={r.listing_id} className={`${styles.row} ${i < 3 && r.stake > 0 ? styles.urgent : ''}`} data-ended={r.ended || undefined}>
                {r.image_url
                  ? <img className={styles.thumb} src={r.image_url} alt="" loading="lazy" />
                  : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

                <span className={styles.who}>
                  <a className={styles.name} href={`https://www.ebay.co.uk/itm/${r.listing_id}`} target="_blank" rel="noreferrer noopener">
                    {r.title ?? r.listing_id}
                    <Icon name="IconOut" className={styles.out} />
                  </a>
                  <span className={styles.sub}>
                    {r.ended ? (
                      <span className={`${styles.tag} ${styles.endedTag}`} title={`Ended ${dayName(r.ended_at)}`}>
                        {Number(r.quantity_sold) > 0 ? `Ended, ${r.quantity_sold} sold` : 'Ended, none sold'}
                      </span>
                    ) : (
                      <span className={`${styles.tag} ${styles[r.verdict]}`}>{VERDICTS[r.verdict].label}</span>
                    )}
                    {r.back && (
                      <span className={`${styles.tag} ${styles.backTag}`}
                        title={r.back.reasons.size ? [...r.back.reasons].join(', ') : 'No reason from eBay'}>
                        {r.back.units} refunded
                      </span>
                    )}
                    {r.price != null && <span data-num>{gbp(r.price, r.currency ?? 'GBP')}</span>}
                    {r.ended
                      ? <span className={styles.endedOn}>ended <span data-num>{dayName(r.ended_at)}</span></span>
                      : <ShopMark item={onShop.get(String(r.listing_id))} disabled={Boolean(bringing)}
                        onAdd={() => bring([String(r.listing_id)])} />}
                    {r.lastSoldAt && (
                      <span className={styles.won}>
                        sold <span data-num>{dayName(r.lastSoldAt)}</span>{r.afterWindow ? ', after this window' : ''}
                      </span>
                    )}
                  </span>
                </span>

                <span className={styles.drop2}>
                  <span className={styles.dropTrack} aria-hidden="true">
                    <span className={styles.dropFill}
                      style={{ width: `${Math.min(100, ((r.click_rate ?? 0) / 0.05) * 100)}%` }} />
                  </span>
                  <span className={styles.dropPct} data-num>{pct(r.click_rate)}</span>
                </span>

                <span data-num className={styles.fig}>{n(r.impressions)}</span>
                <span data-num className={styles.fig}>{n(r.views)}</span>
                <span data-num className={`${styles.fig} ${r.transactions ? styles.won : styles.none}`}>
                  {n(r.transactions)}
                </span>
                {only !== 'unseen' && (
                  <span data-num className={`${styles.fig} ${r.stake ? styles.stake : styles.none}`}>
                    {r.stake ? gbp(r.stake) : '--'}
                  </span>
                )}
              </div>
            ))}

            {shown.length === 0 && (
              <p className={styles.quiet}>Nothing matches that.</p>
            )}
          </div>
        </section>
      )}

      <KeeperDock keeper={keeper} agent={agent}>
        {bringing && (
          <DockNote line={`Bringing ${bringing.done ? `${bringing.done} of ` : ''}${bringing.total} from eBay`}
            note={`Each one goes to ${agent} as it lands.`} progress={bringing.done / bringing.total} />
        )}
        {!bringing && brought && (brought.added.length > 0 || skippedWhy) && (
          <DockNote line={`${brought.added.length} added to your products as drafts.`}
            note={skippedWhy ?? `Review them under New from eBay once ${agent} has filled them in.`}
            onDismiss={() => setBrought(null)} />
        )}
      </KeeperDock>
    </div>
  );
}

// On the shop, waiting in Products, or one tap to bring it over.
function ShopMark({ item, onAdd, disabled }) {
  if (item?.status === 'live') {
    return <Link className={styles.onShop} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?open=${item.id}`)}>On your shop</Link>;
  }
  if (item) {
    return <Link className={styles.inProducts} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?open=${item.id}`)}>In Products, not live</Link>;
  }
  return (
    <button type="button" className={styles.addOne} disabled={disabled} onClick={onAdd}>
      <Icon name="IconPlus" width="11" height="11" />Add to shop
    </button>
  );
}
