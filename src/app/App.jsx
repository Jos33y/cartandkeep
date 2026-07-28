import { Suspense, lazy } from 'react';
import { AppError } from '@components/layout/shared/AppError';

const StoreApp = lazy(() => import('./StoreApp'));
const PortalApp = lazy(() => import('./PortalApp'));
const StatusApp = lazy(() => import('./StatusApp'));

// Splitting by host keeps margins and supplier costs out of the shopper bundle.
function hostMatches(prefix, devFlag) {
  if (typeof window === 'undefined') return false;
  if (window.location.hostname.startsWith(prefix)) return true;
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has(devFlag)
  );
}

export function App() {
  let chunk;
  if (hostMatches('portal.', 'portal')) {
    chunk = <PortalApp />;
  } else if (hostMatches('status.', 'status')) {
    chunk = <StatusApp />;
  } else {
    chunk = <StoreApp />;
  }

  return (
    <AppError>
      <Suspense fallback={<Booting />}>{chunk}</Suspense>
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
