import styles from '@styles/ui/store/load-track.module.css';

// How far through the results you are, as a track that fills, with the button that fills it further.
export function LoadTrack({ shown, total, pageSize, busy, onMore }) {
  if (!total || total <= 0) return null;
  const done = shown >= total;
  const next = Math.min(pageSize, total - shown);
  return (
    <div className={styles.track}>
      <p className={styles.words}>
        {done ? 'That is everything' : 'Showing'} <span data-num>{shown.toLocaleString('en-GB')}</span> of <span data-num>{total.toLocaleString('en-GB')}</span>
      </p>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={shown} aria-label="Products shown">
        <span style={{ transform: `scaleX(${Math.min(1, shown / total)})` }} />
      </div>
      {!done && (
        <button type="button" className={styles.more} onClick={onMore} disabled={busy}>
          {busy ? 'Loading' : `Show ${next} more`}
        </button>
      )}
    </div>
  );
}
