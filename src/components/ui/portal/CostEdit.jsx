import { useId, useState } from 'react';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/cost-edit.module.css';

// An empty box is no figure; anything else has to be a sum of money.
function pounds(v, what) {
  const s = String(v ?? '').replace(/[£,\s]/g, '');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${what} has to be an amount in pounds, or empty.`);
  return Math.round(n * 100) / 100;
}

const today = () => new Date().toISOString().slice(0, 10);

/*
 * A supplier's cost, changed by hand: what one unit costs and their postage. Saved as hers (cost_by 'her'), so the
 * morning Amazon read never moves it; she is told when Amazon's price differs instead (CostOffer).
 */
export function CostEdit({ source, onSave, label = 'Change the cost' }) {
  const goods = source?.price_at_moq ?? source?.unit_cost ?? null;
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState('');
  const [post, setPost] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const hintId = useId();

  if (!source?.id) return null;

  function start() {
    setCost(goods != null ? Number(goods).toFixed(2) : '');
    setPost(source.supplier_shipping != null ? Number(source.supplier_shipping).toFixed(2) : '');
    setFailed(null);
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setFailed(null);
    let unit;
    let ship;
    try {
      unit = pounds(cost, 'The cost');
      ship = pounds(post, 'Their postage');
      if (unit == null) throw new Error('Put in what one costs you.');
    } catch (err) { setFailed(err.message); return; }
    setBusy(true);
    try {
      await onSave({ unit_cost: unit, price_at_moq: unit, supplier_shipping: ship, cost_by: 'her', quoted_on: today() });
      setOpen(false);
    } catch (err) {
      setFailed(err?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <p className={styles.line}>
        {source.cost_by === 'her' && <span className={styles.who}>Your own cost</span>}
        {source.cost_by === 'amazon' && <span className={styles.who}>Follows Amazon&apos;s price</span>}
        <button type="button" className={styles.link} onClick={start}>{label}</button>
      </p>
    );
  }

  return (
    <form className={styles.form} onSubmit={save} aria-label="Change the cost">
      <label className={styles.field}>
        <span className={styles.label}>One costs you</span>
        <span className={styles.money}>
          <span aria-hidden="true">£</span>
          <input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} autoFocus aria-describedby={hintId} />
        </span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Their postage</span>
        <span className={styles.money}>
          <span aria-hidden="true">£</span>
          <input inputMode="decimal" value={post} onChange={(e) => setPost(e.target.value)} placeholder="0.00" />
        </span>
      </label>
      <p className={styles.hint} id={hintId}>Saved as your own cost. The morning Amazon check tells you when its price differs, and leaves yours.</p>
      <div className={styles.actions}>
        <button type="submit" className={styles.save} disabled={busy}>{busy ? 'Saving' : 'Save the cost'}</button>
        <button type="button" className={styles.link} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </form>
  );
}

/*
 * Amazon's price, offered when it differs from a cost she set herself (or one that matched no Amazon price, such as
 * a Business price). One press makes it the cost and lets it follow Amazon from then on.
 */
export function CostOffer({ offer, onUse }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  if (!offer) return null;
  async function use() {
    setBusy(true);
    setFailed(null);
    try {
      await onUse({ unit_cost: offer.to, price_at_moq: offer.to, supplier_shipping: offer.shipping, cost_by: 'amazon', quoted_on: today() });
    } catch (err) {
      setFailed(err?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.offer}>
      <button type="button" className={styles.use} disabled={busy} onClick={use}>
        {busy ? 'Saving' : `Use ${formatGbp(offer.to)} as your cost`}
      </button>
      <span className={styles.offerHint}>{offer.deal ? 'The price after the deal ends. ' : ''}It then follows Amazon&apos;s price each morning.</span>
      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </div>
  );
}
