import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useShopDashboard } from '@hooks/useShopDashboard';
import { CHANNEL_LABEL } from '@hooks/useFinance';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { Icon } from '@components/ui/icons';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, PORTAL_ROUTES } from '@utils/constants';
import styles from '@styles/pages/portal/shop-page.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

// Straight to the gap on Products, rather than a tab that may not hold the row.
const LINKS = {
  returns: '/products?filter=all&gap=returns',
  hazard: '/products?filter=all&gap=hazard',
  checks: '/products?filter=all&gap=checks',
  drafts: '/products?filter=all&gap=description',
  copy: '/products?filter=all&gap=description&select=nocopy',
};

const MARK = (job) => (job.blocking ? 'check' : job.key === 'drafts' ? 'wait' : job.quiet ? 'done' : 'missing');
const CHANNELS = ['store', 'ebay', 'tiktok'];
// Under this many views a percentage claims more than the data holds.
const SMALL = 20;

const dayName = (iso, style = 'short') => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: style, day: 'numeric', month: 'short', timeZone: 'UTC' });
const initial = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Thumb({ product, className }) {
  const src = thumb(product.image_url);
  return src
    ? <img className={className} src={src} alt="" loading="lazy" title={product.title} />
    : <span className={`${className} ${styles.thumbEmpty}`} aria-hidden="true" />;
}

function headline({ funnel, money }) {
  const parts = [];
  parts.push(funnel.looked
    ? `${plural(funnel.looked, 'product view')} this week`
    : 'No product views yet this week');
  if (funnel.basket) parts.push(`${plural(funnel.basket, 'basket')}`);
  parts.push(funnel.bought ? plural(funnel.bought, 'sale') : money.everSold ? 'no sale this week' : 'no sale yet');
  const lead = `${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ` and ${parts.at(-1)}` : ''}.`;
  const ebay = money.byChannel.find((c) => c.channel === 'ebay');
  return ebay?.revenue ? `${lead} eBay has taken ${formatGbp(ebay.revenue)} this month.` : lead;
}

function Pulse({ pulse, funnel }) {
  const peak = Math.max(1, ...pulse.map((d) => d.looked));
  const quiet = pulse.every((d) => !d.looked && !d.sold);
  const trend = funnel.looked - funnel.lookedLastWeek;
  const lost = (a, b) => (a < SMALL ? `${a - b} of ${a}` : `${Math.round(((a - b) / a) * 100)}%`);

  return (
    <Card className={styles.pulse}>
      <div className={styles.chartWrap}>
        <CardHead title="The last two weeks" note="Product views each day, with any sale on the day it was paid"
          aside={<Tip side="end">Views are product pages opened on your shop, London time. The darker part of a bar went into a basket.</Tip>} />
        <ol className={styles.chart} aria-label="Views per day, last 14 days" data-quiet={quiet || undefined}>
          {pulse.map((d, i) => (
            <li key={d.day} className={styles.day} data-today={d.today || undefined} data-week={i === 7 || undefined}>
              <span className={styles.col}>
                <span className={styles.bar} style={{ height: `${quiet ? 0 : (d.looked / peak) * 100}%`, animationDelay: `${i * 25}ms` }}>
                  {d.sold > 0 && (
                    <span className={styles.sale} aria-label={`${plural(d.sold, 'sale')}, ${formatGbp(d.takings)}`}>
                      <Icon name="IconCheck" width="12" height="12" />
                    </span>
                  )}
                  {d.basket > 0 && <span className={styles.bin} style={{ height: `${Math.min(100, (d.basket / Math.max(1, d.looked)) * 100)}%` }} />}
                </span>
              </span>
              <span className={styles.dayLabel}>{d.today ? 'Today' : initial(d.day)}</span>
              <span className={styles.dayTip} role="tooltip">
                <strong>{dayName(d.day, 'long')}</strong>
                {plural(d.looked, 'view')}{d.basket ? `, ${plural(d.basket, 'basket')}` : ''}
                {d.sold ? `, ${plural(d.sold, 'sale')} ${formatGbp(d.takings)}` : ''}
              </span>
            </li>
          ))}
        </ol>
        {quiet && <p className={styles.quietNote}>Each day fills in as people open your products.</p>}
      </div>

      <dl className={styles.flow}>
        <div className={styles.flowStep}>
          <dt>Viewed</dt>
          <dd><span className="figure" data-num>{funnel.looked}</span>
            {trend !== 0 && <span className={trend > 0 ? styles.up : styles.down} data-num>{trend > 0 ? '+' : ''}{trend} on last week</span>}
          </dd>
        </div>
        <div className={styles.flowStep}>
          <dt>Into a basket</dt>
          <dd><span className="figure" data-num>{funnel.basket}</span>
            {funnel.looked > 0 && <span className={styles.flowNote}>{lost(funnel.looked, funnel.basket)} went no further</span>}
          </dd>
        </div>
        <div className={styles.flowStep}>
          <dt>Bought</dt>
          <dd><span className="figure" data-num>{funnel.bought}</span>
            {funnel.basket > 0 && (
              <span className={funnel.bought < funnel.basket ? styles.loud : styles.flowNote}>
                {lost(funnel.basket, funnel.bought)} left it in the basket
              </span>
            )}
          </dd>
        </div>
        <div className={styles.flowStep}>
          <dt>Saved for later</dt>
          <dd><span className="figure" data-num>{funnel.saved}</span></dd>
        </div>
      </dl>
    </Card>
  );
}

