import { addDays, arrivalDays, deliveryEstimate } from '@utils/delivery';
import { returnsTerms } from '@lib/storeConfig';
import styles from '@styles/ui/store/return-window.module.css';

const MAX_SEGMENTS = 30;

// The return window drawn from the day it arrives: one segment per day, ending on the last day to change your mind.
export function ReturnWindow({ product }) {
  const { days, postagePaidBy } = returnsTerms();
  const total = Number(days);
  if (!(total > 0)) return null;

  const estimate = deliveryEstimate(product.dispatch_days);
  const until = arrivalDays({ from: addDays(estimate.from, total), to: addDays(estimate.to, total) });
  const sealed = product.returns_class === 'sealed';
  const detail = product.returns_note
    ?? (sealed
      ? 'On health and hygiene grounds this cannot come back once the seal is broken, unless it is faulty.'
      : `Change your mind for any reason.${postagePaidBy === 'customer' ? '' : ' Free return postage.'}`);

  return (
    <div className={styles.window} data-sealed={sealed || undefined}>
      <p className={styles.head}>
        <span className={styles.days} data-price>{total}</span>
        <span className={styles.unit}>{total === 1 ? 'day' : 'days'} to change your mind{sealed ? ', while sealed' : ''}</span>
      </p>

      <div className={styles.bar} aria-hidden="true">
        {sealed && (
          <svg className={styles.seal} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M8.5 12.2l2.3 2.3 4.7-4.9" />
          </svg>
        )}
        <span className={styles.segments} style={{ '--n': Math.min(total, MAX_SEGMENTS) }}>
          {total <= MAX_SEGMENTS && Array.from({ length: total }, (_, i) => <i key={i} style={{ '--i': i }} />)}
        </span>
      </div>

      <p className={styles.until}>
        Until {until}
        {!estimate.known && (
          <span className={styles.estimate} title="Counted from the estimated arrival day">Estimated</span>
        )}
      </p>
      <p className={styles.detail}>{detail}</p>
    </div>
  );
}
