import styles from '@styles/ui/store/skeleton.module.css';

/*
 * Loading states.
 *
 * The rule is not "make the wait interesting", it is "make nothing move when
 * the wait ends". Every skeleton here is the exact geometry of the thing it
 * stands in for: same aspect ratio, same padding, same line count, same
 * height. A grid that reflows when products arrive undoes any amount of
 * polish, and it is the single most common way a shop feels cheap.
 *
 * The sweep is her own palette rather than the grey shimmer every template
 * ships. Warm to a lighter warm, one pass every 1.4 seconds, at an angle so it
 * reads as light crossing a surface rather than a bar sliding along a track.
 */

export function Block({ w, h, r, className }) {
  return (
    <span
      className={`${styles.block} ${className ?? ''}`}
      style={{ width: w, height: h, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

/*
 * One product tile. Mirrors ProductCard exactly: square image, leaf line,
 * two title lines, price. The second title line is short because most titles
 * wrap unevenly and a pair of full width bars reads as a table.
 */
export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <span className={`${styles.block} ${styles.shot}`} />
      <span className={styles.body}>
        <span className={`${styles.block} ${styles.leaf}`} />
        <span className={`${styles.block} ${styles.line}`} />
        <span className={`${styles.block} ${styles.lineShort}`} />
        <span className={`${styles.block} ${styles.price}`} />
      </span>
    </div>
  );
}

/*
 * `count` defaults to eight because that is two full rows on a phone and
 * exactly fills the first screen on a desktop. Fewer leaves a gap that then
 * fills, which is the jump this exists to prevent.
 */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className={styles.grid} role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)}
      <span className={styles.srOnly}>Loading products</span>
    </div>
  );
}

// The category rail, so the nav does not appear after the grid and shove it
// down the page.
export function CategoryNavSkeleton({ count = 5 }) {
  return (
    <div className={styles.nav} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`${styles.block} ${styles.chip}`}
          // Varied widths, because five identical pills read as a loading bar
          // rather than as categories about to arrive.
          style={{ width: [96, 148, 132, 108, 120][i % 5] }}
        />
      ))}
    </div>
  );
}