function Job({ job, index, lead }) {
  const words = job.count === 1 && job.one ? job.one : job.label;
  return (
    <li className={styles.job} data-kind={job.blocking ? 'block' : job.quiet ? 'quiet' : 'work'}
      style={{ animationDelay: `${index * 40}ms` }}>
      <StepMark state={MARK(job)} />
      <span className={styles.jobCount} data-num>{job.count}</span>
      <span className={styles.jobText}>
        <span className={styles.jobLabel}>{words}</span>
        <span className={styles.jobImpact}>{job.impact}</span>
      </span>
      <span className={styles.row} aria-hidden="true">
        {(job.thumbs ?? []).map((p) => <Thumb key={p.id} product={p} className={styles.rowThumb} />)}
      </span>
      <Link className={lead ? styles.go : styles.quiet} to={portalPath(LINKS[job.key] ?? job.to)}>
        {job.action}
      </Link>
    </li>
  );
}

function Skeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <span className={`skeleton ${styles.skTitle}`} />
      <Card><span className={`skeleton ${styles.skChart}`} /></Card>
      <div className={styles.trio}>
        {[0, 1, 2].map((i) => <Card key={i}><span className={`skeleton ${styles.skBlock}`} /></Card>)}
      </div>
    </div>
  );
}

export function ShopPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, error, live, split, jobs, money, funnel, pulse, readiness, reload } = useShopDashboard(tenant?.id);

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The shop figures did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (tenant === undefined || status === 'loading') return <Skeleton />;

  const open = jobs.filter((j) => j.count > 0);
  // The loudest button goes to what blocks, not to what is easiest.
  const leadKey = (open.find((j) => j.blocking) ?? open[0])?.key;
  const channels = CHANNELS.map((key) => ({
    key,
    revenue: key === 'store' ? money.month : money.byChannel.find((c) => c.channel === key)?.revenue ?? null,
  }));
  const r = readiness ?? { done: 0, total: 0 };
  const pct = (n) => `${r.total ? (n / r.total) * 100 : 0}%`;
  const change = money.today - money.lastSameDay;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Your shop</h1>
        <p className={styles.sub}>{headline({ funnel, money })}</p>
      </header>

      <Pulse pulse={pulse} funnel={funnel} />

      <div className={styles.trio}>
        <Card className={styles.tile}>
          <CardHead title="On sale" aside={
            <Link className={styles.small} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=live`)}>Products</Link>} />
          <p className={styles.figureLine}>
            <span className="display" data-num>{split.live}</span>
            <span className={styles.figureWords}>of <span data-num>{split.total}</span></span>
          </p>
          <div className={styles.shelf}>
            {live.slice(0, 5).map((p) => (
              <Link key={p.id} className={styles.shelfItem} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=live`)}>
                <Thumb product={p} className={styles.shelfThumb} />
                <span className={styles.shelfTip}>{p.title}</span>
              </Link>
            ))}
            {split.ready > 0 && (
              <Link className={styles.shelfMore} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=ready`)}>
                <b data-num>+{split.ready}</b> ready
              </Link>
            )}
          </div>
        </Card>

        <Card className={styles.tile}>
          <CardHead title="Catalogue" aside={<Tip side="end">Every step on every product: photographs, price, returns, checks, stock, description, section and cost.</Tip>} />
          <p className={styles.figureLine}>
            <span className="display" data-num>{r.done}</span>
            <span className={styles.figureWords}>of <span data-num>{r.total}</span> steps done</span>
          </p>
          <div className={styles.meter} role="img" aria-label={`${r.done} of ${r.total} steps done`}>
            <span data-state="done" style={{ width: pct(r.done) }} />
            <span data-state="wait" style={{ width: pct(r.wait) }} />
            <span data-state="check" style={{ width: pct(r.check) }} />
            <span data-state="missing" />
          </div>
          {r.gap && (
            <Link className={styles.gap} to={portalPath(`${PORTAL_ROUTES.PRODUCTS}?filter=all&gap=${r.gap.key}`)}>
              <StepMark state="missing" size="sm" />
              <span><b data-num>{r.gap.open}</b> missing {r.gap.label.toLowerCase()}</span>
              <Icon name="IconCaret" width="12" height="12" className={styles.caretRight} />
            </Link>
          )}
        </Card>

        <Card className={styles.tile}>
          <CardHead title="Money" aside={<Tip side="end">Today is your shop, paid since midnight London time. The month adds eBay and TikTok from their imports.</Tip>} />
          <dl className={styles.money}>
            <div className={styles.moneyToday}>
              <dt>Today on your shop</dt>
              <dd>
                <span className={styles.moneyFig} data-num data-zero={!money.today || undefined}>{formatGbp(money.today)}</span>
                <span className={styles.flowNote}>
                  {money.everSold
                    ? (change === 0 ? 'same as last week' : <><span data-num>{formatGbp(Math.abs(change))}</span> {change > 0 ? 'up' : 'down'} on last week</>)
                    : 'no shop sale yet'}
                </span>
              </dd>
            </div>
            {channels.map((c) => (
              <div key={c.key} className={styles.moneyRow}>
                <dt><i className={styles.swatch} data-channel={c.key} aria-hidden="true" />{CHANNEL_LABEL[c.key]}</dt>
                <dd>{c.revenue !== null
                  ? <span data-num data-zero={!c.revenue || undefined}>{formatGbp(c.revenue)}</span>
                  : <Link className={styles.small} to={portalPath(PORTAL_ROUTES.FINANCE)}>Import</Link>}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card pad={false} className={styles.work}>
        <div className={styles.workHead}>
          <CardHead title="What needs you" note={open.length ? 'Ranked by what it blocks' : null} />
        </div>
        {open.length === 0 ? (
          <div className={styles.clear}>
            <StepMark state="done" />
            <div>
              <p className={styles.clearTitle}>Nothing is waiting for you</p>
              <p className={styles.clearBody}>Orders, checks and drafts land here as they arrive.</p>
            </div>
          </div>
        ) : (
          <ul className={styles.jobs}>
            {open.map((job, i) => <Job key={job.key} job={job} index={i} lead={job.key === leadKey} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}
