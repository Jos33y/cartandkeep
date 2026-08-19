import { ChevronDownIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/category-controls.module.css';

/*
 * Sub-sections and a sort.
 *
 * Health and Beauty is fifteen products spread across gift sets, massagers,
 * mirrors, incontinence and creams. Without a way to narrow, a shopper who
 * came for a mirror scrolls past six hampers first.
 *
 * The sub-sections are the leaf categories eBay already gave us, so every one
 * of them has products behind it and none can return nothing. Only those with
 * two or more appear: a chip that filters fifteen down to one is a worse
 * version of scrolling.
 */
export const SORTS = {
  featured: { label: 'Featured', fn: null },
  'price-asc': { label: 'Price, low to high', fn: (a, b) => Number(a.price) - Number(b.price) },
  'price-desc': { label: 'Price, high to low', fn: (a, b) => Number(b.price) - Number(a.price) },
  name: { label: 'Name, A to Z', fn: (a, b) => a.title.localeCompare(b.title) },
};

export function CategoryControls({ leaves, leaf, onLeaf, sort, onSort, count }) {
  return (
    <div className={styles.controls}>
      {leaves.length > 1 && (
        <div className={styles.leaves}>
          <button
            type="button"
            className={styles.chip}
            data-active={leaf === null || undefined}
            onClick={() => onLeaf(null)}
          >
            All
          </button>
          {leaves.map(([name, n]) => (
            <button
              key={name}
              type="button"
              className={styles.chip}
              data-active={leaf === name || undefined}
              onClick={() => onLeaf(leaf === name ? null : name)}
            >
              {name}
              <span className={styles.n} data-price>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.right}>
        <p className={styles.count} aria-live="polite">
          {count} {count === 1 ? 'product' : 'products'}
        </p>
        <label className={styles.sort}>
          <span className={styles.sortLabel}>Sort</span>
          <select value={sort} onChange={(e) => onSort(e.target.value)}>
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDownIcon size={15} />
        </label>
      </div>
    </div>
  );
}
