import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { useKeeperRun } from '@hooks/useKeeperRun';
import { useAccount } from '@hooks/useAccount';
import { PRODUCT_SELECT, isReady } from '@hooks/useCatalogue';
import { SELLABLE, TRAYS, pounds, timeLeft, trayOf } from '@lib/keeper';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/keeper-page.module.css';

/*
 * Keeper's office (keeper-task-01-shop-drafts.md): the in-tray of drafts, the one on the desk, the stamp, and the
 * out-trays filling. Every movement is a job changing state on the server; nothing here is staged.
 */

const n = (v) => Number(v ?? 0).toLocaleString('en-GB');
const plural = (count, one, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;
const photoOf = (p, job) => job?.result?.image ?? p?.image_url ?? (Array.isArray(p?.images) ? p.images[0] : null) ?? null;
const small = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l140.') : null);
const productUrl = (id) => portalPath(`/products?open=${id}`);
const trayMeta = (key) => TRAYS.find((t) => t.key === key) ?? null;
// Where Keeper is with the draft in hand, as the server writes it (keeper-check.ts). The photos step happens only
// for a chemical or an unclear product, so it is shown as passed over when Keeper goes straight to writing.
const PHASES = [['words', 'Reading the title and description'], ['photos', 'Looking at the photographs'], ['writing', 'Writing it up']];

// Keeper's mark: the shop's stamp with a K. It tilts while reading, presses down on a verdict.
function Stamp({ state = 'idle', size = 56, tone = null }) {
  return (
    <span className={styles.stamp} data-state={state} data-tone={tone || undefined} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <circle cx="32" cy="32" r="26" fill="currentColor" fillOpacity={state === 'stamped' ? 0.08 : 0} stroke="currentColor" strokeWidth="3.4" />
        <circle cx="32" cy="32" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray={state === 'reading' ? '2.2 3.4' : undefined} />
        <path d="M25 19 L25 45 M40 19 L26.5 33.5 M31 29 L41 45" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      </svg>
    </span>
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
  const agent = tenant?.store?.agent?.name || 'Keeper';
  const k = useKeeperRun(tenant?.id);
  const { isStudio } = useAccount();
  const { run, jobs, products, totals, waiting } = k;

  if (tenant === undefined || run === undefined) return <PageSkeleton rows={5} />;

  const live = Boolean(run && (run.state === 'running' || run.state === 'paused'));
  return (
    <div className={styles.page} data-wide>
      <Header agent={agent} run={run} live={live} totals={totals} studio={isStudio} />
      {k.error && <p className={styles.error} role="alert">{k.error}</p>}
      {live
        ? <Floor agent={agent} run={run} jobs={jobs} products={products} totals={totals} onSet={k.set} studio={isStudio} />
        : (
          <>
            {run && <Report agent={agent} run={run} jobs={jobs} products={products} totals={totals} tenantId={tenant?.id} onDone={k.reload} studio={isStudio} />}
            <Start agent={agent} waiting={waiting} last={run} onStart={k.start} studio={isStudio} />
          </>
        )}
    </div>
  );
}

function Header({ agent, run, live, totals, studio }) {
  const total = run?.total ?? 0;
  return (
    <header className={styles.head}>
      <div className={styles.titleBlock}>
        <Stamp state={live && run.state === 'running' ? (totals.working ? 'reading' : 'idle') : 'idle'} size={52} />
        <div>
          <p className="micro">{agent} at work</p>
          <h1 className={styles.title}>Checking your shop drafts</h1>
          <p className={styles.sub}>Returns, label warnings and a clean shop title for each draft. Nothing goes on sale until you say so.</p>
        </div>
      </div>
      {live && (
        <dl className={styles.stats}>
          <div className={styles.stat}>
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

  const log = (only ? landed.filter((j) => trayOf(j) === only) : landed).slice(0, only ? 60 : 14);
  const phase = inHand?.result?.phase ?? 'words';
  const at = Math.max(0, PHASES.findIndex(([key]) => key === phase));

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

      <div className={styles.meter} role="img" aria-label={`${n(totals.done)} of ${n(total)} checked`}>
        {TRAYS.map((t) => (
          <span key={t.key} data-tone={t.tone} style={{ width: `${(totals.trays[t.key] / total) * 100}%` }} />
        ))}
        <span data-tone="skipped" style={{ width: `${(totals.skipped / total) * 100}%` }} />
      </div>

      <div className={styles.floor}>
        <section className={styles.inTray} aria-label="In-tray">
          <h2 className={styles.colHead}>In-tray <span data-num>{n(queued.length)}</span></h2>
          <ol className={styles.pile}>
            {queued.slice(0, 7).map((j, i) => {
              const q = products.get(j.product_id);
              return (
                <li key={j.id} className={styles.pileItem} style={{ '--i': i }}>
                  <Thumb url={photoOf(q, j)} size="sm" />
                  <span className={styles.pileName}>{q?.title ?? 'A draft'}</span>
                </li>
              );
            })}
          </ol>
          {queued.length > 7 && <p className={styles.more}>and {n(queued.length - 7)} more</p>}
          {!queued.length && <p className={styles.more}>Empty. {totals.working ? 'Finishing the last one.' : ''}</p>}
        </section>

        <section className={styles.desk} aria-label="On the desk" aria-live="polite">
          {onDesk ? (
            <article key={onDesk.id + (justDone ? ':done' : '')} className={styles.paper} data-phase={justDone ? 'stamped' : 'reading'}>
              <div className={styles.paperTop}>
                <Thumb url={photoOf(p, onDesk)} size="lg" />
                <div className={styles.paperText}>
                  <p className={styles.paperKicker}>{justDone ? 'Just checked' : `${agent} is reading`}</p>
                  <h2 className={styles.paperTitle}>{justDone?.result?.title ?? p?.title ?? 'A draft'}</h2>
                  {justDone?.result?.title && justDone.result.title_before && (
                    <p className={styles.was}>Was: {justDone.result.title_before}</p>
                  )}
                </div>
              </div>
              {justDone ? (
                <div className={styles.verdict} data-tone={meta?.tone}>
                  <Stamp state="stamped" size={44} tone={meta?.tone} />
                  <div>
                    <p className={styles.verdictLabel}>{meta?.label ?? 'Checked'}</p>
                    <p className={styles.verdictLine}>{justDone.state === 'failed' ? `Could not read it: ${justDone.error ?? 'try again'}` : justDone.result?.line}</p>
                  </div>
                </div>
              ) : (
                <div className={styles.reading}>
                  <Stamp state="reading" size={44} />
                  <ol className={styles.steps}>
                    {PHASES.map(([key, label], i) => (
                      <li key={key} data-state={i < at ? (key === 'photos' && phase === 'writing' && !inHand?.result?.read_photos ? 'skipped' : 'done') : i === at ? 'now' : 'next'}>{label}</li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          ) : (
            <div className={styles.emptyDesk}>
              <Stamp state="idle" size={44} />
              <p>{run.state === 'paused' ? 'Paused.' : 'Picking up the next draft.'}</p>
            </div>
          )}
        </section>

        <section className={styles.trays} aria-label="Out-trays">
          <h2 className={styles.colHead}>Out-trays</h2>
          {TRAYS.map((t) => {
            const inTray = landed.filter((j) => trayOf(j) === t.key);
            return (
              <button key={t.key} type="button" className={styles.tray} data-tone={t.tone} aria-pressed={only === t.key}
                onClick={() => setOnly(only === t.key ? null : t.key)}>
                <span className={styles.trayStack} aria-hidden="true">
                  {inTray.slice(0, 3).map((j, i) => <span key={j.id} style={{ '--i': i }}><Thumb url={photoOf(products.get(j.product_id), j)} size="xs" /></span>)}
                </span>
                <span className={styles.trayText}>
                  <span className={styles.trayLabel}>{t.label}</span>
                  <span className={styles.trayHint}>{t.hint}</span>
                </span>
                <span className={styles.trayCount} data-num>{n(totals.trays[t.key])}</span>
              </button>
            );
          })}
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

function LogLine({ job, product }) {
  const meta = trayMeta(trayOf(job));
  return (
    <li className={styles.line} data-tone={meta?.tone}>
      <Stamp state="stamped" size={26} tone={meta?.tone} />
      <div className={styles.lineText}>
        <p className={styles.lineHead}>
          <span className={styles.lineName}>{job.result?.title ?? product?.title ?? 'A draft'}</span>
          <span className={styles.chip} data-tone={meta?.tone}>{meta?.label ?? 'Checked'}</span>
        </p>
        <p className={styles.lineWhy}>{job.state === 'failed' ? `Could not read it: ${job.error ?? 'try again'}` : job.result?.line}</p>
      </div>
      <Link className={styles.open} to={productUrl(job.product_id)}>Open<span className="visually-hidden"> {product?.title}</span></Link>
    </li>
  );
}

// After a run: what landed where, and the one action each tray needs from you.
function Report({ agent, run, jobs, products, totals, tenantId, onDone, studio }) {
  const readyIds = useMemo(() => jobs.filter((j) => SELLABLE.includes(trayOf(j))).map((j) => j.product_id), [jobs]);
  const [eligible, setEligible] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(null);
  const [showing, setShowing] = useState(null);
  const asked = useRef('');

  // Of the ready tray, the drafts the shop's own release check lets go on sale now.
  useEffect(() => {
    const key = readyIds.join(',');
    if (run.rehearsal || !readyIds.length || asked.current === key) return;
    asked.current = key;
    (async () => {
      const rows = [];
      for (let i = 0; i < readyIds.length; i += 200) {
        const { data } = await supabase.from('store_products').select(PRODUCT_SELECT).in('id', readyIds.slice(i, i + 200));
        rows.push(...(data ?? []));
      }
      setEligible(rows.filter(isReady).map((r) => r.id));
    })();
  }, [readyIds, run.rehearsal]);

  async function putOnSale() {
    setBusy(true);
    setSaid(null);
    try {
      for (let i = 0; i < eligible.length; i += 200) {
        const { error } = await supabase.from('store_products').update({ status: 'live', is_sample: false })
          .eq('tenant_id', tenantId).eq('status', 'draft').in('id', eligible.slice(i, i + 200));
        if (error) throw error;
      }
      setSaid(`${plural(eligible.length, 'product')} on sale now.`);
      setEligible([]);
      setConfirm(false);
      onDone?.();
    } catch (e) {
      setSaid(`That did not finish: ${e?.message ?? 'try again'}.`);
    } finally {
      setBusy(false);
    }
  }

  const t = totals.trays;
  const stopped = run.state === 'stopped';
  const lines = [
    { key: 'ready', count: t.ready, text: run.rehearsal ? 'would be ready for sale' : 'ready for sale' },
    { key: 'label', count: t.label, text: run.rehearsal ? 'would have their label warnings added' : 'with their label warnings added, ready too' },
    { key: 'choose', count: t.choose, text: 'need you: already on the shop, a returns call, or something only you can add' },
    { key: 'unread', count: t.unread, text: run.rehearsal ? 'could not be read' : 'could not be read: the next check tries them again' },
  ].filter((l) => l.count > 0);
  const inTray = (key) => jobs.filter((j) => trayOf(j) === key);
  const unread = t.unread ?? 0;

  return (
    <section className={styles.report} aria-label="The last check">
      <div className={styles.reportHead}>
        <Stamp state="stamped" size={44} />
        <div>
          <p className="micro">{run.rehearsal ? 'Rehearsal finished' : stopped ? 'Stopped' : 'Finished'}</p>
          <h2 className={styles.reportTitle}>
            {agent} {run.rehearsal ? 'would have checked' : 'checked'} {plural(totals.done - unread, 'draft')}{stopped ? ` of ${n(run.total)}` : ''}{studio ? ` for ${pounds(run.spent_pence)}` : ''}.
          </h2>
          {run.rehearsal && <p className={styles.sub}>Nothing was written. Start for real to apply it.</p>}
        </div>
      </div>
      <ul className={styles.reportLines}>
        {lines.map((l) => {
          const meta = trayMeta(l.key);
          return (
            <li key={l.key} data-tone={meta.tone}>
              <div className={styles.reportLine}>
                <span className={styles.reportCount} data-num>{n(l.count)}</span>
                <span className={styles.reportText}>{l.text}</span>
                <button type="button" className={styles.link} aria-expanded={showing === l.key} onClick={() => setShowing(showing === l.key ? null : l.key)}>
                  {showing === l.key ? 'Hide' : 'Show them'}
                </button>
              </div>
              {showing === l.key && (
                <ol className={styles.lines}>
                  {inTray(l.key).map((j) => <LogLine key={j.id} job={j} product={products.get(j.product_id)} />)}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.reportActions}>
        {!run.rehearsal && eligible && eligible.length > 0 && !confirm && (
          <button type="button" className={styles.go} onClick={() => setConfirm(true)}>Put {n(eligible.length)} on sale</button>
        )}
        {confirm && (
          <span className={styles.confirm} role="group" aria-label="Put on sale">
            <span>{plural(eligible.length, 'product')} go live on your shop now.</span>
            <button type="button" className={styles.go} disabled={busy} onClick={putOnSale}>{busy ? 'Putting on sale' : 'Put on sale'}</button>
            <button type="button" className={styles.link} disabled={busy} onClick={() => setConfirm(false)}>Not now</button>
          </span>
        )}
        {!run.rehearsal && eligible && readyIds.length > eligible.length && (
          <p className={styles.more}>{plural(readyIds.length - eligible.length, 'checked draft')} changed since, and {readyIds.length - eligible.length === 1 ? 'needs' : 'need'} a look on Products first.</p>
        )}
        {said && <p className={styles.more} role="status">{said}</p>}
      </div>
    </section>
  );
}

function Start({ agent, waiting, last, onStart, studio }) {
  const [pace, setPace] = useState('watch');
  const [cap, setCap] = useState('5.00');
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);

  if (waiting === null) return null;
  if (!waiting) {
    return <p className={styles.allDone}><Icon name="IconCheck" className={styles.noticeIcon} />Every draft has been checked. New copies from eBay are checked as they arrive.</p>;
  }
  // The studio sets the limit; for her it is worked out: about twice what a draft has been costing, never under £5.
  const capPence = studio ? Math.round(Number(String(cap).replace(/[£,\s]/g, '')) * 100) : Math.max(500, Math.ceil(waiting * 3.2));
  const capOk = Number.isFinite(capPence) && capPence >= 50;
  const tryOn = Math.min(5, waiting);

  async function go(rehearsal) {
    setBusy(rehearsal ? 'rehearsal' : 'run');
    setFailed(null);
    try { await onStart({ pace: studio ? pace : 'watch', capPence, rehearsal, limit: rehearsal ? 5 : null }); } catch (e) { setFailed(e?.message ?? 'That did not start.'); } finally { setBusy(null); }
  }

  return (
    <section className={styles.start} aria-label="Start a check">
      <h2 className={styles.startTitle}>{last && !last.rehearsal ? `Check the rest: ${plural(waiting, 'draft')}` : `${plural(waiting, 'draft')} to check`}</h2>
      <p className={styles.startBody}>
        {agent} reads each draft, sets its returns, puts a chemical&apos;s label warnings on the page when it can read
        them, gives each copy from eBay a clean shop title and a short address, and sorts questions left on it earlier.
        Your eBay listings are not touched, and nothing goes on sale until you say so.
      </p>
      {studio && (
      <div className={styles.startForm}>
        <div className={styles.field}>
          <span className={styles.fieldLabel} id="pace-label">Pace</span>
          <div className={styles.pace} role="group" aria-labelledby="pace-label">
            {[['watch', 'Watch'], ['normal', 'Normal']].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={pace === key} onClick={() => setPace(key)}>{label}</button>
            ))}
          </div>
          <span className={styles.fieldHint}>{pace === 'watch' ? `One at a time, so you can watch: ${timeLeft(waiting, null, 'watch')}` : `Three at a time: ${timeLeft(waiting, null, 'normal')}`}</span>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Spending limit</span>
          <span className={styles.money}>
            <span aria-hidden="true">£</span>
            <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} aria-describedby="cap-hint" />
          </span>
          <span className={styles.fieldHint} id="cap-hint">{capOk ? 'It pauses there and asks before going on.' : 'At least £0.50.'}</span>
        </label>
      </div>
      )}
      <div className={styles.startActions}>
        <button type="button" className={styles.go} disabled={!capOk || Boolean(busy)} onClick={() => go(false)}>
          {busy === 'run' ? 'Starting' : `Start checking ${plural(waiting, 'draft')}`}
        </button>
        {studio && (
          <button type="button" className={styles.quiet} disabled={!capOk || Boolean(busy)} onClick={() => go(true)}>
            {busy === 'rehearsal' ? 'Starting' : `Rehearse on ${tryOn}, write nothing`}
          </button>
        )}
      </div>
      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </section>
  );
}
