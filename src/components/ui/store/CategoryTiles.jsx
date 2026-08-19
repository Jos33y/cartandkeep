import { Link } from 'react-router';
import { imageAt } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/category-tiles.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

// The most expensive product in a group, because it is usually the one with
// the best photograph and it is never a bottle of drain unblocker.
const cover = (items) =>
  items.filter((p) => p.image_url).sort((a, b) => Number(b.price) - Number(a.price))[0];

/*
 * Eight departments as tiles rather than as a chip rail.
 *
 * On a general store the categories are the merchandising, not a filter. A rail
 * of pills asks someone to narrow something they have not seen yet; a tile with
 * a photograph and a count shows them the range in one glance and tells them
 * honestly how deep each part of it goes.
 */
export function CategoryTiles({ groups }) {
  if (groups.length < 2) return null;

  return (
    <section className={styles.section} aria-labelledby="departments">
      <div className={styles.head}>
        <h2 id="departments" className={`${styles.heading} wide`}>Shop by department</h2>
        <p className={styles.count}>
          {groups.length} departments
        </p>
      </div>

      <ul className={styles.tiles}>
        {groups.map((group) => {
          const pick = cover(group.items);
          return (
            <li key={group.slug}>
              <Link className={styles.tile} to={categoryPath(group.slug)}>
                {pick && (
                  <img
                    className={styles.image}
                    src={imageAt(pick.image_url, 500)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <span className={styles.label}>
                  <b className={styles.name}>{group.name}</b>
                  <span className={styles.n} data-price>
                    {group.items.length} {group.items.length === 1 ? 'product' : 'products'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
