import { useState } from 'react';
import { ChevronDownIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/specifications.module.css';

/*
 * Item specifics, as eBay returned them.
 *
 * All 78 products have these and none of them reached the screen. They are the
 * only structured facts the shop has about what a thing actually is: size,
 * material, capacity, colour, what is in the pack.
 *
 * Order is eBay's, which is roughly the order a seller thinks about a product,
 * except that a handful of keys are administrative rather than descriptive and
 * are dropped. Nobody buying a saucepan needs the eBay Product ID.
 */
const HIDE = new Set([
  'brand', 'mpn', 'ean', 'upc', 'gtin', 'isbn', 'custom bundle', 'modified item',
  'country/region of manufacture', 'california prop 65 warning', 'unit quantity',
  'unit type', 'non-domestic product', 'manufacturer part number', 'item height',
  'item width', 'item length', 'item weight', 'ebay product id (epid)',
]);

const CUTOFF = 6;

export function Specifications({ specifications }) {
  const [open, setOpen] = useState(false);

  const rows = Object.entries(specifications ?? {})
    .filter(([k, v]) => k && v && !HIDE.has(k.trim().toLowerCase()))
    // A value that is the whole product title is a seller filling a required
    // field, not a specification.
    .filter(([, v]) => String(v).length < 120);

  if (rows.length === 0) return null;

  const shown = open ? rows : rows.slice(0, CUTOFF);
  const hidden = rows.length - shown.length;

  return (
    <section className={styles.section} aria-labelledby="specs">
      <h2 id="specs" className={styles.head}>Details</h2>

      <dl className={styles.list}>
        {shown.map(([label, value]) => (
          <div className={styles.row} key={label}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Six then a toggle. Some of these products carry twenty specifics and a
          wall of them buries the buy button on a phone. */}
      {(hidden > 0 || open) && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show fewer' : `Show ${hidden} more`}
          <ChevronDownIcon size={15} data-open={open || undefined} />
        </button>
      )}
    </section>
  );
}
