import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useKeeperRun } from '@hooks/useKeeperRun';
import { useAccount } from '@hooks/useAccount';
import { PRODUCT_SELECT, blockers, isLive, isReady } from '@hooks/useCatalogue';
import { REPORT_TRAYS, SELLABLE, TRAYS, placeOf, pounds, summarise, timeLeft, trayOf } from '@lib/keeper';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/keeper-page.module.css';

/*
 * The assistant's office (keeper-task-01-shop-drafts.md): the in-tray of drafts, the one on the desk, the stamp, and
 * the out-trays filling. Every movement is a job changing state on the server; nothing here is staged.
 */

const n = (v) => Number(v ?? 0).toLocaleString('en-GB');
const plural = (count, one, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;
const photoOf = (p, job) => job?.result?.image ?? p?.image_url ?? (Array.isArray(p?.images) ? p.images[0] : null) ?? null;
const small = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const productUrl = (id) => portalPath(`/products?open=${id}`);
const trayMeta = (key) => REPORT_TRAYS.find((t) => t.key === key) ?? null;

// Where the assistant is with the draft in hand, as the server writes it (keeper-check.ts). The photos step happens
// only for a chemical or an unclear product, so it shows as passed over when the assistant goes straight to writing.
const PHASES = [['words', 'Reading', 'IconNote'], ['photos', 'Photos', 'IconEye'], ['writing', 'Writing', 'IconSpark']];

// The stamp: the shop's mark with a K. It tilts while reading and presses down, in the tray's ink, on a verdict.
function Stamp({ state = 'idle', size = 56, tray = null }) {
  return (
    <span className={styles.stamp} data-state={state} data-tray={tray || undefined} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r="26" fill="currentColor" fillOpacity={state === 'stamped' ? 0.1 : 0} stroke="currentColor" strokeWidth="3.4" />
        <circle cx="32" cy="32" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray={state === 'reading' ? '2.2 3.4' : undefined} />
        <path d="M25 19 L25 45 M40 19 L26.5 33.5 M31 29 L41 45" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

// Each out-tray's own mark, drawn on its front: a shop bag, a price tag, a bottle, a hand, a torn page.
function TrayMark({ tray }) {
  if (tray === 'live') return <g><path d="M-8 -4h16l-1.5 14h-13z" /><path d="M-4 -4v-2.5a4 4 0 0 1 8 0v2.5" /></g>;
  if (tray === 'ready') return <g><path d="M-9 -5h11l7 7-9 9-9-9z" /><circle cx="-4" cy="0" r="1.6" /></g>;
  if (tray === 'label') return <g><path d="M-3 -10h6M-2 -10v4l-5 6v9h14v-9l-5-6v-4" /><path d="M-4 3h8" /></g>;
  if (tray === 'choose') return <g><path d="M-5 9v-8a2 2 0 0 1 4 0v-6a2 2 0 0 1 4 0v6a2 2 0 0 1 4 0v8c0 2-2 3-4 3h-5c-2 0-3-1-3-3z" /></g>;
  return <g><path d="M-7 -10h10l4 4v6l-3 2 3 2v6h-14z" /><path d="M3 -10v4h4" /></g>;
}

/*
 * A drawn out-tray: paper stacks up inside it as drafts land, one sheet a draft up to six, with the tray's mark on
 * the front. The colour is the tray's own (keeper-page.module.css, data-tray).
 */
function TrayArt({ tray, count = 0, size = 120 }) {
  const sheets = Math.min(6, count);
  return (
    <svg className={styles.trayArt} data-tray={tray} viewBox="0 8 120 76" width={size} height={Math.round(size * 0.63)} aria-hidden="true">
      <ellipse cx="60" cy="78" rx="50" ry="4" className={styles.trayShadow} />
      <path d="M14 36h92l-8 38H22z" className={styles.trayBack} />
      {Array.from({ length: sheets }, (_, i) => (
        <g key={i} className={styles.sheet} style={{ '--i': i }}>
          <rect x={30 + (i % 2) * 3} y={34 - i * 4} width="58" height="26" rx="1.5" transform={`rotate(${(i % 3) - 1} 60 ${47 - i * 4})`} />
          <path d={`M${38 + (i % 2) * 3} ${40 - i * 4}h30M${38 + (i % 2) * 3} ${45 - i * 4}h22`} className={styles.sheetLines} />
        </g>
      ))}
      <path d="M10 50h100l-9 26H19z" className={styles.trayFront} />
      <g transform="translate(60 63) scale(0.82)" className={styles.trayMark}><TrayMark tray={tray} /></g>
    </svg>
  );
}

function Thumb({ url, size = 'md' }) {
  return url
    ? <img className={styles.thumb} data-size={size} src={size === 'lg' ? url : small(url)} alt="" loading="lazy" />
    : <span className={styles.thumb} data-size={size} data-empty="" />;
}

export function KeeperPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);
  const agent = tenant?.store?.agent?.name || 'Your assistant';
  const account = useAccount();
  const studio = account.isStudio;
  // Nothing is read until the account is known, so she never glimpses a studio rehearsal.
  const k = useKeeperRun(account.loading ? null : tenant?.id, { followPace: !account.loading && !studio, includeRehearsals: studio });
  const { run, jobs, products, totals, waiting } = k;

  if (tenant === undefined || account.loading || run === undefined) return <PageSkeleton rows={5} />;

  const live = Boolean(run && (run.state === 'running' || run.state === 'paused'));
  return (
    <div className={styles.page} data-wide>
      <Header agent={agent} run={run} live={live} totals={totals} studio={studio} waiting={waiting} />
      {k.error && <p className={styles.error} role="alert">{k.error}</p>}
      {live
        ? <Floor agent={agent} run={run} jobs={jobs} products={products} totals={totals} onSet={k.set} studio={studio} />
        : (
          <>
            {run && <Report agent={agent} run={run} jobs={jobs} products={products} totals={totals} tenantId={tenant?.id} onDone={k.refresh} studio={studio} />}
            <Start agent={agent} waiting={waiting} last={run} onStart={k.start} studio={studio} />
          </>
        )}
    </div>
  );
}

function Header({ agent, run, live, totals, studio, waiting }) {
  const total = run?.total ?? 0;
  const working = live && run.state === 'running' && totals.working > 0;
  const title = live ? 'Checking your shop drafts'
    : run && !waiting ? `${agent} has checked your drafts`
      : 'Get your drafts ready for sale';
  return (
    <header className={styles.head}>
      <div className={styles.titleBlock}>
        <Stamp state={working ? 'reading' : 'idle'} size={56} />
        <div>
          <p className={styles.kicker}>{live ? (run.state === 'paused' ? `${agent} is paused` : `${agent} at work`) : agent}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.sub}>Returns, label warnings, a clean title and a short address for each draft. Nothing goes on sale until you say so.</p>
        </div>
      </div>
      {live && (
        <dl className={styles.stats}>
          <div className={styles.stat} data-main>
            <dt>Done</dt>
            <dd data-num>{n(totals.done)}<small> of {n(total)}</small></dd>
          </div>
          <div className={styles.stat}>
            <dt>Left</dt>
            <dd>{timeLeft(totals.left, totals.avgMs, run.pace) ?? 'finishing'}</dd>
          </div>
          {studio && (
            <div className={styles.stat}>
              <dt>Spent</dt>
              <dd data-num>{pounds(run.spent_pence)}<small> of {pounds(run.cap_pence)}</small></dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}

// Progress in the trays' own colours, so the bar says where the drafts went as well as how many.
function Meter({ totals, total }) {
  return (
    <div className={styles.meter} role="img" aria-label={`${n(totals.done)} of ${n(total)} checked`}>
      {TRAYS.map((t) => (
        <span key={t.key} data-tray={t.key} style={{ width: `${(totals.trays[t.key] / total) * 100}%` }} />
      ))}
      <span data-tray="skipped" style={{ width: `${(totals.skipped / total) * 100}%` }} />
    </div>
  );
}

function Floor({ agent, run, jobs, products, totals, onSet, studio }) {
  const [stopping, setStopping] = useState(false);
  const [only, setOnly] = useState(null);
  const total = run.total || 1;

  const queued = jobs.filter((j) => j.state === 'queued');
  const working = jobs.filter((j) => j.state === 'working').sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  const finished = jobs.filter((j) => j.state === 'done' || j.state === 'failed')
    .sort((a, b) => String(b.finished_at ?? '').localeCompare(String(a.finished_at ?? '')));
  const landed = finished.filter((j) => trayOf(j) && trayOf(j) !== 'skipped');

  // The desk: the draft in hand, or the one just stamped until the next is picked up.
  const inHand = working[0] ?? null;
  const justDone = !inHand ? landed[0] ?? null : null;
  const onDesk = inHand ?? justDone;
  const p = onDesk ? products.get(onDesk.product_id) : null;
  const tray = justDone ? trayOf(justDone) : null;
  const meta = trayMeta(tray);
  const phase = inHand?.result?.phase ?? 'words';
  const at = Math.max(0, PHASES.findIndex(([key]) => key === phase));
  const log = (only ? landed.filter((j) => trayOf(j) === only) : landed).slice(0, only ? 60 : 12);
  const newTitle = justDone?.result?.title && justDone.result.title_before && justDone.result.title !== justDone.result.title_before;

  return (
    <>
      <div className={styles.controls}>
        {studio && (
          <div className={styles.pace} role="group" aria-label="Pace">
            {[['watch', 'Watch'], ['normal', 'Normal']].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={run.pace === key} onClick={() => run.pace !== key && onSet({ pace: key })}>{label}</button>
            ))}
          </div>
        )}
        {run.state === 'running'
          ? <button type="button" className={styles.quiet} onClick={() => onSet({ state: 'paused' })}><Icon name="IconClock" className={styles.btnIcon} />Pause</button>
          : <button type="button" className={styles.go} onClick={() => onSet({ state: 'running' })}>Carry on</button>}
        {stopping
          ? (
            <span className={styles.confirm} role="group" aria-label="Stop the check">
              <span>Stop? Drafts already checked keep what {agent} found.</span>
              <button type="button" className={styles.danger} onClick={() => { setStopping(false); onSet({ state: 'stopped' }); }}>Stop</button>
              <button type="button" className={styles.link} onClick={() => setStopping(false)}>Keep going</button>
            </span>
          )
          : <button type="button" className={styles.link} onClick={() => setStopping(true)}>Stop</button>}
        {run.rehearsal && <span className={styles.badge}>Rehearsal: nothing is written</span>}
      </div>

      {run.state === 'paused' && (
        <p className={styles.notice} role="status">
          <Icon name="IconInfo" className={styles.noticeIcon} />
          {run.paused_reason && studio ? run.paused_reason : `Paused. ${agent} carries on from the next draft when you press Carry on.`}
        </p>
      )}

      <Meter totals={totals} total={total} />

      <div className={styles.floor}>
        <section className={styles.inTray} aria-label="In-tray">
          <h2 className={styles.colHead}>In-tray</h2>
          <div className={styles.pileArt} aria-hidden="true">
            {Array.from({ length: Math.min(5, queued.length) }, (_, i) => <span key={i} style={{ '--i': i }} />)}
            <b data-num>{n(queued.length)}</b>
          </div>
          <ol className={styles.pile}>
            {queued.slice(0, 4).map((j, i) => {
              const q = products.get(j.product_id);
              return (
                <li key={j.id} className={styles.pileItem} style={{ '--i': i }}>
                  <Thumb url={photoOf(q, j)} size="sm" />
                  <span className={styles.pileName}>{q?.title ?? 'A draft'}</span>
                </li>
              );
            })}
          </ol>
          {queued.length > 4 && <p className={styles.more}>and {n(queued.length - 4)} more</p>}
          {!queued.length && <p className={styles.more}>{totals.working ? 'Finishing the last one.' : 'Empty.'}</p>}
        </section>

        <section className={styles.desk} aria-label="On the desk" aria-live="polite">
          {onDesk ? (
            <article key={onDesk.id + (justDone ? ':done' : '')} className={styles.paper} data-phase={justDone ? 'stamped' : 'reading'} data-tray={tray || undefined}>
              <div className={styles.photo}><Thumb url={photoOf(p, onDesk)} size="lg" /></div>
              <div className={styles.paperText}>
                <p className={styles.paperKicker}>{justDone ? 'Just checked' : `${agent} is reading`}</p>
                {newTitle ? (
                  <>
                    <p className={styles.was}>{justDone.result.title_before}</p>
                    <h2 className={styles.paperTitle} data-new>{justDone.result.title}</h2>
                  </>
                ) : <h2 className={styles.paperTitle}>{justDone?.result?.title ?? p?.title ?? 'A draft'}</h2>}
                {justDone ? (
                  <p className={styles.verdictLine}>{justDone.state === 'failed' ? `Could not read it: ${justDone.error ?? 'try again'}` : justDone.result?.line}</p>
                ) : (
                  <ol className={styles.phases} aria-label="Steps">
                    {PHASES.map(([key, label, icon], i) => {
                      const state = i < at ? (key === 'photos' && !inHand?.result?.read_photos ? 'skipped' : 'done') : i === at ? 'now' : 'next';
                      return (
                        <li key={key} data-state={state}>
                          <span className={styles.phaseDot}><Icon name={icon} /></span>
                          <span>{label}</span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              {justDone && (
                <div className={styles.landing}>
                  <Stamp state="stamped" size={84} tray={tray} />
                  <span className={styles.landingLabel} data-tray={tray}>{meta?.label ?? 'Checked'}</span>
                </div>
              )}
            </article>
          ) : (
            <div className={styles.emptyDesk}>
              <Stamp state="idle" size={56} />
              <p>{run.state === 'paused' ? 'Paused.' : 'Picking up the next draft.'}</p>
            </div>
          )}
        </section>

        <section className={styles.trays} aria-label="Out-trays">
          <h2 className={styles.colHead}>Out-trays</h2>
          <div className={styles.trayGrid}>
            {TRAYS.map((t) => (
              <button key={t.key} type="button" className={styles.tray} data-tray={t.key} aria-pressed={only === t.key}
                title={t.hint} onClick={() => setOnly(only === t.key ? null : t.key)}>
                <TrayArt tray={t.key} count={totals.trays[t.key]} size={96} />
                <span className={styles.trayCount} data-num>{n(totals.trays[t.key])}</span>
                <span className={styles.trayLabel}>{t.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.log} aria-label="What was checked">
        <h2 className={styles.colHead}>
          {only ? trayMeta(only)?.label : 'Just checked'}
          {only && <button type="button" className={styles.link} onClick={() => setOnly(null)}>Show all</button>}
        </h2>
        {!log.length && <p className={styles.more}>Nothing yet.</p>}
        <ol className={styles.lines}>
          {log.map((j) => <LogLine key={j.id} job={j} product={products.get(j.product_id)} />)}
        </ol>
      </section>
    </>
  );
}

// One checked draft: its photo, the title, the tray, the short line, and the reasons folded away.
function LogLine({ job, product, place = null }) {
  const tray = place ?? trayOf(job);
  const meta = trayMeta(tray);
  const why = job.result?.why;
  return (
    <li className={styles.line} data-tray={tray}>
      <Thumb url={photoOf(product, job)} size="sm" />
      <div className={styles.lineText}>
        <p className={styles.lineHead}>
          <span className={styles.lineName}>{job.result?.title ?? product?.title ?? 'A draft'}</span>
          <span className={styles.chip} data-tray={tray}>{meta?.label ?? 'Checked'}</span>
        </p>
        <p className={styles.lineWhy}>{job.state === 'failed' ? `Could not read it: ${job.error ?? 'try again'}` : job.result?.line}</p>
        {why && (
          <details className={styles.reasons}>
            <summary>Why</summary>
            <p>{why}</p>
          </details>
        )}
      </div>
      <Link className={styles.open} to={productUrl(job.product_id)}>Open<span className="visually-hidden"> {product?.title}</span></Link>
    </li>
  );
}

// After a run: the trays drawn with what landed in each, and the one press that puts the ready ones on sale.
function Report({ agent, run, jobs, products, totals, tenantId, onDone, studio }) {
  // Where the drafts are now: on sale since, archived since, or still in Keeper's tray.
  const now = useMemo(() => summarise(jobs, products), [jobs, products]);
  const placed = (j) => placeOf(j, products.get(j.product_id));
  // Still drafts in a tray that can go on sale. Read again whenever the products are, so one put on sale from
  // Products in the meantime is not offered twice.
  const readyIds = useMemo(
    () => jobs.filter((j) => SELLABLE.includes(placeOf(j, products.get(j.product_id)))).map((j) => j.product_id),
    [jobs, products],
  );
  const [eligible, setEligible] = useState(null);
  // Checked as ready, but changed since (opened and rewritten, a box emptied): which ones, and what they need now.
  const [held, setHeld] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(null);
  const [showing, setShowing] = useState(null);
  const asked = useRef('');

  // Of the sellable trays, the drafts the shop's own release check lets go on sale now.
  useEffect(() => {
    const key = readyIds.join(',');
    if (run.rehearsal || asked.current === key) return;
    if (!readyIds.length) { asked.current = key; setEligible([]); setHeld([]); return; }
    asked.current = key;
    (async () => {
      const rows = [];
      for (let i = 0; i < readyIds.length; i += 200) {
        const { data } = await supabase.from('store_products').select(PRODUCT_SELECT).in('id', readyIds.slice(i, i + 200));
        rows.push(...(data ?? []));
      }
      setEligible(rows.filter(isReady).map((r) => r.id));
      setHeld(rows.filter((r) => !isReady(r) && !isLive(r) && r.status !== 'archived').map((r) => ({ id: r.id, title: r.title, why: blockers(r).join(', ').toLowerCase() })));
    })();
  }, [readyIds, run.rehearsal]);

  async function putOnSale() {
    setBusy(true);
    setSaid(null);
    try {
      // Counted from what the database changed, not what was asked: one put on sale elsewhere meanwhile is not counted.
      let went = 0;
      for (let i = 0; i < eligible.length; i += 200) {
        const { data, error } = await supabase.from('store_products').update({ status: 'live', is_sample: false })
          .eq('tenant_id', tenantId).eq('status', 'draft').in('id', eligible.slice(i, i + 200)).select('id');
        if (error) throw error;
        went += data?.length ?? 0;
      }
      setSaid(went ? `${plural(went, 'product')} on sale now.` : 'They were already on sale.');
      setEligible([]);
      setConfirm(false);
      onDone?.();
    } catch (e) {
      setSaid(`That did not finish: ${e?.message ?? 'try again'}.`);
    } finally {
      setBusy(false);
    }
  }

  const t = now.trays;
  const stopped = run.state === 'stopped';
  const unread = totals.trays.unread ?? 0;
  const shown = REPORT_TRAYS.filter((x) => t[x.key] > 0);
  const inTray = (key) => jobs.filter((j) => placed(j) === key);
  const gone = t.archived ?? 0;

  return (
    <section className={styles.report} aria-label="The last check">
      <div className={styles.reportHead}>
        <div>
          <p className={styles.kicker}>{run.rehearsal ? 'Rehearsal finished, nothing written' : stopped ? 'Stopped' : 'Finished'}</p>
          <h2 className={styles.reportTitle}>
            {agent} {run.rehearsal ? 'would have checked' : 'checked'} {plural(totals.done - unread, 'draft')}{stopped ? ` of ${n(run.total)}` : ''}{studio ? ` for ${pounds(run.spent_pence)}` : ''}.
          </h2>
        </div>
        {!run.rehearsal && eligible && eligible.length > 0 && !confirm && (
          <button type="button" className={styles.go} data-big onClick={() => setConfirm(true)}>Put {n(eligible.length)} on sale</button>
        )}
      </div>

      {confirm && (
        <p className={styles.confirm} role="group" aria-label="Put on sale">
          <span>{plural(eligible.length, 'product')} go live on your shop now.</span>
          <button type="button" className={styles.go} disabled={busy} onClick={putOnSale}>{busy ? 'Putting on sale' : 'Put on sale'}</button>
          <button type="button" className={styles.link} disabled={busy} onClick={() => setConfirm(false)}>Not now</button>
        </p>
      )}
      {said && <p className={styles.more} role="status">{said}</p>}

      <div className={styles.reportTrays} role="group" aria-label="Where the drafts went">
        {shown.map((x) => (
          <button key={x.key} type="button" className={styles.reportTray} data-tray={x.key} aria-expanded={showing === x.key}
            onClick={() => setShowing(showing === x.key ? null : x.key)}>
            <TrayArt tray={x.key} count={t[x.key]} size={112} />
            <span className={styles.reportCount} data-num>{n(t[x.key])}</span>
            <span className={styles.trayLabel}>{x.label}</span>
            <span className={styles.trayHint}>{x.hint}</span>
          </button>
        ))}
      </div>

      {gone > 0 && <p className={styles.more}>{plural(gone, 'checked draft')} archived since.</p>}

      {showing && t[showing] > 0 && (
        <ol className={styles.lines} data-in-report>
          {inTray(showing).map((j) => <LogLine key={j.id} job={j} product={products.get(j.product_id)} place={showing} />)}
        </ol>
      )}

      {!run.rehearsal && held.length > 0 && (
        <div className={styles.held}>
          <p className={styles.more}>{plural(held.length, 'checked draft')} changed since, and {held.length === 1 ? 'needs' : 'need'} a look first:</p>
          <ul>
            {held.map((h) => (
              <li key={h.id}>
                <Link to={productUrl(h.id)}>{h.title}</Link>
                {h.why && <span>: {h.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// How many drafts one check takes: a few at a time, oldest first, or all of them.
const BATCHES = [20, 50, 100];

function Start({ agent, waiting, last, onStart, studio }) {
  const [batch, setBatch] = useState(null);
  const [pace, setPace] = useState('watch');
  const [cap, setCap] = useState('5.00');
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);

  if (waiting === null) return null;
  if (!waiting) {
    return <p className={styles.allDone}><Icon name="IconCheck" className={styles.noticeIcon} />Every draft has been checked. New copies from eBay are checked as they arrive.</p>;
  }
  // A batch bigger than what is waiting is all of them; null is all.
  const sizes = BATCHES.filter((b) => b < waiting);
  const take = batch && batch < waiting ? batch : null;
  const count = take ?? waiting;
  // The studio sets the limit; for her it is worked out: about twice what a draft has been costing, never under £5.
  const capPence = studio ? Math.round(Number(String(cap).replace(/[£,\s]/g, '')) * 100) : Math.max(500, Math.ceil(count * 3.2));
  const capOk = Number.isFinite(capPence) && capPence >= 50;
  const tryOn = Math.min(5, waiting);

  async function go(rehearsal, pick = 'next') {
    setBusy(rehearsal ? `rehearsal-${pick}` : 'run');
    setFailed(null);
    try {
      await onStart({ pace: studio ? pace : 'watch', capPence, rehearsal, limit: rehearsal ? (pick === 'next' ? 5 : null) : take, pick });
    } catch (e) {
      setFailed(e?.message ?? 'That did not start.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.start} aria-label="Start a check">
      <div className={styles.startArt} aria-hidden="true">
        <div className={styles.pileArt} data-big>
          {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
          <b data-num>{n(waiting)}</b>
        </div>
        <Stamp state="idle" size={64} />
      </div>
      <div className={styles.startText}>
        <h2 className={styles.startTitle}>{last && !last.rehearsal ? `${plural(waiting, 'draft')} left to check` : `${plural(waiting, 'draft')} to check`}</h2>
        <p className={styles.startBody}>
          {agent} sets each draft&apos;s returns, puts a chemical&apos;s label warnings on the page, gives each copy from eBay a
          clean title and a short address, and sorts questions left on it. About {timeLeft(count, null, 'watch')?.replace('about ', '')} while you
          watch. Your eBay listings are not touched.
        </p>
        {sizes.length > 0 && (
          <div className={styles.batch}>
            <span className={styles.fieldLabel} id="batch-label">How many</span>
            <div className={styles.pace} role="group" aria-labelledby="batch-label" aria-describedby="batch-hint">
              {sizes.map((b) => (
                <button key={b} type="button" aria-pressed={take === b} onClick={() => setBatch(b)}>{n(b)}</button>
              ))}
              <button type="button" aria-pressed={take === null} onClick={() => setBatch(null)}>All {n(waiting)}</button>
            </div>
            <span className={styles.fieldHint} id="batch-hint">
              {take ? `The first ${n(take)} to come in. The other ${n(waiting - take)} wait for the next check.` : 'Every draft not checked yet, in the order they came in.'}
            </span>
          </div>
        )}
        <div className={styles.startActions}>
          <button type="button" className={styles.go} data-big disabled={!capOk || Boolean(busy)} onClick={() => go(false)}>
            <Icon name="IconKeeper" className={styles.btnIcon} />
            {busy === 'run' ? 'Starting' : take ? `Check ${plural(take, 'draft')}` : `Check ${waiting === 1 ? 'it' : `all ${plural(waiting, 'draft')}`}`}
          </button>
        </div>

        {studio && (
          <div className={styles.studio}>
            <p className={styles.studioHead}>Studio only</p>
            <div className={styles.startForm}>
              <div className={styles.field}>
                <span className={styles.fieldLabel} id="pace-label">Pace</span>
                <div className={styles.pace} role="group" aria-labelledby="pace-label">
                  {[['watch', 'Watch'], ['normal', 'Normal']].map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={pace === key} onClick={() => setPace(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Spending limit</span>
                <span className={styles.money}>
                  <span aria-hidden="true">£</span>
                  <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} aria-describedby="cap-hint" />
                </span>
                <span className={styles.fieldHint} id="cap-hint">{capOk ? 'It pauses there and asks.' : 'At least £0.50.'}</span>
              </label>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Rehearse, write nothing</span>
                <div className={styles.rehearse}>
                  <button type="button" className={styles.quiet} disabled={!capOk || Boolean(busy)} onClick={() => go(true, 'next')}>
                    {busy === 'rehearsal-next' ? 'Starting' : `Next ${tryOn}`}
                  </button>
                  {last?.rehearsal && (
                    <button type="button" className={styles.quiet} disabled={!capOk || Boolean(busy)} onClick={() => go(true, 'again')}>
                      {busy === 'rehearsal-again' ? 'Starting' : 'The last ones again'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {failed && <p className={styles.error} role="alert">{failed}</p>}
      </div>
    </section>
  );
}
