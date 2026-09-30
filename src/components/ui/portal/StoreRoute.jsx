import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Tip } from '@components/ui/portal/primitives';
import { StoreFlow } from '@components/ui/portal/StoreFlow';
import { Icon } from '@components/ui/icons';
import { ROWS, readGap, readReason, readSoon } from '@hooks/useStoreCoverage';
import { DROPS, HELD, KINDS, REASONS, STAGES, funnelOf, kindOf, seasonsOf } from '@lib/storeCoverage';
import { formatGbp } from '@utils/formatGbp';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/coverage-page.module.css';

/*
 * Coverage for the Google best sellers route: the season chips, the flow, the products to list before winter, and
 * why the rest stopped. Counts come from the summary; a reason's products are read only when it is opened.
 */

const n = (v) => Number(v).toLocaleString('en-GB');
const cardLink = (id) => portalPath(`/candidates?card=${id}`);
const BRANDS = 24;

function priceOf(p) {
  if (p.google_min == null) return null;
  if (p.google_max == null || p.google_max === p.google_min) return formatGbp(p.google_min);
  return `${formatGbp(p.google_min)} to ${formatGbp(p.google_max)}`;
}

function Product({ p }) {
  const bits = [p.brand, p.rank != null ? `rank ${n(p.rank)}` : null, priceOf(p),
    p.shop && p.cost != null ? `${p.shop} ${formatGbp(p.cost)}` : p.shop].filter(Boolean);
  const body = (
    <span className={styles.productText}>
      <span className={styles.itemName}>{p.title}</span>
      <span className={styles.itemFigure} data-num>{bits.join(' · ')}</span>
    </span>
  );
  return (
    <li className={`${styles.item} ${styles.product}`}>
      {p.candidate_id
        ? <Link to={cardLink(p.candidate_id)} className={styles.itemLink}>{body}<Icon name="IconCaret" className={styles.itemGo} /></Link>
        : body}
    </li>
  );
}

