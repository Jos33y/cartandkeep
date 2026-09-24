import { useEffect, useMemo, useState } from 'react';
import { useInterest, verdict, ENOUGH } from '@hooks/useInterest';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/interest-page.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
const n = (v) => Number(v ?? 0).toLocaleString('en-GB');

const SOURCE = {
  direct: { label: 'Typed the address in', icon: 'IconShop', hint: 'No link behind it: typed, bookmarked, or an app that hides where it came from. Our own visits land here too.' },
  google: { label: 'Google', icon: 'IconSearch' },
  search: { label: 'Other search engines', icon: 'IconSearch' },
  tiktok: { label: 'TikTok', icon: 'IconSpeech' },
  social: { label: 'Social apps', icon: 'IconPeople' },
  email: { label: 'Email', icon: 'IconEnvelope' },
  referral: { label: 'Links on other sites', icon: 'IconOut' },
};

// What she can do about each verdict, in a line.
const NEXT = {
  'Nobody has seen it': 'Give it a place on the home page or a section that shows.',
  'Looked at, not wanted yet': 'Too early to judge. Check the main photograph and price.',
  'Looked at, not wanted': 'Compare its price with eBay and try a better main photograph.',
  'Looked at, never wanted': 'Enough people have seen it. Consider taking it off the shop.',
  'Wanted, not bought': 'Something stops them at the end. Delivery cost is the usual one.',
  'Added, then taken back out': 'They changed their mind in the basket. Check the delivery price.',
  Selling: 'Keep it stocked.',
};

const SORTS = [
  { key: 'views', label: 'Most looked at', by: (p) => Number(p.views ?? 0) + Number(p.quick_views ?? 0) },
  { key: 'wanted', label: 'Most wanted', by: (p) => Number(p.adds ?? 0) + Number(p.saves ?? 0) },
  { key: 'out', label: 'Taken out most', by: (p) => Number(p.removes ?? 0) },
];

// A screenful. Past this a list stops being read and starts being scrolled past.
const PAGE = 20;
const CHIPS = 12;

const STAGES = [
  { key: 'visits', label: 'Visits' },
  { key: 'viewed', label: 'Viewed a product' },
  { key: 'basket', label: 'Added to basket' },
  { key: 'checkout', label: 'Reached checkout' },
  { key: 'bought', label: 'Paid' },
];

// The funnel as one shape: each stage a column, joined to the next by a band that narrows as people leave.
// Labels and the step pills are placed from the same coordinates as the drawing, so they cannot drift.
const W = 1000;
const COL = 120;
const GAP = (W - COL * 5) / 4;
const H = 170;

