import styles from '@styles/ui/portal/verdict-bar.module.css';

const LABELS = {
  sell_through: 'Sell-through',
  margin_pct: 'Margin',
  trend: 'Trend',
  competition: 'Competition',
  seller_spread: 'Seller spread',
  shipping_band: 'Postage band',
  supply: 'Supply',

  volume: 'Units sold',
  headroom: 'Headroom',
  hold: 'Holding',
  same_sku: 'Same product sellers',
};

// Postgres returns jsonb keys ordered by length, so without this the bar reads
// left to right in an order nobody chose and a rename would rearrange it.
// Demand first, then money, then what stands in the way. Postage band last.
const ORDER = [
  'volume', 'sell_through',
  'headroom', 'margin_pct',
  'hold', 'trend',
  'same_sku', 'competition', 'seller_spread',
  'supply', 'shipping_band',
];

const entries = (breakdown) => Object.entries(breakdown ?? {})
  .sort((a, b) => {
    const ai = ORDER.indexOf(a[0]);
    const bi = ORDER.indexOf(b[0]);
    return (ai === -1 ? ORDER.length : ai) - (bi === -1 ? ORDER.length : bi);
  });

export function VerdictBar({ breakdown, muted = false }) {
  const parts = entries(breakdown);
  if (!parts.length) return null;

  const totalWeight = parts.reduce((a, [, p]) => a + p.weight, 0) || 1;

  return (
    <div className={`${styles.bar} ${muted ? styles.muted : ''}`} role="img"
      aria-label={parts.map(([k, p]) => `${LABELS[k] ?? k} ${Math.round(p.value * 100)}%`).join(', ')}>
      {parts.map(([key, part]) => (
        <div
          key={key}
          className={styles.segment}
          style={{ flexGrow: part.weight / totalWeight }}
          data-label={`${LABELS[key] ?? key} ${Math.round(part.value * 100)}%`}
        >
          <div className={styles.fill} style={{ width: `${part.value * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

// The same numbers the bar encodes, for the expanded row and for touch, where
// the hover label never appears.
export function VerdictLegend({ breakdown }) {
  const parts = entries(breakdown);
  if (!parts.length) return null;

  return (
    <dl className={styles.legend}>
      {parts.map(([key, part]) => (
        <div key={key} className={styles.legendItem}>
          <dt className={styles.legendLabel}>{LABELS[key] ?? key}</dt>
          <dd className={styles.legendValue} data-num>{Math.round(part.value * 100)}</dd>
        </div>
      ))}
    </dl>
  );
}
