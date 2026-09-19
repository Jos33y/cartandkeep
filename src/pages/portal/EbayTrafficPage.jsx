import { useEffect, useMemo, useState } from 'react';
import { useEbayTraffic, diagnose, VERDICTS } from '@hooks/useEbayTraffic';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/ebay-traffic-page.module.css';

/*
 * What eBay does with her listings.
 *
 * Every figure on this project until now came from other people's listings.
 * This is the first that comes from hers, and it answers what the catalogue
 * audit could not: her listings have been shown 158,000 times and opened 2,600,
 * so the market was never the problem.
 *
 * Shown, then opened, then bought. Where the chain breaks is the fault.
 */

const ORDER = ['unseen', 'ignored', 'unconvincing', 'selling'];

const n = (v) => Number(v ?? 0).toLocaleString('en-GB');
const pct = (v) => (v == null ? '--' : `${(Number(v) * 100).toFixed(1)}%`);
const gbp = (v, c = 'GBP') => (v == null ? null
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: c }).format(v));

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

/*
 * Ninety days of impressions, as an area. No axis and no library: the shape is
 * the finding, and a gridline does not help her read whether it is climbing.
 * Views ride on the same chart as a line, because they are two orders of
 * magnitude smaller and a second bar would be a hairline.
 */
function Trend({ days }) {
  if (days.length < 2) return null;

  const w = 720;
  const h = 96;
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
    .map((d, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${(h - ((d.views ?? 0) / topViews) * h * 0.8).toFixed(1)}`)
    .join(' ');

  const sold = days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => (d.transactions ?? 0) > 0);

  return (
    <figure className={styles.trend}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.chart}
        role="img" aria-label={`Impressions and views, ${days.length} days`}>
        <path d={area} className={styles.area} />
        <path d={line} className={styles.line} fill="none" />
        {/* A sale is a day worth marking, and there are thirty of them in
            ninety days: too few to see in a series and the only outcome that
            matters. */}
        {sold.map(({ i }) => (
          <circle key={i} cx={x(i)} cy={h - 4} r="2.5" className={styles.sold} />
        ))}
      </svg>
      <figcaption className={styles.trendKey}>
        <span className={styles.keyArea}>shown</span>
        <span className={styles.keyLine}>opened</span>
        <span className={styles.keyDot}>a sale</span>
        <span className={styles.trendSpan}>
          {when(days[0].day)} to {when(days.at(-1).day)}
        </span>
      </figcaption>
    </figure>
  );
}

export function EbayTrafficPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, total, listings, days, error, pulling, pull } = useEbayTraffic(tenant?.id);
  const [only, setOnly] = useState(null);

  const groups = useMemo(() => {
    const map = { unseen: [], ignored: [], unconvincing: [], selling: [] };
    for (const r of listings) map[diagnose(r)].push(r);
    return map;
  }, [listings]);

  /*
   * Worst first, not biggest first.
   *
   * Sorting on impressions put the busiest listing on top whether it was
   * selling or not. What matters is where the most is being lost, which is
   * views that came to nothing: a listing opened 157 times with no sale is a
   * bigger problem than one opened twice, and the selling ones are the ones
   * that need no attention at all.
   */
  const shown = useMemo(() => {
    const rows = only ? groups[only] : listings;
    const lost = (r) => (r.transactions ? 0 : (r.views ?? 0));
    return [...rows].sort(
      (a, b) => lost(b) - lost(a) || (b.impressions ?? 0) - (a.impressions ?? 0),
    );
  }, [groups, listings, only]);

  if (tenant === undefined) {
    return <p className={styles.status} role="status" aria-live="polite">Loading</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">eBay</p>
          <h1 className={styles.title}>Traffic</h1>
          <p className={styles.lead}>
            What eBay showed, what people opened, and what they bought. Where the
            chain breaks is what is wrong with the listing.
          </p>
        </div>

        {total && (
          <dl className={styles.stats}>
            <Stat label="Shown" value={n(total.impressions)} />
            <Stat label="Opened" value={n(total.views)} foot={`${pct(total.click_rate)} of those shown`} />
            <Stat label="Bought" value={n(total.transactions)} foot={`${pct(total.conversion_rate)} of those opened`} />
          </dl>
        )}
      </header>

      {days?.length > 1 && <Trend days={days} />}

      <div className={styles.bar}>
        <p className={styles.window}>
          {total
            ? `${when(total.window_start)} to ${when(total.window_end)}, pulled ${when(total.fetched_at)}`
            : 'Nothing pulled yet'}
        </p>
        <button type="button" className={styles.button} disabled={pulling} onClick={() => pull(90)}>
          {pulling ? 'Asking eBay' : total ? 'Pull again' : 'Pull 90 days'}
        </button>
      </div>

      {error && <p className={styles.failed} role="alert">{error}</p>}

      {status === 'empty' && !error && (
        <p className={styles.quiet}>
          eBay holds ninety days of this. Pull it once and every listing on the
          account is sorted by what is actually wrong with it.
        </p>
      )}

      {status === 'ready' && listings.length > 0 && (
        <>
          {/* Where the chain breaks, sized by how many listings break there.
              Four cards would give equal space to four very different accounts
              of the same catalogue, and the shape is the finding. */}
          <div className={styles.split} role="group" aria-label="Filter by what is wrong">
            {ORDER.map((key) => {
              const count = groups[key].length;
              if (!count) return null;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={only === key}
                  className={`${styles.segment} ${styles[key]} ${only && only !== key ? styles.dimmed : ''}`}
                  style={{ flexGrow: count }}
                  onClick={() => setOnly(only === key ? null : key)}
                >
                  <span className={styles.segmentValue} data-num>{count}</span>
                  <span className={styles.segmentLabel}>{VERDICTS[key].label}</span>
                </button>
              );
            })}
          </div>

          <p className={styles.verdictNote}>
            {only
              ? VERDICTS[only].note
              : 'Tap a band to see only those. Sorted by what is being lost, so the listings people opened and did not buy come first.'}
          </p>

          <div className={styles.list}>
            {shown.slice(0, 200).map((r) => {
              const verdict = diagnose(r);
              return (
                <a key={r.listing_id} className={styles.row}
                  href={`https://www.ebay.co.uk/itm/${r.listing_id}`}
                  target="_blank" rel="noreferrer noopener">
                  {r.image_url
                    ? <img className={styles.thumb} src={r.image_url} alt="" loading="lazy" />
                    : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

                  <span className={styles.who}>
                    <span className={styles.name}>{r.title ?? r.listing_id}</span>
                    <span className={styles.sub}>
                      <span className={`${styles.tag} ${styles[verdict]}`}>{VERDICTS[verdict].label}</span>
                      {r.price != null && <span data-num>{gbp(r.price, r.currency ?? 'GBP')}</span>}
                    </span>
                  </span>

                  {/* The funnel per listing, drawn rather than tabulated. Two
                      bars on one scale show the drop that three columns of
                      digits make you compute. */}
                  <span className={styles.funnel} aria-hidden="true">
                    <span className={styles.funnelImp}
                      style={{ width: `${Math.min(100, ((r.impressions ?? 0) / Math.max(1, listings[0]?.impressions ?? 1)) * 100)}%` }} />
                    <span className={styles.funnelView}
                      style={{ width: `${Math.min(100, ((r.views ?? 0) / Math.max(1, (r.impressions ?? 1))) * 100)}%` }} />
                  </span>

                  <span className={styles.figs}>
                    <span data-num>{n(r.impressions)}</span>
                    <span data-num>{n(r.views)}</span>
                    <span data-num className={r.transactions ? styles.won : styles.none}>
                      {n(r.transactions)}
                    </span>
                  </span>
                </a>
              );
            })}

            {shown.length > 200 && (
              <p className={styles.quiet}>
                Showing the first <span data-num>200</span> of <span data-num>{shown.length}</span>.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, foot }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
      {foot ? <dd className={styles.statFoot}>{foot}</dd> : null}
    </div>
  );
}
