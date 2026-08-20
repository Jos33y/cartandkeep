import { supabase } from './supabase';

/*
 * What people do in the shop, recorded without touching their device.
 *
 * No cookie, no localStorage, no sessionStorage. Under PECR any storage that
 * is not strictly necessary needs consent, and the ICO has been explicit that
 * this covers localStorage and similar technologies rather than only cookies.
 * A banner would cost more conversions than the analytics are worth on a shop
 * this size.
 *
 * So the session id is a module variable. It lives as long as the tab does and
 * dies on reload, which means it cannot follow anybody anywhere. The one place
 * that matters is the trip to Stripe and back, and that is solved by carrying
 * the id on the order row rather than by storing it on the visitor.
 *
 * Every write is fire and forget. Analytics must never be able to break a
 * shop, so nothing here is awaited, nothing throws, and a failure is one
 * console line in development and silence in production.
 */

// Set once, per tab, in memory.
const SESSION = (() => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
})();

export const sessionId = () => SESSION;

let tenantId = null;
export const setAnalyticsTenant = (id) => { tenantId = id; };

/*
 * The campaign tag from the link she shared, read once on arrival.
 *
 * The referrer below covers most of it and misses the one channel she already
 * has an audience on. TikTok's in-app browser strips the referrer, so a visit
 * from the bio link is indistinguishable from somebody typing the address in.
 * A tag on that link is the only reliable signal, which makes this the piece
 * that decides whether TikTok is ever measurable at all.
 *
 * Held in a module variable for the same reason the session id is: nothing goes
 * on the visitor's device, so it lives as long as the tab and dies on reload.
 * That means it is captured now rather than when the first event fires, because
 * a client-side navigation rewrites the address bar and the tag would be gone.
 *
 * Truncated, because a query string is somebody else's input and an unbounded
 * one has no business reaching a database column.
 */
const CAMPAIGN = (() => {
  if (typeof window === 'undefined') return {};
  try {
    const q = new URLSearchParams(window.location.search);
    const take = (k) => {
      const v = q.get(k);
      return v ? v.trim().slice(0, 80) : null;
    };
    return {
      utm_source: take('utm_source'),
      utm_medium: take('utm_medium'),
      utm_campaign: take('utm_campaign'),
    };
  } catch {
    return {};
  }
})();

/*
 * A referrer with the host and path and nothing else.
 *
 * Query strings on inbound links routinely carry an email address, a click id
 * or a session token from whatever sent the visitor, and none of that is ours
 * to keep.
 */
function safeReferrer() {
  if (typeof document === 'undefined' || !document.referrer) return null;
  try {
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return null;
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return null;
  }
}

/*
 * Batched, because a product grid can fire a dozen events in a second and a
 * dozen round trips for that is a waste of somebody's connection.
 */
let queue = [];
let timer = null;
const FLUSH_MS = 2000;
const MAX_BATCH = 20;

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0 || !tenantId) return;

  const batch = queue;
  queue = [];

  try {
    const { error } = await supabase.from('store_events').insert(batch);
    if (error && import.meta.env.DEV) console.warn('[analytics]', error.message);
  } catch (err) {
    // Dropped, deliberately. Retrying analytics costs a shopper bandwidth to
    // fix a number nobody is waiting on.
    if (import.meta.env.DEV) console.warn('[analytics]', err);
  }
}

export function track(event, { productId = null, path = null, meta = {} } = {}) {
  if (typeof window === 'undefined') return;

  queue.push({
    tenant_id: tenantId,
    session_id: SESSION,
    event,
    product_id: productId,
    path: path ?? window.location.pathname,
    meta,
    referrer: safeReferrer(),
    ...CAMPAIGN,
  });

  // A basket added to and then a tab closed is the event most worth having, so
  // a full batch goes immediately rather than waiting out the timer.
  if (queue.length >= MAX_BATCH) { flush(); return; }
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/*
 * Anything queued when the tab goes away.
 *
 * `visibilitychange` rather than `unload`, which iOS Safari does not fire, and
 * `pagehide` as the backstop. Between them they cover a phone being locked, a
 * tab being switched and a browser being quit.
 */
if (typeof document !== 'undefined') {
  const onLeave = () => { if (queue.length) flush(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onLeave();
  });
  window.addEventListener('pagehide', onLeave);
}

export const trackPageView = (path) => track('page_view', { path });
export const trackProductView = (product) =>
  track('view_product', { productId: product.id, meta: { slug: product.slug, price: Number(product.price) } });
export const trackQuickView = (product) =>
  track('quick_view', { productId: product.id, meta: { slug: product.slug } });
export const trackAdd = (product, qty) =>
  track('add_to_basket', { productId: product.id, meta: { qty, price: Number(product.price) } });
export const trackRemove = (line) =>
  track('remove_from_basket', { productId: line.id, meta: { qty: line.qty } });
export const trackSearch = (query, results) =>
  // The term, trimmed and cut. A search box is a text field and people
  // occasionally paste things into it that should not be kept.
  track('search', { meta: { q: String(query).trim().slice(0, 80), results } });
export const trackBeginCheckout = (subtotal, count) =>
  track('begin_checkout', { meta: { subtotal, items: count } });
/*
 * Saving something is the strongest intent signal short of a basket, and it was
 * the one event declared in the 0039 check constraint that nothing ever fired.
 * The heart worked, the page worked, and not one save was recorded.
 *
 * Only the save is tracked, not the unsave. An unsave is somebody tidying a
 * list rather than rejecting a product, and counting both would net them off
 * into a number that means neither thing.
 */
export const trackSave = (productId) => track('save_product', { productId });

export const trackPurchase = (order) =>
  track('purchase', { meta: { reference: order.reference, total: Number(order.total) } });
