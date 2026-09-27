import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Orders, for the portal.
 *
 * Reads directly under an authenticated session, which is what every other
 * portal page does. Migration 0042 is what makes that possible and what keeps
 * it narrow: select on the columns below, update on four of them, and nothing
 * else. This hook cannot write a total even if somebody asks it to.
 *
 * `access_token` is not in the select and is not granted. A query naming it
 * fails outright rather than quietly returning a null, which is the behaviour
 * to want if anyone puts it back.
 */

/*
 * Two hundred rows is months at the volume this shop is about to have and days
 * at a volume that would need paging. `truncated` comes back true when the cap
 * is reached, and the page says so, because a header figure summed over
 * whatever happened to load is exactly the sort of number that gets defended
 * later. When it starts coming back true this becomes a paged query and the
 * figures become a database aggregate.
 */
const LIMIT = 200;

const SELECT = `
  id, tenant_id, reference, status,
  email, name, phone, address,
  subtotal, delivery, total, currency,
  customer_note, paid_at, created_at,
  is_gift, recipient_name, recipient_phone, recipient_email, notify_recipient, gift_message,
  dispatched_at, carrier, tracking_number, tracking_url,
  order_items ( id, slug, title, image_url, unit_price, qty, line_total ),
  order_emails ( kind, status, subject, identity_complete, created_at )
`;

/*
 * Paid and not gone out. The only number on this page that names a task, so it
 * is the one the header leads with and the filter the page opens on.
 *
 * Refunded is excluded deliberately. A refunded order that never shipped is not
 * a parcel to pack, and putting it in this list would tell her to post
 * something she has already given the money back for.
 */
export const isToSend = (o) => o.status === 'paid' && !o.dispatched_at;

// Dispatch is a timestamp rather than a status, so this is the whole test. An
// order can be refunded after it went out and it still went out.
export const isSent = (o) => Boolean(o.dispatched_at);

function sortRows(rows) {
  /*
   * Newest first, one sort for every filter.
   *
   * Oldest first would be better practice on the sending pile, because the
   * oldest unsent order is the one keeping somebody waiting. It is not worth it
   * yet: the pile is a handful of orders, and the question this page answers on
   * a weekday morning is which one just arrived. Revisit when the pile is
   * routinely longer than a screen.
   */
  return [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function normalise(row) {
  const { order_items: items, order_emails: emails, ...order } = row;

  // Keyed by kind, because the row asks "was the confirmation sent" rather than
  // wanting a list to search through.
  const sent = {};
  for (const e of emails ?? []) sent[e.kind] = e;

  return {
    ...order,
    items: [...(items ?? [])].sort((a, b) => String(a.title).localeCompare(String(b.title))),
    itemCount: (items ?? []).reduce((n, i) => n + (Number(i.qty) || 0), 0),
    emails: sent,
  };
}

/*
 * Asks the notify function to send something about an order.
 *
 * The portal writes `dispatched_at` directly under the 0042 grants, so the
 * email is a separate call and it can fail on its own. That is why the row
 * shows what was sent rather than assuming: a parcel marked gone with nobody
 * told is a customer who thinks they have been ignored, and the only thing
 * worse than that happening is it happening invisibly.
 */
async function callNotify({ orderId, kind, resend = false }) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error('Signed out. Sign in and try again.');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, kind, resend }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `The email did not send (${res.status}).`);
  }
}

export function useOrders(tenantId) {
  const [state, setState] = useState({
    status: 'loading', rows: [], truncated: false, error: null,
  });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('orders')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) {
      return setState({ status: 'error', rows: [], truncated: false, error });
    }

    setState({
      status: 'ready',
      rows: sortRows((data ?? []).map(normalise)),
      truncated: (data ?? []).length >= LIMIT,
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Refresh when she comes back to the tab.
   *
   * What tells her an order landed is the email. This is so the page she then
   * opens is not a version from three hours ago, which matters because the next
   * thing she does on it is act. Not a socket subscription: the value of one is
   * the seconds it saves, and the cost is a live connection to a table whose
   * policy was written this week.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  /*
   * Marking a parcel gone, and correcting it afterwards.
   *
   * One function for both, because the difference is whether `dispatched_at`
   * already has a value. The caller passes the existing one and it is kept, so
   * editing a tracking number two days later does not move the date the parcel
   * left.
   *
   * There is no way to clear `dispatched_at` from here, on purpose. The
   * customer's order page changes the moment it is set, so un-sending a parcel
   * is a conversation rather than a button. If a wrong row gets marked, the
   * tracking can be corrected and the date is out by a day, which is a smaller
   * problem than a stray tap silently un-sending a real one.
   */
  const saveDispatch = useCallback(
    async ({ id, carrier, trackingNumber, trackingUrl, dispatchedAt }) => {
      const patch = {
        dispatched_at: dispatchedAt ?? new Date().toISOString(),
        carrier: carrier || null,
        tracking_number: trackingNumber?.trim() || null,
        tracking_url: trackingUrl?.trim() || null,
      };

      // Optimistic, so the row settles under her thumb rather than after a
      // round trip. A failed write reloads and throws, and the row shows the
      // failure instead of looking done.
      setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));

      const { error } = await supabase.from('orders').update(patch).eq('id', id);

      if (error) {
        await load();
        throw error;
      }

      /*
       * The email is sent only when the parcel is newly gone, not when a
       * tracking number is corrected two days later. Telling somebody twice
       * that their order has shipped is worse than telling them once.
       *
       * A failure here does not undo the dispatch. The parcel did leave, the
       * row is right, and the reload puts the missing send on screen with a way
       * to retry it.
       */
      if (!dispatchedAt) {
        try {
          await callNotify({ orderId: id, kind: 'dispatch' });
        } catch (err) {
          await load();
          throw err;
        }
      }

      await load();
    },
    [load],
  );

  // Used when a send failed, or when a customer says nothing arrived. Deletes
  // the log row first so the unique index still holds afterwards.
  const resendEmail = useCallback(async ({ id, kind }) => {
    await callNotify({ orderId: id, kind, resend: true });
    await load();
  }, [load]);

  return { ...state, reload: load, saveDispatch, resendEmail };
}

/*
 * Whether the catalogue has anything a stranger can buy.
 *
 * The reason there are no orders today is not mysterious: all 78 products are
 * draft and sample, so the read policy hides the shop from everybody. That is
 * worth saying on the empty state, and it is worth counting rather than
 * asserting, so the line disappears by itself on the day it stops being true.
 */
export function usePublicCatalogue(tenantId) {
  const [count, setCount] = useState(undefined);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('store_products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'live')
      .eq('is_sample', false)
      .then(({ count: n, error }) => setCount(error ? null : (n ?? 0)));
  }, [tenantId]);

  return count;
}
