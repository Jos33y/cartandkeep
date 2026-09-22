import { useMemo } from 'react';
import { formatGbp } from '@utils/formatGbp';
import { keepAt, priceFor } from '@lib/assess';
import styles from '@styles/ui/portal/price-field.module.css';

const W = 900;
const H = 268;
const L = 54;
const R = 24;
const TOP = 34;
const CURVE_H = 118;
const STRIP = 205;
const AXIS = 252;

const gbp = (v) => formatGbp(Math.round(v * 100) / 100);

// Quartiles set the scale; one listing at ten times the median would flatten it.
function domainOf(market, points) {
  const { p25, p75, median } = market ?? {};
  let lo;
  let hi;
  if (p25 > 0 && p75 > 0) {
    const spread = Math.max(p75 - p25, p25 * 0.3, 2);
    lo = p25 - spread;
    hi = p75 + spread;
  } else if (median > 0) {
    lo = median * 0.5;
    hi = median * 1.7;
  } else {
    lo = 0;
    hi = 25;
  }
  for (const v of points) {
    if (v > 0) {
      lo = Math.min(lo, v * 0.92);
      hi = Math.max(hi, v * 1.08);
    }
  }
  return { lo: Math.max(0, lo), hi };
}

function ticks(lo, hi) {
  const step = [1, 2, 5, 10, 20, 50].find((s) => (hi - lo) / s <= 8) ?? 100;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

export function PriceField({ market, entry, price, goods, margin, target = 0, ceiling }) {
  const listings = (market?.listings ?? []).filter((l) => Number(l.price) > 0);

  const { lo, hi, breakEven, floor, X, Y, curve } = useMemo(() => {
    const even = priceFor(0, margin, goods);
    const pays = priceFor(target, margin, goods);
    const d = domainOf(market, [price, entry?.price, even, pays, market?.median]);
    const x = (v) => L + ((v - d.lo) / (d.hi - d.lo)) * (W - L - R);

    const top = Math.max(keepAt(d.hi, margin, goods) ?? 1, target + 1);
    const bottom = Math.min(keepAt(d.lo, margin, goods) ?? -1, -1);
    const y = (v) => TOP + ((top - v) / (top - bottom)) * CURVE_H;

    return {
      ...d,
      breakEven: even,
      floor: pays,
      X: x,
      Y: y,
      curve: `M${x(d.lo)},${y(keepAt(d.lo, margin, goods))} L${x(d.hi)},${y(keepAt(d.hi, margin, goods))}`,
    };
  }, [market, entry, price, goods, margin, target]);

  const inField = (v) => v != null && v >= lo && v <= hi;
  const width = (a, b) => Math.max(0, X(Math.min(b, hi)) - X(Math.max(a, lo)));
  const keep = keepAt(price, margin, goods);
  const outside = listings.filter((l) => l.price < lo || l.price > hi).length;
  const selling = listings.filter((l) => l.per_month > 0).length;
  const most = Math.max(...listings.map((l) => l.per_month ?? 0), 1);
  const rFor = (v) => (v > 0 ? 5 + Math.sqrt(v / most) * 13 : 4);
  // No text measurement in SVG before paint, so the flag is sized off the string.
  const flagW = 22 + 6.6 * (`Listed at ${gbp(price)}${keep != null ? ` keeps ${gbp(keep)}` : ''}`).length;

  return (
    <figure className={styles.field}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
        aria-label={`Listed at ${gbp(price)}, keeping ${gbp(keep ?? 0)}. ${listings.length} listings sampled, ${selling} of them selling.`}>
        <defs>
          <clipPath id="priceFieldPlot">
            <rect x={L} y={TOP} width={W - L - R} height={CURVE_H} />
          </clipPath>
        </defs>
        {goods != null && (
          <>
            <rect className={styles.zLoss} x={X(lo)} y={TOP} width={width(lo, breakEven)} height={CURVE_H} />
            <rect className={styles.zThin} x={X(Math.max(lo, breakEven))} y={TOP} width={width(breakEven, floor)} height={CURVE_H} />
            <rect className={styles.zPays} x={X(Math.max(lo, floor))} y={TOP} width={width(floor, hi)} height={CURVE_H} />
            {width(lo, breakEven) > 70 && <text className={styles.zText} x={X(lo) + 10} y={TOP + 16}>Loses money</text>}
            {width(breakEven, floor) > 70 && <text className={styles.zText} x={X(breakEven) + 10} y={TOP + 16}>Under {gbp(target)}</text>}
            {width(floor, hi) > 70 && <text className={`${styles.zText} ${styles.zPaysText}`} x={X(Math.max(lo, floor)) + 10} y={TOP + 16}>Pays</text>}
          </>
        )}

        <line className={styles.zero} x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} />
        <text className={styles.axisText} x={L - 8} y={Y(0) + 4} textAnchor="end">£0</text>
        {target > 0 && <line className={styles.targetLine} x1={L} x2={W - R} y1={Y(target)} y2={Y(target)} />}

        {goods != null && <path className={styles.curve} d={curve} clipPath="url(#priceFieldPlot)" />}
        <text className={styles.curveLabel} transform={`translate(16, ${TOP + CURVE_H / 2}) rotate(-90)`} textAnchor="middle">What you keep a sale</text>

        <text className={styles.stripLabel} x={L} y={STRIP - 32}>Listings on this search, sized by sales a month</text>
        <line className={styles.stripLine} x1={L} x2={W - R} y1={STRIP} y2={STRIP} />

        {listings.map((l, i) => inField(l.price) && (
          <circle key={`${l.price}-${i}`} cx={X(l.price)} cy={STRIP} r={rFor(l.per_month)}
            className={`${styles.bubble} ${l.feedback != null && ceiling != null && l.feedback <= ceiling ? styles.small : ''} ${l.per_month > 0 ? '' : styles.quiet}`}
            style={{ animationDelay: `${i * 45}ms` }}>
            <title>
              {`${gbp(l.price)}, ${l.per_month > 0 ? `${l.per_month} a month` : 'no sales'}`
                + `${l.feedback != null ? `, ${l.feedback.toLocaleString('en-GB')} feedback seller` : ''}`}
            </title>
          </circle>
        ))}

        {inField(price) && (
          <g className={styles.here}>
            <line x1={X(price)} x2={X(price)} y1={TOP} y2={STRIP + 26} />
            {keep != null && <circle cx={X(price)} cy={Y(keep)} r="5" />}
            <g transform={`translate(${X(price)}, ${TOP - 8})`}>
              <rect className={styles.flag} x={-flagW / 2} y={-18} width={flagW} height="22" rx="4" />
              <text className={styles.flagText} x="0" y="-3" textAnchor="middle">
                {`Listed at ${gbp(price)}`}
                {keep != null && <tspan className={styles.flagKeep} dx="6">{`keeps ${gbp(keep)}`}</tspan>}
              </text>
            </g>
          </g>
        )}

        {ticks(lo, hi).map((v) => (
          <text key={v} className={styles.axisText} x={X(v)} y={AXIS} textAnchor="middle">{gbp(v)}</text>
        ))}
      </svg>

      <figcaption className={styles.key}>
        <span><i className={`${styles.dot} ${styles.small}`} />Small seller</span>
        <span><i className={styles.dot} />Large account</span>
        <span><i className={`${styles.dot} ${styles.quiet}`} />Not selling</span>
        {goods != null && <span>Pays from <b>{gbp(floor)}</b> with goods at {gbp(goods)}</span>}
        {outside > 0 && <span className={styles.faint}>{outside} priced off this scale</span>}
      </figcaption>
    </figure>
  );
}
