import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Customers.
 *
 * Two reads, not one per row. The view answers who they are and what they have
 * spent; the orders come with it so an expanded row does not go back to the
 * database for something that was three hundred bytes away.
 *
 * At her volume that is the right trade and it is the wrong one at ten
 * thousand orders, which is the same limitation the Products page has. The
 * comment is here so whoever hits that knows it was a choice.
 */

const EMPTY = {
  status: 'loading',
  rows: [],
  error: null,
  counts: { all: 0, returning: 0, new: 0 },
};

const key = (email) => String(email ?? '').trim().toLowerCase();

export function useCustomers(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const [people, orders] = await Promise.all([
      supabase.from('store_customers')
        .select('email, name, address, orders, spent, average, first_order, last_order, to_send, is_returning')
        .eq('tenant_id', tenantId)
        .order('spent', { ascending: false }),

      supabase.from('orders')
        .select('id, reference, email, total, status, paid_at, dispatched_at, order_items ( title, qty, variant_label )')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(1000),
    ]);

    const error = people.error ?? orders.error;
    if (error) return setState({ ...EMPTY, status: 'error', error });

    /*
     * Joined on the lowercased email, the same rule the view groups on.
     *
     * Doing it any other way here would mean a customer whose orders used two
     * spellings of their address shows three orders on the row and one in the
     * list underneath, which is the sort of disagreement nobody reports and
     * everybody stops trusting the screen over.
     */
    const byEmail = new Map();
    for (const o of orders.data ?? []) {
      const k = key(o.email);
      if (!byEmail.has(k)) byEmail.set(k, []);
      byEmail.get(k).push(o);
    }

    const rows = (people.data ?? []).map((p) => ({
      ...p,
      orders: Number(p.orders),
      spent: Number(p.spent),
      average: Number(p.average),
      toSend: Number(p.to_send),
      returning: p.is_returning,
      history: byEmail.get(key(p.email)) ?? [],
    }));

    setState({
      status: 'ready',
      error: null,
      rows,
      counts: {
        all: rows.length,
        returning: rows.filter((r) => r.returning).length,
        new: rows.filter((r) => !r.returning).length,
      },
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

/*
 * Search, over the fields somebody would actually have to hand.
 *
 * This screen is opened when a person writes in saying an order never arrived,
 * so it has to be findable by whatever they signed the email with: a name, an
 * address, or an order reference they copied out of a confirmation.
 */
export function searchCustomers(rows, term) {
  const q = String(term ?? '').trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((r) => {
    const parts = [
      r.name,
      r.email,
      r.address?.postcode,
      r.address?.city,
      ...r.history.map((o) => o.reference),
    ];
    return parts.some((p) => String(p ?? '').toLowerCase().includes(q));
  });
}
