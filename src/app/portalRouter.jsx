import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { PortalProtected } from '@components/layout/portal/PortalProtected';
import { LoginPage } from '@pages/portal/LoginPage';
import { OverviewPage } from '@pages/portal/OverviewPage';
import { CandidatesPage } from '@pages/portal/CandidatesPage';
import { PortalNotFoundPage } from '@pages/portal/PortalNotFoundPage';
import { PORTAL_ROUTES } from '@utils/constants';

// Overview and Candidates are the week's work and load eagerly. The rest are
// visited rarely, so they are split out of the first paint.
const ApprovedPage = lazy(() => import('@pages/portal/ApprovedPage').then((m) => ({ default: m.ApprovedPage })));
const ListingsPage = lazy(() => import('@pages/portal/ListingsPage').then((m) => ({ default: m.ListingsPage })));
const FinancePage = lazy(() => import('@pages/portal/FinancePage').then((m) => ({ default: m.FinancePage })));
const OrdersPage = lazy(() => import('@pages/portal/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const ActivityPage = lazy(() => import('@pages/portal/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const NotesPage = lazy(() => import('@pages/portal/NotesPage').then((m) => ({ default: m.NotesPage })));
const SettingsPage = lazy(() => import('@pages/portal/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const deferred = (el) => <Suspense fallback={null}>{el}</Suspense>;

export const portalRouter = createBrowserRouter([
  { path: PORTAL_ROUTES.LOGIN, element: <LoginPage /> },
  {
    path: '/',
    element: <PortalProtected />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'candidates', element: <CandidatesPage /> },
      { path: 'approved', element: deferred(<ApprovedPage />) },
      { path: 'listings', element: deferred(<ListingsPage />) },
      { path: 'finance', element: deferred(<FinancePage />) },
      { path: 'orders', element: deferred(<OrdersPage />) },
      { path: 'notes', element: deferred(<NotesPage />) },
      { path: 'activity', element: deferred(<ActivityPage />) },
      { path: 'settings', element: deferred(<SettingsPage />) },
      // Catches everything unmatched, and does it inside the shell so she is
      // not thrown out of the portal by a typo in the address bar.
      { path: '*', element: <PortalNotFoundPage /> },
    ],
  },
]);
