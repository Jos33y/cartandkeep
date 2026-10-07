import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useOverview, nextMonday } from '@hooks/useOverview';
import { useOverviewCounts } from '@hooks/useOverviewCounts';
import { useFinance } from '@hooks/useFinance';
import { useApproved } from '@hooks/useApproved';
import { useAlerts } from '@hooks/useAlerts';
import { assess } from '@lib/assess';
import { goLive, viewsOf } from '@lib/golive';
import { Block, Line, PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { AlertRow } from '@components/ui/portal/AlertRow';
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
  // The top figures, counted in the database in one quick read, apart from the heavy reads below (0146).
  const top = useOverviewCounts(tenant?.id);
  const f = useFinance(tenant?.id);
  const ap = useApproved(tenant?.id);
  const al = useAlerts(tenant?.id, { agent: tenant?.store?.agent?.name || null });
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

  // The page waits only for what is quick. The approved cards' full read fills Needs you when it lands.
  if (tenant === undefined || o.status === 'loading' || f.status === 'loading') {
    return <PageSkeleton rows={3} />;
  }
  const apReady = ap.status === 'ready';
  // Read or failed: either way Needs you shows what it has, the approved cards' tasks only once they have loaded.
  const apDone = ap.status !== 'loading';

  // Live on eBay with no shop product at all, and live on eBay with a shop draft waiting in Products.
  const ebayOnly = Number(top.noShop ?? 0);
  const shopDrafts = Number(top.drafts ?? 0);
  /*
   * Sold is every unit from her orders, on every channel, since the first sale. It used to add up the traffic of
   * the listings live today over 90 days, so a listing that sold out and ended took its sales with it, and anything
   * older than 90 days was gone: 26 shown against the 30 and more she had sold.
   */
  const sold = f.totals.units;
  const firstMonth = f.months.length ? f.months[f.months.length - 1] : null;
  const since = firstMonth
    ? new Date(`${String(firstMonth).slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;
  const channels = [...f.byChannel].sort((a, b) => b.units - a.units)
    .map((c) => (c.channel === 'ebay' ? 'eBay' : c.channel === 'store' ? 'your shop' : c.channel));
  // Products sold with no cost recorded: the profit on them is not known, so it is not shown as a figure.
  const sold$ = f.products ?? [];
  const uncosted = sold$.filter((p) => !p.costed).length;

  // What needs her, in the order it costs money to leave it.
  const tasks = [
    apReady && approved.ready > 0 && {
      icon: 'IconTag',
      tone: 'action',
      count: approved.ready,
      title: `${n(approved.ready)} ready to go live`,
      body: 'Approved and checked: in the market, your profit, your photos and your words.',
      to: portalPath('/approved'),
      cta: 'List them',
    },
    apReady && approved.waiting - approved.ready > 0 && {
      icon: 'IconInfo',
      tone: 'warning',
      count: approved.waiting - approved.ready,
      title: `${approved.waiting - approved.ready} approved ${plural(approved.waiting - approved.ready, 'needs', 'need')} a look`,
      body: 'Photos, a description, a parcel or a price to settle before they go up.',
      to: portalPath('/approved'),
      cta: 'Check them',
    },
    o.counts.pending > 0 && {
      icon: 'IconLayers',
      count: o.counts.pending,
      title: `${n(o.counts.pending)} to review`,
      body: 'Candidates the gate passed, waiting for a yes or no.',
      to: portalPath('/candidates'),
      cta: 'Open the queue',
    },
    shopDrafts > 0 && {
      icon: 'IconShop',
      count: shopDrafts,
      title: `${n(shopDrafts)} on eBay, waiting in Products for your shop`,
      body: 'Already drafted on your shop from your eBay listings. Confirm them to sell at the same price with no eBay fee.',
      to: portalPath('/products'),
      cta: 'Open Products',
    },
    ebayOnly > 0 && {
      icon: 'IconShop',
      count: ebayOnly,
      title: `${n(ebayOnly)} on eBay with nothing on your shop`,
      body: 'Same price keeps more on your own shop, with no eBay fee. Add them as drafts in one go.',
      to: portalPath('/listings?show=noShop'),
      cta: 'Add them',
    },
  ].filter(Boolean);

  const stages = [
    { label: 'To review', value: o.counts.pending, to: portalPath('/candidates'), icon: 'IconLayers' },
    // The counts come from the database; what each keeps comes from the cards themselves, once they have loaded.
    { label: 'Approved', value: top.approved, to: portalPath('/approved'), icon: 'IconCheck',
      foot: apReady && approved.waiting
        ? `${approved.half ? `${n(approved.half)} with one channel left` : 'not live yet'}${approved.worth > 0 ? `, ${formatGbp(approved.worth)} if ${plural(approved.waiting, 'it sells', 'each sells')} once` : ''}`
        : null },
    // Live is what the portal listed (Joseey, 7 October); everything on her eBay account sits underneath.
    { label: 'Live', value: top.listedHere, to: portalPath('/listings'), icon: 'IconTag',
      foot: top.onEbay != null ? `listed from here, ${n(top.onEbay)} on your eBay in all` : 'listed from here' },
    { label: 'Sold', value: sold, to: portalPath('/finance'), icon: 'IconBought', tone: sold > 0 ? 'positive' : null,
      foot: since ? `units since ${since}, ${channels.join(' and ')}` : 'no sales recorded yet' },
  ];

  const nothingYet = o.batches.length === 0 && !top.listedHere && !top.onEbay;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>{fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className={styles.title}>
          {!apDone
            ? `${greeting()}.`
            : tasks.length
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
            {s.value == null
              ? <span className={styles.stageValue}><Line w="88px" h="34px" /></span>
              : <span className={`figure ${styles.stageValue} ${s.tone ? styles[s.tone] : ''}`}>{n(s.value)}</span>}
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
          {/* Two columns that stack on their own: a long card on one side never leaves a hole on the other. */}
          <div className={styles.col}>
            <Card>
              <CardHead title="Needs you" note={apDone && tasks.length ? 'Most valuable first' : undefined} />
              {!apDone ? (
                <div className={styles.taskList} aria-hidden="true">
                  <Block h={66} r="var(--r-md)" />
                  <Block h={66} r="var(--r-md)" />
                </div>
              ) : tasks.length ? (
                <ul className={styles.taskList}>
                  {tasks.map((t) => (
                    <li key={t.title}>
                      <TaskLink t={t} className={styles.task}>
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
                      </TaskLink>
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
                title="eBay, last 90 days"
                aside={<Link to={portalPath('/ebay/traffic')} className={styles.more}>Traffic</Link>}
              />
              {o.traffic ? (
                <>
                  <div className={styles.funnel}>
                    <Mini icon="IconImpression" label="Shown" value={n(o.traffic.impressions)} />
                    <Mini icon="IconOpened" label="Opened" value={n(o.traffic.views)} foot={pct(o.traffic.click_rate)} />
                    <Mini icon="IconBought" label="Orders" value={n(o.traffic.transactions)} foot={pct(o.traffic.conversion_rate)} tone="positive" />
                  </div>
                  <Spark days={o.days} />
                  {o.days.length > 1 && (
                    <p className={styles.sparkAxis}>
                      <span>{fmt(new Date(`${o.days[0].day}T12:00:00Z`), { day: 'numeric', month: 'short' })}</span>
                      <span>a mark on each day with an order</span>
                      <span>{fmt(new Date(`${o.days[o.days.length - 1].day}T12:00:00Z`), { day: 'numeric', month: 'short' })}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className={styles.empty}>Pull traffic once from the Traffic page and this fills in.</p>
              )}
            </Card>
            {o.reasons.length > 0 && (
              <Card>
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
          <div className={styles.col}>
            <Card>
              <CardHead title="Alerts"
                note={al.status !== 'ready' ? 'Checking' : al.badge ? `${al.counts.stop ? `${n(al.counts.stop)} need action now` : 'Nothing urgent'}` : 'Nothing on what is selling'}
                aside={<Link to={portalPath('/alerts')} className={styles.more}>{al.alerts.length > ALERTS_SHOWN ? `All ${n(al.counts.all)}` : 'All alerts'}</Link>} />
              {al.alerts.length ? (
                <ul className={styles.alertList}>
                  {al.alerts.slice(0, ALERTS_SHOWN).map((a) => <AlertRow key={a.key} a={a} compact />)}
                </ul>
              ) : al.status === 'ready' ? (
                <p className={styles.quiet}>
                  <Icon name="IconCheck" className={styles.quietIcon} />
                  Suppliers, the eBay queue, {tenant?.store?.agent?.name || 'Keeper'} and stock are all fine.
                </p>
              ) : null}
              {al.alerts.length > ALERTS_SHOWN && (
                <Link to={portalPath('/alerts')} className={styles.seeAll}>
                  See all {n(al.counts.all)} alerts
                  <Icon name="IconCaret" className={styles.taskCaret} />
                </Link>
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
                  {/* A profit over some products is not her profit. With costs missing it says so, not a figure. */}
                  {uncosted ? (
                    <Mini icon="IconCheck" label="Kept" value="Costs missing" tone="warning"
                      foot={`${uncosted} of ${sold$.length} products sold have no cost yet${f.totals.net != null ? `. ${formatGbp(f.totals.net)} on the rest` : ''}.`}
                      to={portalPath('/finance')} cta="Add costs" />
                  ) : (
                    <Mini icon="IconCheck" label="Kept" value={f.totals.net == null ? 'Unknown' : formatGbp(f.totals.net)}
                      tone={f.totals.net > 0 ? 'positive' : null} />
                  )}
                  <Mini icon="IconBought" label="Units" value={n(f.totals.units)} />
                </div>
              ) : (
                <p className={styles.empty}>
                  No sales recorded yet. Shop orders appear here on their own; eBay sales come in from an export on the Finance page.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// The Overview shows the worst few; the Alerts page has the rest.
const ALERTS_SHOWN = 3;

function Step({ icon, title, body }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepIcon}><Icon name={icon} className={styles.taskGlyph} /></span>
      <p className={styles.stepTitle}>{title}</p>
      <p className={styles.stepBody}>{body}</p>
    </div>
  );
}

function Mini({ icon, label, value, foot, tone, to = null, cta = null }) {
  return (
    <div className={styles.mini}>
      <span className={styles.miniHead}><Icon name={icon} className={styles.miniIcon} />{label}</span>
      <span className={`figure ${styles.miniValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      {foot && <span className={styles.miniFoot}>{foot}</span>}
      {to && cta && <Link to={to} className={styles.more}>{cta}</Link>}
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
      {/* Ticks, not dots: the chart stretches to its box, and a circle stretched becomes a dash. */}
      {days.map((d, i) => (d.transactions > 0
        ? <line key={d.day} x1={x(i)} x2={x(i)} y1={h - 7} y2={h} stroke="var(--c-positive)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        : null))}
    </svg>
  );
}

// A task opens a page, or scrolls to a card on this one.
function TaskLink({ t, className, children }) {
  if (!t.anchor) return <Link to={t.to} className={className}>{children}</Link>;
  return (
    <a href={`#${t.anchor}`} className={className} onClick={(e) => {
      e.preventDefault();
      document.getElementById(t.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }}>
      {children}
    </a>
  );
}
