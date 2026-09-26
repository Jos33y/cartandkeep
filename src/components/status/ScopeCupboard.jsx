import styles from '@styles/ui/status/scope-cupboard.module.css';

// The signed scope as a cupboard: one shelf per part, one box per item, filled when it works today.
export function ScopeCupboard({ shelves, isNew }) {
  let n = 0;
  // One column count for every shelf, so a box is the same size wherever it sits.
  const cols = Math.max(...shelves.map((s) => s.items.length));
  return (
    <figure className={styles.unit} style={{ '--cols': cols }}>
      {shelves.map((shelf) => {
        const done = shelf.items.filter((i) => i.state === 'done').length;
        return (
          <div key={shelf.key} className={`${styles.shelf} ${shelf.apart ? styles.apart : ''}`}>
            <p className={styles.label}>
              <span>{shelf.label}</span>
              <span className={styles.count} data-num>{done} of {shelf.items.length}</span>
            </p>
            <ul className={styles.row}
              aria-label={`${shelf.label}: ${done} of ${shelf.items.length} delivered`}>
              {shelf.items.map((item) => {
                n += 1;
                const filled = item.state === 'done';
                return (
                  <li key={item.label} style={{ '--i': n }}
                    className={`${styles.box} ${filled ? styles.filled : styles.empty} ${filled && isNew(item) ? styles.fresh : ''}`}
                    title={`${item.label}: ${filled ? 'delivered' : 'not yet'}`} />
                );
              })}
            </ul>
            <span className={styles.plank} aria-hidden="true" />
          </div>
        );
      })}
    </figure>
  );
}
