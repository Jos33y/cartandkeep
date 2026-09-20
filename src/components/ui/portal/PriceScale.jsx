import { useMemo, useRef, useState } from 'react';
import styles from '@styles/ui/portal/price-scale.module.css';

const gbp = (v) => (v == null ? '--'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v));

// Fees, postage, packaging and returns come off; the shelf price comes off after.
export function keepAt(price, margin, goods) {
  const r = margin?.rates;
  if (!r || price == null) return null;
  const net = price * (1 - r.fvf - r.ad)
    - r.fixed
    - Number(margin.postage ?? 0)
    - Number(margin.packaging ?? 0)
    - Number(margin.returns_allowance ?? 0)
    - Number(goods ?? 0);
  return Math.round(net * 100) / 100;
}

/*
 * The market, and where her price sits in it.
 *
 * A single sale_price hid the thing that decides whether anything sells: the
 * one seller her size who is actually moving units, and what they charge. The
 * median is the middle of everybody listed, including the ones selling nothing,
 * so pricing at it means pricing above everyone who is selling.
 */
export function PriceScale({ market, entry, price, goods, margin, onChange }) {
  const track = useRef(null);
  const [dragging, setDragging] = useState(false);

  // A little air either side, so a price at the edge is still grabbable.
  const { lo, hi } = useMemo(() => {
    const all = [market?.low, market?.high, entry?.price, price].filter((v) => v > 0);
    if (!all.length) return { lo: 0, hi: 1 };
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.12, 1);
    return { lo: Math.max(0, min - pad), hi: max + pad };
  }, [market, entry, price]);

  const at = (v) => (v == null ? null : ((v - lo) / (hi - lo)) * 100);
  const from = (pctX) => Math.round((lo + (pctX / 100) * (hi - lo)) * 100) / 100;

  const move = (clientX) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    onChange(from(Math.max(0, Math.min(100, ((clientX - box.left) / box.width) * 100))));
  };

  const keep = keepAt(price, margin, goods);
  const entryKeep = keepAt(entry?.price, margin, goods);

  return (
    <div className={styles.wrap}>
      <div className={styles.readout}>
        <div>
          <p className={styles.label}>List at</p>
          <div className={styles.priceRow}>
            <span className={styles.currency}>£</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={price ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="Listing price"
            />
          </div>
        </div>

        <div className={styles.keepBox}>
          <p className={styles.label}>You keep</p>
          <p className={`figure ${styles.keep} ${keep != null && keep < 0 ? styles.loss : ''}`}>
            {gbp(keep)}
          </p>
        </div>
      </div>

      <div
        className={styles.track}
        ref={track}
        onPointerDown={(e) => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
        onPointerMove={(e) => dragging && move(e.clientX)}
        onPointerUp={() => setDragging(false)}
        role="slider"
        tabIndex={0}
        aria-label="Listing price"
        aria-valuemin={Math.round(lo)}
        aria-valuemax={Math.round(hi)}
        aria-valuenow={price ?? 0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 1 : 0.5;
          if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.round((price - step) * 100) / 100); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.round((price + step) * 100) / 100); }
        }}
      >
        <span className={styles.rail} />

        {/* Where most of the field sits. Outside it is a price nobody is
            charging, which is worth seeing before choosing one. */}
        {market?.p25 != null && market?.p75 != null && (
          <span
            className={styles.body}
            style={{ left: `${at(market.p25)}%`, width: `${at(market.p75) - at(market.p25)}%` }}
          />
        )}

        {market?.median != null && (
          <span className={styles.median} style={{ left: `${at(market.median)}%` }} />
        )}

        {/* The only price on the scale somebody her size has been paid. */}
        {entry?.price != null && (
          <span className={styles.proof} style={{ left: `${at(entry.price)}%` }}>
            <span className={styles.proofDot} />
          </span>
        )}

        {price != null && (
          <span
            className={`${styles.handle} ${dragging ? styles.handleOn : ''}`}
            style={{ left: `${at(price)}%` }}
          />
        )}
      </div>

      <div className={styles.legend}>
        <span>{gbp(market?.low)}</span>
        <span className={styles.legendMid}>
          {market?.p25 != null && `most sell ${gbp(market.p25)} to ${gbp(market.p75)}`}
        </span>
        <span>{gbp(market?.high)}</span>
      </div>

      {entry?.price != null && (
        <div className={styles.suggest}>
          <p className={styles.suggestNote}>
            <span className={styles.proofKey} aria-hidden="true" />
            A {entry.seller_feedback} feedback seller is selling at {gbp(entry.price)}
            {entryKeep != null && <>, which keeps {gbp(entryKeep)}</>}
          </p>

          <div className={styles.suggestButtons}>
            <button type="button" className={styles.chip} onClick={() => onChange(entry.price)}>
              Match it
            </button>
            <button type="button" className={styles.chip}
              onClick={() => onChange(Math.max(0, Math.round((entry.price - 1) * 100) / 100))}>
              Undercut by £1
            </button>
            {market?.median != null && (
              <button type="button" className={styles.chip} onClick={() => onChange(market.median)}>
                Market median
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
