import { Link } from 'react-router';
import { ChevronRightIcon } from '@components/ui/store/icons';
import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/category-header.module.css';

// A compact head, so the first row of products is on the first screen: the section's drawn object on its own short shelf, the name, and the range.
export function CategoryHeader({ name, count = null, priceMin = null, priceMax = null, glyph = null }) {
  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{name}</span>
      </nav>

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
