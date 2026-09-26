import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/category-header.module.css';

// A compact head: the name, the count and range, and when most products arrive, said once here instead of on every card.
export function CategoryHeader({ name, count = null, priceMin = null, priceMax = null, arrives = null }) {
  return (
    <header className={styles.header}>
      <div className={styles.head}>
        <div className={styles.words}>
          <h1 className={`${styles.title} wide`}>{name}</h1>
          <p className={styles.meta}>
            {count === null ? '\u00a0' : (
              <>
                <span data-num>{count.toLocaleString('en-GB')}</span> {count === 1 ? 'product' : 'products'}
                {Number.isFinite(priceMin) && (
                  <>
                    {' '}&middot;{' '}
                    <span data-price>{formatGbp(priceMin)}</span>
                    {priceMax > priceMin && <> to <span data-price>{formatGbp(priceMax)}</span></>}
                  </>
                )}
                {arrives && <span className={styles.arrives}> &middot; {arrives}</span>}
              </>
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
