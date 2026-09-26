import { useEffect, useRef, useState } from 'react';
import { CATEGORY_MIN, NEW_LISTING_STOCK } from '@hooks/useCatalogue';
import { stepsFor } from '@lib/readiness';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import row from '@styles/ui/portal/product-row.module.css';
import sheet from '@styles/ui/portal/product-sheet.module.css';
import styles from '@styles/ui/portal/new-product.module.css';

export function NewProduct({ categories, columns, onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const first = useRef(null);

  const chosen = categories.find((c) => c.path === section);
  const ok = title.trim() && Number(price) > 0;

  // What the row will look like the moment it lands, so the next steps are visible before it exists.
  const steps = stepsFor({
    title, price: Number(price) || null, category_path: null, section: section || null, status: 'draft',
    image_url: null, images: [], stock: NEW_LISTING_STOCK, derived_fields: {}, landed_cost: null,
  }, columns).filter((s) => s.state !== 'none');
  const done = steps.filter((s) => s.state === 'done').length;

  useEffect(() => {
    first.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  async function submit() {
    if (!ok) return;
    setBusy(true);
    setFailed(null);
    try {
      await onCreate({ title: title.trim(), price, section });
    } catch (e) {
      setFailed(e?.message ?? 'That did not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <div className={sheet.scrim} onClick={onCancel} aria-hidden="true" />
      <form
        className={sheet.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-product-title"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <header className={`${sheet.top} ${styles.top}`}>
          <button type="button" className={sheet.close} onClick={onCancel} aria-label="Close">
            <Icon name="IconX" width="18" height="18" />
          </button>
          <h2 id="new-product-title" className={styles.title}>Add a product</h2>
          <p className={styles.lead}>Name and price now. Photographs and the rest once it is on the list.</p>
        </header>

        <div className={sheet.body}>
          <section className={sheet.section}>
            <div className={sheet.sectionBody}>
              <div className={row.panel}>
                <label className={row.field}>
                  <span className={row.split}>
                    <span className={row.label}>What is it</span>
                    <span className={row.count} data-num data-over={title.trim().length > 80 || undefined}>
                      {title.trim().length}/80
                    </span>
                  </span>
                  <input ref={first} className={row.input} value={title} autoComplete="off"
                    onChange={(e) => setTitle(e.target.value)} placeholder="Cast Iron Casserole Dish 4.7 Litre" />
                  <span className={row.hint}>The way somebody would search for it. Size and quantity earn their place, adjectives do not.</span>
                </label>

                <div className={row.pair}>
                  <label className={row.field}>
                    <span className={row.label}>Price</span>
                    <span className={row.control}>
                      <span className={row.affix} aria-hidden="true">£</span>
                      <input className={row.bare} data-num inputMode="decimal" placeholder="34.99"
                        value={price} onChange={(e) => setPrice(e.target.value)} autoComplete="off" />
                    </span>
                  </label>
                  <label className={row.field}>
                    <span className={row.label}>Where it sits</span>
                    <select className={row.input} value={section} onChange={(e) => setSection(e.target.value)}>
                      <option value="">Everything else</option>
                      {categories.map((c) => <option key={c.path} value={c.path}>{c.label}</option>)}
                    </select>
                  </label>
                </div>

                {chosen && chosen.count + 1 < CATEGORY_MIN && (
                  <p className={row.thin}>
                    {chosen.label} would have <span data-num>{chosen.count + 1}</span>. A section needs {CATEGORY_MIN},
                    so until then it shows under Everything else.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className={`${sheet.section} ${styles.preview}`} aria-label="How it will arrive">
            <header className={sheet.sectionHead}>
              <h3 className={sheet.sectionTitle}>How it arrives</h3>
              <span className={sheet.sectionNote}><span data-num>{done}</span> of <span data-num>{steps.length}</span> steps done</span>
            </header>
            <div className={sheet.sectionBody}>
              <div className={styles.card}>
                <span className={styles.thumb} aria-hidden="true"><Icon name="IconPlus" width="16" height="16" /></span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle} data-empty={!title.trim() || undefined}>
                    {title.trim() || 'Your product'}
                  </span>
                  <span className={styles.cardMeta}>
                    <span className={styles.blocked}><i aria-hidden="true" />Blocked</span>
                    {chosen?.label ?? 'Everything else'}
                  </span>
                </span>
                <span className={styles.cardPrice} data-num>{Number(price) > 0 ? formatGbp(Number(price)) : <span className={styles.noPrice}>No price</span>}</span>
              </div>
              <ul className={styles.steps}>
                {steps.map((s) => (
                  <li key={s.key} data-open={s.state !== 'done' || undefined}>
                    <StepMark state={s.state} size="sm" />{s.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <footer className={sheet.foot}>
          <p className={sheet.status} role="status" aria-live="polite">
            {failed ? <span className={sheet.failed}>{failed}</span> : 'Photographs come straight after, on the next screen.'}
          </p>
          <button type="button" className={sheet.quiet} disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="submit" className={sheet.go} disabled={busy || !ok}>{busy ? 'Adding' : 'Add it'}</button>
        </footer>
      </form>
    </>
  );
}
