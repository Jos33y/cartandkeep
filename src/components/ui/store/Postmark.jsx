import styles from '@styles/ui/store/postmark.module.css';

// Round, double ringed, inked a little crooked, with franking lines to its left. Placed by the caller's className.
export function Postmark({ top = null, word, date = null, shop = null, label, lines = true, className = '' }) {
  return (
    <span className={`${styles.postmark} ${className}`} data-plain={lines ? undefined : ''} role="img" aria-label={label ?? [top, word, date].filter(Boolean).join(' ')}>
      {top && <span className={styles.top}>{top}</span>}
      <span className={styles.word}>{word}</span>
      {date && <span className={styles.date}>{date}</span>}
      {shop && <span className={styles.shop}>{shop}</span>}
    </span>
  );
}
