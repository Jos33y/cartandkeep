import styles from '@styles/ui/portal/product-row.module.css';

/*
 * What the model found wrong with the record.
 *
 * Its own panel rather than part of the description, for two reasons. These are
 * findings about the product, not about the writing, so they outlive the draft
 * they arrived with. And they gate release, which the description does not, so
 * burying them under a textarea put the one blocking thing on the row below the
 * one thing that never blocks.
 *
 * Sits first on the row, above returns, because it is the reason the row is
 * blocked and a person should not have to scroll to find out why.
 *
 * No dialogue. A box that appears on every row is a box that gets clicked
 * through inside a week, and then it is worse than nothing because it looks
 * like a check that happened.
 */
export function ChecksPanel({ product, checks, busy, run, onAcknowledge }) {
  const read = Boolean(checks?.read_at);

  return (
    <section className={styles.panel}>
      <h4 className="micro">Things to check</h4>

      <p className={read ? styles.settled : styles.guessed}>
        {read
          ? 'You have read these. They are kept in case they matter later.'
          : 'The source data contradicts itself here. Read these before this goes on sale. You do not have to fix them, and some of them cannot be fixed.'}
      </p>

      <ul className={styles.flags}>
        {checks.items.map((item) => <li key={item}>{item}</li>)}
      </ul>

      {!read && (
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => run(() => onAcknowledge(product.id))}
        >
          I have read these
        </button>
      )}
    </section>
  );
}
