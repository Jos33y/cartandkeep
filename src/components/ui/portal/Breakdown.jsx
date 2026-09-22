import styles from '@styles/ui/portal/breakdown.module.css';

const gbp = (v) => (v == null ? '--'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v));

/*
 * Where the price goes, as one bar.
 *
 * "£21.89 less £6.78 less £4.99" is arithmetic left to the reader. Drawn, the
 * share she keeps against the share eBay and the shop take is visible before
 * any number is read.
 */
export function Breakdown({ price, fees, postage, goods, keep, feeLabel = 'eBay fees' }) {
  if (!(price > 0)) return null;

  const parts = [
    { key: 'fees', label: feeLabel, value: fees },
    { key: 'post', label: 'Postage & packing', value: postage },
    { key: 'goods', label: 'Goods', value: goods },
    { key: 'keep', label: 'You keep', value: keep },
  ].filter((p) => p.value != null && p.value > 0);

  const loss = keep != null && keep < 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="img"
        aria-label={parts.map((p) => `${p.label} ${gbp(p.value)}`).join(', ')}>
        {parts.map((p) => (
          <span key={p.key} className={`${styles.seg} ${styles[p.key]}`}
            style={{ flexGrow: p.value }} />
        ))}
      </div>

      <dl className={styles.key}>
        {parts.map((p) => (
          <div key={p.key} className={styles.item}>
            <dt className={styles.label}>
              <span className={`${styles.swatch} ${styles[p.key]}`} aria-hidden="true" />
              {p.label}
            </dt>
            <dd className={`${styles.value} ${p.key === 'keep' ? styles.keepValue : ''}`} data-num>
              {gbp(p.value)}
              <span className={styles.share}>{Math.round((p.value / price) * 100)}%</span>
            </dd>
          </div>
        ))}
      </dl>

      {loss && (
        <p className={styles.loss}>
          Loses {gbp(Math.abs(keep))} a sale at {gbp(price)}.
        </p>
      )}
    </div>
  );
}
