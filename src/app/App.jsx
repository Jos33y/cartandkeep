import { Suspense, lazy, useEffect } from 'react';
import { AppError } from '@components/layout/shared/AppError';
import { BrandLoader } from '@components/ui/store/BrandLoader';
import { isPortalHost, isStatusHost } from '@lib/host';
import { bootDone } from '@lib/boot';

const StoreApp = lazy(() => import('./StoreApp'));
const PortalApp = lazy(() => import('./PortalApp'));
const StatusApp = lazy(() => import('./StatusApp'));

// Rendered after the chunk, so the splash stays up until there is a page under it.
function Booted() {
  useEffect(() => { bootDone(); }, []);
  return null;
}

// Split by host so margins and supplier costs never reach the shopper bundle.
export function App() {
  const portal = isPortalHost();
  const status = isStatusHost();
  const chunk = portal ? <PortalApp /> : status ? <StatusApp /> : <StoreApp />;

  // The splash covers the portal and status page while they load; the shop keeps its mark.
  const fallback = portal || status ? null : <BrandLoader />;

  return (
    <AppError>
      <Suspense fallback={fallback}>
        {chunk}
        <Booted />
      </Suspense>
    </AppError>
  );
}
