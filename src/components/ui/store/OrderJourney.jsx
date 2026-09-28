import { CheckIcon } from '@components/ui/store/icons';
import { addWorkingDays, deliveryEstimate } from '@utils/delivery';
import { storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/order-journey.module.css';

const LONDON = 'Europe/London';
const isoOf = (at) => new Intl.DateTimeFormat('en-CA', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LONDON });
// "Tue 29 Sep", the way the checkout label writes a day, without the commas the locale puts in.
const day = (iso) => {
  const p = Object.fromEntries(DAY.formatToParts(new Date(`${iso}T12:00:00Z`)).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${String(p.month).slice(0, 3)}`;
};

/*
 * The dates an order runs on, worked out the way the checkout and the
 * confirmation email work them out: from the moment it was paid, her cutoff
 * and her transit days, England and Wales bank holidays skipped. Once it has
 * actually left, the arrival counts from the real day it left instead.
 */
export function orderDates(order, now = new Date()) {
  const paidAt = order.paid_at ?? order.created_at;
  const planned = deliveryEstimate(null, paidAt ? new Date(paidAt) : now);
  const { transitMin, transitMax } = storeConfig().delivery;
  const leftIso = order.dispatched_at ? isoOf(order.dispatched_at) : null;
  const from = leftIso ? addWorkingDays(leftIso, transitMin) : planned.from;
  const to = leftIso ? addWorkingDays(leftIso, transitMax) : planned.to;
  const todayIso = isoOf(now);
  return {
    paidIso: paidAt ? isoOf(paidAt) : null,
    paidTime: paidAt ? TIME.format(new Date(paidAt)) : null,
    leaves: leftIso ?? planned.leaves,
    left: Boolean(leftIso),
    from,
    to,
    due: Boolean(leftIso) && todayIso >= from,
    todayIso,
  };
}

export const windowText = (from, to) => (from === to ? day(from) : `${day(from)} or ${day(to)}`);

/*
 * Where the parcel has got to, as the three stops the checkout label promised:
 * paid, leaves us, with you. Done stops are filled, the next one is marked,
 * and every stop carries its date, so somebody can see at a glance whether
 * anything is late rather than reading a paragraph to find out.
 */
export function OrderJourney({ order }) {
  const d = orderDates(order);
  const gift = Boolean(order.is_gift);
  const who = gift ? 'With them' : 'With you';
  const todayWord = (iso) => (iso === d.todayIso ? 'Today' : day(iso));

  const stops = [
    {
      key: 'paid',
      label: 'Paid',
      date: d.paidIso ? `${todayWord(d.paidIso)}, ${d.paidTime}` : null,
      state: 'done',
    },
    {
      key: 'left',
      label: d.left ? 'Left us' : 'Leaves us',
      date: d.left
        ? `${todayWord(d.leaves)}${order.carrier ? `, ${order.carrier}` : ''}`
        : `${todayWord(d.leaves)}, expected`,
      state: d.left ? 'done' : 'next',
    },
    {
      key: 'with',
      label: d.due ? `Due ${gift ? 'with them' : 'with you'}` : who,
      date: windowText(d.from, d.to),
      state: d.left ? 'next' : 'later',
    },
  ];

  return (
    <ol className={styles.journey} aria-label="Where your order has got to">
      {stops.map((s) => (
        <li key={s.key} className={styles.stop} data-state={s.state}>
          <span className={styles.dot} aria-hidden="true">{s.state === 'done' && <CheckIcon size={13} />}</span>
          <span className={styles.label}>{s.label}</span>
          {s.date && <span className={styles.date}>{s.date}</span>}
          <span className="visually-hidden">{s.state === 'done' ? ', done' : s.state === 'next' ? ', next' : ''}</span>
        </li>
      ))}
    </ol>
  );
}
