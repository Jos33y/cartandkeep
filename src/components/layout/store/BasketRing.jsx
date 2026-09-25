import { useEffect, useRef, useState } from 'react';
import { BasketIcon } from '@components/ui/store/icons';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/layout/store/basket-ring.module.css';

const R = 19;
const C = 2 * Math.PI * R;

// The basket icon wears its progress to free delivery; the ring closes as the basket fills.
export function BasketRing({ count, subtotal, threshold, label = true }) {
  const share = threshold > 0 ? Math.min(1, subtotal / threshold) : 0;
  const unlocked = count > 0 && share >= 1;
  const toGo = Math.max(0, threshold - subtotal);

  // A one-off pulse at the moment the threshold is crossed, and not on every render after.
  const was = useRef(unlocked);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (unlocked && !was.current) setBurst((n) => n + 1);
    was.current = unlocked;
  }, [unlocked]);

  const words = count === 0 ? 'Basket' : unlocked ? 'Free delivery' : `${formatGbp(toGo)} to go`;

  return (
    <span className={styles.wrap} data-unlocked={unlocked || undefined}>
      <span className={styles.ring} key={burst} data-burst={burst > 0 || undefined}>
        <svg className={styles.dial} viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
          <circle className={styles.track} cx="22" cy="22" r={R} />
          <circle
            className={styles.fill}
            cx="22"
            cy="22"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - (count ? share : 0))}
          />
        </svg>
        <BasketIcon size={20} />
        {count > 0 && <span className={styles.pip} data-price>{count > 99 ? '99+' : count}</span>}
      </span>
      {label && words && <span className={styles.words}>{words}</span>}
    </span>
  );
}
