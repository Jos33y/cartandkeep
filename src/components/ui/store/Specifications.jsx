import { useState } from 'react';
import { ChevronDownIcon } from '@components/ui/store/icons';
import { visibleSpecs } from '@utils/specs';
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
const CUTOFF = 6;

export function Specifications({ specifications }) {
  const [open, setOpen] = useState(false);

  /*
   * One list, shared with the portal.
   *
   * The blocklist and the mark stripping used to live in this file and again in
   * the draft function, which is how the portal ended up showing her the eBay
   * policy ids after the shop had stopped showing them to customers. The 120
   * character limit is the shop's own: a value that long is a seller filling a
   * required field with the whole product title.
   */
  const rows = visibleSpecs(specifications, { max: 120 });

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
