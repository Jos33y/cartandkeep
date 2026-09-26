import { storeConfig } from '@lib/storeConfig';

/*
 * When it turns up.
 *
 * "2 to 3 working days" is what a shop says. "Arrives Thursday 21 August" is
 * what somebody decides on, and it is the highest value sentence we can put on
 * a product page with data we already hold.
 *
 * Everything here is computed in Europe/London. A 10am cutoff means 10am
 * where the parcel is, and a shopper in Lagos looking at a UK shop should see
 * the UK answer.
 */

// Her dispatch cutoff and transit days, read from settings on every call so a change in Settings reaches the next render.
const timings = () => {
  const { cutoffHour, transitMin, transitMax } = storeConfig().delivery;
  return { cutoffHour, transitMin, transitMax };
};

// 10 reads 10am, 12 reads midday, 13 reads 1pm.
export function hourLabel(hour) {
  if (hour === 12) return 'midday';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/*
 * England and Wales bank holidays.
 *
 * 2026 is the confirmed government list. 2027 is computed from the fixed dates
 * and the substitution rules and is provisional, because the official list is
 * usually only published twelve to eighteen months ahead.
 *
 * A year that is not in here falls back to weekends only, which overpromises
 * by a day at most rather than throwing. In development it says so, because
 * the quiet version of this is a shop confidently naming Christmas Day.
 */
const BANK_HOLIDAYS = {
  2026: ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28'],
  2027: ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'],
};

const HOLIDAYS = new Set(Object.values(BANK_HOLIDAYS).flat());
const KNOWN_YEARS = new Set(Object.keys(BANK_HOLIDAYS).map(Number));

// London wall clock, whatever the visitor's own timezone is.
function londonParts(date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const parts = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: parts.weekday,
  };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const isWeekend = (iso) => {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

const isWorkingDay = (iso) => !isWeekend(iso) && !HOLIDAYS.has(iso);

function nextWorkingDay(iso) {
  let next = iso;
  // Christmas 2026 runs Friday the 25th to Monday the 28th, so four in a row
  // is real. Fourteen is the guard against a bad holiday table looping.
  for (let i = 0; i < 14; i += 1) {
    next = addDays(next, 1);
    if (isWorkingDay(next)) return next;
  }
  return next;
}

function addWorkingDays(iso, n) {
  let out = iso;
  for (let i = 0; i < n; i += 1) out = nextWorkingDay(out);
  return out;
}

/*
 * `dispatchDays` is null on every product today, because nothing writes it.
 * Null means we do not know, and the caller is expected to show a range rather
 * than a date. Zero means same day, which is a claim, and it should only ever
 * be there because somebody put it there.
 */
export function deliveryEstimate(dispatchDays, now = new Date(), times = timings()) {
  const { iso: today, hour } = londonParts(now);
  const { cutoffHour, transitMin, transitMax } = times;

  if (!KNOWN_YEARS.has(Number(today.slice(0, 4)))) {
    if (import.meta.env?.DEV) {
      console.warn(`[delivery] no bank holiday list for ${today.slice(0, 4)}, weekends only`);
    }
  }

  const known = dispatchDays !== null && dispatchDays !== undefined;
  const days = known ? Number(dispatchDays) : transitMin;

  // Same day only if it is a working day and we are inside the cutoff.
  let leaves;
  if (known && days === 0) {
    leaves = isWorkingDay(today) && hour < cutoffHour ? today : nextWorkingDay(today);
  } else {
    const from = isWorkingDay(today) && hour < cutoffHour ? today : nextWorkingDay(today);
    leaves = known ? addWorkingDays(from, days) : from;
  }

  return {
    known,
    leaves,
    from: addWorkingDays(leaves, transitMin),
    to: addWorkingDays(leaves, transitMax),
    sameDay: known && days === 0 && leaves === today,
  };
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function formatDeliveryDay(iso, { withDate = true } = {}) {
  const d = new Date(`${iso}T12:00:00Z`);
  return withDate ? DATE.format(d) : DAY.format(d);
}

/*
 * The sentence.
 *
 * Two dates in the same week collapse to "Wednesday or Thursday", because
 * "Wednesday 20 August or Thursday 21 August" is a mouthful nobody parses.
 */
export function deliveryLabel(estimate) {
  const { from, to } = estimate;
  if (from === to) return `Arrives ${formatDeliveryDay(from)}`;

  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const closeTogether = (new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000 <= 3;

  if (sameMonth && closeTogether) {
    return `Arrives ${formatDeliveryDay(from, { withDate: false })} or ${formatDeliveryDay(to)}`;
  }
  return `Arrives between ${formatDeliveryDay(from)} and ${formatDeliveryDay(to)}`;
}

export function dispatchLabel(estimate, now = new Date()) {
  const { iso: today } = londonParts(now);
  if (estimate.sameDay) return `Sent today if ordered before ${hourLabel(timings().cutoffHour)}`;
  if (estimate.leaves === nextWorkingDay(today)) return 'Sent the next working day';
  return `Leaves us ${formatDeliveryDay(estimate.leaves)}`;
}
