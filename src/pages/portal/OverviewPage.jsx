import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useOverview, nextMonday } from '@hooks/useOverview';
import { useListings } from '@hooks/useListings';
import { useFinance } from '@hooks/useFinance';
import { useApproved } from '@hooks/useApproved';
import { assess } from '@lib/assess';
import { goLive, viewsOf } from '@lib/golive';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath, REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/pages/portal/overview-page.module.css';

const fmt = (d, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts }).format(d);
const n = (v) => Number(v ?? 0).toLocaleString('en-GB');
const pct = (v) => (v == null ? 'Unknown' : `${(Number(v) * 100).toFixed(1)}%`);
const plural = (count, one, many) => (count === 1 ? one : many);

function greeting(now = new Date()) {
  const h = Number(fmt(now, { hour: 'numeric', hour12: false }));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function OverviewPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const o = useOverview(tenant?.id);
  const l = useListings(tenant?.id);
  const f = useFinance(tenant?.id);
  const ap = useApproved(tenant?.id);
  const monday = useMemo(() => nextMonday(), []);

  // Approved, not yet listed, read by the same assess() as the Approved page, so "ready" here is the Approved page's
  // Ready count and what each keeps is what the card says, confirmed costs included.
  const approved = useMemo(() => {
    const as = ap.rows.map((r) => { const a = assess(r); return { a, gl: goLive(viewsOf(a), r, r.draft ?? {}) }; });
    return {
      waiting: as.length,
      ready: as.filter(({ gl }) => gl.ready).length,
      half: as.filter(({ gl }) => gl.started.length > 0).length,
      worth: as.reduce((s, { a }) => s + Math.max(0, a.keep ?? 0), 0),
    };
  }, [ap.rows]);

  if (tenant === undefined || o.status === 'loading' || l.status === 'loading' || f.status === 'loading' || ap.status === 'loading') {
    return <PageSkeleton rows={3} />;
  }

  const onEbay = l.items.filter((i) => i.listingId).length;
  const onShop = l.items.filter((i) => i.shop?.status === 'live').length;
  const ebayOnly = l.items.filter((i) => i.listingId && !i.shop).length;
  // The last stage counts what came through the stages before it: sales on the
  // listings that are live now, not every sale on the account in 90 days.
  const sold = l.items.reduce((s, i) => s + (i.traffic?.transactions ?? 0), 0);

  // What needs her, in the order it costs money to leave it.
  const tasks = [
    approved.ready > 0 && {
      icon: 'IconTag',
      tone: 'action',
      count: approved.ready,
      title: `${n(approved.ready)} ready to go live`,
      body: 'Approved and checked: in the market, your profit, your photos and your words.',
      to: portalPath('/approved'),
      cta: 'List them',
    },
    o.counts.pending > 0 && {
      icon: 'IconLayers',
      count: o.counts.pending,
      title: `${n(o.counts.pending)} to review`,
      body: 'Candidates the gate passed, waiting for a yes or no.',
      to: portalPath('/candidates'),
      cta: 'Open the queue',
    },
    approved.waiting - approved.ready > 0 && {
      icon: 'IconInfo',
      tone: 'warning',
      count: approved.waiting - approved.ready,
      title: `${approved.waiting - approved.ready} approved ${plural(approved.waiting - approved.ready, 'needs', 'need')} a look`,
      body: 'Photos, a description, a parcel or a price to settle before they go up.',
      to: portalPath('/approved'),
      cta: 'Check them',
    },
    ebayOnly > 0 && {
      icon: 'IconShop',
      count: ebayOnly,
      title: `${ebayOnly} on eBay, ${plural(ebayOnly, 'not', 'none')} on your shop`,
      body: 'Same price keeps more on your own shop, with no eBay fee.',
      to: portalPath('/listings'),
      cta: 'Add them',
    },
  ].filter(Boolean);

  const stages = [
    { label: 'To review', value: o.counts.pending, to: portalPath('/candidates'), icon: 'IconLayers' },
    { label: 'Approved', value: approved.waiting, to: portalPath('/approved'), icon: 'IconCheck',
      foot: approved.waiting
        ? `${approved.half ? `${n(approved.half)} with one channel left` : 'not live yet'}${approved.worth > 0 ? `, ${formatGbp(approved.worth)} if ${plural(approved.waiting, 'it sells', 'each sells')} once` : ''}`
        : null },
    { label: 'Live', value: onEbay, to: portalPath('/listings'), icon: 'IconTag',
      foot: onShop ? `${onShop} ${plural(onShop, 'is', 'are')} also on your shop` : 'on eBay' },
    { label: 'Sold', value: sold, to: portalPath('/listings'), icon: 'IconBought', tone: sold > 0 ? 'positive' : null,
      foot: o.traffic ? `from ${plural(onEbay, 'that one', `those ${onEbay}`)}, last 90 days` : 'no traffic pulled yet' },
  ];

  const nothingYet = o.batches.length === 0 && onEbay === 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className={styles.title}>
          {tasks.length
            ? `${greeting()}. ${tasks.length === 1 ? 'One thing needs you.' : `${tasks.length} things need you.`}`
            : `${greeting()}. Nothing is waiting on you.`}
        </h1>
      </header>

      {/* The business as it runs, left to right. Each stage opens the page
          that works on it, so the overview is a map as well as a summary. */}
      <nav className={styles.pipeline} aria-label="Where everything is">
        {stages.map((s, i) => (
          <Link key={s.label} to={s.to} className={styles.stage}>
            <span className={styles.stageHead}>
              <Icon name={s.icon} className={styles.stageIcon} />
              {s.label}
            </span>
            <span className={`figure ${styles.stageValue} ${s.tone ? styles[s.tone] : ''}`}>{n(s.value)}</span>
            {s.foot && <span className={styles.stageFoot}>{s.foot}</span>}
            {i < stages.length - 1 && <span className={styles.arrow} aria-hidden="true" />}
          </Link>
        ))}
      </nav>

      {nothingYet ? (
        <Card>
          <CardHead title="How the week runs" note={`First batch lands ${fmt(monday, { weekday: 'long', day: 'numeric', month: 'long' })}`} />
          <div className={styles.steps}>
            <Step icon="IconLayers" title="Research runs" body="eBay's sold listings go through the gate. Only what clears it reaches you." />
            <Step icon="IconCheck" title="You decide" body="Approve, reject or leave for later, with a reason." />
            <Step icon="IconTag" title="It goes live" body="Approved products are priced, written and published from here." />
          </div>
        </Card>
      ) : (
        <div className={styles.grid}>
          <Card className={styles.tasks}>
            <CardHead title="Needs you" note={tasks.length ? 'Most valuable first' : undefined} />
            {tasks.length ? (
              <ul className={styles.taskList}>
                {tasks.map((t) => (
                  <li key={t.title}>
                    <Link to={t.to} className={styles.task}>
                      <span className={`${styles.taskIcon} ${t.tone ? styles[t.tone] : ''}`}>
                        <Icon name={t.icon} className={styles.taskGlyph} />
                      </span>
                      <span className={styles.taskText}>
                        <span className={styles.taskTitle}>{t.title}</span>
                        <span className={styles.taskBody}>{t.body}</span>
                      </span>
                      <span className={styles.taskCta}>
                        {t.cta}
                        <Icon name="IconCaret" className={styles.taskCaret} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.clear}>
                <Icon name="IconCheck" className={styles.clearIcon} />
                Everything is reviewed, listed or waiting on the next batch.
              </p>
            )}
          </Card>

          <Card>
            <CardHead
              title="Money"
              note={!f.totals.lines ? 'No sales yet'
                : f.showing === 'all' ? 'All time'
                  : new Date(`${String(f.showing).slice(0, 7)}-01T00:00:00Z`)
                    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              aside={<Link to={portalPath('/finance')} className={styles.more}>Finance</Link>}
            />
            {/* No sales is not an unknown profit. Unknown is for sales with no
                cost behind them. */}
            {f.totals.lines ? (
              <div className={styles.funnel}>
                <Mini icon="IconChart" label="Taken" value={formatGbp(f.totals.revenue)} />
                <Mini icon="IconCheck" label="Kept"
                  value={f.totals.net == null ? 'Unknown' : formatGbp(f.totals.net)}
                  foot={f.totals.net == null ? 'no costs recorded'
                    : f.totals.uncosted ? `on ${f.totals.covered} of ${f.totals.lines} sales, ${f.totals.uncosted} with no cost yet` : null}
                  tone={f.totals.net > 0 && !f.totals.uncosted ? 'positive' : null} />
                <Mini icon="IconBought" label="Units" value={n(f.totals.units)} />
              </div>
            ) : (
              <p className={styles.empty}>
                No sales recorded yet. Shop orders appear here on their own; eBay sales come in from an export on the Finance page.
              </p>
            )}
          </Card>

          <Card>
            <CardHead
              title="eBay, last 90 days"
              aside={<Link to={portalPath('/ebay/traffic')} className={styles.more}>Traffic</Link>}
            />
            {o.traffic ? (
              <>
                <div className={styles.funnel}>
                  <Mini icon="IconImpression" label="Shown" value={n(o.traffic.impressions)} />
                  <Mini icon="IconOpened" label="Opened" value={n(o.traffic.views)} foot={pct(o.traffic.click_rate)} />
                  <Mini icon="IconBought" label="Sold" value={n(o.traffic.transactions)} foot={pct(o.traffic.conversion_rate)} tone="positive" />
                </div>
                <Spark days={o.days} />
              </>
            ) : (
              <p className={styles.empty}>Pull traffic once from the Traffic page and this fills in.</p>
            )}
          </Card>

          {o.reasons.length > 0 && (
            <Card className={styles.wide}>
              <CardHead title="Why products were rejected"
                note="Used to adjust what the research looks for." />
              <ul className={styles.reasons}>
                {o.reasons.map(({ reason, count }) => {
                  const label = REJECTION_REASONS.find((r) => r.value === reason)?.label ?? reason;
                  const top = o.reasons[0].count || 1;
                  return (
                    <li key={reason} className={styles.reason}>
                      <span className={styles.reasonLabel}>{label}</span>
                      <span className={styles.reasonTrack}>
                        <span className={styles.reasonFill} style={{ width: `${(count / top) * 100}%` }} />
                      </span>
                      <span className={styles.reasonCount} data-num>{count}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ icon, title, body }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepIcon}><Icon name={icon} className={styles.taskGlyph} /></span>
      <p className={styles.stepTitle}>{title}</p>
      <p className={styles.stepBody}>{body}</p>
    </div>
  );
}

function Mini({ icon, label, value, foot, tone }) {
  return (
    <div className={styles.mini}>
      <span className={styles.miniHead}><Icon name={icon} className={styles.miniIcon} />{label}</span>
      <span className={`figure ${styles.miniValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      {foot && <span className={styles.miniFoot}>{foot}</span>}
    </div>
  );
}

// Ninety days of impressions as a shape, with a dot on each day that sold.
function Spark({ days }) {
  if (days.length < 2) return null;
  const w = 320;
  const h = 56;
  const top = Math.max(1, ...days.map((d) => d.impressions ?? 0));
  const x = (i) => (i / (days.length - 1)) * w;
  const y = (v) => h - 6 - ((v ?? 0) / top) * (h - 12);
  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.impressions).toFixed(1)}`).join(' ');

  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
      aria-label="Impressions over the last 90 days">
      <defs>
        <linearGradient id="ovFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-scale-2)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--c-scale-2)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#ovFill)" />
      <path d={line} fill="none" stroke="var(--c-ink-soft)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      {days.map((d, i) => (d.transactions > 0
        ? <circle key={d.day} cx={x(i)} cy={h - 3} r="2.2" fill="var(--c-positive)" />
        : null))}
    </svg>
  );
}
