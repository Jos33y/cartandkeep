import { Link } from 'react-router';
import { imageAt } from '@utils/categories';
import { ChevronRightIcon } from '@components/ui/store/icons';
import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/category-header.module.css';

const SHOWN = 3;

// The unit itself: one ink panel with the department's drawn object and a few of its products standing on the board.
export function CategoryHeader({ group, derived = false }) {
  const prices = group.items.map((p) => Number(p.price)).filter(Number.isFinite);
  const cheapest = Math.min(...prices);
  const dearest = Math.max(...prices);
  const standing = group.items.filter((p) => p.image_url).slice(0, SHOWN);
  const count = group.items.length;

  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{group.name}</span>
      </nav>

      <div className={styles.unit}>
        <div className={styles.label}>
          <h1 className={`${styles.title} wide`}>{group.name}</h1>
          <p className={styles.meta}>
            {count} {count === 1 ? 'product' : 'products'}
            {prices.length > 0 && (
              <>
                {' '}&middot;{' '}
                <span data-price>{formatGbp(cheapest)}</span>
                {dearest > cheapest && <> to <span data-price>{formatGbp(dearest)}</span></>}
              </>
            )}
          </p>
          {/* A price band is not a department; saying so stops somebody wondering why it has no sub-sections. */}
          {derived && <p className={styles.note}>Across every section of the shop.</p>}
        </div>

        <div className={styles.shelf} aria-hidden="true">
          <span className={styles.object}>
            <SectionGlyph name={group.name} size={48} className={styles.glyph} />
            <i className={styles.shadow} />
          </span>
          {standing.map((p, i) => (
            <span key={p.id} className={styles.item} style={{ '--i': i }}>
              <img src={imageAt(p.image_url, 300)} alt="" loading="eager" decoding="async" />
            </span>
          ))}
          <span className={styles.board} />
        </div>
      </div>
    </header>
  );
}