// One reason opened: the brands for the gap, the products for everything else, more on request.
function ReasonDetail({ code, batchIds, season, total }) {
  const [state, setState] = useState({ status: 'loading', rows: [], more: false });
  const [shown, setShown] = useState(BRANDS);
  const gap = code === 'not_seen';
  const stage = REASONS[code].stage;

  useEffect(() => {
    let live = true;
    setShown(BRANDS);
    setState({ status: 'loading', rows: [], more: false });
    const read = gap
      ? readGap({ batchIds, season })
      : readReason({ batchIds, stage, reason: code === HELD ? null : code, season });
    read.then((rows) => live && setState({ status: 'ready', rows, more: !gap && rows.length === ROWS }))
      .catch(() => live && setState({ status: 'error', rows: [], more: false }));
    return () => { live = false; };
  }, [code, batchIds, season, gap, stage]);

  const more = async () => {
    setState((s) => ({ ...s, status: 'more' }));
    try {
      const next = await readReason({ batchIds, stage, reason: code === HELD ? null : code, season, from: state.rows.length });
      setState((s) => ({ status: 'ready', rows: [...s.rows, ...next], more: next.length === ROWS }));
    } catch {
      setState((s) => ({ ...s, status: 'ready' }));
    }
  };

  return (
    <div className={styles.detail}>
      <p className={styles.detailTip}>{REASONS[code].tip}</p>
      {state.status === 'loading' && <p className={styles.detailWait}>Reading the products</p>}
      {state.status === 'error' && <p className={styles.detailWait} role="alert">These did not load. Close and open it again.</p>}

      {gap && state.status === 'ready' && (
        <>
          <p className={styles.gapHead}>Brands with the most best sellers no shop on file stocks</p>
          <ul className={styles.brands}>
            {state.rows.slice(0, shown).map((b) => (
              <li key={b.brand || 'none'} className={styles.brand}>
                <span className={styles.itemName}>{b.brand || 'No brand given'}</span>
                <span className={styles.brandCount} data-num>{n(b.unseen)}</span>
                <span className={styles.itemFigure} data-num>{b.best != null ? `best rank ${n(b.best)}` : ''}</span>
              </li>
            ))}
          </ul>
          {state.rows.length > shown && (
            <button type="button" className={styles.more} onClick={() => setShown((v) => v + BRANDS)}>
              More brands <span data-num>{n(state.rows.length - shown)}</span>
            </button>
          )}
        </>
      )}

      {!gap && state.rows.length > 0 && (
        <>
          <ul className={styles.items}>{state.rows.map((p) => <Product key={p.id} p={p} />)}</ul>
          {state.more && (
            <button type="button" className={styles.more} onClick={more} disabled={state.status === 'more'}>
              {state.status === 'more' ? 'Reading' : 'Show more'} <span data-num>{n(total - state.rows.length)}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function StoreRoute({ status, summary, candidates, batchIds, cards }) {
  const [season, setSeason] = useState(null);
  const [open, setOpen] = useState(null);
  const [soon, setSoon] = useState([]);
  const idsKey = batchIds.join(',');
  const ids = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey]);

  const seasons = useMemo(() => seasonsOf(summary), [summary]);
  const { values, drops, byReason, twice } = useMemo(() => funnelOf(summary, season), [summary, season]);

  useEffect(() => { setOpen(null); }, [idsKey, season]);
  useEffect(() => {
    if (season && !seasons.some((s) => s.key === season)) setSeason(null);
  }, [seasons, season]);

  useEffect(() => {
    let live = true;
    if (status !== 'ready' || !ids.length) { setSoon([]); return undefined; }
    readSoon({ batchIds: ids }).then((r) => live && setSoon(r)).catch(() => live && setSoon([]));
    return () => { live = false; };
  }, [status, ids]);

  const decisions = useMemo(() => {
    const has = (c, a) => !c.ebay && c.decision?.action === a;
    return [
      { key: 'approved', label: 'Approved', value: candidates.filter((c) => c.decision?.action === 'approve').length },
      { key: 'pending', label: 'Waiting for your review', value: candidates.filter((c) => !c.decision).length },
      { key: 'defer', label: 'Saved for later', value: candidates.filter((c) => has(c, 'defer')).length },
      { key: 'reject', label: 'Rejected', value: candidates.filter((c) => has(c, 'reject')).length },
    ];
  }, [candidates]);

  // Why the rest stopped, stage by stage, largest reason first inside each.
  const groups = useMemo(() => STAGES.filter((s) => s.drop).map((s) => ({
    key: s.drop,
    ...DROPS[s.drop],
    reasons: Object.entries(REASONS)
      .filter(([k, r]) => r.stage === s.drop && byReason[k] > 0)
      .map(([k, r]) => ({ key: k, ...r, count: byReason[k] }))
      .sort((a, b) => b.count - a.count),
  })).filter((g) => g.reasons.length), [byReason]);
  const widest = Math.max(1, ...groups.flatMap((g) => g.reasons.map((r) => r.count)));
  const stopped = values.ranked - values.sent;
  const soonCount = summary.filter((r) => r.stage === 'sent' && ['Winter', 'Christmas'].includes(r.season))
    .reduce((t, r) => t + r.products, 0);

  const pick = (stageKey) => {
    const first = groups.find((g) => g.key === stageKey)?.reasons[0]?.key;
    if (!first) return;
    setOpen(first);
    requestAnimationFrame(() => document.getElementById(`reason-${first}`)
      ?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };

  if (status === 'absent' || (status === 'ready' && !summary.length)) {
    return (
      <div className={`card ${styles.blank}`}>
        <span className={styles.blankIcon}><Icon name="IconMap" className={styles.blankGlyph} /></span>
        <p className={styles.blankTitle}>The route for these is on its way</p>
        <p className={styles.blankBody}>
          Every best seller Google ranked, and where each one stopped, shows here after the next store import.
          {cards > 0 && <> Your {n(cards)} cards from Google best sellers are already in <Link to={portalPath('/candidates')}>Candidates</Link>.</>}
        </p>
      </div>
    );
  }

  const funnel = [
    ...STAGES.map((s) => ({ key: s.key, label: s.label, value: values[s.key], tip: s.tip })),
    { key: 'approved', label: 'Approved', value: decisions[0].value, to: '/approved' },
  ];

  return (
    <>
      {seasons.length > 1 && (
        <div className={styles.seasons} role="group" aria-label="Season">
          <span className={styles.seasonsLabel}>
            Season
            <Tip>When a product sells, from the months Google exported. Until October to December is exported, most read All year, and that is correct.</Tip>
          </span>
          <button type="button" aria-pressed={!season} className={`${styles.chip} ${!season ? styles.chipOn : ''}`} onClick={() => setSeason(null)}>
            Every season <span className={styles.chipCount} data-num>{n(seasons.reduce((s, x) => s + x.count, 0))}</span>
          </button>
          {seasons.map((s) => (
            <button key={s.key} type="button" aria-pressed={season === s.key}
              className={`${styles.chip} ${season === s.key ? styles.chipOn : ''}`} onClick={() => setSeason(s.key)}>
              {s.key} <span className={styles.chipCount} data-num>{n(s.count)}</span>
            </button>
          ))}
        </div>
      )}

      <section className={`card ${styles.flowCard}`} aria-label="Where every ranked product went">
        <StoreFlow values={values} drops={drops} twice={twice} decisions={decisions} onPick={pick} />
      </section>

      <section className={styles.funnel} aria-label="From ranked to approved">
        {funnel.map((s, i) => {
          const prev = funnel[i - 1]?.value;
          const share = funnel[0].value ? s.value / funnel[0].value : 0;
          const body = (
            <>
              <span className={styles.stageLabel}>{s.label}{s.tip && <Tip side={i > 2 ? 'end' : undefined}>{s.tip}</Tip>}</span>
              <span className={`display ${styles.stageValue}`}>{n(s.value)}</span>
              {s.key === 'sent' && s.value > 0 && <span className={styles.stageNote}>{n(twice)} ranked in 2 or more months</span>}
              <span className={styles.stageBar}><span style={{ width: `${Math.max(share * 100, s.value ? 1.5 : 0)}%` }} /></span>
            </>
          );
          return (
            <div key={s.key} className={styles.stage} data-stage={s.key}>
              {i > 0 && <span className={styles.ratio} data-num>{prev ? `${Math.round((s.value / prev) * 100)}%` : 'None'}</span>}
              {s.to
                ? <Link to={portalPath(s.to)} className={`${styles.stageBody} ${styles.stageLink}`}>{body}</Link>
                : <div className={styles.stageBody}>{body}</div>}
            </div>
          );
        })}
      </section>

      {soon.length > 0 && (
        <section className={`card ${styles.soon}`} aria-labelledby="soon-title">
          <header className={styles.soonHead}>
            <Icon name="IconClock" className={styles.soonIcon} />
            <h2 id="soon-title" className={styles.whyTitle}>List these by late October</h2>
            <span className={styles.whyCount} data-num>{n(soonCount)}</span>
          </header>
          <p className={styles.detailTip}>Winter and Christmas best sellers that reached you. They sell from November, so they need to be live before then.</p>
          <ul className={styles.items}>
            {soon.map((p) => <Product key={p.id} p={{ ...p, brand: [p.season, p.brand].filter(Boolean).join(', ') }} />)}
          </ul>
          {soonCount > soon.length && <p className={styles.detailWait}>The {n(soon.length)} best ranked. The rest are in Candidates.</p>}
        </section>
      )}

      {groups.length > 0 && (
        <section className={styles.why} aria-labelledby="why-store-title">
          <header className={styles.whyHead}>
            <h2 id="why-store-title" className={styles.whyTitle}>Why the rest stopped</h2>
            <span className={styles.whyCount} data-num>{n(stopped)}</span>
            <span className={styles.key}>
              {Object.entries(KINDS).map(([k, label]) => <span key={k}><i data-kind={k} />{label}</span>)}
            </span>
          </header>

          <div className={styles.reasons}>
            {groups.map((g) => (
              <div key={g.key} className={styles.group}>
                <p className={styles.groupHead}>
                  <span>{g.title}</span>
                  <span data-num>{n(drops[g.key])}</span>
                </p>
                <ul className={styles.groupList}>
                  {g.reasons.map((r) => (
                    <li key={r.key} id={`reason-${r.key}`} className={`${styles.reason} ${open === r.key ? styles.reasonOpen : ''}`}>
                      <button type="button" className={styles.reasonRow} aria-expanded={open === r.key}
                        onClick={() => setOpen((v) => (v === r.key ? null : r.key))}>
                        <span className={styles.reasonLabel}>{r.label}</span>
                        <span className={styles.reasonBar}>
                          <span style={{ width: `${(r.count / widest) * 100}%` }} data-kind={kindOf(r.key)} />
                        </span>
                        <span className={styles.reasonCount} data-num>{n(r.count)}</span>
                        <Icon name="IconCaret" className={styles.caret} />
                      </button>
                      {open === r.key && <ReasonDetail code={r.key} batchIds={ids} season={season} total={r.count} />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
