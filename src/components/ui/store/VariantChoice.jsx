import { variantBuyable } from '@hooks/useStoreProducts';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/variant-choice.module.css';

/*
 * Which one.
 *
 * "Size 5, 6 and 7" was three products inside one title, so this is the control
 * that turns a title into a choice. Rendered only when a product has variants,
 * which means the other 77 products render exactly as they did before.
 *
 * Buttons in a row rather than a select. A select hides the options behind a
 * tap and hides the sold out ones entirely, and the two things a shopper wants
 * to know here are what is available and what is not.
 *
 * Nothing is preselected. A shop that picks a size for somebody sells them the
 * wrong size occasionally, and the Add button stays disabled until they choose,
 * which is a clearer prompt than a default they did not notice.
 */
export function VariantChoice({ product, chosen, onChoose }) {
  if (!product.variants?.length) return null;

  // Only when they actually differ. A row of identical prices under a row of
  // sizes is noise, and the price is already above this control.
  const priced = product.priceFrom !== product.priceTo;

  return (
    <div className={styles.block}>
      <p className={styles.label} id="variant-label">
        Choose one
        {!chosen && <span className={styles.hint}>Pick before adding to the basket</span>}
      </p>

      <div className={styles.options} role="group" aria-labelledby="variant-label">
        {product.variants.map((v) => {
          const gone = !variantBuyable(v);
          const price = Number(v.price ?? product.price);

          return (
            <button
              key={v.id}
              type="button"
              className={styles.option}
              data-chosen={chosen?.id === v.id || undefined}
              data-gone={gone || undefined}
              // Sold out options stay on screen and stay unpressable. Hiding
              // them makes a shop look like it never stocked the size somebody
              // came for.
              disabled={gone}
              aria-pressed={chosen?.id === v.id}
              onClick={() => onChoose(v)}
            >
              <span className={styles.optionLabel}>{v.label}</span>
              {priced && <span className={styles.optionPrice} data-price>{formatGbp(price)}</span>}
              {gone && <span className={styles.optionGone}>Sold out</span>}
            </button>
          );
        })}
      </div>

      {/* Counted per variant, so "only 2 left" means two of that size rather
          than two across all of them. Five is the same threshold StockSignal
          uses, because two components disagreeing about what low means is a
          shop that contradicts itself between two lines on one page. */}
      {chosen && Number.isFinite(chosen.stock) && chosen.stock > 0 && chosen.stock <= 5 && (
        <p className={styles.low}>
          Only <span data-price>{chosen.stock}</span> of {chosen.label} left
        </p>
      )}
    </div>
  );
}
