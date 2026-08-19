import { Link } from 'react-router';
import { imageAt } from '@utils/categories';
import { ChevronRightIcon } from '@components/ui/store/icons';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/category-header.module.css';

// Same choice as the tiles on the shop front: the most expensive product with
// a photograph, because that is reliably the best shot in a department and it
// is never the drain unblocker.
const cover = (items) =>
  items.filter((p) => p.image_url).sort((a, b) => Number(b.price) - Number(a.price))[0];

/*
 * A department needs a top.
 *
 * The page went straight from a chip rail into a grid, which reads as a filter
 * applied to the shop front rather than as somewhere you have arrived. This
 * gives it a breadcrumb, a banner in the same treatment as the tiles that link
 * here, and the two numbers a buyer actually wants before scrolling: how many
 * there are and where the prices start.
 */
export function CategoryHeader({ group, derived = false }) {
  const pick = cover(group.items);
  const cheapest = Math.min(...group.items.map((p) => Number(p.price)));
  const dearest = Math.max(...group.items.map((p) => Number(p.price)));

  return (
    <header className={styles.header}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{group.name}</span>
      </nav>

      <div className={styles.banner}>
        {pick && (
          <img
            className={styles.image}
            src={imageAt(pick.image_url, 800)}
            alt=""
            loading="eager"
            decoding="async"
          />
        )}
        <div className={styles.label}>
          <h1 className={`${styles.title} wide`}>{group.name}</h1>
          <p className={styles.meta}>
            {group.items.length} {group.items.length === 1 ? 'product' : 'products'}
            {Number.isFinite(cheapest) && (
              <>
                {' '}&middot;{' '}
                <span data-price>{formatGbp(cheapest)}</span>
                {dearest > cheapest && <> to <span data-price>{formatGbp(dearest)}</span></>}
              </>
            )}
          </p>
        </div>
      </div>

      {/* A price band is not a department, and saying so stops somebody
          wondering why Under 20 has no sub-sections. */}
      {derived && (
        <p className={styles.note}>
          Everything in the shop below {formatGbp(20)}, across every department.
        </p>
      )}
    </header>
  );
}
