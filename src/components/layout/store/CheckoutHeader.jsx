import { Link } from 'react-router';
import { Logo } from '@components/ui/shared/Logo';
import { LockIcon } from '@components/ui/store/icons';
import { LEGAL_LINKS } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/layout/store/checkout-header.module.css';

/*
 * The checkout's own frame.
 *
 * Every link in the shop's header and footer is a way out of a purchase, so
 * here there are two: the mark, and back to the basket. The legal pages stay
 * one tap away underneath, because the terms have to be reachable before
 * somebody pays.
 */
export function CheckoutHeader() {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link to={STORE_ROUTES.HOME} className={styles.mark} aria-label="Cart and Keep, home">
          <Logo size={30} />
        </Link>
        <p className={styles.secure}><LockIcon size={15} />Secure checkout</p>
        <Link to={STORE_ROUTES.CART} className={styles.back}>Back to basket</Link>
      </div>
    </header>
  );
}

export function CheckoutFooter() {
  return (
    <footer className={styles.foot}>
      <nav className={styles.legal} aria-label="Legal">
        {['terms', 'privacy', 'returns', 'delivery'].map((slug) => (
          <Link key={slug} to={`/legal/${slug}`}>{LEGAL_LINKS[slug]}</Link>
        ))}
      </nav>
    </footer>
  );
}
