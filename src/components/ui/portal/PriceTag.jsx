import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/price-tag.module.css';

// Her price as a kraft swing tag. The punched end points at the price; flip hangs it the other way near a right edge.
export function PriceTag({ price, note = null, size = 'row', tone = 'kraft', flip = false, className = '' }) {
  return (
    <span className={`${styles.tag} ${className}`} data-size={size} data-tone={tone} data-flip={flip || undefined}>
      <span className={styles.face}>
        <span className={styles.price} data-num>{formatGbp(price)}</span>
        {note && <span className={styles.note}>{note}</span>}
      </span>
    </span>
  );
}
