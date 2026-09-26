import { useEffect, useState } from 'react';
import { ProductCard } from './ProductCard';
import styles from '@styles/ui/store/product-grid.module.css';

// The entry animation runs on the first grid of a session only; replaying it on every route change reads as a stutter.
let played = false;

// Same breakpoints as the stylesheet, so a row of cards is exactly one shelf.
const WIDE = '(min-width: 900px)';
const MID = '(min-width: 620px)';
const columns = () => {
  if (typeof window === 'undefined') return 4;
  if (window.matchMedia(WIDE).matches) return 4;
  return window.matchMedia(MID).matches ? 3 : 2;
};

function useColumns(active) {
  const [cols, setCols] = useState(columns);
  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    const queries = [WIDE, MID].map((q) => window.matchMedia(q));
    const update = () => setCols(columns());
    queries.forEach((m) => m.addEventListener('change', update));
    return () => queries.forEach((m) => m.removeEventListener('change', update));
  }, [active]);
  return cols;
}

function Cells({ products, from, onQuickView, shelfName, onPrefetch, hideSection = false, commonArrival = null }) {
  return products.map((product, i) => (
    // --i is set here rather than on the card, because the delay is read on this element.
    <li key={product.id} className={styles.cell} style={{ '--i': from + i }}>
      <ProductCard product={product} index={from + i} onQuickView={onQuickView} shelfName={shelfName} onPrefetch={onPrefetch} hideSection={hideSection} commonArrival={commonArrival} />
    </li>
  ));
}

// Shared by every page that lists products. With shelves, each row of cards stands on its own board, as in the cupboard.
export function ProductGrid({ products, onQuickView, shelfName = null, shelves = false, density = null, onPrefetch = null, commonArrival = null }) {
  const animate = !played;
  if (typeof window !== 'undefined') played = true;
  const cols = useColumns(shelves);

  // With a density, columns come from the space available rather than the screen, so the same grid fits beside a filter rail or without one.
  if (density) {
    return (
      <ul className={`${styles.grid} ${styles.fluid}`} data-density={density} data-animate={animate || undefined}>
        <Cells products={products} from={0} onQuickView={onQuickView} shelfName={shelfName} onPrefetch={onPrefetch} hideSection commonArrival={commonArrival} />
      </ul>
    );
  }

  if (!shelves) {
    return (
      <ul className={styles.grid} data-animate={animate || undefined}>
        <Cells products={products} from={0} onQuickView={onQuickView} shelfName={shelfName} onPrefetch={onPrefetch} />
      </ul>
    );
  }

  const rows = [];
  for (let i = 0; i < products.length; i += cols) rows.push(products.slice(i, i + cols));

  return (
    <div className={styles.shelves} data-animate={animate || undefined}>
      {rows.map((row, r) => (
        <div key={row[0].id} className={styles.shelf}>
          <ul className={styles.grid}>
            <Cells products={row} from={r * cols} onQuickView={onQuickView} shelfName={shelfName} />
          </ul>
          <span className={styles.board} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
