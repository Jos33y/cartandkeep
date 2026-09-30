import { useState } from 'react';
import { DROPS, STAGES } from '@lib/storeCoverage';
import styles from '@styles/ui/portal/coverage-flow.module.css';

/*
 * The Google best sellers route as one trunk, left to right: ranked, worth a look, stocked, page checked, sent.
 * At each step the products that stopped fall away below in the colour of whose limit stopped them, and Sent opens
 * out into your decisions on the right, as the eBay flow does.
 */

const W = 1120;
const X = [16, 200, 384, 568, 752];
const ZOOM = 900;
const NODE = 10;
const TOP = 62;
const TRUNK = 120;
const DROP_Y = TOP + TRUNK + 40;
const MIN = 3;
const n = (v) => Number(v).toLocaleString('en-GB');

function ribbon(x0, a0, b0, x1, a1, b1) {
  const m = (x0 + x1) / 2;
  return `M${x0},${a0} C${m},${a0} ${m},${a1} ${x1},${a1} L${x1},${b1} C${m},${b1} ${m},${b0} ${x0},${b0} Z`;
}

export function StoreFlow({ values, drops, twice, decisions, onPick }) {
  const [hover, setHover] = useState(null);
  const total = values.ranked || 1;
  const scale = TRUNK / total;
  const h = (v) => (v > 0 ? Math.max(MIN, v * scale) : 0);

  const trunk = STAGES.map((s, i) => ({ ...s, x: X[i], v: values[s.key], h: h(values[s.key]) }));
  const falls = trunk.slice(1).map((s, i) => {
    const from = trunk[i];
    const d = DROPS[s.drop];
    return { key: s.drop, ...d, v: drops[s.drop] ?? 0, from, x: from.x + 72, a0: TOP + s.h, b0: TOP + from.h, h: h(drops[s.drop] ?? 0) };
  }).filter((f) => f.v > 0);

  const sent = trunk.at(-1);
  const sentTotal = decisions.reduce((s, d) => s + d.value, 0);
  const zoomH = 150;
  const zScale = sentTotal ? zoomH / sentTotal : 0;
  let zy = TOP;
  let ly = -Infinity;
  const zoom = decisions.filter((d) => d.value > 0).map((d) => {
    const seg = { ...d, y: zy, h: Math.max(MIN, d.value * zScale) };
    seg.ly = Math.max(ly + 18, seg.y + Math.min(seg.h, 28) / 2 + 4);
    ly = seg.ly;
    zy += seg.h + 2;
    return seg;
  });

  const tallest = Math.max(50, ...falls.map((f) => f.h));
  const H = Math.max(DROP_Y + tallest, Math.max(DROP_Y, ly + 16) + 38, DROP_Y + 50) + 8;
  const dim = (k) => hover && hover !== k;

  return (
    <svg className={styles.flow} viewBox={`0 0 ${W} ${H}`} role="img" onPointerLeave={() => setHover(null)}
      aria-label={`${n(values.ranked)} ranked on Google, ${n(values.worth)} worth a look, ${n(values.stocked)} stocked by a UK shop, ${n(values.checked)} page checked, ${n(values.sent)} sent to you.`}>
      {trunk.slice(1).map((s, i) => (
        <path key={`t-${s.key}`} className={styles.linkPassed}
          d={ribbon(trunk[i].x + NODE, TOP, TOP + s.h, s.x, TOP, TOP + s.h)} />
      ))}

      {falls.map((f, i) => (
        <path key={`f-${f.key}`} className={`${styles.link} ${styles[f.kind]} ${dim(f.key) ? styles.dim : ''}`}
          style={{ animationDelay: `${80 + i * 40}ms` }}
          d={ribbon(f.from.x + NODE, f.a0, f.b0, f.x, DROP_Y, DROP_Y + f.h)}
          onPointerEnter={() => setHover(f.key)} onPointerLeave={() => setHover(null)} />
      ))}

      {sent.v > 0 && sentTotal > 0 && (
        <path className={styles.lens} d={ribbon(sent.x + NODE, TOP, TOP + sent.h, ZOOM, TOP, zy - 2)} />
      )}

      {trunk.map((s, i) => (
        <g key={s.key}>
          <rect className={i === trunk.length - 1 ? styles.node_sent : styles.nodePassed}
            x={s.x} y={TOP} width={NODE} height={Math.max(s.h, 1)} rx="2" />
          <text className={`${styles.halo} ${i === trunk.length - 1 ? styles.strong : ''}`} x={s.x} y={18}>{s.label}</text>
          <text className={styles.stageValue} x={s.x} y={44}>{n(s.v)}</text>
        </g>
      ))}

      {falls.map((f) => (
        <g key={`n-${f.key}`} className={`${styles.outcome} ${dim(f.key) ? styles.dim : ''}`} role="button" tabIndex={0}
          aria-label={`${f.label}, ${n(f.v)}. Show the reasons.`}
          onPointerEnter={() => setHover(f.key)} onPointerLeave={() => setHover(null)}
          onClick={() => { setHover(null); onPick?.(f.key); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(f.key); } }}>
          <rect className={styles.hit} x={f.x - 4} y={DROP_Y - 4} width="132" height={Math.max(f.h, 42) + 8} />
          <rect className={styles[`node_${f.kind}`]} x={f.x} y={DROP_Y} width={NODE} height={f.h} rx="2" />
          <text className={styles.halo} x={f.x + NODE + 8} y={DROP_Y + 12}>{f.label}</text>
          <text className={`${styles.halo} ${styles.num}`} x={f.x + NODE + 8} y={DROP_Y + 30}>{n(f.v)}</text>
        </g>
      ))}

      {sent.v > 0 && (
        <g>
          <text className={styles.halo} x={ZOOM} y={Math.max(DROP_Y, ly + 16) + 12}>Ranked in 2 or more months</text>
          <text className={`${styles.halo} ${styles.num}`} x={ZOOM} y={Math.max(DROP_Y, ly + 16) + 30}>
            {n(twice)}<tspan dx="6">of {n(sent.v)}</tspan>
          </text>
        </g>
      )}

      {zoom.map((z) => (
        <g key={z.key}>
          <rect className={styles[`zoom_${z.key}`]} x={ZOOM} y={z.y} width="14" height={z.h} rx="2" />
          <text className={styles.halo} x={ZOOM + 22} y={z.ly}>
            {z.label}<tspan className={styles.num} dx="8">{n(z.value)}</tspan>
          </text>
        </g>
      ))}
      {sentTotal > 0 && (
        <text className={styles.zoomTitle} x={ZOOM} y={TOP - 12}>Your {n(sentTotal)} cards</text>
      )}
    </svg>
  );
}
