import styles from '@styles/ui/store/stock-signal.module.css';

/*
 * How many are left, when we know.
 *
 * `availability` and `stock` have been fetched on every product since the
 * enrichment run and shown nowhere. Scarcity is the most reliable nudge in
 * retail and it is also the most abused, so the rule here is that every word
 * is either read from the database or not said.
 *
 * No countdown, no "12 people are viewing this", no number invented to look
 * urgent. If stock is null the signal is simply that it is in stock, because
 * that is all we actually know.
 */
const LOW = 5;

export function StockSignal({ product, size = 'normal' }) {
  const availability = product.availability ?? 'in_stock';
  const stock = Number.isFinite(product.stock) ? product.stock : null;

  if (availability === 'discontinued') {
    return <p className={styles.gone} data-size={size}>No longer stocked</p>;
  }

  if (availability === 'out_of_stock') {
    return <p className={styles.gone} data-size={size}>Out of stock</p>;
  }

  if (availability === 'made_to_order') {
    return <p className={styles.made} data-size={size}>Made to order</p>;
  }

  // A real number, and only when it is genuinely low. "Only 47 left" is not a
  // nudge, it is a shop telling you it has plenty.
  if (stock !== null && stock > 0 && stock <= LOW) {
    return (
      <p className={styles.low} data-size={size}>
        Only <span data-price>{stock}</span> left
      </p>
    );
  }

  if (availability === 'low_stock') {
    return <p className={styles.low} data-size={size}>Low stock</p>;
  }

  return <p className={styles.in} data-size={size}>In stock</p>;
}

export const isBuyable = (product) =>
  (product?.availability ?? 'in_stock') !== 'out_of_stock'
  && (product?.availability ?? 'in_stock') !== 'discontinued';
