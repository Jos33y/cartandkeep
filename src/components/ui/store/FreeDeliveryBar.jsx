import { useBasket } from '@context/BasketContext';
import { CheckIcon } from '@components/ui/store/icons';
import { formatGbp } from '@utils/formatGbp';
import { freeOver, postage } from '@lib/storeConfig';
import styles from '@styles/ui/store/free-delivery-bar.module.css';

// The header ring's promise in words: the basket, plus what is about to go in, against her free delivery threshold.
export function FreeDeliveryBar({ pending = 0 }) {
  const { subtotal } = useBasket();
  const threshold = freeOver();
  if (!(threshold > 0)) return null;

  const withThis = subtotal + pending;
  const free = subtotal >= threshold;
  const freeWithThis = !free && withThis >= threshold;
  const toGo = Math.max(0, threshold - withThis);

  const share = (n) => `${Math.min(100, (n / threshold) * 100)}%`;
  const words = free
    ? 'Delivery is free on this basket.'
    : freeWithThis
      ? 'Add this and delivery is free.'
      : `${pending > 0 ? 'With this, ' : ''}${formatGbp(toGo)} more and delivery is free.`;

  return (
    <div className={styles.wrap} data-free={free || undefined}>
      <p className={styles.words}>
        {free && <CheckIcon size={15} />}
        <span aria-live="polite">{words}</span>
        {!free && <span className={styles.cost}>Delivery <span data-price>{formatGbp(postage())}</span></span>}
      </p>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Towards free delivery"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(threshold, withThis)}
      >
        <span className={styles.basket} style={{ width: share(subtotal) }} />
        {pending > 0 && !free && (
          <span className={styles.pending} style={{ left: share(subtotal), width: `calc(${share(withThis)} - ${share(subtotal)})` }} />
        )}
      </div>
    </div>
  );
}
