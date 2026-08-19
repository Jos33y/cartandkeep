import { useMemo } from 'react';
import { VanIcon } from '@components/ui/store/icons';
import { deliveryEstimate, deliveryLabel, dispatchLabel } from '@utils/delivery';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/delivery-estimate.module.css';

const FREE_OVER = 40;
const POSTAGE = 3.95;

/*
 * A date, not a duration.
 *
 * Somebody deciding whether to buy a lamp is deciding whether it will be there
 * for Saturday. "2 to 3 working days" makes them do the arithmetic, and about
 * a third of people get it wrong across a weekend.
 *
 * When `dispatch_days` is null, which is every product today, it still gives a
 * date but says the dispatch part is an estimate rather than claiming a
 * cutoff nobody has confirmed. A confident wrong date is worse than a hedged
 * right one.
 */
export function DeliveryEstimate({ product, compact = false }) {
  const price = Number(product.price);
  const free = price >= FREE_OVER;

  // Recomputed on every render, which matters: the answer changes at 2pm and a
  // page left open through lunch should not still be promising today.
  const estimate = useMemo(
    () => deliveryEstimate(product.dispatch_days),
    [product.dispatch_days],
  );

  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <VanIcon size={compact ? 17 : 19} />
      <p className={styles.text}>
        <span className={styles.date}>{deliveryLabel(estimate)}</span>
        <span className={styles.detail}>
          {free ? 'Free UK delivery' : `${formatGbp(POSTAGE)} delivery, free over ${formatGbp(FREE_OVER)}`}
          {estimate.known && <>. {dispatchLabel(estimate)}</>}
          {!estimate.known && <>. Estimated on our usual dispatch times.</>}
        </span>
      </p>
    </div>
  );
}
