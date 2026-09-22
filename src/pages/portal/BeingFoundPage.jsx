import { useEffect, useState } from 'react';
import { useFindability, monthName } from '@hooks/useFindability';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/being-found-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

/*
 * Being found.
 *
 * The monthly search report the retainer commits to, kept as a series rather
 * than as a document, because the point is the line from nothing to the first
 * eleven clicks to ninety. One month's figures on their own say nothing.
 *
 * Two halves, deliberately not mixed. What Google reported, which is history
 * and arrives monthly. And what state the catalogue is in, which is now and
 * changes the hour she writes a description.
 */

// A bar chart drawn as bars, in the sunk colour, with the figure beside it.
// No axis, no gridlines, no library. Twelve numbers do not need a chart engine.
function Trend({ reports }) {
  const seen = reports.filter((r) => r.clicks !== null && r.clicks !== undefined);
  const top = Math.max(1, ...seen.map((r) => Number(r.clicks)));

  return (
    <ol className={styles.trend}>
      {reports.map((r) => {
        const blind = r.clicks === null || r.clicks === undefined;
        const height = blind ? 0 : Math.round((Number(r.clicks) / top) * 100);

        return (
          <li key={r.month} className={styles.bar}>
            <span className={styles.barValue} data-num>{blind ? '' : r.clicks}</span>
            <span className={styles.barTrack}>
              {/*
                * A month we could not see is drawn as an outline rather than as
                * a zero column. Nobody came and we could not tell whether
                * anybody came are different facts and a chart that draws them
                * the same way tells her the wrong story about her first month.
                */}
              <span
                className={blind ? styles.barBlind : height === 0 ? styles.barFillNone : styles.barFill}
                style={blind || height === 0 ? undefined : { height: `${height}%` }}
              />
            </span>
            <span className={styles.barMonth}>
              {new Date(`${String(r.month).slice(0, 7)}-01T00:00:00Z`)
                .toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
            </span>

            {/*
              * Reach under the bar.
              *
              * Impressions move first and a first month is usually a few
              * hundred of them and no clicks. Drawn as clicks alone that month
              * is a bar at the floor, indistinguishable from a month where
              * nothing happened, when in fact it is the month Google started
              * showing the shop. Not a second bar, because 11 against 340 on
              * one scale is a bar and a hairline.
              */}
            <span className={styles.barShown} data-num>
              {blind ? '' : `${r.impressions ?? 0} shown`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function BeingFoundPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, reports, catalogue, blocked, latest, change, reload,
  } = useFindability(tenant?.id);

  if (tenant === undefined) {
    return <PageSkeleton />;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>This did not load</h1>
        <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.retry} onClick={reload}>Try again</button>
      </div>
    );
  }

  const blind = !latest || latest.clicks === null || latest.clicks === undefined;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Your shop</p>
          <h1 className={styles.title}>Being found</h1>
        </div>

        <dl className={styles.stats}>
          <Stat
            label="Clicks from Google"
            value={blind ? 'Not yet' : latest.clicks}
            foot={change ? `${change.delta >= 0 ? 'up' : 'down'} ${Math.abs(change.delta)} on last month` : null}
          />
          <Stat label="Times shown" value={blind ? 'Not yet' : latest.impressions ?? 'Not yet'} />
          <Stat label="Products Google can list" value={catalogue.listable} />
        </dl>
      </header>

      {/* --- the series --------------------------------------------------- */}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="micro">Month by month</h2>
        </div>

        {reports.length === 0 ? (
          <p className={styles.quiet}>
            The first report lands on the 22nd. Until the shop is public and Google has
            found it there is nothing to measure, and a month of zeros would be a made up
            number rather than a starting point.
          </p>
        ) : (
          <>
            <Trend reports={reports} />
            <p className={styles.caveat}>
              A hollow month is one we could not see, because the site was not verified
              or Google had not reached it. That is different from nobody coming, so it is
              drawn differently.
            </p>
          </>
        )}
      </section>

      {/* --- the written report ------------------------------------------- */}

      {latest && (latest.summary || latest.next) && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className="micro">{monthName(latest.month)}</h2>
          </div>

          {latest.summary && <p className={styles.prose}>{latest.summary}</p>}

          {latest.next && (
            <div className={styles.next}>
              <p className="micro">Before the next one</p>
              <p className={styles.prose}>{latest.next}</p>
            </div>
          )}

          {(latest.queries ?? []).length > 0 && (
            <div className={styles.terms}>
              <p className="micro">What people searched to reach you</p>
              {latest.queries.map((q) => (
                <div key={q.query} className={styles.term}>
                  <span className={styles.termText}>{q.query}</span>
                  <span data-num>{q.clicks}</span>
                  <span className={styles.termSub} data-num>{q.impressions} shown</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- the catalogue ------------------------------------------------- */}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className="micro">What Google can work with</h2>
        </div>

        <p className={styles.caveat}>
          Counted over the <span data-num>{catalogue.live}</span> products that are public.
          Google needs a description, a photograph and a price before it will list one at
          all, and a brand and a barcode before it will rank it well.
        </p>

        <dl className={styles.gaps}>
          <Gap label="Can be listed" value={catalogue.listable} of={catalogue.live} good />
          <Gap label="No description" value={catalogue.noDescription} of={catalogue.live} />
          <Gap label="No photograph" value={catalogue.noPhotograph} of={catalogue.live} />
          <Gap label="No brand" value={catalogue.noBrand} of={catalogue.live} soft />
          <Gap label="No barcode" value={catalogue.noBarcode} of={catalogue.live} soft />
          <Gap label="No section" value={catalogue.noCategory} of={catalogue.live} soft />
        </dl>

        {catalogue.live === 0 && (
          <p className={styles.quiet}>
            Nothing is public yet, so there is nothing for Google to find. Take products
            live on the Products screen and this fills.
          </p>
        )}

        {blocked.length > 0 && (
          <div className={styles.table}>
            <div className={styles.headRow}>
              <span>Product</span>
              <span>Missing</span>
            </div>
            {blocked.slice(0, 40).map((p) => (
              <div key={p.id} className={styles.row}>
                <span className={styles.product}>{p.title}</span>
                <span className={styles.missing}>{p.gaps.join(', ')}</span>
              </div>
            ))}
            {blocked.length > 40 && (
              <p className={styles.caveat}>
                Showing the first <span data-num>40</span> of <span data-num>{blocked.length}</span>.
              </p>
            )}
          </div>
        )}
      </section>
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

function Gap({ label, value, of, good, soft }) {
  // Nothing missing is not a warning. Zero in a column of problems should read
  // as settled rather than as another figure to scan.
  const tone = good
    ? styles.toneGood
    : value === 0 ? styles.toneQuiet : soft ? styles.toneSoft : styles.toneHard;

  return (
    <div className={styles.gap}>
      <dt className={styles.gapLabel}>{label}</dt>
      <dd className={`${styles.gapValue} ${tone}`}>
        <span data-num>{value}</span>
        <span className={styles.gapOf} data-num>of {of}</span>
      </dd>
    </div>
  );
}
