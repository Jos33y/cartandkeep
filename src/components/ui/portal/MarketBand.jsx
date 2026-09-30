import { PriceTag } from './PriceTag';
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

/*
 * The market on top, what she keeps at each of those prices underneath, and her price as a kraft tag whose string
 * drops through both rails. `scale` holds the points the scale was first drawn for, so trying a cost moves the tag
 * rather than redrawing the rails under it. `ghost` is where the tag would hang at a cost that lists in the market.
 */
export function MarketBand({
  market, entry, price, keep, breakEven, floor, target, ghost = null, scale = null, listings = [], medianListed = null,
  sellsLabel = 'Where it sells', bodyLabel = 'half of all listed', medianLabel = 'median of those selling',
}) {
  const { lo, hi } = domainOf(market, [...(scale ?? [entry?.price, breakEven, floor]), price, ghost?.price]);
  const at = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));

  const loss = breakEven != null ? at(breakEven) : null;
  const thin = floor != null ? at(floor) : null;
  const short = keep != null && keep < (target ?? 0);
  const x = price != null ? at(price) : null;

  return (
    <figure className={styles.band} data-ghost={ghost?.price != null || undefined}>
      <div className={styles.lanes}>
        <span className={styles.laneLabel}>{sellsLabel}</span>
        <div className={styles.rail}>
          {market?.p25 != null && market?.p75 != null && (
            <span className={styles.body}
              style={{ left: `${at(market.p25)}%`, width: `${Math.max(0.5, at(market.p75) - at(market.p25))}%` }}
              title={`${bodyLabel[0].toUpperCase()}${bodyLabel.slice(1)}: ${formatGbp(market.p25)} to ${formatGbp(market.p75)}`} />
          )}
          {listings.map((l, i) => (
            <a key={l.item_id ?? i} className={styles.dot} data-sold={Number(l.sold) > 0 || undefined}
              href={l.url} target="_blank" rel="noreferrer noopener"
              style={{ left: `${at(Number(l.price))}%` }}
              title={`${formatGbp(l.price)}${Number(l.sold) > 0 ? `, ${l.sold} sold` : ', none sold'}${l.title ? `: ${l.title}` : ''}`}
              aria-label={`Listing at ${formatGbp(l.price)}`} />
          ))}
          {market?.median != null && (
            <span className={styles.median} style={{ left: `${at(market.median)}%` }}
              title={`${medianLabel[0].toUpperCase()}${medianLabel.slice(1)}: ${formatGbp(market.median)}`} />
          )}
          {entry?.price != null && (
            <span className={`${styles.seller} ${entry.proved ? styles.sellerProved : ''}`}
              style={{ left: `${at(entry.price)}%` }}
              title={`${Number(entry.seller_feedback).toLocaleString('en-GB')} feedback seller at ${formatGbp(entry.price)}`} />
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

        <span className={styles.overlay} aria-hidden="true">
          {x != null && (
            <span className={styles.list} style={{ left: `${x}%` }}>
              <span className={styles.tagAt} data-flip={x > 62 || undefined}>
                <PriceTag price={price} size="big" flip={x > 62}
                  note={keep != null ? `${keep < 0 ? 'loses' : 'keeps'} ${formatGbp(Math.abs(keep))}` : null} />
              </span>
              <span className={styles.string} />
              <span className={`${styles.knob} ${short ? styles.short : ''}`} />
            </span>
          )}
          {ghost?.price != null && (
            <span className={styles.ghost} style={{ left: `${at(ghost.price)}%` }}>
              <span className={styles.ghostAt} data-flip={at(ghost.price) > 62 || undefined}>
                <PriceTag price={ghost.price} tone="ghost" flip={at(ghost.price) > 62} note={ghost.note} />
              </span>
            </span>
          )}
        </span>
      </div>

      {/* The ends of the scale, with anything the scale leaves off said at the end it falls past. */}
      <div className={styles.axis}>
        <span><span data-num>{formatGbp(lo)}</span>{market?.low != null && market.low < lo && <span className={styles.clipped}>, lowest <span data-num>{formatGbp(market.low)}</span> off the scale</span>}</span>
        <span><span data-num>{formatGbp(hi)}</span>{market?.high != null && market.high > hi && <span className={styles.clipped}>, highest <span data-num>{formatGbp(market.high)}</span> off the scale</span>}</span>
      </div>

      {/*
       * Three lines at most: the market, the seller who proves it, and where it pays. Each listing dot carries its own
       * price and sales on hover, so the dots need no line of their own.
       */}
      <figcaption className={styles.key}>
        {market?.p25 != null && market?.p75 != null && (
          <span className={styles.keyItem}>
            <i className={styles.keyBody} />{bodyLabel} <b data-num>{formatGbp(market.p25)}</b> to <b data-num>{formatGbp(market.p75)}</b>
            {market?.median != null && <>, <i className={styles.keyMedian} />{medianLabel} <b data-num>{formatGbp(market.median)}</b></>}
            {medianListed != null && <span className={styles.clipped}> (all listed <span data-num>{formatGbp(medianListed)}</span>)</span>}
          </span>
        )}
        {entry?.price != null && (
          <span className={styles.keyItem}>
            <i className={`${styles.keyDot} ${entry.proved ? styles.sellerProved : ''}`} />
            {entry.proved ? 'small seller selling' : 'smallest seller seen'} <b data-num>{formatGbp(entry.price)}</b>
          </span>
        )}
        {breakEven != null && (
          <span className={styles.keyItem}>
            <i className={styles.keyPays} />loses under <b data-num>{formatGbp(breakEven)}</b>
            {target != null && floor != null && <>, your {formatGbp(target)} profit from <b data-num>{formatGbp(floor)}</b></>}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
