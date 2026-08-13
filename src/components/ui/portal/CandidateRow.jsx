import { useState } from 'react';
import { VerdictBar, VerdictLegend } from './VerdictBar';
import { MarketSummary, MarketScale } from './MarketLine';
import { WindowSeries } from './WindowSeries';
import { ImageLightbox } from './ImageLightbox';
import { SourceList } from './SourceList';
import { formatGbp } from '@utils/formatGbp';
import { breadcrumb } from '@utils/category';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/ui/portal/candidate-row.module.css';

// A button that says Later produces a state that says Later.
const VERDICT = { approve: 'Approved', reject: 'Rejected', defer: 'Saved for later' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

// A few sizes of one bed is a normal listing. A few hundred is a catalogue, and
// only then is the average price a blend worth warning about.
const BLENDED = 10;

// Windows are calendar months, so "sold in July" is truer than "sold in 30 days".
function windowName(candidate) {
  const w = candidate.window_series?.at(-1)?.window
    ?? (candidate.window_start ? candidate.window_start.slice(0, 7) : null);
  if (!w) return null;
  return MONTHS[Number(w.split('-')[1]) - 1] ?? null;
}

export function CandidateRow({ candidate, onDecide, onClear, onNote, onSource, suppliers }) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const decision = candidate.decision;
  const m = candidate.margin ?? {};
  const sources = [...new Set((candidate.signals ?? []).map((s) => s.source_id ?? s.sourceId))];

  // Net needs a supplier quote. Until one exists the row shows headroom and
  // says so, rather than printing a profit figure with no cost behind it.
  const quoted = m.net != null;
  const headroom = candidate.headroom ?? m.headroom ?? null;
  const month = windowName(candidate);

  // A score needs components behind it. On a batch with one window there is no
  // trend, no sell-through and no competition read, so the analysis writes none
  // and the bar has nothing to draw.
  const score = candidate.score ?? null;
  const scored = Object.keys(candidate.breakdown ?? {}).length > 0;

  // What it would be worth in a month at the going rate, before goods cost.
  const worth = candidate.monthly_headroom
    ?? (headroom != null && candidate.sold_30d != null ? headroom * candidate.sold_30d : null);

  // A failed write used to disappear, leaving the row looking decided until the
  // next reload put it back.
  async function run(fn) {
    setBusy(true);
    setFailed(null);
    try {
      await fn();
      setRejecting(false);
      setReason('');
      setNote('');
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const send = (action, payload = {}) => run(() => onDecide({ action, ...payload }));

  return (
    <article className={`${styles.row} ${decision ? styles[decision.action] : ''} ${open ? styles.rowOpen : ''}`}>
      {zoomed && (
        <ImageLightbox src={candidate.image_url} alt={candidate.title} onClose={() => setZoomed(false)} />
      )}

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
        {candidate.image_url ? (
          <button
            className={styles.thumb}
            onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
            aria-label={`View ${candidate.title} larger`}
          >
            <img src={thumb(candidate.image_url)} alt="" loading="lazy" />
            <span className={styles.zoom} aria-hidden="true">View</span>
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <div className={styles.middle}>
          <h3 className={styles.title}>{candidate.title}</h3>
          <p className={styles.meta}>
            <span data-num>{candidate.sold_30d ?? 0}</span> sold{month ? ` in ${month}` : ''}
            {candidate.same_sku_sellers != null && (
              <> · <span data-num>{candidate.same_sku_sellers}</span> seller{candidate.same_sku_sellers === 1 ? '' : 's'} on this product</>
            )}
            {candidate.classification && candidate.classification !== 'unknown' && (
              <> · {candidate.classification}</>
            )}
            {candidate.tier === 'slipping' && candidate.hold != null && (
              <> · <span className={styles.flagInline}>
                slipping, <span data-num>{Math.round(Number(candidate.hold) * 100)}%</span> of its own average
              </span></>
            )}
            {candidate.bulky && <> · <span className={styles.flagInline}>bulky</span></>}
            {candidate.variation_count > 1 && (
              <> · <span className={candidate.variation_count >= BLENDED ? styles.flagInline : undefined}>
                <span data-num>{candidate.variation_count}</span> variations
              </span></>
            )}
          </p>
        </div>

        <div className={styles.money}>
          <p className={`figure ${styles.net}`}>
            {quoted ? formatGbp(m.net) : (headroom != null ? formatGbp(headroom) : 'no figure')}
          </p>
          <p className={styles.pct}>
            {quoted
              ? (m.net_pct != null ? `${Math.round(m.net_pct * 100)}% net` : 'net')
              : 'headroom'}
            {m.cost_source === 'estimated' && <span className={styles.est}> est</span>}
          </p>
          {m.sale_price != null && (
            <p className={styles.outOf}>out of <span data-num>{formatGbp(m.sale_price)}</span></p>
          )}
        </div>

        <span className={styles.caret} aria-hidden="true" data-open={open || undefined}>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </span>
      </div>

      {/* The bar and the actions share a line. Apart they were two full-width
          rows each carrying about a third of a row of content. */}
      <div className={`${styles.control} ${styles.aligned} ${rejecting ? styles.controlWrap : ''}`}>
        {/* The score next to the bar that explains it, rather than a numeral on
            the far side of the row with nothing tying the two together.
            Absent where nothing computed it: a null rendered as a zero reads as
            a product that scored nothing, which is a worse claim than silence.
            In its place the figure that does hold on this batch. */}
        {score != null ? (
          <p className={styles.score}>
            <span className={styles.scoreLabel}>Score</span>
            <span className={styles.scoreValue} data-num>{score}</span>
          </p>
        ) : worth != null ? (
          <p className={styles.score}>
            <span className={styles.scoreLabel}>A month before goods</span>
            <span className={styles.scoreValue} data-num>{formatGbp(worth)}</span>
            <span className={styles.scoreFoot}>
              {candidate.sold_30d} sold at {formatGbp(headroom)}
            </span>
          </p>
        ) : null}

        <div className={styles.barSlot}>
          {scored
            ? <VerdictBar breakdown={candidate.breakdown} muted={Boolean(decision)} />
            : <MarketSummary candidate={candidate} />}
        </div>

        <div className={`${styles.foot} ${decision ? styles.footSettled : ''}`}>
          {decision ? (
            <>
              <span className={styles.verdict} role="status">{VERDICT[decision.action]}</span>
              {decision.reason && (
                <span className={styles.reason}>
                  {REJECTION_REASONS.find((r) => r.value === decision.reason)?.label}
                </span>
              )}
              <button className={styles.change} onClick={() => run(onClear)} disabled={busy}>
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
      </div>

      {failed && <p className={`${styles.failed} ${styles.aligned}`} role="alert">{failed}</p>}

      {open && (
        <div className={`${styles.detail} ${styles.aligned}`}>
          <dl className={styles.ledger}>
            <Line label="Sale price" value={formatGbp(m.sale_price)} />

            {quoted ? (
              <>
                <Line label="Platform fee" value={`- ${formatGbp(m.platform_fee)}`} />
                {m.ads > 0 && <Line label="Promoted listings" value={`- ${formatGbp(m.ads)}`} />}
                <Line label="Postage" value={`- ${formatGbp(m.postage)}`} sub={m.band?.replace(/_/g, ' ')} />
                <Line label="Packaging" value={`- ${formatGbp(m.packaging)}`} />
                {m.returns_provision > 0 && <Line label="Returns" value={`- ${formatGbp(m.returns_provision)}`} />}
                <Line label="Goods" value={`- ${formatGbp(m.landed_cost)}`} sub={m.cost_source} />
                <Line label="Net" value={formatGbp(m.net)} strong />
              </>
            ) : (
              <>
                {m.platform_fee != null ? (
                  <>
                    <Line label="eBay fee" value={`- ${formatGbp(m.platform_fee)}`} />
                    {m.ads > 0 && <Line label="Promoted listings" value={`- ${formatGbp(m.ads)}`} />}
                    <Line label="Postage" value={`- ${formatGbp(m.postage)}`}
                      sub={(m.headroom_band ?? 'small_parcel').replace(/_/g, ' ')} />
                    <Line label="Packaging" value={`- ${formatGbp(m.packaging)}`} />
                  </>
                ) : (
                  <Line
                    label="Cost to sell"
                    value={m.cost_to_sell != null ? `- ${formatGbp(m.cost_to_sell)}` : 'not computed'}
                    sub={`fees, postage, packaging, ${(m.headroom_band ?? 'small_parcel').replace(/_/g, ' ')}`}
                  />
                )}
                <Line label="Headroom" value={headroom != null ? formatGbp(headroom) : 'no figure'} strong />
                <Line label="Goods" value="not quoted" sub="awaiting supplier" />
              </>
            )}

            {candidate.ebay_category_id && (
              <Line
                label="eBay category"
                value={breadcrumb(candidate.ebay_category_path) || candidate.ebay_category_id}
                sub={candidate.ebay_category_id}
              />
            )}
          </dl>

          {scored && (
            <div className={styles.legendWrap}>
              <p className="micro">What the bar is made of</p>
              <VerdictLegend breakdown={candidate.breakdown} />
            </div>
          )}

          {candidate.tier === 'slipping' && (
            <p className={styles.flag}>
              This one sold in every window we measured and is still selling, but the
              latest month is below its own average, so it is not one to buy stock in
              today. It is here because a product that dipped can come back, and you
              may know why this one dipped.
            </p>
          )}

          {candidate.variation_count >= BLENDED && (
            <p className={styles.flag}>
              The listing behind these figures carries {candidate.variation_count} variations.
              The sold count covers all of them and the price is an average across
              whichever sold, so treat the money here as a blend rather than a
              per-unit figure.
            </p>
          )}

          {candidate.bulky && (
            <p className={styles.flag}>
              Costed as a small parcel at £3.65. This one is bulky, so the real
              band is a medium parcel at £5.55 or a courier above that, and the
              headroom above is a ceiling rather than a figure. Confirm the size
              and weight with the supplier before pricing it.
            </p>
          )}

          <MarketScale candidate={candidate} />

          <WindowSeries series={candidate.window_series} />

          {candidate.reference_url && (
            <p className={styles.reference}>
              <a href={candidate.reference_url} target="_blank" rel="noreferrer noopener">
                The listing these figures came from
              </a>
            </p>
          )}

          {sources.length > 0 && (
            <p className={styles.sources}>
              <span className="micro">Sources</span> {sources.join(' · ')}
            </p>
          )}

          {candidate.analyst_note && <p className={styles.note}>{candidate.analyst_note}</p>}

          <SourceList candidate={candidate} onAdd={onSource} suppliers={suppliers} />

          <div className={styles.notes}>
            <p className="micro">Notes</p>

            {(candidate.notes ?? []).map((n) => (
              <p key={n.id} className={styles.noteItem}>
                <span className={styles.noteWhen} data-num>
                  {new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/London', day: 'numeric', month: 'short',
                  }).format(new Date(n.created_at))}
                </span>
                {n.body}
              </p>
            ))}

            <div className={styles.noteAdd}>
              <input
                className={styles.input}
                aria-label={`Add a note about ${candidate.title}`}
                placeholder="Supplier lead, a size question, something to check"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && noteDraft.trim()) {
                    e.preventDefault();
                    run(async () => { await onNote(noteDraft); setNoteDraft(''); });
                  }
                }}
              />
              <button
                className={styles.ghost}
                disabled={!noteDraft.trim() || busy}
                onClick={() => run(async () => { await onNote(noteDraft); setNoteDraft(''); })}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
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
