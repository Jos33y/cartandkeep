import { useEffect, useMemo, useState } from 'react';
import { useEbayTraffic, diagnose, VERDICTS } from '@hooks/useEbayTraffic';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/ebay-traffic-page.module.css';

/*
 * What eBay does with her listings.
 *
 * Every figure on this project until now came from other people's listings.
 * This is the first that comes from hers, and it answers the question the
 * catalogue audit could not: 167 listings have never sold, and nothing in the
 * data said whether that was the title, the photograph, or the listing.
 *
 * The answer is two ratios. Shown, then opened, then bought. Where the chain
 * breaks is the fault.
 */

const ORDER = ['unseen', 'ignored', 'unconvincing', 'selling'];

const pct = (n) => (n == null ? '--' : `${(Number(n) * 100).toFixed(1)}%`);

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

export function EbayTrafficPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, total, listings, error, pulling, pull } = useEbayTraffic(tenant?.id);
  const [only, setOnly] = useState(null);

  const groups = useMemo(() => {
    const map = { unseen: [], ignored: [], unconvincing: [], selling: [] };
    for (const r of listings) map[diagnose(r)].push(r);
    return map;
  }, [listings]);

  const shown = only ? groups[only] : listings;

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
            <Stat label="Shown" value={total.impressions ?? 0} />
            <Stat label="Opened" value={total.views ?? 0} foot={pct(total.click_rate)} />
            <Stat label="Bought" value={total.transactions ?? 0} foot={pct(total.conversion_rate)} />
          </dl>
        )}
      </header>

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
          {/* Where the chain breaks, as one bar. Four numbers do not need four
              cards, and seeing them as proportions of one account is the whole
              point: 140 never shown is a title problem, 140 opened and not
              bought is a pricing problem, and they look nothing alike. */}
          <div className={styles.split} role="group" aria-label="Filter by what is wrong">
            {ORDER.map((key) => {
              const n = groups[key].length;
              if (!n) return null;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={only === key}
                  className={`${styles.segment} ${styles[key]} ${only && only !== key ? styles.dimmed : ''}`}
                  style={{ flexGrow: n }}
                  onClick={() => setOnly(only === key ? null : key)}
                >
                  <span className={styles.segmentValue} data-num>{n}</span>
                  <span className={styles.segmentLabel}>{VERDICTS[key].label}</span>
                </button>
              );
            })}
          </div>

          {only && <p className={styles.verdictNote}>{VERDICTS[only].note}</p>}

          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Listing</span>
              <span>Shown</span>
              <span>Opened</span>
              <span>Bought</span>
            </div>

            {shown.slice(0, 200).map((r) => {
              const verdict = diagnose(r);
              return (
                <div key={r.listing_id} className={styles.row}>
                  <span className={styles.product}>
                    <a href={`https://www.ebay.co.uk/itm/${r.listing_id}`}
                      target="_blank" rel="noreferrer noopener">{r.title ?? r.listing_id}</a>
                    <span className={`${styles.tag} ${styles[verdict]}`}>{VERDICTS[verdict].label}</span>
                  </span>
                  <span data-num>{r.impressions ?? 0}</span>
                  <span data-num>{r.views ?? 0}</span>
                  <span data-num>{r.transactions ?? 0}</span>
                </div>
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
