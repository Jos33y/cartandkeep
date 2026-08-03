import { useMemo, useState } from 'react';
import styles from '@styles/ui/portal/batch-scatter.module.css';

const W = 660;
const H = 320;
const PAD = { top: 18, right: 20, bottom: 44, left: 56 };
const GATE = 4;

// A fine ladder, because powers of ten rounded 101 up to 200 and left half the
// plot empty with every point squashed into the left third.
const LADDER = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceMax(n) {
  if (n <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(n));
  const rel = n / mag;
  return (LADDER.find((s) => s >= rel) ?? 10) * mag;
}

const ticks = (max, count = 4) =>
  Array.from({ length: count + 1 }, (_, i) => (max / count) * i);

export function BatchScatter({ rows }) {
  const [hover, setHover] = useState(null);

  const points = useMemo(
    () => (rows ?? []).filter((r) => r.headroom != null && r.sold_30d != null),
    [rows],
  );

  if (points.length < 2) return null;

  const maxUnits = niceMax(Math.max(...points.map((p) => p.sold_30d)));
  const maxRoom = niceMax(Math.max(...points.map((p) => p.headroom)));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (units) => PAD.left + (units / maxUnits) * plotW;
  const y = (room) => PAD.top + plotH - (room / maxRoom) * plotH;

  const active = points.find((p) => p.id === hover) ?? null;
  const decided = points.filter((p) => p.action).length;

  return (
    <figure className={styles.wrap}>
      <div className={styles.readout} role="status" aria-live="polite">
        {active ? (
          <>
            <span className={styles.readoutTitle}>{active.title}</span>
            <span className={styles.readoutFigures}>
              <span data-num>{active.sold_30d}</span> sold
              {' · '}
              <span data-num>£{active.headroom.toFixed(2)}</span> headroom
              {active.variation_count > 1 && <> · <span data-num>{active.variation_count}</span> variations</>}
            </span>
          </>
        ) : (
          <span className={styles.readoutIdle}>
            Each dot is one candidate. Hover or tap to read it.
          </span>
        )}
      </div>

      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${points.length} candidates plotted by units sold against headroom`}>

        {ticks(maxRoom).map((v) => (
          <g key={`r${v}`}>
            <line className={styles.grid} x1={PAD.left} y1={y(v)} x2={PAD.left + plotW} y2={y(v)} />
            <text className={styles.tick} x={PAD.left - 10} y={y(v) + 4} textAnchor="end">
              £{Math.round(v)}
            </text>
          </g>
        ))}

        {ticks(maxUnits).map((v) => (
          <text key={`u${v}`} className={styles.tick} x={x(v)} y={PAD.top + plotH + 20} textAnchor="middle">
            {Math.round(v)}
          </text>
        ))}

        <line className={styles.axis} x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} />
        <line className={styles.axis} x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} />

        {/* Nothing below this was ever admitted, so the floor is a rule. */}
        <line className={styles.gate} x1={PAD.left} y1={y(GATE)} x2={PAD.left + plotW} y2={y(GATE)} />
        <text className={styles.gateLabel} x={PAD.left + plotW} y={y(GATE) - 7} textAnchor="end">
          £4 floor
        </text>

        <text className={styles.axisLabel} x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle">
          Units sold in the latest month
        </text>

        {points.map((p) => (
          <circle
            key={p.id}
            className={`${styles.dot} ${p.action ? styles.dotDecided : ''} ${hover === p.id ? styles.dotOn : ''}`}
            cx={x(p.sold_30d)}
            cy={y(p.headroom)}
            r={hover === p.id ? 9 : 6}
            tabIndex={0}
            role="button"
            aria-label={`${p.title}, ${p.sold_30d} sold, ${p.headroom.toFixed(2)} pounds headroom`}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.id)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>

      <figcaption className={styles.caption}>
        Headroom against sales for the {points.length} candidates in this batch.
        Top right is where the money and the demand meet.
        {decided > 0 && ' Hollow means already decided.'}
      </figcaption>
    </figure>
  );
}
