import { useEffect, useId, useState } from 'react';
import { landedOf } from '@lib/pricing';
import { formatGbp } from '@utils/formatGbp';
import { REF_WORD } from './GapRail';
import styles from '@styles/ui/portal/cost-try.module.css';

export const parseCost = (text) => {
  const v = Number(String(text ?? '').replace(/[£,\s]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
};

const KINDS = [
  { value: 'unknown', label: 'Not sure' },
  { value: 'wholesale', label: 'Wholesaler' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'retailer', label: 'Shop' },
  { value: 'marketplace', label: 'Marketplace, e.g. eBay' },
];

const EMPTY = {
  supplier: '', supplier_kind: 'unknown', fulfilment: 'dropship',
  unit_cost: '', supplier_shipping: '', price_at_moq: '', moq: '', inbound_freight_per_unit: '', duty_pct: '',
  ships_from: '', transit_days: '', url: '', note: '',
};

const num = (v) => (String(v ?? '').trim() === '' ? null : Number(String(v).replace(/[£,\s%]/g, '')));

// The one sentence that says what would move this card, from assess(). Never worked out here.
function nextStep(base) {
  const p = base.position;
  if (!p) return null;
  const ref = formatGbp(p.ref);
  const word = REF_WORD[p.refName] ?? p.refName;
  if (base.lane === 'price' && base.entry?.price != null) {
    return { tone: 'warning', text: <>Priced at the median. A small seller sells at <b data-num>{formatGbp(base.entry.price)}</b>: open that listing before you trust this price.</> };
  }
  if (p.inMarket) {
    return base.costConfirmed
      ? { tone: 'positive', text: <>In the market at {ref}. A cheaper cost only raises what you keep.</> }
      : { tone: 'positive', text: <>In the market at {ref}. Confirm the pack, or try a cheaper cost.</> };
  }
  if (base.landsUnder != null) {
    return {
      tone: 'warning',
      text: <>Find it for <b data-num>{formatGbp(base.landsUnder)}</b> or less, delivered to your buyer, and it lists at {ref}, level with {word}.</>,
      fill: base.landsUnder,
    };
  }
  return {
    tone: 'negative',
    text: base.refLeaves > 0
      ? <>At {ref}, fees leave <b data-num>{formatGbp(base.refLeaves)}</b> for the delivered goods and your profit, under the {formatGbp(base.refProfit)} profit alone. No cost lists it there.</>
      : <>At {ref}, fees take the whole price. No cost lists it there.</>,
  };
}

/*
 * A cost to try, and the supplier behind it. The quick field moves the card as she types. Saving asks for everything
 * candidate_sources records, and while the form is open the card follows the landed cost the database will store.
 */
export function CostTry({ onTry, base, view, onSave, suppliers = [] }) {
  const [quick, setQuick] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const id = useId();

  const landed = saving ? landedOf({
    fulfilment: form.fulfilment,
    unit_cost: num(form.unit_cost),
    price_at_moq: form.fulfilment === 'stock' ? num(form.price_at_moq) : null,
    supplier_shipping: form.fulfilment === 'dropship' ? num(form.supplier_shipping) : null,
    inbound_freight_per_unit: form.fulfilment === 'stock' ? num(form.inbound_freight_per_unit) : null,
    duty_pct: form.fulfilment === 'stock' && num(form.duty_pct) != null ? num(form.duty_pct) / 100 : null,
  }) : parseCost(quick);

  // The quick field is a delivered cost, so the supplier posts it; the form says who posts.
  const posted = saving && form.fulfilment === 'stock' ? 'you' : 'supplier';
  useEffect(() => { onTry(landed, posted); }, [landed, posted, onTry]);

  const step = nextStep(base);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function openForm() {
    setForm((f) => ({ ...f, unit_cost: quick, price_at_moq: quick }));
    setSaving(true);
  }

  function reset() {
    setQuick('');
    setSaving(false);
    setForm(EMPTY);
    setFailed(null);
  }

  async function save() {
    if (landed == null || !form.supplier.trim()) return;
    setBusy(true);
    setFailed(null);
    const stock = form.fulfilment === 'stock';
    try {
      await onSave({
        supplier: form.supplier.trim(),
        supplier_kind: form.supplier_kind,
        fulfilment: form.fulfilment,
        unit_cost: stock ? num(form.price_at_moq) : num(form.unit_cost),
        price_at_moq: stock ? num(form.price_at_moq) : num(form.unit_cost),
        supplier_shipping: stock ? null : num(form.supplier_shipping),
        moq: stock ? num(form.moq) : null,
        inbound_freight_per_unit: stock ? num(form.inbound_freight_per_unit) : null,
        duty_pct: stock && num(form.duty_pct) != null ? num(form.duty_pct) / 100 : null,
        ships_from: form.ships_from.trim().toUpperCase().slice(0, 2) || null,
        transit_days: num(form.transit_days),
        url: form.url.trim() || null,
        note: form.note.trim() || null,
        status: 'quoted',
        quoted_on: new Date().toISOString().slice(0, 10),
      });
      reset();
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const moved = landed != null && view.price != null;
  const stock = form.fulfilment === 'stock';

  return (
    <div className={styles.try}>
      {step && (
        <p className={styles.step} data-tone={step.tone}>
          {step.text}
          {step.fill != null && landed == null && (
            <button type="button" className={styles.fill} onClick={() => setQuick(step.fill.toFixed(2))}>
              Try {formatGbp(step.fill)}
            </button>
          )}
        </p>
      )}

      {!saving && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={id}>
            Found it cheaper? <span className={styles.hint}>Delivered to your buyer, their postage in</span>
          </label>
          <span className={styles.inputWrap}>
            <span className={styles.pound} aria-hidden="true">£</span>
            <input id={id} data-try className={styles.input} inputMode="decimal" autoComplete="off"
              value={quick} placeholder="0.00"
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuick(''); e.currentTarget.blur(); } }} />
          </span>
          {landed != null && <button type="button" className={styles.clear} onClick={reset}>Clear</button>}
          {landed != null && <button type="button" className={styles.save} onClick={openForm}>Save as a supplier</button>}
        </div>
      )}

      {saving && (
        <div className={styles.form} role="group" aria-label="Save as a supplier">
          <label className={styles.cell}>
            <span>Supplier</span>
            <input className={styles.text} list="ck-try-suppliers" autoFocus value={form.supplier} onChange={set('supplier')} placeholder="e.g. Lakeland" />
          </label>
          <datalist id="ck-try-suppliers">
            {suppliers.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
          <label className={styles.cell}>
            <span>Kind</span>
            <select className={styles.text} value={form.supplier_kind} onChange={set('supplier_kind')}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className={`${styles.cell} ${styles.wide}`}>
            <span>How it reaches the buyer</span>
            <select className={styles.text} value={form.fulfilment} onChange={set('fulfilment')}>
              <option value="dropship">They post it to the buyer</option>
              <option value="stock">I buy stock and post it</option>
            </select>
          </label>

          {stock ? (
            <>
              <Money label="Price at quantity" value={form.price_at_moq} onChange={set('price_at_moq')} />
              <label className={styles.cell}><span>Minimum order</span><input className={styles.text} inputMode="numeric" value={form.moq} onChange={set('moq')} /></label>
              <Money label="Freight per unit" value={form.inbound_freight_per_unit} onChange={set('inbound_freight_per_unit')} />
              <label className={styles.cell}><span>Duty, %</span><input className={styles.text} inputMode="decimal" value={form.duty_pct} onChange={set('duty_pct')} placeholder="0" /></label>
            </>
          ) : (
            <>
              <Money label="Cost per unit" value={form.unit_cost} onChange={set('unit_cost')} />
              <Money label="Their postage" value={form.supplier_shipping} onChange={set('supplier_shipping')} />
            </>
          )}

          <label className={styles.cell}><span>Ships from</span><input className={styles.text} maxLength={2} value={form.ships_from} onChange={set('ships_from')} placeholder="GB" /></label>
          <label className={styles.cell}><span>Days to arrive</span><input className={styles.text} inputMode="numeric" value={form.transit_days} onChange={set('transit_days')} /></label>
          <label className={`${styles.cell} ${styles.wide}`}><span>Link</span><input className={styles.text} value={form.url} onChange={set('url')} placeholder="Optional" /></label>
          <label className={`${styles.cell} ${styles.wide}`}><span>Note</span><input className={styles.text} value={form.note} onChange={set('note')} placeholder="Optional" /></label>

          <div className={styles.formFoot}>
            <span className={styles.landed}>
              Landed <b data-num>{landed != null ? formatGbp(landed) : '--'}</b>
              <small>{stock ? 'price, duty and freight' : 'cost and their postage'}</small>
            </span>
            <button type="button" className={styles.quiet} onClick={reset}>Cancel</button>
            <button type="button" className={styles.primary} disabled={busy || landed == null || !form.supplier.trim()} onClick={save}>
              Save supplier
            </button>
          </div>
          {failed && <p className={styles.failed} role="alert">{failed}</p>}
        </div>
      )}

      {moved && (
        <p className={styles.result} role="status" aria-live="polite">
          At <b data-num>{formatGbp(landed)}</b> it lists at <b data-num>{formatGbp(view.price)}</b>
          {view.position ? (view.position.inMarket ? ', in the market,' : <>, <span className={styles.over}>+{formatGbp(view.position.over)} over</span>,</>) : ''}
          {' '}and {view.keep < 0 ? 'loses' : 'keeps'} <b data-num className={view.keep < 0 ? styles.lose : styles.gain}>{formatGbp(Math.abs(view.keep ?? 0))}</b>.
        </p>
      )}
    </div>
  );
}

function Money({ label, value, onChange }) {
  return (
    <label className={styles.cell}>
      <span>{label}</span>
      <span className={styles.moneyWrap}>
        <span className={styles.pound} aria-hidden="true">£</span>
        <input className={`${styles.text} ${styles.money}`} inputMode="decimal" value={value} onChange={onChange} placeholder="0.00" />
      </span>
    </label>
  );
}
