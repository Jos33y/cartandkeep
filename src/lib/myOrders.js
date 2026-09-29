/*
 * Orders opened on this device.
 *
 * There is no account, so "Track an order" had nothing to show somebody who
 * was looking at their order a minute ago but a blank form. Each order page
 * that opens with its token records a line here, and the tracking page lists
 * them first.
 *
 * Only what the confirmation link already carries, plus what the order page
 * has just shown: reference, token, when it was placed, the total, where it
 * has got to, and one photograph. No address and no email, so a borrowed
 * device shows a list of parcels rather than somebody's details.
 */
const KEY = 'ck.orders.v1';
// Keeping the refusal is strictly necessary: without it the next order page would be kept again.
const OFF_KEY = 'ck.orders.off';
const MAX = 12;
const EVENT = 'ck:orders';

export function readMyOrders() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((o) => o && typeof o.reference === 'string' && typeof o.token === 'string')
      : [];
  } catch {
    return [];
  }
}

function write(list) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* full or private */ }
  window.dispatchEvent(new Event(EVENT));
}

// Where an order has got to, in the words the tracking list uses.
export function stageOf(order) {
  if (order.status === 'refunded') return 'refunded';
  if (order.dispatched_at) return 'sent';
  if (order.status === 'paid') return 'paid';
  return 'pending';
}

export function myOrdersOff() {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}

// The cookies page's switch. Off deletes the list as well.
export function setKeepMyOrders(on) {
  try {
    if (on) window.localStorage.removeItem(OFF_KEY);
    else window.localStorage.setItem(OFF_KEY, '1');
  } catch { /* private mode */ }
  if (!on) write([]);
  else window.dispatchEvent(new Event(EVENT));
}

export function rememberOrder(order, items, token) {
  if (!order?.reference || !token || myOrdersOff()) return;
  const entry = {
    reference: order.reference,
    token,
    placed: order.paid_at ?? order.created_at ?? null,
    total: Number(order.total) || 0,
    stage: stageOf(order),
    count: (items ?? []).reduce((n, i) => n + (Number(i.qty) || 0), 0),
    image: (items ?? []).find((i) => i.image_url)?.image_url ?? null,
    first: (items ?? [])[0]?.title ?? null,
    firstQty: Number((items ?? [])[0]?.qty) || 1,
    lines: (items ?? []).length,
    gift: Boolean(order.is_gift),
    seen: Date.now(),
  };
  const rest = readMyOrders().filter((o) => o.reference !== entry.reference);
  write([entry, ...rest].slice(0, MAX));
}

export function forgetMyOrders() { write([]); }

export const MY_ORDERS_EVENT = EVENT;
export const MY_ORDERS_KEY = KEY;
