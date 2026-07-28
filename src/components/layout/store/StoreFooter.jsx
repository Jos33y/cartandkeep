import { Link } from 'react-router';
import { LEGAL_PAGES } from '@utils/constants';
import styles from '@styles/layout/store/store-footer.module.css';

const LABELS = {
  terms: 'Terms',
  privacy: 'Privacy',
  returns: 'Returns',
  delivery: 'Delivery',
  cookies: 'Cookies',
};

export function StoreFooter() {
  return (
    <footer className={styles.footer}>
      <nav className={styles.links} aria-label="Legal">
        {LEGAL_PAGES.map((slug) => (
          <Link key={slug} to={`/legal/${slug}`}>{LABELS[slug]}</Link>
        ))}
      </nav>
      <p className={styles.copy}>Cart &amp; Keep</p>
    </footer>
  );
}
