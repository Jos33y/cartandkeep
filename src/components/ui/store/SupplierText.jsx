import { useState } from 'react';
import styles from '@styles/ui/store/supplier-text.module.css';

/*
 * The seller's own description, labelled as such.
 *
 * Every one of the 78 has one and none of them is hers. They are supplier and
 * lister copy: keyword runs, postage tables, occasional shouting. Putting that
 * under a heading that says "About this product" would pass somebody else's
 * words off as the shop's voice.
 *
 * So it sits under "From the supplier's listing", below her own description
 * rather than instead of it, and it disappears the moment she writes one. That
 * is how Amazon handles "From the manufacturer" and it is honest for the same
 * reason.
 */
const CUTOFF = 420;

export function SupplierText({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  const clean = String(text).trim();
  const long = clean.length > CUTOFF;
  const shown = open || !long ? clean : `${clean.slice(0, CUTOFF).trimEnd()}\u2026`;

  return (
    <section className={styles.section}>
      <h2 className={styles.head}>From the supplier&rsquo;s listing</h2>
      <p className={styles.body}>{shown}</p>
      {long && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)}>
          {open ? 'Show less' : 'Read all of it'}
        </button>
      )}
      <p className={styles.note}>
        Written by whoever supplied the product, not by us.
      </p>
    </section>
  );
}
