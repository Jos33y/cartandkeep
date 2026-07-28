import styles from '@styles/ui/portal/verdict-bar.module.css';

const LABELS = {
  sell_through: 'Sell-through',
  margin_pct: 'Margin',
  trend: 'Trend',
  competition: 'Competition',
  seller_spread: 'Seller spread',
  shipping_band: 'Postage band',
  supply: 'Supply',
};

export function VerdictBar({ breakdown, muted = false }) {
  const parts = Object.entries(breakdown ?? {});
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
