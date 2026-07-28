import { Link } from 'react-router';
import styles from '@styles/layout/store/store-header.module.css';

export function StoreHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.mark}>Cart &amp; Keep</Link>
      <nav className={styles.nav} aria-label="Categories">
        <Link to="/c/beauty">Beauty</Link>
        <Link to="/c/pet">Pet</Link>
      </nav>
      <Link to="/cart" className={styles.cart}>Cart</Link>
    </header>
  );
}
