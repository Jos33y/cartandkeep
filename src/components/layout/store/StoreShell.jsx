import { Outlet } from 'react-router';
import { ScrollToTop } from '@components/layout/shared/ScrollToTop';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import styles from '@styles/layout/store/store-shell.module.css';

export function StoreShell() {
  return (
    <div className={styles.shell}>
      <ScrollToTop />
      <a href="#store-main" className={styles.skip}>Skip to content</a>
      <StoreHeader />
      <main id="store-main" className={styles.main}>
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
