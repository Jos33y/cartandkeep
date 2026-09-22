import { useEffect, useMemo, useState } from 'react';
import { useInterest, verdict, ENOUGH, CERTAIN } from '@hooks/useInterest';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/interest-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

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

/*
 * Plain names for what the classifier calls a source.
 *
 * `referral` is the one worth spelling out. Somebody linked to the shop from a
 * page of their own, which is the single best thing that can happen to it and
 * is worth reading as that rather than as a category name.
 */
const SOURCE = {
  google: 'Google',
  tiktok: 'TikTok',
  social: 'Instagram and other social',
  search: 'Other search engines',
  email: 'Email',
  referral: 'Somebody linked to you',
  direct: 'Typed the address in',
};

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const pct = (n) => (n === null || n === undefined ? null : `${Number(n).toFixed(1)}%`);

export function InterestPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('worth');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, products, searches, totals, failing, missed, sources, reload,
  } = useInterest(tenant?.id);

  const rows = useMemo(
    () => (filter === 'worth' ? failing : products),
    [filter, failing, products],
  );

  if (tenant === undefined) {
    return <PageSkeleton />;
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

      {/*
        * Zero is the screen, not a state to hide the screen behind.
        *
        * This used to replace everything with a paragraph saying it fills up
        * later, which told her nothing she could act on. Four zeros and one
        * line about what moves them is the more useful version: nobody has been
        * is a finding, and the fix is on the shop front rather than here.
        */}
      {quiet && (
        <p className={styles.nothing}>
          Nothing yet, and nothing arrives on its own. Visits start when the shop is
          public and somebody has a reason to look: the address in your TikTok bio,
          Google finding you, a link you send to somebody.
        </p>
      )}

      <>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="micro">Where people came from</h2>
            </div>

            {sources.length === 0 ? (
              <p className={styles.quiet}>
                <span data-num>0</span> visits from anywhere. Put{' '}
                <span data-num>cartandkeep.com/?utm_source=tiktok</span> in your TikTok bio and
                this is where those visits will show up.
              </p>
            ) : (
              <>
                <div className={styles.table} role="table">
                  <div className={styles.headRow} role="row">
                    <span role="columnheader">Source</span>
                    <span role="columnheader" className={styles.num}>Visits</span>
                    <span role="columnheader" className={styles.num}>Baskets</span>
                    <span role="columnheader" className={styles.num}>Orders</span>
                    <span role="columnheader" className={styles.num}>Taken</span>
                  </div>

                  {sources.map((s) => (
                    <div key={s.source} className={styles.sourceRow} role="row">
                      <span className={styles.sourceName}>{SOURCE[s.source] ?? s.source}</span>
                      <Cell value={s.visits} />
                      <Cell value={s.baskets} sub={s.basketRate === null ? null : `${s.basketRate}%`} />
                      <Cell value={s.orders} sub={s.buyRate === null ? null : `${s.buyRate}%`} />
                      <Cell value={formatGbp(s.revenue)} />
                    </div>
                  ))}
                </div>

                {/*
                  * Said because the fix is on her side and costs nothing.
                  *
                  * TikTok's browser strips the referrer, so a visit from the
                  * bio link lands in "typed the address in" unless the link
                  * carries a tag. Telling her the exact link to use is worth
                  * more than any amount of explaining why the number is wrong.
                  */}
                <p className={styles.caveat}>
                  TikTok hides where its visitors came from unless the link says so. Use{' '}
                  <span data-num>cartandkeep.com/?utm_source=tiktok</span> in your bio and those
                  visits stop counting as somebody typing the address in.
                </p>
              </>
            )}
          </section>

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
                Everything that has been looked at and not bought, most looked at first. The
                wording hardens as the evidence does: past <span data-num>{ENOUGH}</span> views
                a product that nobody wants is unlikely to be bad luck, and past{' '}
                <span data-num>{CERTAIN}</span> it is not luck at all.
              </p>
            )}

            {rows.length === 0 ? (
              <p className={styles.quiet}>
                {filter === 'worth'
                  ? 'Nothing has been looked at and left. Either nobody has been, or everything that was looked at sold.'
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
              <p className={styles.quiet}>
                <span data-num>0</span> searches. When people start using the box, the words
                they type and find nothing for are the best list of what to stock next.
              </p>
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
