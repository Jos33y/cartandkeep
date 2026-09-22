import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * What she actually made.
 *
 * Reads the profit view, which already carries every line of the model the
 * finance screen has been promising since July: revenue, the platform fee,
 * promoted listings, packaging, a returns provision, postage and cost of goods.
 *
 * Nothing is computed here that the database can compute, because two versions
 * of a margin calculation is one of them being wrong and neither knowing it.
 */

const CHANNELS = ['store', 'ebay', 'tiktok'];

export const CHANNEL_LABEL = {
  store: 'Your shop',
  ebay: 'eBay',
  tiktok: 'TikTok Shop',
};

const sum = (rows, key) => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);
const round = (n) => Math.round(n * 100) / 100;

export function useFinance(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], costs: null, error: null });
  const [month, setMonth] = useState(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const [profit, tenant] = await Promise.all([
      supabase.from('store_channel_profit').select('*')
        .eq('tenant_id', tenantId).order('month', { ascending: false }).limit(2000),
      supabase.from('tenants').select('store').eq('id', tenantId).single(),
    ]);

    const error = profit.error ?? tenant.error;
    if (error) return setState({ status: 'error', rows: [], costs: null, error });

    setState({
      status: 'ready',
      rows: profit.data ?? [],
      costs: tenant.data?.store?.selling_costs ?? {},
      error: null,
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(
    () => [...new Set(state.rows.map((r) => r.month))].sort().reverse(),
    [state.rows],
  );

  // Whatever month is showing, defaulting to the most recent with anything in
  // it rather than to this calendar month, which on the 2nd is empty and reads
  // as a business that has stopped.
  const showing = month ?? months[0] ?? null;

  const inMonth = useMemo(
    () => state.rows.filter((r) => r.month === showing),
    [state.rows, showing],
  );

  /*
   * Per channel, and the whole model rather than a headline.
   *
   * `costed` is carried up because a channel where half the products have no
   * landed cost cannot report a net, and reporting one anyway would treat those
   * products as free. The screen says which rather than showing a figure it
   * would have to caveat.
   */
  const byChannel = useMemo(() => CHANNELS.map((channel) => {
    const rows = inMonth.filter((r) => r.channel === channel);
    const costed = rows.filter((r) => r.costed);

    return {
      channel,
      lines: rows.length,
      units: sum(rows, 'units'),
      revenue: round(sum(rows, 'revenue')),
      fees: round(sum(rows, 'fees')),
      ads: round(sum(rows, 'ads')),
      packaging: round(sum(rows, 'packaging')),
      returns: round(sum(rows, 'returns_provision')),
      postage: round(sum(rows, 'postage')),
      cost: round(sum(costed, 'cost_of_goods')),

      /*
       * Always a figure, with what it excludes said beside it.
       *
       * This used to be null whenever any product on the channel lacked a cost,
       * which is the normal state and meant the screen showed nothing for
       * months. A total over what is costed is a real number, it is just not
       * the whole month, and saying "£46.32, over 3 of 4 products" tells her
       * both things. Withholding it told her neither.
       */
      // A total over nothing is unknown, not zero. With no product costed the
      // sum was 0 and the page showed it as her profit.
      net: costed.length ? round(sum(costed, 'net')) : null,
      netCovers: costed.length,
      uncosted: rows.length - costed.length,
      unmatched: sum(rows, 'unmatched_lines'),
    };
  }).filter((c) => c.lines > 0), [inMonth]);

  const totals = useMemo(() => {
    const covered = sum(byChannel, 'netCovers');
    return {
      revenue: round(sum(byChannel, 'revenue')),
      net: covered ? round(byChannel.reduce((n, c) => n + (c.net ?? 0), 0)) : null,
      units: sum(byChannel, 'units'),
      uncosted: sum(byChannel, 'uncosted'),
      covered,
      lines: sum(byChannel, 'lines'),
      unmatched: sum(byChannel, 'unmatched'),
    };
  }, [byChannel]);

  // Products worth the most, worst costed first among equals, because a product
  // earning well with no cost recorded is the one worth ten minutes.
  const products = useMemo(() => {
    const rolled = new Map();

    for (const r of inMonth) {
      const key = r.product_id ?? `t:${r.title}`;
      const at = rolled.get(key) ?? {
        key, title: r.title, product_id: r.product_id,
        units: 0, revenue: 0, net: 0, costed: true, byChannel: [],
      };
      at.units += Number(r.units ?? 0);
      at.revenue += Number(r.revenue ?? 0);
      at.net += Number(r.net ?? 0);
      at.costed = at.costed && r.costed;

      /*
       * Kept per channel rather than folded together.
       *
       * Net per product per channel is the Section 5 line and the argument for
       * her own shop, and rolling it up to one figure per product hides it
       * exactly when it is most useful. A channel that cannot report a total
       * because one other product has no cost should not take this with it.
       */
      at.byChannel.push({
        channel: r.channel,
        units: Number(r.units ?? 0),
        revenue: round(Number(r.revenue ?? 0)),
        net: r.costed ? round(Number(r.net ?? 0)) : null,
      });

      rolled.set(key, at);
    }

    return [...rolled.values()]
      .map((r) => ({
        ...r,
        // No product id means the shop product is gone, so there is no cost
        // to add. Telling her to add one under Products is not possible.
        removed: r.product_id == null,
        revenue: round(r.revenue),
        net: r.costed ? round(r.net) : null,
        byChannel: r.byChannel.sort((a, b) => (b.net ?? -1e9) - (a.net ?? -1e9)),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [inMonth]);

  const saveCosts = useCallback(async (next) => {
    const num = (v) => {
      const s = String(v ?? '').trim();
      if (s === '') return 0;
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0) throw new Error('Those have to be numbers.');
      return n;
    };

    const { error } = await supabase.rpc('set_store_settings', {
      p_tenant: tenantId,
      p_patch: {
        selling_costs: {
          packaging_per_order: num(next.packaging),
          // Entered as a percentage and stored as a rate, because nobody thinks
          // in 0.02 and every calculation does.
          returns_provision_pct: num(next.returns) / 100,
          ad_rate_pct: num(next.ads) / 100,
        },
      },
    });

    if (error) throw new Error(error.message ?? 'Those did not save.');
    await load();
  }, [tenantId, load]);

  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState(null);

  // Her eBay orders with eBay's real fees, through the connection she approved.
  const pullEbay = useCallback(async (days = 90) => {
    setPulling(true);
    setPulled(null);
    try {
      const { data, error } = await supabase.functions.invoke('ebay-sales', {
        body: { tenant_id: tenantId, days },
      });
      if (error || data?.error) throw new Error(data?.error ?? error.message);
      setPulled(data);
      await load();
      return data;
    } finally {
      setPulling(false);
    }
  }, [tenantId, load]);

  return {
    ...state, months, showing, setMonth, byChannel, totals, products, saveCosts, reload: load,
    pullEbay, pulling, pulled,
  };
}
