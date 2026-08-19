import { useEffect, useMemo, useState } from 'react';
import { useInterest, verdict, ENOUGH } from '@hooks/useInterest';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/interest-page.module.css';

/*
 * What people look at.
 *
 * The screen exists because she cannot run what she cannot see, and everything
 * on it except the sales columns fills up before the first order. A hundred
 * views and nothing in a basket is a finding on the first afternoon.
 *
 * It answers three questions in the order she would ask them. Did anybody come.
 * Which products are wasting the attention they get. What did people ask for
 * that the shop does not sell.
 */

const FILTERS = [
  { key: 'worth', label: 'Worth a look' },
  { key: 'all', label: 'Every product' },
];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const pct = (n) => (n === null || n === undefined ? null : `${Number(n).toFixed(1)}%`);

export function InterestPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('worth');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, products, searches, totals, failing, missed, reload,
  } = useInterest(tenant?.id);

  const rows = useMemo(
    () => (filter === 'worth' ? failing : products),
    [filter, failing, products],
  );

  if (tenant === undefined) {
    return <p className={styles.status} role="status" aria-live="polite">Loading</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>The numbers did not load</h1>
        <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.retry} onClick={reload}>Try again</button>
      </div>
    );
  }

  const quiet = status === 'ready' && totals.visits === 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Your shop</p>
          <h1 className={styles.title}>What people look at</h1>
        </div>

        <dl className={styles.stats}>
          <Stat label="Visits" value={totals.visits} />
          <Stat label="Products viewed" value={totals.productViews} />
          <Stat label="Added to a basket" value={totals.adds} />
          <Stat label="Reached checkout" value={totals.checkouts} />
        </dl>
      </header>

      {/*
        * Two honest caveats, said once and not repeated beside every figure.
        * Visits is not people: nothing is stored on a visitor's device, so the
        * reference dies on reload and a refresh counts twice. And nothing
        * filters crawlers, so this inflates the day the sitemap goes in.
        */}
      <p className={styles.caveat}>
        Visits rather than people, because the shop stores nothing on anybody's device,
        so a reload counts twice. Search engines are counted too. Last {totals.days || 0} days.
      </p>

      {quiet ? (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>Nobody has been yet</h2>
          <p className={styles.emptyBody}>
            This fills the hour the shop is public, long before anything sells. Views,
            saves and what people searched for all arrive first.
          </p>
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="micro">Products</h2>
              <div className={styles.filters} role="group" aria-label="Which products">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={filter === f.key}
                    className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                    <span className={styles.chipCount} data-num>
                      {f.key === 'worth' ? failing.length : products.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {filter === 'worth' && (
              <p className={styles.caveat}>
                Seen at least <span data-num>{ENOUGH}</span> times and never bought. Below that
                a verdict would be a guess: if a product were converting normally, no sale in
                twenty views happens more than a third of the time.
              </p>
            )}

            {rows.length === 0 ? (
              <p className={styles.quiet}>
                {filter === 'worth'
                  ? 'Nothing has had enough attention to judge yet.'
                  : 'No products.'}
              </p>
            ) : (
              <div className={styles.table} role="table">
                <div className={styles.headRow} role="row">
                  <span role="columnheader">Product</span>
                  <span role="columnheader" className={styles.num}>Views</span>
                  <span role="columnheader" className={styles.num}>Saved</span>
                  <span role="columnheader" className={styles.num}>Basket</span>
                  <span role="columnheader" className={styles.num}>Out</span>
                  <span role="columnheader" className={styles.num}>Sold</span>
                  <span role="columnheader" className={styles.num}>Taken</span>
                </div>

                {rows.map((p) => {
                  const v = verdict(p);
                  return (
                    <div key={p.product_id} className={styles.row} role="row">
                      <span className={styles.product}>
                        {p.image_url
                          ? <img className={styles.thumb} src={thumb(p.image_url)} alt="" loading="lazy" />
                          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}
                        <span className={styles.productText}>
                          <span className={styles.productTitle}>{p.title}</span>
                          <span className={`${styles.verdict} ${styles[v.tone]}`}>{v.text}</span>
                        </span>
                      </span>

                      <Cell value={p.views} />
                      <Cell value={p.saves} />
                      <Cell value={p.adds} sub={pct(p.add_rate_pct)} />
                      <Cell value={p.removes} sub={pct(p.abandon_rate_pct)} />
                      <Cell value={p.units_sold} sub={pct(p.buy_rate_pct)} />
                      <Cell value={formatGbp(p.revenue)} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="micro">What people asked for</h2>
            </div>

            {/*
              * The most actionable line in the whole table. Somebody arrived
              * wanting a specific thing, typed it in, and left with nothing.
              * Each one is either a product to stock or a word the catalogue
              * does not use for something already on the shelf.
              */}
            {searches.length === 0 ? (
              <p className={styles.quiet}>Nobody has used the search box yet.</p>
            ) : (
              <>
                {missed.length > 0 && (
                  <p className={styles.caveat}>
                    <span data-num>{missed.length}</span> of these found nothing. Each one is a
                    product to stock, or a word the shop does not use for something it already sells.
                  </p>
                )}

                <ul className={styles.terms}>
                  {searches.map((s) => (
                    <li key={s.term} className={styles.term}>
                      <span className={styles.termText}>{s.term}</span>
                      <span className={styles.termCount} data-num>{s.searches}</span>
                      <span className={s.never_found ? styles.bad : styles.quietText}>
                        {s.never_found ? 'found nothing' : 'found something'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Cell({ value, sub }) {
  return (
    <span className={styles.cell} role="cell">
      <span data-num>{value}</span>
      {sub ? <span className={styles.sub} data-num>{sub}</span> : null}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
    </div>
  );
}
