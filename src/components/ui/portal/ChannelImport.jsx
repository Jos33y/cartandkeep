import { useRef, useState } from 'react';
import { useChannelSales } from '@hooks/useChannelSales';
import { channelLabel } from '@lib/channelImport';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/channel-import.module.css';

/*
 * Her eBay and TikTok Shop sales, from the exports both platforms already give
 * her.
 *
 * Not an API integration. eBay's would need her account authorised and a token
 * to keep alive, and it would still only answer the same question a file she
 * can download today already answers. When the volume makes downloading a file
 * every month annoying, that is the moment to build the integration, and not
 * before.
 */
const CHANNELS = [
  { key: 'ebay', label: 'eBay', where: 'Seller Hub, then Orders, then Download report.' },
  { key: 'tiktok', label: 'TikTok Shop', where: 'Seller Centre, then Orders, then Export.' },
];

const day = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  : null);

export function ChannelImport({ tenantId, onImported }) {
  const [channel, setChannel] = useState('ebay');
  const input = useRef(null);
  const { preview, busy, failed, result, read, commit, discard } = useChannelSales(tenantId);

  const chosen = CHANNELS.find((c) => c.key === channel);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await read({ channel, file });
  }

  async function save() {
    await commit();
    onImported?.();
  }

  return (
    <section className={styles.panel}>
      <h2 className="micro">Sales from your other channels</h2>
      <p className={styles.body}>
        The shop records its own sales. eBay and TikTok Shop keep theirs, and this brings
        them in so what you make on a product can be compared across all three.
      </p>

      <div className={styles.pick}>
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={channel === c.key}
            className={`${styles.chip} ${channel === c.key ? styles.chipOn : ''}`}
            onClick={() => { setChannel(c.key); discard(); }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className={styles.where}>{chosen.where}</p>

      <button
        type="button"
        className={styles.choose}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Reading' : `Choose your ${chosen.label} export`}
      </button>

      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".csv,text/csv"
        onChange={pick}
      />

      {failed && <p className={styles.failed} role="alert">{failed}</p>}

      {result && (
        <p className={styles.done} role="status">
          <span data-num>{result.written}</span> {channelLabel(result.channel)} lines saved.
          Importing the same export again corrects these rather than counting them twice.
        </p>
      )}

      {/*
        * Shown before anything is written.
        *
        * A file with the wrong report selected reads perfectly and produces
        * rows that match nothing, and by the time that is visible in a total it
        * is a fortnight later. Sixty seconds of looking at what it found costs
        * nothing and catches it.
        */}
      {preview && (
        <div className={styles.preview}>
          <h3 className={styles.previewTitle}>What that file has in it</h3>

          <dl className={styles.figures}>
            <Figure label="Sales" value={preview.paid} />
            <Figure label="Worth" value={formatGbp(preview.revenue)} />
            <Figure
              label="Matched to a product"
              value={`${preview.matched} of ${preview.lines.length}`}
              tone={preview.matched === 0 ? 'bad' : undefined}
            />
          </dl>

          {preview.from && (
            <p className={styles.range}>
              {day(preview.from)} to {day(preview.to)}. Check that is the period you meant.
            </p>
          )}

          {preview.matched === 0 && (
            <p className={styles.warn}>
              Nothing matched anything in your catalogue. These will still count towards what
              each channel earns, and they cannot show a profit, because profit needs what the
              product cost you and that lives on the product. Adding your eBay custom labels
              as SKUs on the matching products fixes it for good.
            </p>
          )}

          {preview.unmatched > 0 && preview.matched > 0 && (
            <p className={styles.note}>
              <span data-num>{preview.unmatched}</span> did not match a product in your shop.
              They count as revenue and cannot show a profit.
            </p>
          )}

          {preview.notPaid > 0 && (
            <p className={styles.note}>
              <span data-num>{preview.notPaid}</span> refunded or cancelled, kept on record and
              counted as nothing.
            </p>
          )}

          {preview.skipped.length > 0 && (
            <p className={styles.note}>
              <span data-num>{preview.skipped.length}</span> rows had no date, price or quantity
              and were left out.
            </p>
          )}

          <ul className={styles.lines}>
            {preview.lines.slice(0, 6).map((l) => (
              <li key={`${l.external_ref}-${l.line_no}`} className={styles.line}>
                <span className={styles.lineTitle}>{l.title}</span>
                <span className={styles.lineQty} data-num>{l.qty}</span>
                <span data-num>{formatGbp(l.gross)}</span>
                <span className={l.product_id ? styles.ok : styles.miss}>
                  {l.product_id ? 'matched' : 'no match'}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={busy} onClick={save}>
              {busy ? 'Saving' : `Import ${preview.paid} sales`}
            </button>
            <button type="button" className={styles.ghost} disabled={busy} onClick={discard}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, tone }) {
  return (
    <div className={styles.figure}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${tone === 'bad' ? styles.bad : ''}`}>{value}</dd>
    </div>
  );
}
