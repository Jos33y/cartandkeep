import styles from '@styles/ui/portal/seller-gauge.module.css';

// Log scale: feedback spans five orders of magnitude.
const MIN = 10;
const MAX = 1_000_000;
const at = (v) => {
  const x = (Math.log10(Math.max(MIN, Math.min(MAX, v))) - 1) / (Math.log10(MAX) - 1);
  return x * 100;
};

const fmt = (n) => Number(n).toLocaleString('en-GB');

export function SellerGauge({ entry, ceiling, compact = false }) {
  const line = at(ceiling);
  const has = entry?.seller_feedback != null;
  const tone = !has ? 'none' : entry.proved ? 'proved' : 'large';

  const read = !has
    ? 'No recent seller in the sample'
    : `Smallest seller converting has ${fmt(entry.seller_feedback)} feedback`
      + (entry.proved ? `, inside the ${fmt(ceiling)} that proves entry` : `, over the ${fmt(ceiling)} that proves entry`);

  return (
    <div className={`${styles.gauge} ${compact ? styles.compact : ''}`} data-tone={tone}
      role="img" aria-label={read} title={compact ? read : undefined}>
      <div className={styles.track}>
        <span className={styles.open} style={{ width: `${line}%` }} />
        <span className={styles.ceiling} style={{ left: `${line}%` }} />
        {has && <span className={styles.dot} style={{ left: `${at(entry.seller_feedback)}%` }} />}
      </div>

      {compact ? (
        <span className={styles.value} data-num>{has ? fmt(entry.seller_feedback) : 'None'}</span>
      ) : (
        <div className={styles.scale}>
          <span style={{ width: `${line}%` }}>Proves a small seller can get in</span>
          <span>Large accounts</span>
        </div>
      )}
    </div>
  );
}
