import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@components/ui/shared/Logo';
import { BasketIcon, HeartIcon, SearchIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/layout/store/store-header.module.css';

/*
 * The header linked to /c/beauty and /c/pet, which were a 404 for anyone who
 * clicked because neither exists in the catalogue. Removing them left the bar
 * empty, which is its own problem: a shop with eight departments and no way
 * into any of them from the top of the page.
 *
 * These are a constant rather than a derived list. The header renders on the
 * cart, the checkout and every legal page, and deriving them would mean
 * fetching the whole catalogue on all of those. A department that later
 * empties leads to a page that says so with a way back, which is a much
 * cheaper failure than a query on every route.
 *
 * Four, not eight. The rest sit behind "All departments", because a header
 * that scrolls is a header nobody reads.
 *
 * No account link, and there will not be one. Checkout is guest only and the
 * fastest way to lose an order is to put a password between somebody and it.
 */
const DEPARTMENTS = [
  ['Home & DIY', '/c/home-furniture-and-diy'],
  ['Health & beauty', '/c/health-and-beauty'],
  ['Pet', '/c/pet-supplies'],
  ['Under \u00a320', '/c/under-20'],
];
export function StoreHeader() {
  const { count } = useBasket();
  const [stuck, setStuck] = useState(false);

  // The hairline appears once the page has moved. A rule under a header
  // sitting at the top of its own page is a line for no reason.
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={styles.header} data-stuck={stuck || undefined}>
      <div className={styles.inner}>
        <Link to={STORE_ROUTES.HOME} className={styles.mark} aria-label="Cart and Keep, home">
          <Logo size={32} />
        </Link>

        <nav className={styles.nav} aria-label="Departments">
          {DEPARTMENTS.map(([label, to]) => (
            <NavLink key={to} to={to} className={styles.link}>{label}</NavLink>
          ))}
          <NavLink to={STORE_ROUTES.HOME} end className={styles.link}>All departments</NavLink>
        </nav>

        <div className={styles.tools}>
          <NavLink to="/search" className={styles.icon} aria-label="Search">
            <SearchIcon />
          </NavLink>

          <NavLink to="/saved" className={styles.icon} aria-label="Saved items">
            <HeartIcon />
          </NavLink>

          <NavLink
            to={STORE_ROUTES.CART}
            className={styles.icon}
            aria-label={count === 1 ? 'Basket, 1 item' : `Basket, ${count} items`}
          >
            <BasketIcon />
            {/* Hidden at zero. An empty badge is a nag. */}
            {count > 0 && (
              <span className={styles.pip} data-price aria-hidden="true">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </NavLink>
        </div>
      </div>
    </header>
  );
}
