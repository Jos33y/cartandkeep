import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useShopDashboard, funnelSteps } from '@hooks/useShopDashboard';
import { CHANNEL_LABEL } from '@hooks/useFinance';
import { Icon } from '@components/ui/icons';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { imageAt } from '@utils/categories';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import styles from '@styles/pages/portal/shop-page.module.css';

/*
 * The screen she opens.
 *
 * The first version was a single column of full width rows, every count sitting
 * alone with eight hundred pixels of nothing after it. Four things fixed that,
 * and every one of them is information rather than decoration:
 *
 *   the photographs   she has 78 products with nine images each, and a shop
 *                     dashboard that never shows the shop is the flat thing
 *   the ranking       three rows stop a product going on sale and four do not,
 *                     which is the only distinction the eye has to make here
 *   the comparison    a figure with nothing to measure against does not answer
 *                     the question it was asked
 *   the actions       the row that can be cleared from here has a button that
 *                     clears it, rather than a link somewhere else
 */

// Feed images are 300px and the tiles are 38, so a smaller source is a faster
// page rather than a worse one.
const thumb = (url) => (url ? imageAt(url, 160) : null);

function Tile({ product, size = 'tile' }) {
  const src = thumb(product.image_url);
  return src
    ? <img className={styles[size]} src={src} alt="" loading="lazy" title={product.title} />
    : <span className={`${styles[size]} ${styles.tileEmpty}`} aria-hidden="true" />;
}

/*
 * One line of work.
 *
 * The count, the products behind it, what it is, what it blocks, and the way
 * out. A row with the first and last of those only is a report; the middle
 * three are what make it a thing she can act on.
 */
function Job({ job }) {
  if (job.count === 0) return null;

  const rail = job.blocking ? styles.railBlock : job.quiet ? styles.railQuiet : styles.railWork;
  const words = job.count === 1 && job.one ? job.one : job.label;

  return (
    <li className={`${styles.job} ${rail}`}>
      <span className={`figure ${styles.count}`} data-num>{job.count}</span>

      {/* Always rendered, even with nothing in it.
          Overlapped, so three tiles cost the width of two. The slot keeps its
          width when a row has no products behind it, because the orders row
          does not and its label started sixty pixels left of every other row on
          the screen. A ledger whose left edge wanders is one the eye has to
          re-find on every line. */}
      <span className={styles.thumbs} aria-hidden={!job.thumbs?.length}>
        {(job.thumbs ?? []).map((p) => <Tile key={p.id} product={p} size="thumb" />)}
      </span>

      <span className={styles.jobText}>
        <span className={styles.jobLabel}>{words}</span>
        <span className={styles.jobImpact}>{job.impact}</span>
      </span>

      {/* The primary row hands the work over rather than starting it here.
          Drafting seventy eight products takes minutes and reports failures by
          name, and a screen that runs it in the background with no way to see
          where it got to is a screen she cannot trust. Products already does
          all of that, so this arrives with the rows ticked. */}
      <Link
        className={job.primary ? styles.primary : styles.ghost}
        to={portalPath(job.to)}
      >
        {job.action}
      </Link>
    </li>
  );
}

function Funnel({ funnel }) {
  const steps = funnelSteps(funnel);

  return (
    <section className={`${styles.panel} ${styles.panelBrand}`}>
      <header className={styles.panelHead}>
        <h2 className="micro">This week</h2>
        <span className={styles.panelNote}>
          {funnel.lookedLastWeek} looked last week
        </span>
      </header>

      {steps.map((s) => (
        <div key={s.key} className={styles.step}>
          <div className={styles.stepRow}>
            <span className={styles.stepLabel}>{s.label}</span>
            <span
              className={s.key === 'bought' ? styles.stepBarBuy : styles.stepBar}
              style={{ width: `${s.width}%` }}
            />
            <span className={`figure ${styles.stepCount}`} data-num>{s.count}</span>
          </div>
          {/* Under the bar the people fall out of, not the one they fail to
              reach. Which is the whole reason this is a shape rather than
              three numbers. */}
          {s.dropAfter !== null && (
            <p className={s.key === 'basket' ? styles.dropLoud : styles.drop}>
              {s.dropAfter}% {s.key === 'basket' ? 'left it there' : 'went no further'}
            </p>
          )}
        </div>
      ))}

      {/* Beside the funnel, not in it. Saving is not a step on the way to
          buying, and a product with saves and no sales is a price problem
          rather than a photograph one, which is a different question from
          where the buying path leaks. */}
      <p className={styles.aside}>
        {funnel.saved > 0
          ? `${funnel.saved} ${funnel.saved === 1 ? 'item was' : 'items were'} saved for later`
          : 'Nothing saved for later'}
      </p>
    </section>
  );
}

