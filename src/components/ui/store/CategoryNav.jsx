import { NavLink } from 'react-router';
import { STORE_ROUTES } from '@utils/constants';
import { visibleGroups } from '@utils/categories';
import styles from '@styles/ui/store/category-nav.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

/*
 * The catalogue's navigation.
 *
 * Links rather than local filter state, because /c/:slug is a real route.
 * Filtering in state would give the same catalogue two addresses, one of which
 * nobody could share or come back to.
 *
 * It has to hold at one group and at twenty without a layout change, since a
 * generalist catalogue changes shape every time she adds stock. So it is one
 * scrolling row rather than a menu with a fixed number of slots, and it
 * disappears below two groups, because a filter offering one choice is
 * furniture.
 *
 * Counts are set in mono and are not decoration. On a catalogue this broad the
 * count is the fastest way to see that Home is twenty four and Pet is four.
 */
export function CategoryNav({ groups: all, total }) {
  // Hidden departments stay reachable by link but off the tabs.
  const groups = visibleGroups(all);
  if (groups.length < 2) return null;

  return (
    <nav className={styles.nav} aria-label="Product categories">
      <ul className={styles.list}>
        <li>
          {/* /shop, not home. Home is a hero and shelves; this chip means
              "show me all of them", which is a different page. */}
          <NavLink to={STORE_ROUTES.SHOP} end className={styles.chip}>
            Everything
            <span className={styles.count} data-price>{total}</span>
          </NavLink>
        </li>
        {groups.map((group) => (
          <li key={group.slug}>
            <NavLink to={categoryPath(group.slug)} className={styles.chip}>
              {group.name}
              <span className={styles.count} data-num>{group.items.length}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
