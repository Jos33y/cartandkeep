import { VanIcon } from '@components/ui/store/icons';
import { deliveryEstimate, deliveryLabel, dispatchLabel } from '@utils/delivery';
import { formatGbp } from '@utils/formatGbp';
import { freeOver, postage } from '@lib/storeConfig';
import styles from '@styles/ui/store/delivery-estimate.module.css';

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
  const threshold = freeOver();
  const free = price >= threshold;

  // Not memoised: the answer changes at the cutoff, and a page left open past it must stop promising today.
  const estimate = deliveryEstimate(product.dispatch_days);

  return (
    <div className={styles.wrap} data-compact={compact || undefined}>
      <VanIcon size={compact ? 17 : 19} />
      <p className={styles.text}>
        <span className={styles.date}>{deliveryLabel(estimate)}</span>
        <span className={styles.detail}>
          {free ? 'Free UK delivery' : `${formatGbp(postage())} delivery, free from ${formatGbp(threshold)}`}
          {estimate.known && <>. {dispatchLabel(estimate)}</>}
          {!estimate.known && <>. Estimated on our usual dispatch times.</>}
        </span>
      </p>
    </div>
  );
}
