import { useState } from 'react';
import { VerdictBar } from './VerdictBar';
import { formatGbp } from '@utils/formatGbp';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/ui/portal/candidate-row.module.css';

const VERDICT = { approve: 'Approved', reject: 'Rejected', defer: 'Deferred' };

export function CandidateRow({ candidate, onDecide }) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decision = candidate.decision;
  const m = candidate.margin ?? {};
  const sources = [...new Set((candidate.signals ?? []).map((s) => s.source_id ?? s.sourceId))];

  async function send(action, payload = {}) {
    setBusy(true);
    try {
      await onDecide({ action, ...payload });
      setRejecting(false);
      setReason('');
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${styles.row} ${decision ? styles[decision.action] : ''}`}>
      <div
        className={styles.head}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}
      >
        <p className={`display ${styles.score}`}>
          <span className="visually-hidden">Score </span>{candidate.score ?? candidate.confidence}
        </p>

        <div className={styles.middle}>
          <h3 className={styles.title}>{candidate.title}</h3>
          <p className={styles.meta}>
            <span data-num>{candidate.sold_30d ?? 0}</span> sold
            {candidate.trend != null && <> · trend <span data-num>{Number(candidate.trend).toFixed(2)}</span></>}
            {' · '}<span data-num>{candidate.signal_count}</span> source{candidate.signal_count === 1 ? '' : 's'}
            {candidate.category && <> · {candidate.category}</>}
          </p>
        </div>

        <div className={styles.money}>
          <p className={`figure ${styles.net}`}>{formatGbp(m.net)}</p>
          <p className={styles.pct}>
            {m.net_pct != null ? `${Math.round(m.net_pct * 100)}% net` : 'no margin'}
            {m.cost_source === 'estimated' && <span className={styles.est}> est</span>}
          </p>
        </div>
      </div>

      <VerdictBar breakdown={candidate.breakdown} muted={Boolean(decision)} />

      {open && (
        <div className={styles.detail}>
          <dl className={styles.ledger}>
            <Line label="Sale price" value={formatGbp(m.sale_price)} />
            <Line label="Platform fee" value={`- ${formatGbp(m.platform_fee)}`} />
            {m.ads > 0 && <Line label="Promoted listings" value={`- ${formatGbp(m.ads)}`} />}
            <Line label="Postage" value={`- ${formatGbp(m.postage)}`} sub={m.band?.replace(/_/g, ' ')} />
            <Line label="Packaging" value={`- ${formatGbp(m.packaging)}`} />
            {m.returns_provision > 0 && <Line label="Returns" value={`- ${formatGbp(m.returns_provision)}`} />}
            <Line label="Goods" value={`- ${formatGbp(m.landed_cost)}`} sub={m.cost_source} />
            <Line label="Net" value={formatGbp(m.net)} strong />
          </dl>

          {sources.length > 0 && (
            <p className={styles.sources}>
              <span className="micro">Sources</span> {sources.join(' · ')}
            </p>
          )}

          {candidate.analyst_note && <p className={styles.note}>{candidate.analyst_note}</p>}
        </div>
      )}

      <div className={styles.foot}>
        {decision ? (
          <>
            <span className={styles.verdict} role="status">{VERDICT[decision.action]}</span>
            {decision.reason && (
              <span className={styles.reason}>
                {REJECTION_REASONS.find((r) => r.value === decision.reason)?.label}
              </span>
            )}
            <button className={styles.change} onClick={() => send('defer')} disabled={busy}>
              Change<span className="visually-hidden"> decision for {candidate.title}</span>
            </button>
          </>
        ) : rejecting ? (
          <div className={styles.reject}>
            <select className={styles.select} aria-label="Reason for rejecting"
              value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
              <option value="">Why</option>
              {REJECTION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input className={styles.input} aria-label="Note, optional" placeholder="Note"
              value={note} onChange={(e) => setNote(e.target.value)} />
            <button className={styles.ghost} onClick={() => setRejecting(false)}>Cancel</button>
            <button className={styles.danger} disabled={!reason || busy}
              onClick={() => send('reject', { reason, note: note || null })}>Reject</button>
          </div>
        ) : (
          <>
            <button className={styles.ghost} onClick={() => send('defer')} disabled={busy}>
              Later<span className="visually-hidden"> {candidate.title}</span>
            </button>
            <button className={styles.ghost} onClick={() => setRejecting(true)} disabled={busy}>
              Reject<span className="visually-hidden"> {candidate.title}</span>
            </button>
            <button className={styles.primary} onClick={() => send('approve')} disabled={busy}>
              Approve<span className="visually-hidden"> {candidate.title}</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Line({ label, value, sub, strong }) {
  return (
    <div className={`${styles.line} ${strong ? styles.lineStrong : ''}`}>
      <dt>{label}{sub && <span className={styles.sub}> {sub}</span>}</dt>
      <dd data-num>{value}</dd>
    </div>
  );
}
