import { useCallback, useState } from 'react';
import { supabase } from '@lib/supabase';
import { readExport, matchProducts } from '@lib/channelImport';

/*
 * Bringing eBay and TikTok Shop sales in from their own exports.
 *
 * Parsed in the browser rather than uploaded and parsed on a server. The file
 * holds her customers' order numbers and it has no reason to travel further
 * than it already has, and nothing here needs a function deployed to work.
 *
 * The import is two steps on purpose. Reading the file shows her what it found
 * before anything is written, because a file with the wrong report selected
 * looks exactly like a file with the right one until you see that every row
 * matched nothing.
 */
export function useChannelSales(tenantId) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [result, setResult] = useState(null);

  const read = useCallback(async ({ channel, file }) => {
    setBusy(true);
    setFailed(null);
    setResult(null);

    try {
      const text = await file.text();
      const { lines, skipped } = readExport({ channel, text, fileName: file.name });

      // Matched against her whole catalogue rather than only what is live,
      // because a product she has taken off the shop still sold on eBay last
      // month and its cost is still the right cost.
      const { data: products, error } = await supabase
        .from('store_products')
        .select('id, sku, gtin, title')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const { lines: matched, matched: hit, unmatched } = matchProducts(lines, products ?? []);

      const paid = matched.filter((l) => l.status === 'paid');
      const revenue = paid.reduce((n, l) => n + Number(l.gross), 0);

      setPreview({
        channel,
        fileName: file.name,
        lines: matched,
        skipped,
        matched: hit,
        unmatched,
        paid: paid.length,
        notPaid: matched.length - paid.length,
        revenue: Math.round(revenue * 100) / 100,
        // The earliest and latest, so she can see at a glance whether she
        // exported the range she meant to.
        from: matched.reduce((a, l) => (!a || l.sold_at < a ? l.sold_at : a), null),
        to: matched.reduce((a, l) => (!a || l.sold_at > a ? l.sold_at : a), null),
      });
    } catch (e) {
      setFailed(e?.message ?? 'That file could not be read.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }, [tenantId]);

  /*
   * Written with upsert on the unique key, so importing the same export twice
   * corrects rows rather than doubling revenue. It will be imported twice: the
   * obvious way to catch up a missed week is to export a wider range.
   *
   * In batches because an export of a busy quarter is thousands of rows and one
   * statement carrying all of them is a request that times out on a train.
   */
  const commit = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    setFailed(null);

    try {
      const rows = preview.lines.map((l) => ({ ...l, tenant_id: tenantId }));
      const SIZE = 200;
      let written = 0;

      for (let i = 0; i < rows.length; i += SIZE) {
        const { error } = await supabase
          .from('channel_sales')
          .upsert(rows.slice(i, i + SIZE), { onConflict: 'tenant_id,channel,external_ref,line_no' });

        if (error) throw error;
        written += Math.min(SIZE, rows.length - i);
      }

      setResult({ written, channel: preview.channel });
      setPreview(null);
    } catch (e) {
      setFailed(e?.message ?? 'Those sales did not save.');
    } finally {
      setBusy(false);
    }
  }, [preview, tenantId]);

  const discard = useCallback(() => { setPreview(null); setFailed(null); }, []);

  return { preview, busy, failed, result, read, commit, discard };
}
