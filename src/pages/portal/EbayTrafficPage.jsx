import { useEffect, useMemo, useState } from 'react';
import { useEbayTraffic, diagnose, VERDICTS, atStake, benchmarkOf } from '@hooks/useEbayTraffic';
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
  { key: 'transactions', label: 'Sold', help: 'Units bought in this window' },
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
function Funnel({ total, benchmark, count }) {
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
    {
      icon: 'IconBought',
      label: 'Bought',
      value: total.transactions,
      rate: total.conversion_rate,
      fill: total.conversion_rate ?? 0,
      lost: (total.views ?? 0) - (total.transactions ?? 0),
      lostWord: 'left without buying',
      strong: true,
      tip: 'Units paid for. Anyone who got this far had already read the whole listing.',
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
              ? <><span data-num>{pct(s.rate)}</span> carried through, <span data-num>{n(s.lost)}</span> {s.lostWord}</>
              : s.foot}
          </p>
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

function Trend({ days }) {
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

  const { status, total, listings, days, error, pulling, pull } = useEbayTraffic(tenant?.id);
  const [only, setOnly] = useState(null);
  const [sort, setSort] = useState({ key: 'stake', dir: -1 });
  const [find, setFind] = useState('');

  const benchmark = useMemo(() => benchmarkOf(listings), [listings]);
  const withStake = useMemo(
    () => listings.map((r) => ({ ...r, stake: atStake(r, benchmark), verdict: diagnose(r) })),
    [listings, benchmark],
  );

  const groups = useMemo(() => {
    const map = { unseen: [], ignored: [], unconvincing: [], selling: [] };
    for (const r of withStake) map[r.verdict].push(r);
    return map;
  }, [withStake]);

  const shown = useMemo(() => {
    let rows = only ? groups[only] : withStake;
    if (find.trim()) {
      const q = find.trim().toLowerCase();
      rows = rows.filter((r) => (r.title ?? '').toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * sort.dir);
  }, [groups, withStake, only, sort, find]);

  const lost = groups.unconvincing.reduce((a, r) => a + r.stake, 0);

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={8} />;

  const click = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const filtered = only || find.trim();

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
          <Funnel total={total} benchmark={benchmark} count={listings.length} />
          {days?.length > 1 && <Trend days={days} />}
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
            <span className={styles.findWrap}>
              <Icon name="IconSearch" className={styles.findIcon} />
              <input className={styles.find} value={find} placeholder="Find a listing"
                onChange={(e) => setFind(e.target.value)} aria-label="Find a listing" />
            </span>

            {/* A filter you can see and dismiss. Applying one was a click on a
                band and removing it was the same click again, which nobody
                finds by accident. */}
            {filtered ? (
              <button type="button" className={styles.chip}
                onClick={() => { setOnly(null); setFind(''); }}>
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
              <a key={r.listing_id} className={`${styles.row} ${i < 3 && r.stake > 0 ? styles.urgent : ''}`}
                href={`https://www.ebay.co.uk/itm/${r.listing_id}`}
                target="_blank" rel="noreferrer noopener">
                {r.image_url
                  ? <img className={styles.thumb} src={r.image_url} alt="" loading="lazy" />
                  : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

                <span className={styles.who}>
                  <span className={styles.name}>
                    {r.title ?? r.listing_id}
                    <Icon name="IconOut" className={styles.out} />
                  </span>
                  <span className={styles.sub}>
                    <span className={`${styles.tag} ${styles[r.verdict]}`}>{VERDICTS[r.verdict].label}</span>
                    {r.price != null && <span data-num>{gbp(r.price, r.currency ?? 'GBP')}</span>}
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
              </a>
            ))}

            {shown.length === 0 && (
              <p className={styles.quiet}>Nothing matches that.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