function Flow({ totals }) {
  const values = STAGES.map((st) => totals[st.key] ?? 0);
  const top = Math.max(1, values[0]);
  // Square root, so a stage of 1 beside 114 is still a shape rather than a hairline. The figures carry the exact values.
  const height = (v) => (v > 0 ? Math.max(10, Math.sqrt(v / top) * H) : 10);
  const y = (v) => (H - height(v)) / 2;
  const x = (i) => i * (COL + GAP);
  const at = (px) => `${(px / W) * 100}%`;

  return (
    <div className={styles.flow}>
      <div className={styles.flowStage}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.flowSvg} aria-hidden="true">
          <defs>
            <linearGradient id="flow-band" x1="0" x2="1">
              <stop offset="0" stopColor="#c4674a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#c4674a" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          {values.slice(0, -1).map((v, i) => {
            const nx = values[i + 1];
            if (!v || !nx) return null;
            const x1 = x(i) + COL;
            const x2 = x(i + 1);
            const mid = (x1 + x2) / 2;
            return (
              <path key={i} className={styles.band} style={{ animationDelay: `${i * 90}ms` }}
                d={`M${x1},${y(v)} C${mid},${y(v)} ${mid},${y(nx)} ${x2},${y(nx)} L${x2},${y(nx) + height(nx)} C${mid},${y(nx) + height(nx)} ${mid},${y(v) + height(v)} ${x1},${y(v) + height(v)} Z`}
                fill="url(#flow-band)" />
            );
          })}
          {values.map((v, i) => (v > 0 ? (
            <rect key={i} className={styles.col} style={{ animationDelay: `${i * 90}ms` }}
              x={x(i)} y={y(v)} width={COL} height={height(v)} rx="10"
              fill={i === values.length - 1 ? '#a9c9a2' : '#e9a48c'} />
          ) : (
            <rect key={i} x={x(i) + 1} y={y(v)} width={COL - 2} height={height(v)} rx="5"
              fill="none" stroke="rgba(250,246,239,0.3)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )))}
        </svg>

        {values.slice(0, -1).map((v, i) => {
          const p = pct(values[i + 1], v);
          if (p === null) return null;
          return (
            <span key={i} className={styles.pill} data-zero={p === 0 || undefined} style={{ left: at(x(i) + COL + GAP / 2) }}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6M5.5 2.5L8 5 5.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <b data-num>{p}%</b>
              <span className="visually-hidden"> of the stage before carried on</span>
            </span>
          );
        })}
      </div>

      <ol className={styles.flowLabels}>
        {STAGES.map((st, i) => (
          <li key={st.key} style={{ left: at(x(i)), width: at(i === STAGES.length - 1 ? COL : COL + GAP * 0.85) }} data-zero={!values[i] || undefined}>
            <b data-num>{values[i] ? n(values[i]) : 0}</b>
            <span>{st.label}</span>
            <em>{!values[i] ? 'None yet' : i === 0 ? (values[0] < 15 ? 'under 1 a day' : `about ${n(Math.round(values[0] / 30))} a day`) : `${pct(values[i], values[0])}% of visits`}</em>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Daily({ days }) {
  const map = new Map(days.map((d) => [String(d.day), Number(d.visits)]));
  const list = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86400000);
    const k = date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    return { k, date, n: map.get(k) ?? 0 };
  });
  const peak = list.reduce((best, d) => (d.n > best.n ? d : best), list[0]);
  const scale = Math.max(1, peak.n);
  const short = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  return (
    <>
      <ol className={styles.daily} aria-label="Visits each day">
        {list.map((d, i) => (
          <li key={d.k} title={`${short(d.date)}: ${n(d.n)} visits`} data-peak={(d === peak && d.n > 0) || undefined}>
            <i style={{ height: `${(d.n / scale) * 100}%`, animationDelay: `${i * 12}ms` }} />
            {d === peak && d.n > 0 && <span className={styles.peak} data-num>{n(d.n)}</span>}
          </li>
        ))}
      </ol>
      <div className={styles.axis}>
        <span>{short(list[0].date)}</span>
        {peak.n > 0 && list.indexOf(peak) > 3 && list.indexOf(peak) < list.length - 4 && <span className={styles.axisPeak} style={{ left: `${((list.indexOf(peak) + 0.5) / list.length) * 100}%` }}>Busiest, {short(peak.date)}</span>}
        <span>Today</span>
      </div>
    </>
  );
}

function Product({ p, index }) {
  const v = verdict(p);
  const views = Number(p.views ?? 0);
  const steps = [
    { k: 'Views', n: views + Number(p.quick_views ?? 0), plain: true },
    { k: 'Saved', n: Number(p.saves ?? 0) },
    { k: 'Basket', n: Number(p.adds ?? 0) },
    { k: 'Out again', n: Number(p.removes ?? 0), bad: true },
    { k: 'Sold', n: Number(p.purchases ?? 0), good: true },
  ];
  const confidence = Math.min(1, views / ENOUGH);

  return (
    <li className={styles.product} data-tone={v.tone} style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      {thumb(p.image_url) ? <img className={styles.pic} src={thumb(p.image_url)} alt="" loading="lazy" /> : <span className={styles.pic} />}
      <div className={styles.pmain}>
        <p className={styles.ptitle}>{p.title}</p>
        <p className={styles.verdict}><i />{v.text}</p>
        <p className={styles.next}>{NEXT[v.text] ?? ''}</p>
      </div>
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.k} data-on={s.n > 0 || undefined} data-plain={s.plain || undefined} data-bad={s.bad || undefined} data-good={s.good || undefined}>
            <b data-num>{n(s.n)}</b><span>{s.k}</span>
          </li>
        ))}
      </ol>
      <div className={styles.sure}>
        <span className={styles.sureTrack}><i style={{ width: `${confidence * 100}%` }} /></span>
        <span className={styles.sureText}>
          {views >= ENOUGH ? 'Enough views to trust this' : <><span data-num>{ENOUGH - views}</span> more views to be sure</>}
        </span>
      </div>
    </li>
  );
}

export function InterestPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);
  const { status, error, products, days, totals, failing, missed, searches, sources, reload } = useInterest(tenant?.id);
  const [which, setWhich] = useState('worth');
  const [sort, setSort] = useState('views');
  const [term, setTerm] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [allSearches, setAllSearches] = useState(false);

  const pool = useMemo(() => (which === 'worth' ? failing : products.filter((p) => p.status === 'live' || Number(p.views) > 0)), [which, failing, products]);
  const list = useMemo(() => {
    const by = SORTS.find((x) => x.key === sort).by;
    const q = term.trim().toLowerCase();
    return pool.filter((p) => !q || String(p.title).toLowerCase().includes(q)).sort((a, b) => by(b) - by(a));
  }, [pool, sort, term]);
  useEffect(() => { setShown(PAGE); }, [which, sort, term]);
  const allVisits = sources.reduce((n, s) => n + s.visits, 0);
  const found = searches.filter((s) => !s.never_found);
  const chipLimit = allSearches ? Infinity : CHIPS;
  const moreSearches = Math.max(0, missed.length - CHIPS) + Math.max(0, found.length - CHIPS);

  if (tenant === undefined || (status === 'loading' && !days.length && !products.length)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The figures did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  const quiet = totals.visits === 0;
  const lost = totals.visits - totals.viewed;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>What people look at</h1>
        <p className={styles.sub}>
          {quiet ? 'Nobody has visited in the last 30 days.'
            : <>
              <span data-num>{n(totals.visits)}</span> visits in the last 30 days.{' '}
              {lost > 0 && <><span data-num>{pct(lost, totals.visits)}%</span> left without opening a product. </>}
              {totals.bought ? <><span data-num>{totals.bought}</span> paid, <span data-num>{formatGbp(totals.taken)}</span>.</> : 'Nobody has paid yet.'}
            </>}
        </p>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroHead}>
          <p className={styles.heroLabel}>
            From arriving to paying, last 30 days
            <Tip side="end" place="below" tone="light">
              Each figure is visits, not clicks: someone who opens checkout three times counts once.
              The shop keeps nothing on anybody&apos;s device, so the same person coming back tomorrow is a second visit.
            </Tip>
          </p>
        </div>
        <Flow totals={totals} />
        <div className={styles.dailyWrap}>
          <p className={styles.heroLabel}>Visits each day</p>
          <Daily days={days} />
        </div>
      </section>

      <div className={styles.twin}>
        <Card>
          <CardHead title="Where they came from" note="Last 30 days, by first page of the visit"
            aside={<Tip side="end">For TikTok, put cartandkeep.com/?utm_source=tiktok in your bio. TikTok hides where visitors came from unless the link says so.</Tip>} />
          {sources.length === 0 ? <p className={styles.emptyNote}>Nothing yet.</p> : (
            <ul className={styles.sources}>
              {sources.map((s) => {
                const meta = SOURCE[s.source] ?? { label: s.source, icon: 'IconOut' };
                return (
                  <li key={s.source} className={styles.source}>
                    <span className={styles.sourceIcon} data-source={s.source}><Icon name={meta.icon} width="16" height="16" /></span>
                    <span className={styles.sourceMain}>
                      <span className={styles.sourceTop}>
                        <b>{meta.label}</b>
                        {meta.hint && <Tip side="end">{meta.hint}</Tip>}
                        <span className={styles.sourceVisits}>
                          <b data-num>{n(s.visits)}</b>
                          <small data-num>{allVisits ? Math.round((s.visits / allVisits) * 100) : 0}%</small>
                        </span>
                      </span>
                      <span className={styles.share}><i style={{ width: `${allVisits ? (s.visits / allVisits) * 100 : 0}%` }} /></span>
                      <span className={styles.sourceMeta}>
                        <span><span data-num>{n(s.baskets)}</span> {s.baskets === 1 ? 'basket' : 'baskets'}</span>
                        <span><span data-num>{n(s.orders)}</span> {s.orders === 1 ? 'order' : 'orders'}</span>
                        {s.revenue > 0 && <span data-num>{formatGbp(s.revenue)}</span>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="What they searched for" note="Words typed into the shop's search box" />
          {searches.length === 0 ? (
            <div className={styles.searchEmpty}>
              <span className={styles.exampleTag}>Example</span>
              <span className={styles.chipGhost}>toilet frame</span>
              <span className={styles.chipGhost}>shoe horn</span>
              <span className={styles.chipGhost}>grab rail</span>
              <p>No searches yet. Words that find nothing will show here in red: the best list there is of what to stock next.</p>
            </div>
          ) : (
            <>
              {missed.length > 0 && <p className={styles.searchLabel}>Found nothing</p>}
              <div className={styles.chips}>
                {missed.slice(0, chipLimit).map((s) => <span key={s.term} className={styles.chip} data-missed=""><b>{s.term}</b><span data-num>{n(s.searches)}</span></span>)}
              </div>
              {found.length > 0 && <p className={styles.searchLabel}>Found something</p>}
              <div className={styles.chips}>
                {found.slice(0, chipLimit).map((s) => <span key={s.term} className={styles.chip}><b>{s.term}</b><span data-num>{n(s.searches)}</span></span>)}
              </div>
              {moreSearches > 0 && (
                <button type="button" className={styles.more} onClick={() => setAllSearches((v) => !v)}>
                  {allSearches ? 'Show the top ones' : <>Show all <span data-num>{n(searches.length)}</span> searches</>}
                </button>
              )}
            </>
          )}
        </Card>
      </div>

      <section>
        <div className={styles.listHead}>
          <div>
            <h2 className={styles.h2}>Products</h2>
            <p className={styles.sub2}>
              {which === 'worth' ? 'Looked at and not bought, most looked at first.' : 'Everything on the shop, most looked at first.'}
              {' '}Counted since each product went on the shop, not just the last 30 days.
            </p>
          </div>
          <div className={styles.tabs} role="group" aria-label="Which products">
            <button type="button" className={styles.tab} aria-pressed={which === 'worth'} onClick={() => setWhich('worth')}>Worth a look<span data-num>{failing.length}</span></button>
            <button type="button" className={styles.tab} aria-pressed={which === 'all'} onClick={() => setWhich('all')}>Every product<span data-num>{n(products.filter((p) => p.status === 'live' || Number(p.views) > 0).length)}</span></button>
          </div>
        </div>
        {pool.length > 6 && (
          <div className={styles.listTools}>
            <label className={styles.search}>
              <Icon name="IconSearch" width="16" height="16" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find a product" aria-label="Find a product" />
            </label>
            <div className={styles.sorts} role="group" aria-label="Sort products">
              {SORTS.map((x) => (
                <button key={x.key} type="button" className={styles.sortBtn} aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>{x.label}</button>
              ))}
            </div>
          </div>
        )}
        {list.length === 0
          ? <Card className={styles.emptyCard}><p>{term ? 'No product matches that.' : which === 'worth' ? 'Nothing looked at and left. Either nobody has visited, or everything seen has sold.' : 'Nothing to show yet.'}</p></Card>
          : (
            <>
              <ul className={styles.products}>{list.slice(0, shown).map((p, i) => <Product key={p.product_id} p={p} index={i} />)}</ul>
              {list.length > shown && (
                <button type="button" className={styles.showMore} onClick={() => setShown((v) => v + PAGE)}>
                  Show <span data-num>{Math.min(PAGE, list.length - shown)}</span> more
                  <small>of <span data-num>{n(list.length - shown)}</span> left</small>
                </button>
              )}
            </>
          )}
      </section>
    </div>
  );
}
