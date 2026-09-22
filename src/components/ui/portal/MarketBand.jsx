import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/market-band.module.css';

// Quartiles, not low and high: one outlier would squash the scale.
function domainOf(market, points) {
  const { p25, p75, median } = market ?? {};
  let lo;
  let hi;

  if (p25 > 0 && p75 > 0) {
    const spread = Math.max(p75 - p25, p25 * 0.25, 1);
    lo = p25 - spread * 0.8;
    hi = p75 + spread * 0.8;
  } else if (median > 0) {
    lo = median * 0.5;
    hi = median * 1.6;
  } else {
    lo = 0;
    hi = 20;
  }

  for (const v of points) {
    if (v > 0) {
      lo = Math.min(lo, v * 0.9);
      hi = Math.max(hi, v * 1.08);
    }
  }

  return { lo: Math.max(0, lo), hi };
}

export function MarketBand({ market, entry, price, keep, breakEven, floor, target }) {
  const { lo, hi } = domainOf(market, [entry?.price, price, breakEven, floor]);
  const at = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

  const loss = breakEven != null ? at(breakEven) : null;
  const thin = floor != null ? at(floor) : null;
  const clipped = [
    market?.low != null && market.low < lo && `lowest ${formatGbp(market.low)}`,
    market?.high != null && market.high > hi && `highest ${formatGbp(market.high)}`,
  ].filter(Boolean);

  return (
    <figure className={styles.band}>
      <div className={styles.lanes}>
        <span className={styles.laneLabel}>Where it sells</span>
        <div className={styles.rail}>
          {market?.p25 != null && market?.p75 != null && (
            <span className={styles.body}
              style={{ left: `${at(market.p25)}%`, width: `${at(market.p75) - at(market.p25)}%` }}
              title={`Half the listings sit between ${formatGbp(market.p25)} and ${formatGbp(market.p75)}`} />
          )}
          {market?.median != null && (
            <span className={styles.median} style={{ left: `${at(market.median)}%` }}
              title={`Median ${formatGbp(market.median)}`} />
          )}
          {entry?.price != null && (
            <span className={`${styles.seller} ${entry.proved ? styles.sellerProved : ''}`}
              style={{ left: `${at(entry.price)}%` }}
              title={`${entry.seller_feedback.toLocaleString('en-GB')} feedback seller converting at ${formatGbp(entry.price)}`} />
          )}
        </div>

        <span className={styles.laneLabel}>Where it pays</span>
        <div className={`${styles.rail} ${styles.pays}`}>
          {loss != null ? (
            <>
              <span className={styles.loss} style={{ width: `${loss}%` }} />
              <span className={styles.thin} style={{ left: `${loss}%`, width: `${Math.max(0, thin - loss)}%` }} />
              <span className={styles.gain} style={{ left: `${thin}%`, right: 0 }} />
            </>
          ) : (
            <span className={styles.unknown}>No goods cost yet</span>
          )}
        </div>

        {price != null && (
          <span className={styles.overlay} aria-hidden="true">
          <span className={`${styles.knob} ${keep != null && keep < (target ?? 0) ? styles.short : ''}`}
            style={{ left: `${at(price)}%` }} />
          <span className={styles.list} style={{ left: `${at(price)}%` }}>
            <span className={styles.flag}>
              <span className={styles.flagPrice} data-num>{formatGbp(price)}</span>
              {keep != null && (
                <span className={`${styles.flagKeep} ${keep < (target ?? 0) ? styles.flagShort : ''}`}>
                  keeps <span data-num>{formatGbp(keep)}</span>
                </span>
              )}
            </span>
          </span>
          </span>
        )}
      </div>

      <div className={styles.axis} data-num>
        <span>{formatGbp(lo)}</span>
        <span>{formatGbp(hi)}</span>
      </div>

      <figcaption className={styles.key}>
        <span className={styles.keyItem}><i className={styles.keyBody} />half of listings</span>
        {entry?.price != null && (
          <span className={styles.keyItem}>
            <i className={`${styles.keyDot} ${entry.proved ? styles.sellerProved : ''}`} />
            smallest seller converting
          </span>
        )}
        {breakEven != null && (
          <>
            <span className={styles.keyItem}><i className={styles.keyLoss} />loses money under <b data-num>{formatGbp(breakEven)}</b></span>
            {target != null && (
              <span className={styles.keyItem}><i className={styles.keyGain} />keeps {formatGbp(target)} from <b data-num>{formatGbp(floor)}</b></span>
            )}
          </>
        )}
        {clipped.length > 0 && <span className={styles.clipped}>Off the scale: {clipped.join(', ')}</span>}
      </figcaption>
    </figure>
  );
}
