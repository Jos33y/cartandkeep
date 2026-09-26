import styles from '@styles/ui/status/delivery-track.module.css';

const TZ = 'Europe/London';
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const fmt = (key, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(new Date(`${key}T12:00:00Z`));

function daysBetween(fromKey, toKey) {
  const out = [];
  const end = new Date(`${toKey}T12:00:00Z`);
  for (let d = new Date(`${fromKey}T12:00:00Z`); d <= end; d = new Date(d.getTime() + 86400000)) out.push(dayKey(d));
  return out;
}

// One column per day since the first delivery, one dot per item delivered that day.
export function DeliveryTrack({ items, lastVisit }) {
  const dated = items.filter((i) => i.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!dated.length) return null;

  const today = dayKey(new Date());
  const days = daysBetween(dated[0].date, today > dated[dated.length - 1].date ? today : dated[dated.length - 1].date);
  const byDay = new Map();
  for (const item of dated) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);

  const tallest = Math.max(...[...byDay.values()].map((l) => l.length));
  const seenKey = lastVisit ? dayKey(lastVisit) : null;
  const pinIndex = seenKey ? days.indexOf(seenKey) : -1;
  const newCount = seenKey ? dated.filter((i) => i.date > seenKey).length : 0;

  const summary = `${dated.length} items delivered between ${fmt(days[0], { day: 'numeric', month: 'long' })} and ${fmt(dated[dated.length - 1].date, { day: 'numeric', month: 'long' })}`
    + (seenKey ? `, ${newCount} since your last visit.` : '.');

  return (
    <figure className={styles.track} role="img" aria-label={summary} style={{ '--days': days.length, '--rows': tallest }}>
      <div className={styles.plot}>
        {days.map((key, i) => {
          const list = byDay.get(key) ?? [];
          const isNew = seenKey && key > seenKey;
          return (
            <span key={key} className={styles.day} style={{ '--i': i }}
              title={list.length ? `${fmt(key, { day: 'numeric', month: 'short' })}: ${list.length} ${list.length === 1 ? 'item' : 'items'}` : undefined}>
              {list.map((item) => (
                <i key={item.label} className={`${styles.dot} ${isNew ? styles.fresh : ''} ${item.superseded ? styles.replaced : ''}`} />
              ))}
            </span>
          );
        })}

        {pinIndex >= 0 && pinIndex < days.length - 1 && (
          <span className={`${styles.pin} ${(pinIndex + 1) / days.length < 0.3 ? styles.pinRight : ''}`} style={{ '--at': (pinIndex + 1) / days.length }}
            title={`Your last visit from this device, ${fmt(seenKey, { day: 'numeric', month: 'short' })}`}>
            <span className={styles.pinLabel}>You were here</span>
          </span>
        )}
      </div>

      <div className={styles.axis} aria-hidden="true">
        {days.map((key, i) => {
          const first = i === 0;
          const last = i === days.length - 1;
          const monthStart = key.endsWith('-01');
          if (!first && !last && !monthStart) return null;
          const text = first ? fmt(key, { day: 'numeric', month: 'long' }) : last ? 'Today' : fmt(key, { month: 'short' });
          return (
            <span key={key} className={`${styles.tick} ${first ? styles.start : ''} ${last ? styles.end : ''}`}
              style={{ '--at': (i + 0.5) / days.length }}>
              {text}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
