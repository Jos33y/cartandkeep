import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { loadStoreConfig } from '@lib/storeConfig';
import { BrandLoader } from '@components/ui/store/BrandLoader';
import { ScrollToTop } from '@components/layout/shared/ScrollToTop';
import { BasketProvider } from '@context/BasketContext';
import { usePageViews } from '@hooks/useAnalytics';
import { useTenant } from '@hooks/useTenant';
import { AnnouncementBar } from './AnnouncementBar';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import { CheckoutFooter, CheckoutHeader } from './CheckoutHeader';
import { STORE_ROUTES } from '@utils/constants';
import { MiniBasket } from '@components/ui/store/MiniBasket';
import styles from '@styles/layout/store/store-shell.module.css';

/*
 * The basket provider wraps the whole shell rather than a page, because the
 * header shows the count on every route and a product card adds to it from
 * inside a grid.
 */
export function StoreShell() {
  // The shell already sits inside the router and above every route, which is
  // the only place a single page app can count a navigation from.
  const tenant = useTenant();
  usePageViews(tenant?.id);

  // Checkout is enclosed: its own header and the legal links, nothing else to leave by.
  const { pathname } = useLocation();
  const enclosed = pathname === STORE_ROUTES.CHECKOUT;

  // Settings reach the shop only through this load. Nothing renders before it, so no page promises the defaults first.
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    let live = true;
    loadStoreConfig().finally(() => { if (live) setConfigured(true); });
    return () => { live = false; };
  }, []);

  if (!configured) return <BrandLoader />;

  return (
    <BasketProvider>
      <div className={styles.shell}>
        <ScrollToTop />
        <a href="#store-main" className={styles.skip}>Skip to content</a>
        {enclosed ? <CheckoutHeader /> : <><AnnouncementBar /><StoreHeader /></>}
        <main id="store-main" className={styles.main}>
          <Outlet />
        </main>
        {enclosed ? <CheckoutFooter /> : <StoreFooter />}

        {/* Inside the provider and outside the main, so it can open over any
            route without being part of the page it opens over. */}
        {!enclosed && <MiniBasket />}
      </div>
    </BasketProvider>
  );
}
