import { useMemo, useState } from 'react';
import styles from '@styles/ui/portal/coverage-flow.module.css';

const W = 1040;
const H = 420;
const TOP = 28;
const NODE = 10;
const GAP = 10;
const MIN = 3;
const X = { checked: 150, split: 380, outcome: 590, zoom: 830 };

const OURS = ['held_back', 'no_buy_price', 'duplicate'];
const n = (v) => Number(v).toLocaleString('en-GB');

function ribbon(x0, a0, b0, x1, a1, b1) {
  const m = (x0 + x1) / 2;
  return `M${x0},${a0} C${m},${a0} ${m},${a1} ${x1},${a1} L${x1},${b1} C${m},${b1} ${m},${b0} ${x0},${b0} Z`;
}

export function CoverageFlow({ counts, totals, labels, decisions, onPick }) {
  const [hover, setHover] = useState(null);

  const layout = useMemo(() => {
    const passedKeys = ['sent', ...OURS].filter((k) => counts[k] > 0);
    const marketKeys = Object.keys(counts)
      .filter((k) => !passedKeys.includes(k) && !OURS.includes(k) && counts[k] > 0)
      .sort((a, b) => counts[b] - counts[a]);
    const outcomes = [...passedKeys, ...marketKeys];
    const total = outcomes.reduce((s, k) => s + counts[k], 0) || 1;

    const scale = (H - TOP - GAP * (outcomes.length + 1)) / total;
    const h = (v) => Math.max(MIN, v * scale);

    let y = TOP;
    const out = {};
    outcomes.forEach((k, i) => {
      if (i === passedKeys.length) y += GAP;
      out[k] = { y, h: h(counts[k]) };
      y += out[k].h + GAP;
    });

    const group = (keys) => {
      const sum = keys.reduce((s, k) => s + out[k].h, 0);
      const from = out[keys[0]]?.y ?? TOP;
      const to = keys.length ? out[keys.at(-1)].y + out[keys.at(-1)].h : TOP;
      return { y: from + (to - from - sum) / 2, h: sum };
    };

    const passed = group(passedKeys);
    const refused = group(marketKeys);
    const checkedH = passed.h + refused.h;
    const checked = { y: (passed.y + refused.y + refused.h - checkedH) / 2, h: checkedH };

    return { passedKeys, marketKeys, out, passed, refused, checked };
  }, [counts]);

  const { passedKeys, marketKeys, out, passed, refused, checked } = layout;
  const toneOf = (k) => (k === 'sent' ? 'sent' : OURS.includes(k) ? 'ours' : 'market');

  const sent = out.sent;
  const zoomTop = TOP;
  const zoomH = 260;
  const sentTotal = decisions.reduce((s, d) => s + d.value, 0);
  const zScale = sentTotal ? zoomH / sentTotal : 0;
  let zy = zoomTop;
  let ly = -Infinity;
  const zoom = decisions.filter((d) => d.value > 0).map((d) => {
    const seg = { ...d, y: zy, h: Math.max(MIN, d.value * zScale) };
    // Labels keep a line apart even when their segments do not.
    seg.ly = Math.max(ly + 18, seg.y + Math.min(seg.h, 28) / 2 + 4);
    ly = seg.ly;
    zy += seg.h + 2;
    return seg;
  });

  let pa = passed.y;
  let ra = refused.y;
  const links = [
    ...passedKeys.map((k) => {
      const l = { key: k, from: 'split', a0: pa, b0: pa + out[k].h };
      pa += out[k].h;
      return l;
    }),
    ...marketKeys.map((k) => {
      const l = { key: k, from: 'refused', a0: ra, b0: ra + out[k].h };
      ra += out[k].h;
      return l;
    }),
  ];

  const dim = (k) => hover && hover !== k;

  return (
    <svg className={styles.flow} viewBox={`0 0 ${W} ${H + 20}`} role="img" onPointerLeave={() => setHover(null)}
      aria-label={`${n(totals.checked)} checked, ${n(totals.passed)} passed, ${n(counts.sent ?? 0)} sent to you.`}>
      <path className={styles.linkPassed}
        d={ribbon(X.checked + NODE, checked.y, checked.y + passed.h, X.split, passed.y, passed.y + passed.h)} />
      <path className={styles.linkRefused}
        d={ribbon(X.checked + NODE, checked.y + passed.h, checked.y + checked.h, X.split, refused.y, refused.y + refused.h)} />

      {links.map((l, i) => (
        <path key={l.key} className={`${styles.link} ${styles[toneOf(l.key)]} ${dim(l.key) ? styles.dim : ''}`}
          style={{ animationDelay: `${80 + i * 30}ms` }}
          d={ribbon(X.split + NODE, l.a0, l.b0, X.outcome, out[l.key].y, out[l.key].y + out[l.key].h)}
          onPointerEnter={() => setHover(l.key)} onPointerLeave={() => setHover(null)}>
          <title>{`${labels[l.key]}: ${n(counts[l.key])}`}</title>
        </path>
      ))}

      {sent && sentTotal > 0 && (
        <path className={styles.lens}
          d={ribbon(X.outcome + NODE, sent.y, sent.y + sent.h, X.zoom, zoomTop, zy - 2)} />
      )}

      <rect className={styles.nodeChecked} x={X.checked} y={checked.y} width={NODE} height={checked.h} rx="2" />
      <rect className={styles.nodePassed} x={X.split} y={passed.y} width={NODE} height={passed.h} rx="2" />
      <rect className={styles.nodeRefused} x={X.split} y={refused.y} width={NODE} height={refused.h} rx="2" />

      <text className={styles.colLabel} x={X.checked - 12} y={checked.y + checked.h / 2 - 8} textAnchor="end">Checked</text>
      <text className={styles.colValue} x={X.checked - 12} y={checked.y + checked.h / 2 + 18} textAnchor="end">{n(totals.checked)}</text>

      <text className={styles.halo} x={X.split - 10} y={passed.y + passed.h / 2 - 2} textAnchor="end">Passed the check</text>
      <text className={`${styles.halo} ${styles.num}`} x={X.split - 10} y={passed.y + passed.h / 2 + 14} textAnchor="end">{n(totals.passed)}</text>
      <text className={styles.halo} x={X.split - 10} y={refused.y + refused.h / 2 - 2} textAnchor="end">The market said no</text>
      <text className={`${styles.halo} ${styles.num}`} x={X.split - 10} y={refused.y + refused.h / 2 + 14} textAnchor="end">{n(totals.refused)}</text>

      {[...passedKeys, ...marketKeys].map((k) => (
        <g key={k} className={`${styles.outcome} ${dim(k) ? styles.dim : ''}`} role="button" tabIndex={0}
          onPointerEnter={() => setHover(k)} onPointerLeave={() => setHover(null)}
          onClick={() => { setHover(null); onPick?.(k); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.(k); } }}>
          <rect className={styles[`node_${toneOf(k)}`]} x={X.outcome} y={out[k].y} width={NODE} height={out[k].h} rx="2" />
          <rect className={styles.hit} x={X.outcome - 4} y={out[k].y - 3} width="250" height={Math.max(out[k].h + 6, 20)} />
          <text className={`${styles.halo} ${k === 'sent' ? styles.strong : ''}`} x={X.outcome + NODE + 8} y={out[k].y + out[k].h / 2 + 4}>
            {labels[k]}
            <tspan className={styles.num} dx="8">{n(counts[k])}</tspan>
          </text>
        </g>
      ))}

      {zoom.map((z) => (
        <g key={z.key}>
          <rect className={styles[`zoom_${z.key}`]} x={X.zoom} y={z.y} width="14" height={z.h} rx="2" />
          <text className={styles.halo} x={X.zoom + 22} y={z.ly}>
            {z.label}<tspan className={styles.num} dx="8">{n(z.value)}</tspan>
          </text>
        </g>
      ))}
      {sentTotal > 0 && (
        <text className={styles.zoomTitle} x={X.zoom} y={TOP - 12}>Of the {n(sentTotal)} sent to you</text>
      )}
    </svg>
  );
}
