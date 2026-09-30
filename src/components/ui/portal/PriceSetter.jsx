import { useMemo } from 'react';
import { MarketBand } from './MarketBand';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/price-setter.module.css';

const r2 = (v) => Math.round(v * 100) / 100;

/*
 * Her price, set by hand or from the market, drawn on the same chart the queue uses: the kraft tag moves along the
 * rails as she types, and what she keeps moves with it. The scale is fixed on the figures it opened with, so the rails
 * stay put and only the tag travels.
 */
export function PriceSetter({ a, market, listings = [], medianLabel, onChange }) {
  const store = Boolean(a.store);
  const entry = store ? null : a.entry;
  const g = a.g ?? {};
  const band = store
    ? (g.min != null ? { p25: g.min, p75: g.max ?? g.min, low: g.min, high: g.max } : null)
    : market;
  // Opened once: the scale, so it does not follow the price.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scale = useMemo(() => [entry?.price, a.price, a.breakEven, a.floor, a.position?.ref], []);
  const step = (n) => onChange(Math.max(0, r2((a.price ?? 0) + n)));

  const chips = [
    !store && entry?.price != null && { key: 'match', label: 'Match the seller', at: entry.price },
    !store && entry?.price != null && { key: 'under', label: 'Undercut £1', at: Math.max(0, r2(entry.price - 1)) },
    !store && market?.median != null && { key: 'median', label: 'Median', at: market.median },
    store && g.min != null && { key: 'low', label: 'Google\'s lowest', at: g.min },
    a.floor != null && { key: 'floor', label: 'Your floor', at: a.floor },
  ].filter(Boolean);

  return (
    <div className={styles.setter}>
      <div className={styles.head}>
        <label className={styles.priceBox}>
          <span className={styles.label}>List at</span>
          <span className={styles.priceRow}>
            <button type="button" className={styles.step} onClick={() => step(-0.5)} aria-label="Lower by 50p">
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" /></svg>
            </button>
            <span className={styles.currency} aria-hidden="true">£</span>
            <input className={styles.input} type="number" step="0.01" min="0" inputMode="decimal" data-num
              value={a.price ?? ''} aria-label="Listing price"
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
            <button type="button" className={styles.step} onClick={() => step(0.5)} aria-label="Raise by 50p">
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6 2.5v7" /></svg>
            </button>
          </span>
        </label>
        <div className={styles.keepBox} data-tone={a.keep == null ? undefined : a.keep < 0 ? 'negative' : a.target != null && a.keep < a.target ? 'warning' : 'positive'}>
          <span className={styles.label}>You keep</span>
          <span className={styles.keep} data-num>{a.keep != null ? formatGbp(a.keep) : '--'}</span>
          <span className={styles.keepFoot}>
            {a.keep == null ? 'no cost yet'
              : a.keep < 0 ? 'loses money at this price'
                : a.target != null && a.keep < a.target ? `under your ${formatGbp(a.target)} profit`
                  : a.target == null || a.keep - a.target < 0.01 ? `your ${formatGbp(a.target ?? a.keep)} profit` : `${formatGbp(a.keep - a.target)} above your ${formatGbp(a.target)} profit`}
          </span>
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Set the price to">
          {chips.map((c) => (
            <button key={c.key} type="button" className={styles.chip} data-on={a.price != null && Math.abs(a.price - c.at) < 0.005 || undefined}
              onClick={() => onChange(r2(c.at))}>
              {c.label} <span data-num>{formatGbp(c.at)}</span>
            </button>
          ))}
        </div>
      )}

      <MarketBand
        market={band}
        entry={entry}
        listings={listings}
        sellsLabel={store ? 'On Google' : 'Where it sells'}
        bodyLabel={store ? "Google's price range" : 'half of all listed'}
        medianLabel={medianLabel}
        price={a.price} keep={a.keep} breakEven={a.breakEven} floor={a.floor} target={a.target}
        scale={scale} />
    </div>
  );
}
