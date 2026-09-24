import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useRequests, toCsv, download, stamped } from '@hooks/useRequests';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { Card, CardHead, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import styles from '@styles/pages/portal/requests-page.module.css';

/*
 * What people asked her to stock.
 *
 * The most valuable screen in this portal per line of code, because every row
 * is somebody saying unprompted what they would buy. The research pipeline
 * pays for demand signal; this arrives free, from her own visitors, with a
 * price attached.
 *
 * Asked twice sits at the top, because that is the only thing on the page that
 * is a decision rather than a record. Two people asking is a coincidence. Four
 * is a product.
 */

// The path a request takes, left to right. Stocked is the win.
const STAGES = [
  { key: 'new', label: 'New', icon: 'IconAsk', hint: 'Asked, not looked at yet' },
  { key: 'looking', label: 'Looking', icon: 'IconSearch', hint: 'You are finding a supplier' },
  { key: 'sourced', label: 'Stocked', icon: 'IconCheck', hint: 'On the shop now' },
  { key: 'declined', label: 'Not for us', icon: 'IconX', hint: 'Decided against' },
];

const FILTERS = [...STAGES, { key: 'all', label: 'All' }];

function ago(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
};

const COLUMNS = [
  { label: 'Asked', value: (r) => when(r.created_at) },
  { label: 'What they want', value: (r) => r.wanted },
  { label: 'They pay now', value: (r) => (r.paying == null ? '' : Number(r.paying).toFixed(2)) },
  { label: 'Where they buy it', value: (r) => r.seen_at },
  { label: 'Name', value: (r) => r.name },
  { label: 'Email', value: (r) => r.email },
  { label: 'Asked from', value: (r) => r.source },
  { label: 'Status', value: (r) => r.status },
  { label: 'Your note', value: (r) => r.note },
];

function Request({ request, busy, run, saved, onStatus, onNote, index, example }) {
  const [note, setNote] = useState(request.note ?? '');
  const dirty = note.trim() !== (request.note ?? '').trim();

  return (
    <li className={styles.request} data-status={request.status} data-example={example || undefined}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
      {example && <span className={styles.exampleTag}>Example</span>}
      <div className={styles.requestMain}>
        <p className={styles.wanted}>{request.wanted}</p>
        <p className={styles.facts}>
          {request.paying != null && (
            <span className={styles.pays}>
              <Icon name="IconTag" width="12" height="12" />
              Pays <b data-num>{formatGbp(request.paying)}</b>{request.seen_at ? ` at ${request.seen_at}` : ''}
            </span>
          )}
          {request.paying == null && request.seen_at && <span className={styles.pays}>Buys it at {request.seen_at}</span>}
          <span className={styles.meta}>{ago(request.created_at)}</span>
          {request.source && <span className={styles.meta}>from {request.source}</span>}
          {request.email && (
            <a className={styles.who} href={`mailto:${request.email}`}>
              <Icon name="IconEnvelope" width="12" height="12" />{request.name || request.email}
            </a>
          )}
        </p>
      </div>

      <div className={styles.stages} role="group" aria-label="Where this request is">
        {STAGES.map((st) => (
          <button key={st.key} type="button" className={styles.stage} data-stage={st.key}
            aria-pressed={request.status === st.key} disabled={busy || example} title={st.hint}
            onClick={() => request.status !== st.key && run(() => onStatus(request.id, st.key), `${request.id}:stage`)}>
            <Icon name={st.icon} width="13" height="13" />
            <span>{st.label}</span>
          </button>
        ))}
      </div>

      <form className={styles.noteBox} onSubmit={(e) => { e.preventDefault(); if (dirty) run(() => onNote({ id: request.id, note }), request.id); }}>
        <Icon name="IconNote" width="14" height="14" className={styles.noteIcon} />
        <input className={styles.note} value={note} onChange={(e) => setNote(e.target.value)} disabled={example}
          placeholder="A note for you, never shown to them" aria-label="Your note, never shown to them" />
        {dirty && <button type="submit" className={styles.quiet} disabled={busy}>Save</button>}
        {!dirty && saved && <span className={styles.saved}><Icon name="IconCheck" width="12" height="12" />Saved</span>}
      </form>
    </li>
  );
}

const SAMPLE = {
  id: 'example',
  wanted: 'Toilet frame with arms, adjustable height',
  paying: 34.99,
  seen_at: 'Boots',
  name: 'A customer',
  email: null,
  source: 'the request form',
  status: 'new',
  note: 'Aidapt do one at £18 trade',
  created_at: new Date().toISOString(),
};

const SAMPLE_DEMAND = [
  { wanted: 'Toilet frame with arms', asks: 4, paying: 32.33 },
  { wanted: 'Long handled shoe horn', asks: 2, paying: 8.75 },
];

const HOW = [
  { icon: 'IconSearch', title: 'They cannot find it', body: 'A visitor looking for something you do not sell yet.' },
  { icon: 'IconTag', title: 'They tell you the price', body: 'What they want, what they pay now and where they buy it.' },
  { icon: 'IconEnvelope', title: 'It lands here', body: 'With an email to you the moment they send it.' },
];

// Before the first request: the page as it will look, a real example, and a way to send one.
function FirstRequest() {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/request`;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Requests</h1>
          <p className={styles.sub}>None yet. Each one is research you did not have to do.</p>
        </div>
      </header>

      <nav className={styles.flow} aria-label="Stages a request moves through">
        {STAGES.map((st, i) => (
          <div key={st.key} className={styles.flowStep} data-stage={st.key} data-idle="">
            <span className={styles.flowIcon}><Icon name={st.icon} width="16" height="16" /></span>
            <span className={styles.flowText}>
              <b data-num>0</b>
              <span>{st.label}</span>
            </span>
            {i < 2 && <Icon name="IconCaret" width="14" height="14" className={styles.flowArrow} />}
          </div>
        ))}
      </nav>

      <div className={styles.first}>
        <section className={styles.firstMain}>
          <p className={styles.firstLabel}>This is how one will look</p>
          <ul className={styles.list}>
            <Request request={SAMPLE} index={0} example busy={false} run={() => {}} saved={false}
              onStatus={() => {}} onNote={() => {}} />
          </ul>
          <p className={styles.firstHint}>
            Move it from New to Looking while you find a supplier, then to Stocked once it is on the shop.
          </p>

          <p className={styles.firstLabel}>When the same thing is asked for again</p>
          <Card className={styles.demandExample}>
            <span className={styles.exampleTag}>Example</span>
            <ol className={styles.demand}>
              {SAMPLE_DEMAND.map((d) => (
                <li key={d.wanted} className={styles.demandRow}>
                  <span className={styles.demandTop}>
                    <span className={styles.demandWanted}>{d.wanted}</span>
                    <b className={styles.asks} data-num>{d.asks}</b>
                  </span>
                  <span className={styles.heat}><i style={{ width: `${(d.asks / SAMPLE_DEMAND[0].asks) * 100}%` }} /></span>
                  <span className={styles.demandMeta}>
                    <span>about <span data-num>{formatGbp(d.paying)}</span> each</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className={styles.firstHint}>Requests for the same thing are grouped, however they are worded. Four asks at a known price is a product worth pricing up.</p>
          </Card>
        </section>

        <Card className={styles.how}>
          <CardHead title="How a request reaches you" />
          <ol className={styles.steps}>
            {HOW.map((h, i) => (
              <li key={h.title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <Icon name={h.icon} width="16" height="16" />
                  <i data-num>{i + 1}</i>
                </span>
                <span>
                  <b>{h.title}</b>
                  <span>{h.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className={styles.try}>
            <a className={styles.go} href={`${link}?from=portal`} target="_blank" rel="noreferrer">
              <Icon name="IconOut" width="16" height="16" />Send one yourself
            </a>
            <button type="button" className={styles.quiet} onClick={async () => {
              try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* clipboard refused */ }
            }}>
              {copied && <Icon name="IconCheck" width="16" height="16" />}{copied ? 'Copied' : 'Copy the link'}
            </button>
          </div>
          <p className={styles.tryNote}>A test you send is marked as from the portal, so you can tell it apart.</p>
        </Card>
      </div>
    </div>
  );
}

export function RequestsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, demand, error, counts, setStatus, saveNote, reload } = useRequests(tenant?.id);

  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const fallback = counts.new ? 'new' : counts.looking ? 'looking' : 'all';
  const filter = FILTERS.some((f) => f.key === requested) ? requested : fallback;

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [saved, setSaved] = useState(null);

  async function run(fn, key = null) {
    setBusy(true);
    setFailed(null);
    setSaved(null);
    try {
      await fn();
      if (key) {
        setSaved(key);
        setTimeout(() => setSaved((k) => (k === key ? null : k)), 3000);
      }
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const peak = Math.max(1, ...demand.map((d) => d.asks));
  const decided = counts.sourced + counts.declined;

  if (tenant === undefined || (status === 'loading' && rows.length === 0)) return <PageSkeleton />;

  if (status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The requests did not load</h1>
        <p className={styles.failureBody}>{error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={reload}>Try again</button>
      </div>
    );
  }

  if (counts.all === 0) return <FirstRequest />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Requests</h1>
          <p className={styles.sub}>
            {counts.new ? <><span data-num>{counts.new}</span> new, </> : 'Nothing new. '}
            <span data-num>{counts.sourced}</span> turned into stock so far.
          </p>
        </div>
        <button type="button" className={styles.quiet} onClick={() => download(stamped('requests'), toCsv(rows, COLUMNS))}>
          <Icon name="IconOut" width="16" height="16" />Export as a spreadsheet
        </button>
      </header>

      <nav className={styles.flow} aria-label="Requests by stage">
        {STAGES.map((st, i) => (
          <button key={st.key} type="button" className={styles.flowStep} data-stage={st.key}
            aria-pressed={filter === st.key}
            onClick={() => setParams(st.key === fallback ? {} : { filter: st.key }, { replace: true })}>
            <span className={styles.flowIcon}><Icon name={st.icon} width="16" height="16" /></span>
            <span className={styles.flowText}>
              <b data-num>{counts[st.key]}</b>
              <span>{st.label}</span>
            </span>
            {i < 2 && <Icon name="IconCaret" width="14" height="14" className={styles.flowArrow} />}
          </button>
        ))}
        <button type="button" className={styles.flowAll} aria-pressed={filter === 'all'}
          onClick={() => setParams({ filter: 'all' }, { replace: true })}>
          All <span data-num>{counts.all}</span>
        </button>
      </nav>

      {counts.all > 0 && (
        <div className={styles.progress} role="img" aria-label={`${decided} of ${counts.all} decided`}>
          {STAGES.map((st) => counts[st.key] > 0 && (
            <span key={st.key} data-stage={st.key} style={{ flex: counts[st.key] }} />
          ))}
        </div>
      )}

      <div className={styles.body}>
        <section className={styles.listWrap}>
          {failed && <p className={styles.error} role="alert">{failed}</p>}
          {visible.length === 0 ? (
            <Card className={styles.none}>
              <span className={styles.noneMark}><Icon name="IconCheck" width="22" height="22" /></span>
              <p className={styles.noneTitle}>{filter === 'new' ? 'Every request has been looked at' : 'Nothing in here'}</p>
              <p className={styles.noneBody}>New ones arrive here as people ask.</p>
            </Card>
          ) : (
            <ul className={styles.list}>
              {visible.map((r, i) => (
                <Request key={r.id} index={i} request={r} busy={busy} run={run}
                  saved={saved === r.id} onStatus={setStatus} onNote={saveNote} />
              ))}
            </ul>
          )}
        </section>

        <aside className={styles.side}>
          <Card>
            <CardHead title="Asked more than once" note="The strongest signal on this page"
              aside={<Tip side="end">Requests for the same thing, grouped. More asks at a known price is demand you can check before buying stock.</Tip>} />
            {demand.length === 0 ? (
              <p className={styles.demandEmpty}>When two people ask for the same thing, it rises here.</p>
            ) : (
              <ol className={styles.demand}>
                {demand.map((d) => (
                  <li key={d.wanted} className={styles.demandRow}>
                    <span className={styles.demandTop}>
                      <span className={styles.demandWanted}>{d.wanted}</span>
                      <b className={styles.asks} data-num>{d.asks}</b>
                    </span>
                    <span className={styles.heat}><i style={{ width: `${(d.asks / peak) * 100}%` }} /></span>
                    <span className={styles.demandMeta}>
                      {d.paying != null && <span>about <span data-num>{formatGbp(d.paying)}</span> each</span>}
                      {d.unanswered > 0 && <span className={styles.demandOpen}><span data-num>{d.unanswered}</span> not looked at</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
