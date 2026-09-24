import { useEffect, useMemo, useState } from 'react';
import { useSubscribers } from '@hooks/useSubscribers';
import { toCsv, download, stamped } from '@hooks/useRequests';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/subscribers-page.module.css';

const FILTERS = [
  { key: 'on', label: 'On the list' },
  { key: 'off', label: 'Left' },
  { key: 'all', label: 'Everyone' },
];

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

const COLUMNS = [
  { label: 'Email', value: (r) => r.email },
  { label: 'Name', value: (r) => r.name },
  { label: 'Joined', value: (r) => when(r.consented_at) },
  { label: 'From', value: (r) => r.source },
  { label: 'What they agreed to', value: (r) => r.wording },
  { label: 'Left', value: (r) => when(r.unsubscribed_at) },
];

const WEEKS = 12;

// The sign up boxes send short keys; these are the names she would use for them.
const SOURCE_NAMES = { footer: 'Shop footer', home: 'Home page', product: 'Product page', checkout: 'Checkout', blog: 'Blog' };
const sourceName = (s) => (s ? SOURCE_NAMES[String(s).toLowerCase()] ?? String(s)[0].toUpperCase() + String(s).slice(1) : null);
const hueOf = (s) => [...String(s)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 5;

// People on the list at the end of each of the last twelve weeks.
function growth(rows) {
  const now = Date.now();
  return Array.from({ length: WEEKS }, (_, i) => {
    const end = now - (WEEKS - 1 - i) * 7 * 86400000;
    return rows.filter((r) => new Date(r.consented_at).getTime() <= end
      && (!r.unsubscribed_at || new Date(r.unsubscribed_at).getTime() > end)).length;
  });
}

function Growth({ points }) {
  const w = 320;
  const h = 84;
  const peak = Math.max(1, ...points);
  const xy = points.map((v, i) => [(i / (points.length - 1)) * w, h - 6 - (v / peak) * (h - 16)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className={styles.growth} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="list-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9c9a2" stopOpacity="0.45" />
          <stop offset="1" stopColor="#a9c9a2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#list-fill)" />
      <path d={line} fill="none" stroke="#a9c9a2" strokeWidth="2" vectorEffect="non-scaling-stroke" className={styles.growthLine} />
      <circle cx={xy.at(-1)[0]} cy={xy.at(-1)[1]} r="4" fill="#a9c9a2" />
    </svg>
  );
}

function Hero({ rows, counts, first }) {
  const points = useMemo(() => growth(rows), [rows]);
  const month = Date.now() - 30 * 86400000;
  const joined = rows.filter((r) => new Date(r.consented_at).getTime() >= month).length;
  const latest = rows.reduce((d, r) => (r.consented_at > d ? r.consented_at : d), '');
  const sources = useMemo(() => {
    const m = new Map();
    for (const r of rows.filter((x) => x.on)) {
      const k = sourceName(r.source) ?? 'Not recorded';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [rows]);
  const top = Math.max(1, ...sources.map((s) => s[1]));

  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <p className={styles.heroLabel}>On the list</p>
        <p className={styles.heroFigure} data-num>{counts.on}</p>
        <p className={styles.heroNote}>
          {first ? 'The first sign up starts the line.'
            : joined
              ? <><b data-num>+{joined}</b> in the last 30 days{counts.off ? <>, <span data-num>{counts.off}</span> left</> : ''}</>
              : <>Nobody new in 30 days. Last joined {when(latest)}.</>}
        </p>
      </div>
      <div className={styles.heroChart}>
        <p className={styles.heroLabel}>The last 12 weeks</p>
        {first ? <div className={styles.growthGhost} aria-hidden="true" /> : (
          <>
            <Growth points={points} />
            <p className={styles.axis}><span>12 weeks ago</span><span>Now, <b data-num>{counts.on}</b></span></p>
          </>
        )}
      </div>
      <div className={styles.sources}>
        <p className={styles.heroLabel}>
          Where they signed up
          <Tip side="end" place="below" tone="light">The page each person was on when they ticked the box. It tells you which sign up box is working.</Tip>
        </p>
        {sources.length === 0 ? <p className={styles.heroNote}>Each sign up box is named here once it brings someone.</p> : (
          <ul className={styles.sourceList}>
            {sources.map(([name, n]) => (
              <li key={name}>
                <span className={styles.sourceName}>{name}</span>
                <span className={styles.sourceTrack}><i style={{ width: `${(n / top) * 100}%` }} /></span>
                <span data-num>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Person({ person, busy, onTake, index, example }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className={styles.person} data-off={!person.on || undefined} data-example={example || undefined}
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
      {example && <span className={styles.exampleTag}>Example</span>}
      <div className={styles.row}>
        <span className={styles.avatar} data-hue={hueOf(person.email)} aria-hidden="true">
          {(person.name || person.email)[0].toUpperCase()}
        </span>
        <span className={styles.who}>
          <span className={styles.email}>{person.email}</span>
          <span className={styles.meta}>
            {person.name && <span>{person.name}</span>}
            <span>joined {when(person.consented_at)}</span>
            {person.source && <span className={styles.source}>{sourceName(person.source)}</span>}
          </span>
        </span>
        {person.wording && (
          <button type="button" className={styles.consent} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Icon name="IconCheck" width="12" height="12" />Consent recorded
          </button>
        )}
        {person.on ? (
          confirm ? (
            <span className={styles.confirm}>
              <button type="button" className={styles.danger} disabled={busy || example} onClick={() => onTake(person.id)}>Take off</button>
              <button type="button" className={styles.link} onClick={() => setConfirm(false)}>Keep</button>
            </span>
          ) : (
            <button type="button" className={styles.link} disabled={example} onClick={() => setConfirm(true)}>Take off</button>
          )
        ) : (
          <span className={styles.left}>Left {when(person.unsubscribed_at)}</span>
        )}
      </div>
      {open && (
        <blockquote className={styles.wording}>
          <span className={styles.wordingLabel}>What the box said when they ticked it</span>
          {person.wording}
        </blockquote>
      )}
    </li>
  );
}

const SAMPLE = [
  { id: 'e1', email: 'june.carter@example.com', name: 'June', on: true, source: 'Shop footer', consented_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    wording: 'Send me the odd email about new stock and offers. I can leave at any time from the link in every email.' },
  { id: 'e2', email: 'r.patel@example.com', name: null, on: false, source: 'Product page', consented_at: '2026-08-02', unsubscribed_at: '2026-09-10',
    wording: 'Send me the odd email about new stock and offers. I can leave at any time from the link in every email.' },
];

function FirstList() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Mailing list</h1>
          <p className={styles.sub}>Nobody yet. People join from the sign up box on your shop, and only by ticking it themselves.</p>
        </div>
      </header>
      <Hero rows={[]} counts={{ on: 0, off: 0 }} first />
      <div className={styles.first}>
        <section>
          <p className={styles.firstLabel}>This is how they will look. Press Consent recorded to see what they agreed to.</p>
          <ul className={styles.list}>
            {SAMPLE.map((p, i) => <Person key={p.id} person={p} index={i} example busy={false} onTake={() => {}} />)}
          </ul>
        </section>
        <Card>
          <CardHead title="How the list works" />
          <ol className={styles.steps}>
            <li><span className={styles.stepIcon}><Icon name="IconEnvelope" width="16" height="16" /></span><span><b>They tick the box</b>The exact words of the box are saved with them, as proof of what they agreed to.</span></li>
            <li><span className={styles.stepIcon}><Icon name="IconX" width="16" height="16" /></span><span><b>They can leave in one click</b>From the link in any email. Leaving is kept on record, not deleted.</span></li>
            <li><span className={styles.stepIcon}><Icon name="IconOut" width="16" height="16" /></span><span><b>You send from elsewhere</b>Export the list into an email service, which handles bounces and complaints.</span></li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

export function SubscribersPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, error, counts, remove, reload } = useSubscribers(tenant?.id);
  const [filter, setFilter] = useState('on');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const visible = useMemo(() => {
    const byFilter = filter === 'all' ? rows : rows.filter((r) => (filter === 'on' ? r.on : !r.on));
    const q = term.trim().toLowerCase();
    return q ? byFilter.filter((r) => [r.email, r.name, r.source].some((v) => String(v ?? '').toLowerCase().includes(q))) : byFilter;
  }, [rows, filter, term]);

  async function take(id) {
    setBusy(true);
    setFailed(null);
    try { await remove(id); } catch (e) { setFailed(e?.message ?? 'That did not save.'); } finally { setBusy(false); }
  }

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The list did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (counts.all === 0) return <FirstList />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Mailing list</h1>
          <p className={styles.sub}>Everyone who ticked the box, and everyone who has since left, kept as the record that they did.</p>
        </div>
        {/* Everybody, not the filtered view: an export without the leavers would put them back on a list elsewhere. */}
        <button type="button" className={styles.quiet} onClick={() => download(stamped('mailing-list'), toCsv(rows, COLUMNS))}>
          <Icon name="IconOut" width="16" height="16" />Export everyone
        </button>
      </header>

      <Hero rows={rows} counts={counts} />

      <div className={styles.controls}>
        <div className={styles.tabs} role="group" aria-label="Filter the list">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={styles.tab} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}<span data-num>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Icon name="IconSearch" width="16" height="16" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Email, name or where" aria-label="Search the list" />
        </label>
      </div>

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      {visible.length === 0 ? (
        <Card className={styles.none}><p>Nobody matches that.</p></Card>
      ) : (
        <ul className={styles.list}>
          {visible.map((p, i) => <Person key={p.id} person={p} index={i} busy={busy} onTake={take} />)}
        </ul>
      )}
    </div>
  );
}
