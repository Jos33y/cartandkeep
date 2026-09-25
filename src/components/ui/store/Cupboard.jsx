import { Link } from 'react-router';
import { imageAt } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/cupboard.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);
const MAX_SHELVES = 6;

// Her tagline, drawn: one compartment per section, each holding its own products. It grows as sections fill.
export function Cupboard({ groups }) {
  const shelves = groups.slice(0, MAX_SHELVES);
  const only = shelves.length === 1;

  return (
    <figure className={styles.cupboard} aria-label="The shop, shelf by shelf">
      <div className={styles.cornice} aria-hidden="true" />
      <div className={styles.body}>
        <span className={`${styles.door} ${styles.doorLeft}`} aria-hidden="true"><i /></span>
        <span className={`${styles.door} ${styles.doorRight}`} aria-hidden="true"><i /></span>

        <ul className={styles.shelves} data-count={shelves.length} data-odd={shelves.length % 2 === 1 || undefined}>
          {shelves.map((group) => {
            const shown = group.items.filter((p) => p.image_url).slice(0, only ? 4 : 3);
            const name = only && group.path === 'Everything else' ? 'Everything in the shop' : group.name;
            return (
              <li key={group.slug} className={styles.shelf}>
                <Link to={categoryPath(group.slug)} className={styles.compartment}>
                  <span className={styles.goods}>
                    {shown.map((p, i) => (
                      <img
                        key={p.id}
                        className={styles.item}
                        style={{ '--i': i }}
                        src={imageAt(p.image_url, 300)}
                        alt=""
                        loading="eager"
                        decoding="async"
                      />
                    ))}
                  </span>
                  <span className={styles.label}>
                    <span className={styles.labelName}>{name}</span>
                    <span className={styles.labelCount}>{group.items.length}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.plinth} aria-hidden="true"><i /><i /></div>
    </figure>
  );
}
