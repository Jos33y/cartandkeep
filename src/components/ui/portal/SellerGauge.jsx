import styles from '@styles/ui/portal/seller-gauge.module.css';

// Log scale: feedback spans five orders of magnitude.
const MIN = 10;
const MAX = 1_000_000;
const at = (v) => {
  const x = (Math.log10(Math.max(MIN, Math.min(MAX, v))) - 1) / (Math.log10(MAX) - 1);
  return x * 100;
};

const RUNGS = [
  [10, '10'], [100, '100'], [1000, '1k'], [10000, '10k'], [100000, '100k'], [1000000, '1m'],
];

const fmt = (n) => Number(n).toLocaleString('en-GB');

/*
 * Who is selling, from starting out to large account, with the door at the ceiling that proves a new account can get
 * in. Nobody seen is drawn as nobody: a dashed rail and no dot, never a marker placed on a guess.
 */
export function SellerGauge({ entry, ceiling, compact = false }) {
  const line = at(ceiling);
  const has = entry?.seller_feedback != null;
  const tone = !has ? 'none' : entry.proved ? 'proved' : 'large';

  const read = !has
    ? 'Untested. No recent seller in the sample'
    : `Smallest seller converting has ${fmt(entry.seller_feedback)} feedback`
      + (entry.proved ? `, inside the ${fmt(ceiling)} that proves entry` : `, over the ${fmt(ceiling)} that proves entry`);

  if (compact) {
    return (
      <div className={`${styles.gauge} ${styles.compact}`} data-tone={tone} role="img" aria-label={read} title={read}>
        <div className={styles.track}>
          <span className={styles.open} style={{ width: `${line}%` }} />
          <span className={styles.ceiling} style={{ left: `${line}%` }} />
          {has && <span className={styles.dot} style={{ left: `${at(entry.seller_feedback)}%` }} />}
        </div>
        <span className={styles.value}>{has ? <><b data-num>{fmt(entry.seller_feedback)}</b> feedback</> : 'None'}</span>
      </div>
    );
  }

  return (
    <div className={styles.gauge} data-tone={tone} role="img" aria-label={read}>
      <div className={styles.zones} aria-hidden="true">
        <span className={styles.zoneIn} style={{ width: `${line}%` }}>Can get in</span>
        <span className={styles.zoneOut}>Large accounts</span>
      </div>
      <div className={styles.track}>
        <span className={styles.open} style={{ width: `${line}%` }} />
        <span className={styles.ceiling} style={{ left: `${line}%` }} />
        {RUNGS.map(([v]) => <span key={v} className={styles.rung} style={{ left: `${at(v)}%` }} />)}
        {has ? (
          <span className={styles.dot} style={{ left: `${at(entry.seller_feedback)}%` }}>
            <span className={styles.flag} data-num data-edge={at(entry.seller_feedback) > 85 ? 'end' : at(entry.seller_feedback) < 12 ? 'start' : undefined}>
              {fmt(entry.seller_feedback)}
            </span>
          </span>
        ) : (
          <span className={styles.untested}>Untested</span>
        )}
      </div>
      <div className={styles.rungs} aria-hidden="true" data-num>
        {RUNGS.map(([v, label]) => <span key={v} style={{ left: `${at(v)}%` }}>{label}</span>)}
      </div>
    </div>
  );
}
