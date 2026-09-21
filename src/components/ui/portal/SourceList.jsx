import { useState } from 'react';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/source-list.module.css';

const EMPTY = {
  supplier: '',
  fulfilment: 'dropship',
  unit_cost: '',
  supplier_shipping: '',
  moq: '',
  inbound_freight_per_unit: '',
  ships_from: '',
  transit_days: '',
  url: '',
  note: '',
};

const num = (v) => (String(v).trim() === '' ? null : Number(v));

// Rows written by a script carry a slug. She should read a name.
const display = (name, suppliers) => {
  const clean = String(name ?? '').replace(/[_-]+/g, ' ').trim();
  const known = suppliers.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (known) return known.name;
  return clean.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

// eBay restricts sellers on late delivery, so a source is not just a price. Two
// months in transit is an account risk before it is a slow one.
const SLOW_DAYS = 30;

export function SourceList({ candidate, onAdd, suppliers = [], compact = false }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const sources = candidate.sources ?? [];
  const headroom = Number(candidate.headroom ?? candidate.margin?.headroom ?? 0);
  const postage = Number(candidate.margin?.postage ?? 0);
  const shelf = candidate.margin?.shelf ?? null;

  // On a dropship order the supplier posts it, so the postage inside headroom
  // is not hers to pay and comes back on.
  const netFor = (s) => {
    if (s.landed_unit_cost == null) return null;
    const landed = Number(s.landed_unit_cost);
    if (!Number.isFinite(landed) || !headroom) return null;
    const back = s.fulfilment === 'dropship' ? postage : 0;
    return Math.round((headroom + back - landed) * 100) / 100;
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.supplier.trim()) return;
    setBusy(true);
    setFailed(null);
    try {
      await onAdd({
        supplier: form.supplier.trim(),
        fulfilment: form.fulfilment,
        supplier_kind: 'unknown',
        unit_cost: num(form.unit_cost),
        price_at_moq: num(form.unit_cost),
        supplier_shipping: num(form.supplier_shipping),
        moq: num(form.moq),
        inbound_freight_per_unit: num(form.inbound_freight_per_unit),
        ships_from: form.ships_from.trim().toUpperCase().slice(0, 2) || null,
        transit_days: num(form.transit_days),
        url: form.url.trim() || null,
        note: form.note.trim() || null,
        status: 'quoted',
        quoted_on: new Date().toISOString().slice(0, 10),
      });
      setForm(EMPTY);
      setOpen(false);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        {/* Inside a card that already names the shop and its price, a heading
            and a sentence saying the same thing is the same fact twice. */}
        {!compact && <p className="micro">Where it comes from</p>}
        <button className={styles.add} onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : compact ? 'Found it cheaper elsewhere?' : 'Add a supplier'}
        </button>
      </div>

      {!compact && sources.length === 0 && !open && (
        shelf?.shop ? (
          <p className={styles.none}>
            Priced off the shelf at {shelf.shop}
            {shelf.price != null ? `, ${formatGbp(shelf.price)}` : ''}. Add a supplier
            here if you find it cheaper somewhere else.
          </p>
        ) : (
          <p className={styles.none}>
            No supplier yet, so the goods cost is unknown and the figure above is
            headroom rather than profit.
          </p>
        )
      )}

      {sources.map((s) => {
        const net = netFor(s);
        const slow = s.transit_days != null && s.transit_days > SLOW_DAYS;

        return (
          <div key={s.id} className={styles.source}>
            <div className={styles.sourceMain}>
              <p className={styles.supplier}>
                {s.url
                  ? <a href={s.url} target="_blank" rel="noreferrer noopener">{display(s.supplier, suppliers)}</a>
                  : display(s.supplier, suppliers)}
                <span className={styles.route}>{s.fulfilment}</span>
                {s.status === 'requested' && <span className={styles.pending}>asked, no price yet</span>}
              </p>

              <p className={styles.detail}>
                {[
                  s.moq ? `minimum ${s.moq}` : null,
                  s.ships_from ? `from ${s.ships_from}` : null,
                  s.transit_days != null ? `${s.transit_days} days${slow ? ', too slow for eBay delivery expectations' : ''}` : null,
                  s.note,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className={styles.money}>
              <p className={styles.landed} data-num>
                {s.landed_unit_cost != null ? formatGbp(s.landed_unit_cost) : 'no price yet'}
              </p>
              <p className={styles.net}>
                {net == null ? 'nothing to work out yet' : `${formatGbp(net)} left`}
              </p>
            </div>
          </div>
        );
      })}

      {open && (
        <div className={styles.form}>
          <input className={styles.input} placeholder="Supplier name" autoFocus
            list="ck-suppliers" value={form.supplier} onChange={set('supplier')}
            aria-label="Supplier name" />

          <datalist id="ck-suppliers">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name}>
                {[s.country, s.kind !== 'unknown' ? s.kind : null].filter(Boolean).join(', ')}
              </option>
            ))}
          </datalist>

          <select className={styles.select} value={form.fulfilment} onChange={set('fulfilment')}
            aria-label="How it reaches the buyer">
            <option value="dropship">They post it to the buyer</option>
            <option value="stock">I buy stock and post it</option>
          </select>

          <input className={styles.input} inputMode="decimal" placeholder="Cost per unit"
            value={form.unit_cost} onChange={set('unit_cost')} aria-label="Cost per unit" />

          {form.fulfilment === 'dropship' ? (
            <input className={styles.input} inputMode="decimal" placeholder="Their postage"
              value={form.supplier_shipping} onChange={set('supplier_shipping')} aria-label="Their postage" />
          ) : (
            <>
              <input className={styles.input} inputMode="numeric" placeholder="Minimum order"
                value={form.moq} onChange={set('moq')} aria-label="Minimum order" />
              <input className={styles.input} inputMode="decimal" placeholder="Freight per unit"
                value={form.inbound_freight_per_unit} onChange={set('inbound_freight_per_unit')}
                aria-label="Freight per unit" />
            </>
          )}

          <input className={styles.input} placeholder="From, e.g. GB" maxLength={2}
            value={form.ships_from} onChange={set('ships_from')} aria-label="Ships from" />
          <input className={styles.input} inputMode="numeric" placeholder="Days"
            value={form.transit_days} onChange={set('transit_days')} aria-label="Days in transit" />
          <input className={`${styles.input} ${styles.wide}`} placeholder="Link, optional"
            value={form.url} onChange={set('url')} aria-label="Link" />
          <input className={`${styles.input} ${styles.wide}`} placeholder="Note, optional"
            value={form.note} onChange={set('note')} aria-label="Note" />

          <button className={styles.save} disabled={!form.supplier.trim() || busy} onClick={submit}>
            Save supplier
          </button>
        </div>
      )}

      {failed && <p className={styles.failed} role="alert">{failed}</p>}
    </div>
  );
}
