import { useState } from 'react';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/product-row.module.css';

/*
 * Sizes, colours, pack sizes.
 *
 * "Size 5, 6 and 7" is three products sitting inside one title on her shop
 * today, and this is the screen that separates them. Its own file rather than
 * another section of ProductRow, which already carries nine panels and twenty
 * pieces of state.
 *
 * Rendered on every product, including the 77 with none. A panel that appears
 * only once a product already has variants is a panel nobody can find the first
 * time, which is the only time it matters.
 */
export function VariantsPanel({ product, busy, run, onAdd, onSave, onRemove }) {
  const variants = product.store_variants ?? [];

  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [note, setNote] = useState(null);

  async function add() {
    await run(async () => {
      await onAdd({
        productId: product.id,
        tenantId: product.tenant_id,
        label,
        price,
        stock,
      });
      setLabel('');
      setPrice('');
      setStock('');
    });
  }

  async function remove(v) {
    setNote(null);
    await run(async () => {
      const what = await onRemove({ id: v.id });
      // Said afterwards rather than confirmed beforehand. The two outcomes are
      // different and only one of them is reversible, so telling her which
      // happened is more use than asking her to predict it.
      setNote(what === 'discontinued'
        ? `${v.label} has been ordered before, so it is off sale rather than deleted. Old orders keep it.`
        : null);
    });
  }

  return (
    <section className={styles.panel}>
      <h4 className="micro">Sizes and options</h4>

      {variants.length === 0 ? (
        <p className={styles.settled}>
          One price and one count for the whole product. Add options below if it
          comes in sizes, colours or pack sizes.
        </p>
      ) : (
        <ul className={styles.variants}>
          {variants.map((v) => {
            const gone = v.availability === 'out_of_stock' || v.availability === 'discontinued';
            return (
              <li key={v.id} className={styles.variant} data-gone={gone || undefined}>
                <span className={styles.variantLabel}>{v.label}</span>

                {/* The product's price when the variant has none, marked as
                    inherited rather than repeated, so it is visible that
                    changing the product price changes this one too. */}
                <span className={`figure ${styles.variantPrice}`} data-num>
                  {v.price === null || v.price === undefined
                    ? <span className={styles.inherited}>{formatGbp(product.price)}</span>
                    : formatGbp(v.price)}
                </span>

                <span className={styles.variantStock}>
                  {v.stock === null || v.stock === undefined
                    ? 'untracked'
                    : <><span data-num>{v.stock}</span> left</>}
                </span>

                {gone && <span className={styles.variantGone}>off sale</span>}

                <button
                  type="button"
                  className={styles.bare}
                  disabled={busy}
                  onClick={() => remove(v)}
                  aria-label={`Remove ${v.label}`}
                >
                  &times;
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {note && <p className={styles.settled}>{note}</p>}

      <div className={styles.variantAdd}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Size 5"
            autoComplete="off"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Price</span>
          <input
            className={styles.input}
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            placeholder={formatGbp(product.price)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How many</span>
          <input
            className={styles.input}
            value={stock}
            inputMode="numeric"
            onChange={(e) => setStock(e.target.value)}
            placeholder="Any"
          />
        </label>

        <button
          type="button"
          className={styles.primary}
          disabled={busy || !label.trim()}
          onClick={add}
        >
          Add
        </button>
      </div>

      {/* Only the half the placeholders cannot say.
          The price box already shows the product price as its placeholder, so
          "leave it empty and it follows the product price" was the same fact
          twice. An empty count has no placeholder that can carry its meaning. */}
      <p className={styles.hint}>
        No count means it never runs out.
      </p>
    </section>
  );
}
