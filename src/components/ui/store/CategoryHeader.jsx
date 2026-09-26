import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/category-header.module.css';

// A compact head, so the first row of products is on the first screen of the shortest laptop: the section's object on a short ledge, the name, the range. The tabs above are the way up, so there is no breadcrumb.
export function CategoryHeader({ name, count = null, priceMin = null, priceMax = null, glyph = null }) {
  return (
    <header className={styles.header}>
      <div className={styles.head}>
        <span className={styles.object} aria-hidden="true">
          <SectionGlyph name={glyph ?? name} size={48} className={styles.glyph} />
          <i className={styles.ledge} />
        </span>
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
              </>
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
