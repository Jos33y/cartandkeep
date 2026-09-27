import { LockIcon, ReturnIcon, ShieldIcon, VanIcon } from '@components/ui/store/icons';
import { ZONE_LABELS } from '@lib/postcode';
import { returnsTerms, storeConfig } from '@lib/storeConfig';
import { addWorkingDays, arrivalDays, deliveryEstimate } from '@utils/delivery';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/basket-totals.module.css';

/*
 * The figures under a basket, on the basket and the checkout alike.
 *
 * One component so the two pages cannot word or weigh the same numbers
 * differently. The free delivery gap is a thin line under Delivery rather than
 * a panel, because it is a fact about that row and not a second message.
 */

// The latest of the lines' arrivals, pushed on by the zone's extra days.
export function basketArrival(lines, zone = 'mainland') {
  if (!lines?.length) return null;
  let from = null;
  let to = null;
  let leaves = null;
  let today = null;
  for (const l of lines) {
    const e = deliveryEstimate(l.dispatchDays ?? null);
    if (!from || e.from > from) from = e.from;
    if (!to || e.to > to) to = e.to;
    if (!leaves || e.leaves > leaves) leaves = e.leaves;
    today = e.today;
  }
  const extra = Number(storeConfig().delivery?.zones?.[zone]?.extraDays) || 0;
  return extra
    ? { today, leaves, from: addWorkingDays(from, extra), to: addWorkingDays(to, extra) }
    : { today, leaves, from, to };
}

export function BasketTotals({
  subtotal, delivery, total, toFree = 0, freeOver = 0, surcharge = 0, zone = 'mainland', arrival = null, agreed = false,
}) {
  const free = delivery === 0;
  const share = freeOver > 0 ? Math.min(100, Math.max(4, ((freeOver - toFree) / freeOver) * 100)) : 100;

  return (
    <div className={styles.totals}>
      <dl className={styles.figures}>
        <div className={styles.row}>
          <dt>{agreed ? 'Agreed price' : 'Subtotal'}</dt>
          <dd data-price>{formatGbp(subtotal)}</dd>
        </div>

        <div className={styles.row}>
          <dt>
            Delivery
            {surcharge > 0 && <span className={styles.zone}>{ZONE_LABELS[zone]}</span>}
          </dt>
          <dd data-price data-free={free || undefined}>{free ? 'Free' : formatGbp(delivery)}</dd>

          {toFree > 0 && freeOver > 0 && (
            <dd className={styles.gap}>
              <span
                className={styles.track}
                role="progressbar"
                aria-label="Towards free delivery"
                aria-valuemin={0}
                aria-valuemax={freeOver}
                aria-valuenow={Math.round((freeOver - toFree) * 100) / 100}
              >
                <span style={{ width: `${share}%` }} />
              </span>
              <span className={styles.gapWords}>
                <span data-price>{formatGbp(toFree)}</span> more for free delivery
              </span>
            </dd>
          )}
        </div>

        <div className={`${styles.row} ${styles.grand}`}>
          <dt>To pay</dt>
          <dd data-price>{formatGbp(total)}</dd>
        </div>
      </dl>

      {arrival && (
        <p className={styles.arrival}>
          <VanIcon size={16} />
          <span>Arrives <strong>{arrivalDays(arrival)}</strong></span>
        </p>
      )}
    </div>
  );
}

// The three promises, said once and small. Only what is true of every order.
export function BasketPromises({ paying = false }) {
  const days = Number(returnsTerms().days);
  return (
    <ul className={styles.promises}>
      {days > 0 && <li><ReturnIcon size={15} /><span>{days} {days === 1 ? 'day' : 'days'} to change your mind</span></li>}
      <li><LockIcon size={15} /><span>No account needed</span></li>
      <li><ShieldIcon size={15} /><span>{paying ? 'Card details go to Stripe, never to us' : 'Paid securely through Stripe'}</span></li>
    </ul>
  );
}
