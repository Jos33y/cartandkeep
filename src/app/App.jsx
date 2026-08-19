import { Suspense, lazy } from 'react';
import { AppError } from '@components/layout/shared/AppError';
import { BrandLoader } from '@components/ui/store/BrandLoader';
import { isPortalHost, isStatusHost } from '@lib/host';

const StoreApp = lazy(() => import('./StoreApp'));
const PortalApp = lazy(() => import('./PortalApp'));
const StatusApp = lazy(() => import('./StatusApp'));

// Splitting by host keeps margins and supplier costs out of the shopper bundle.
// The host test itself moved to @lib/host, because the manifest injection in
// index.html and the service worker gate both need the same answer and three
// copies of it is how one of them ends up disagreeing.
export function App() {
  let chunk;
  let booting;

  if (isPortalHost()) {
    chunk = <PortalApp />;
    booting = <Booting />;
  } else if (isStatusHost()) {
    chunk = <StatusApp />;
    booting = <Booting />;
  } else {
    chunk = <StoreApp />;
    // The shop gets the mark. A stranger's first frame should say whose shop
    // they have opened, and grey text saying Loading says nothing. The portal
    // and the status page keep the plain one: she knows where she is, and the
    // mark would mean loading her review tool pulls in the shop's fonts.
    booting = <BrandLoader />;
  }

  return (
    <AppError>
      <Suspense fallback={booting}>{chunk}</Suspense>
    </AppError>
  );
}

function Booting() {
  return (
    <div
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#736c5d' }}
    >
      <p style={{ fontSize: '0.8125rem' }}>Loading</p>
    </div>
  );
}
