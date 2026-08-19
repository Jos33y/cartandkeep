import { ProductCard } from './ProductCard';
import styles from '@styles/ui/store/product-grid.module.css';

/*
 * Shared by the shop front and by a category, so the two cannot drift into
 * looking like different shops.
 *
 * Module level rather than state: the entry animation runs on the first grid
 * of a session and never again. Playing it on every route change turns a
 * pleasant arrival into a stutter between categories.
 */
let played = false;

export function ProductGrid({ products, onQuickView }) {
  const animate = !played;
  if (typeof window !== 'undefined') played = true;

  return (
    <ul className={styles.grid} data-animate={animate || undefined}>
      {products.map((product, i) => (
        // --i is set here rather than on the card, because the delay is read
        // on this element and a custom property inherits downward, not up.
        <li key={product.id} className={styles.cell} style={{ '--i': i }}>
          <ProductCard product={product} index={i} onQuickView={onQuickView} />
        </li>
      ))}
    </ul>
  );
}
