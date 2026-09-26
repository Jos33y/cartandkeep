import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { arrivalDays, deliveryEstimate, formatDeliveryDay, hourLabel } from '@utils/delivery';
import { storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/arrival-track.module.css';

// Three drawn stops from today to her door, worked out from her cutoff and transit days on every render.
export function ArrivalTrack({ product }) {
  const estimate = deliveryEstimate(product.dispatch_days);
  const leavesToday = estimate.leaves === estimate.today;

  const stops = [
    { kind: 'basket', title: 'Order today', day: formatDeliveryDay(estimate.today) },
    {
      kind: 'box',
      title: 'Leaves us',
      day: leavesToday
        ? `Today if ordered before ${hourLabel(storeConfig().delivery.cutoffHour)}`
        : formatDeliveryDay(estimate.leaves),
    },
    { kind: 'door', title: 'With you', day: arrivalDays(estimate) },
  ];

  return (
    <div className={styles.track}>
      <ol className={styles.stops}>
        {stops.map((stop, i) => (
          <li key={stop.kind} className={styles.stop} data-last={i === stops.length - 1 || undefined} style={{ '--i': i }}>
            <span className={styles.mark} aria-hidden="true">
              <SectionGlyph kind={stop.kind} size={22} />
            </span>
            <span className={styles.title}>{stop.title}</span>
            <span className={styles.day}>{stop.day}</span>
            {i === stops.length - 1 && !estimate.known && (
              <span className={styles.estimate} title="Worked out from our usual dispatch times">Estimated</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