export function ShopPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, error, live, split, jobs, money, funnel } = useShopDashboard(tenant?.id);

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The shop figures did not load</h1>
        <p className={styles.emptyBody}>
          {error?.message ?? 'Reload the page, and tell me if it keeps happening.'}
        </p>
      </div>
    );
  }

  const pct = (n) => (split.total ? `${(n / split.total) * 100}%` : '0%');
  const change = money.today - money.lastSameDay;

  return (
    <div className={styles.page}>

      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Your shop</p>
          <p className={styles.hero}>
            <span className={`figure ${styles.heroNum}`} data-num>{split.live}</span>
            <span className={styles.heroWords}>of {split.total} on sale</span>
          </p>
          {/* Width is the count, so how far off a finished shop she is reads
              before a number does. */}
          <div className={styles.bar} role="img"
            aria-label={`${split.live} on sale, ${split.ready} ready, ${split.blocked} blocked`}>
            {split.live > 0 && <span className={styles.segLive} style={{ width: pct(split.live) }} />}
            {split.ready > 0 && <span className={styles.segReady} style={{ width: pct(split.ready) }} />}
            {split.blocked > 0 && <span className={styles.segBlocked} style={{ width: pct(split.blocked) }} />}
          </div>
        </div>

        <div className={styles.takings}>
          <p className={styles.eyebrow}>Taken today</p>
          <p className={`figure ${styles.takingsNum}`} data-num>{formatGbp(money.today)}</p>
          {/* A number with nothing to measure against is not an answer. The
              same weekday a week ago, not yesterday, because a Thursday against
              a Wednesday compares two different kinds of day. */}
          <p className={styles.compare}>
            {change > 0 ? <span className={styles.up}>up {formatGbp(change)}</span>
              : change < 0 ? <span className={styles.down}>down {formatGbp(Math.abs(change))}</span>
                : <span className={styles.compareBase}>same as last week</span>}
            <span className={styles.compareBase}>
              {formatGbp(money.lastSameDay)} this day last week
            </span>
          </p>
        </div>
      </header>

      {/* The only place on this page that shows the shop rather than describing
          it. The last tile is the count of what could join them and the way to
          do it, so an empty run of tiles is still an invitation. */}
      <section className={styles.strip}>
        <h2 className="micro">On sale now</h2>
        <div className={styles.tiles}>
          {live.map((p) => (
            <Link key={p.id} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=live`)}>
              <Tile product={p} />
            </Link>
          ))}
          {split.ready > 0 && (
            <Link className={styles.tileMore} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=ready`)}>
              <span data-num>+{split.ready}</span>
              <span className={styles.tileMoreWord}>ready</span>
            </Link>
          )}
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.work}>
          <header className={styles.panelHead}>
            <h2 className="micro">What needs you</h2>
            <span className={styles.panelNote}>ranked by what it blocks</span>
          </header>

          {jobs.every((j) => j.count === 0) ? (
            <p className={styles.clear}>Nothing waiting. Everything is either on sale or on its way.</p>
          ) : (
            <ul className={styles.jobs}>
              {jobs.map((job) => (
                <Job key={job.key} job={job} />
              ))}
            </ul>
          )}
        </section>

        <aside className={styles.side}>
          <Funnel funnel={funnel} />

          <section className={`${styles.panel} ${styles.panelSand} ${styles.panelFill}`}>
            <h2 className="micro">This month</h2>
            <ul className={styles.channels}>
              <li className={styles.channel}>
                <span className={styles.channelName}>Your shop</span>
                <span className={`figure ${styles.channelValue}`} data-num>{formatGbp(money.month)}</span>
              </li>
              {['ebay', 'tiktok'].map((key) => {
                const found = money.byChannel.find((c) => c.channel === key);
                return (
                  <li key={key} className={styles.channel}>
                    <span className={styles.channelQuiet}>{CHANNEL_LABEL[key]}</span>
                    {found ? (
                      <span className={`figure ${styles.channelValue}`} data-num>{formatGbp(found.revenue)}</span>
                    ) : (
                      // An action rather than a dash. Nothing imported is a
                      // thing she can fix in a minute from here.
                      <Link className={styles.tiny} to={portalPath(PORTAL_ROUTES.FINANCE)}>Import</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Only while it is true. Three of the twelve gold blocks stop her
              trading at all, and unlike everything else on this page they are
              decisions rather than work. */}
          {split.live === 0 && (
            <section className={`${styles.panel} ${styles.panelAlert}`}>
              <p className={styles.alertHead}>
                <Icon name="IconGauge" className={styles.alertIcon} />
                Nothing is on sale
              </p>
              <p className={styles.alertBody}>
                A visitor sees an empty shop until something goes live. Clear the
                rows on the left and take them live from Products.
              </p>
              <Link className={styles.ghost} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=ready`)}>
                Open Products
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
