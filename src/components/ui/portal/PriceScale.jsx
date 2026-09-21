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
 * The scale is drawn from the quartiles, not from low and high. One £481
 * listing in a dog food market pinned every real price into the first three
 * percent of the track, which is worse than no scale at all.
 */
function domainOf({ market, entry, price }) {
  const p25 = market?.p25;
  const p75 = market?.p75;
  const mid = market?.median;

  let lo;
  let hi;

  if (p25 > 0 && p75 > 0) {
    const spread = Math.max(p75 - p25, p25 * 0.25, 1);
    lo = p25 - spread * 0.7;
    hi = p75 + spread * 0.7;
  } else if (mid > 0) {
    lo = mid * 0.5;
    hi = mid * 1.6;
  } else {
    lo = 0;
    hi = Math.max(price ?? 10, 10) * 1.6;
  }

  // Whatever she has chosen and whoever is actually selling both have to be on
  // the scale, even if they sit outside the body of the field.
  for (const v of [entry?.price, price]) {
    if (v > 0) {
      lo = Math.min(lo, v * 0.92);
      hi = Math.max(hi, v * 1.08);
    }
  }

  return { lo: Math.max(0, lo), hi };
}

export function PriceScale({ market, entry, price, goods, margin, onChange }) {
  const track = useRef(null);
  const [dragging, setDragging] = useState(false);

  const { lo, hi } = useMemo(
    () => domainOf({ market, entry, price }),
    [market, entry, price],
  );

  const at = (v) => (v == null ? null : Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)));
  const from = (x) => Math.round((lo + (x / 100) * (hi - lo)) * 100) / 100;

  const move = (clientX) => {
    const box = track.current?.getBoundingClientRect();
    if (!box) return;
    onChange(from(Math.max(0, Math.min(100, ((clientX - box.left) / box.width) * 100))));
  };

  const keep = keepAt(price, margin, goods);
  const entryKeep = keepAt(entry?.price, margin, goods);
  const step = (n) => onChange(Math.max(0, Math.round((price + n) * 100) / 100));

  // Outside the drawn range rather than clipped to it, so a price beyond the
  // field is visible as beyond the field.
  const outside = market?.high != null && price > market.high;

  return (
    <div className={styles.wrap}>
      <div className={styles.readout}>
        <div className={styles.priceBox}>
          <span className={styles.label}>List at</span>
          <div className={styles.priceRow}>
            <button type="button" className={styles.step} onClick={() => step(-0.5)} aria-label="Lower by 50p">−</button>
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
            <button type="button" className={styles.step} onClick={() => step(0.5)} aria-label="Raise by 50p">+</button>
          </div>
        </div>

        <div className={styles.keepBox}>
          <span className={styles.label}>You keep</span>
          <span className={`figure ${styles.keep} ${keep != null && keep < 0 ? styles.loss : ''}`}>
            {gbp(keep)}
          </span>
          {goods != null && <span className={styles.keepFoot}>after {gbp(goods)} of goods</span>}
        </div>
      </div>

      <div
        className={`${styles.track} ${dragging ? styles.trackOn : ''}`}
        ref={track}
        onPointerDown={(e) => {
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging && move(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        role="slider"
        tabIndex={0}
        aria-label="Listing price"
        aria-valuemin={Math.round(lo)}
        aria-valuemax={Math.round(hi)}
        aria-valuenow={price ?? 0}
        onKeyDown={(e) => {
          const by = e.shiftKey ? 1 : 0.5;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); step(-by); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); step(by); }
        }}
      >
        <span className={styles.rail}>
          {market?.p25 != null && market?.p75 != null && (
            <span className={styles.body}
              style={{ left: `${at(market.p25)}%`, right: `${100 - at(market.p75)}%` }} />
          )}
          {price != null && (
            <span className={styles.fill} style={{ width: `${at(price)}%` }} />
          )}
        </span>

        {market?.median != null && (
          <span className={styles.median} style={{ left: `${at(market.median)}%` }}>
            <span className={styles.tickLabel}>median</span>
          </span>
        )}

        {entry?.price != null && (
          <span className={styles.proof} style={{ left: `${at(entry.price)}%` }} title={`A seller is converting at ${gbp(entry.price)}`} />
        )}

        {price != null && (
          <span className={`${styles.thumb} ${dragging ? styles.thumbOn : ''}`} style={{ left: `${at(price)}%` }}>
            <span className={styles.bubble} data-num>{gbp(price)}</span>
          </span>
        )}
      </div>

      <div className={styles.legend}>
        <span data-num>{gbp(lo)}</span>
        <span className={styles.legendMid}>
          {market?.p25 != null
            ? <>most sell {gbp(market.p25)} to {gbp(market.p75)}</>
            : market?.median != null ? <>median {gbp(market.median)}</> : null}
        </span>
        <span data-num>{gbp(hi)}</span>
      </div>

      {outside && (
        <p className={styles.outside}>
          Above every listing in the sample, the highest of which is {gbp(market.high)}.
        </p>
      )}

      {entry?.price != null && (
        <div className={styles.suggest}>
          <p className={styles.suggestNote}>
            <span className={styles.proofKey} aria-hidden="true" />
            A {entry.seller_feedback} feedback seller is converting at {gbp(entry.price)}
            {entryKeep != null && <>, keeping {gbp(entryKeep)}</>}
          </p>

          <div className={styles.suggestButtons}>
            <button type="button" className={styles.chip} onClick={() => onChange(entry.price)}>Match</button>
            <button type="button" className={styles.chip}
              onClick={() => onChange(Math.max(0, Math.round((entry.price - 1) * 100) / 100))}>
              Undercut £1
            </button>
            {market?.median != null && (
              <button type="button" className={styles.chip} onClick={() => onChange(market.median)}>Median</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
