import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * The mailing list.
 *
 * A screen and an export, and the export is the point. A list she cannot take
 * out of this system is a list she does not own, and it is in the signed scope
 * as a data ownership promise. Built now rather than at handover, because
 * built early it demonstrates the promise is real and built late it is a
 * scramble during a termination.
 *
 * The row is also the consent record: when, from which page, and what the box
 * said at the time. That last one is what makes consent provable after the
 * copy has changed, so it goes in the export as its own column.
 */

const EMPTY = {
  status: 'loading',
  rows: [],
  error: null,
  counts: { on: 0, off: 0, all: 0 },
};

export function useSubscribers(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    /*
     * The table, not the view.
     *
     * `store_mailing_list` is what anything that sends should read, because it
     * cannot include somebody who left. This screen is the one place that
     * needs to see them: the record of an unsubscribe is the evidence the opt
     * out worked, and hiding it would leave her unable to answer somebody who
     * says they never got taken off.
     */
    const { data, error } = await supabase
      .from('store_subscribers')
      .select('id, email, name, source, wording, consented_at, unsubscribed_at')
      .eq('tenant_id', tenantId)
      .order('consented_at', { ascending: false });

    if (error) return setState({ ...EMPTY, status: 'error', error });

    const rows = (data ?? []).map((r) => ({ ...r, on: !r.unsubscribed_at }));

    setState({
      status: 'ready',
      error: null,
      rows,
      counts: {
        on: rows.filter((r) => r.on).length,
        off: rows.filter((r) => !r.on).length,
        all: rows.length,
      },
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Taking somebody off by hand.
   *
   * Somebody who writes in rather than clicking the link still has to come
   * off, and the law does not care which route they used. A date rather than a
   * delete, the same as the link does, so the record of having left survives.
   *
   * There is no way to put somebody back on from here. Consent has to come
   * from them, and a button that adds an address to a mailing list from the
   * inside is the one control on this screen that could not be defended.
   */
  const remove = useCallback(async (id) => {
    const { error } = await supabase.from('store_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('id', id)
      .is('unsubscribed_at', null);
    if (error) throw error;
    await load();
  }, [load]);

  return { ...state, reload: load, remove };
}
