import styles from '@styles/ui/portal/search-tile.module.css';

const gbp = (v) => (v == null ? '--'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v));

/*
 * The listing as it appears in eBay search results.
 *
 * A title, a photograph and a price are all a buyer sees before deciding
 * whether to open it, and 98% of the people shown her listings did not. Editing
 * those three fields without seeing the thing they produce is guessing.
 */
export function SearchTile({ title, image, price, feedback, compare }) {
  const truncated = title.length > 80;

  return (
    <div className={styles.wrap}>
      <div className={styles.tile}>
        <div className={styles.shot}>
          {image
            ? <img src={image} alt="" loading="lazy" />
            : <span className={styles.shotEmpty} aria-hidden="true" />}
        </div>

        <div className={styles.body}>
          {/* eBay clips at 80 and the clip is what buyers read. */}
          <p className={styles.title}>
            {title.slice(0, 80)}
            {truncated && <span className={styles.clip}>{title.slice(80)}</span>}
          </p>

          <p className={styles.meta}>Brand new</p>
          <p className={styles.price} data-num>{gbp(price)}</p>
          <p className={styles.postage}>Free postage</p>

          {feedback != null && (
            <p className={styles.seller} data-num>
              {feedback} feedback
            </p>
          )}
        </div>
      </div>

      {compare != null && price != null && (
        <p className={styles.compare}>
          {price < compare
            ? <>Undercuts the seller who is converting by <strong>{gbp(compare - price)}</strong></>
            : price > compare
              ? <>Above the seller who is converting by <strong>{gbp(price - compare)}</strong></>
              : 'Matches the seller who is converting'}
        </p>
      )}
    </div>
  );
}
