/*
 * Dates, the way the checkout and the order page work them out: London civil
 * time, weekends and England and Wales bank holidays skipped.
 *
 * The holiday list matches src/utils/delivery.js. Hand written and dated,
 * because a wrong estimate is worse than a vague one, so both lists are
 * checked each year and 2028 goes in once gov.uk publishes it.
 */
export const LONDON = 'Europe/London';

const HOLIDAYS = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
]);

export function londonParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { iso: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), time: `${get('hour')}:${get('minute')}` };
}

// A London calendar day as a Date at midday UTC, so formatting it in any zone gives the same day.
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const isoOf = (d: Date) => londonParts(d).iso;

export function isWorking(iso: string) {
  const day = noon(iso).getUTCDay();
  return day !== 0 && day !== 6 && !HOLIDAYS.has(iso);
}

export function addWorkingDays(iso: string, days: number) {
  const d = noon(iso);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorking(d.toISOString().slice(0, 10))) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...o }).formatToParts(noon(iso)).map((p) => [p.type, p.value]));

// "Tuesday 29 September". Parts joined by hand, because en-GB puts a comma after the weekday.
export const longDay = (iso: string) => {
  const p = fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${p.weekday} ${p.day} ${p.month}`;
};

// "Tue 29 Sep", as the checkout label and the order page write a day.
export const shortDay = (iso: string) => {
  const p = fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${String(p.month).slice(0, 3)}`;
};

export const weekday = (iso: string) => fmt(iso, { weekday: 'long' }).weekday;

// "Thu 1 or Fri 2 Oct", "Wed 30 Sep or Thu 1 Oct", or one day when the window is one day.
export function windowShort(from: string, to: string) {
  if (from === to) return shortDay(from);
  const a = fmt(from, { weekday: 'short', day: 'numeric', month: 'short' });
  const b = fmt(to, { weekday: 'short', day: 'numeric', month: 'short' });
  return a.month === b.month
    ? `${a.weekday} ${a.day} or ${b.weekday} ${b.day} ${String(b.month).slice(0, 3)}`
    : `${shortDay(from)} or ${shortDay(to)}`;
}

// For a sentence: "on Thursday 1 or Friday 2 October", or "between ... and ..." for a longer window.
export function windowLong(from: string, to: string) {
  if (from === to) return `on ${longDay(from)}`;
  const a = fmt(from, { weekday: 'long', day: 'numeric', month: 'long' });
  const b = fmt(to, { weekday: 'long', day: 'numeric', month: 'long' });
  const next = addWorkingDays(from, 1) === to;
  if (!next) return `between ${longDay(from)} and ${longDay(to)}`;
  return a.month === b.month
    ? `on ${a.weekday} ${a.day} or ${b.weekday} ${b.day} ${b.month}`
    : `on ${longDay(from)} or ${longDay(to)}`;
}

// "Mon 28 Sep 2026, 18:31"
export function stamp(at: Date) {
  const { iso, time } = londonParts(at);
  return `${shortDay(iso)} ${iso.slice(0, 4)}, ${time}`;
}

/*
 * When an order leaves and arrives. Planned from the moment it was paid, her
 * cutoff and her transit days; once it has actually left, counted from the
 * real day it left instead.
 */
export function orderDates(order: { paid_at?: string | null; created_at?: string | null; dispatched_at?: string | null }, delivery: Record<string, unknown> = {}, now = new Date()) {
  const cutoff = Number(delivery.cutoff_hour ?? 14);
  const min = Number(delivery.transit_min ?? 2);
  const max = Math.max(min, Number(delivery.transit_max ?? 3));
  const paid = new Date(order.paid_at ?? order.created_at ?? now);
  const p = londonParts(paid);
  const planned = isWorking(p.iso) && p.hour < cutoff ? p.iso : addWorkingDays(p.iso, 1);
  const left = order.dispatched_at ? isoOf(new Date(order.dispatched_at)) : null;
  const leaves = left ?? planned;
  return {
    paid, paidIso: p.iso, paidTime: p.time,
    leaves, left: Boolean(left),
    from: addWorkingDays(leaves, min),
    to: addWorkingDays(leaves, max),
    today: isoOf(now),
  };
}

// "Mon 28 Sep, 14:20", for when a message was written.
export function when(at: Date) {
  const { iso, time } = londonParts(at);
  return `${shortDay(iso)}, ${time}`;
}
