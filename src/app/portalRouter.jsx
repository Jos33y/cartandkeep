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
const ShopPage = lazy(() => import('@pages/portal/ShopPage').then((m) => ({ default: m.ShopPage })));
const ReviewsPage = lazy(() => import('@pages/portal/ReviewsPage').then((m) => ({ default: m.ReviewsPage })));
const MessagesPage = lazy(() => import('@pages/portal/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const SlipPage = lazy(() => import('@pages/portal/SlipPage').then((m) => ({ default: m.SlipPage })));
const CustomersPage = lazy(() => import('@pages/portal/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const RequestsPage = lazy(() => import('@pages/portal/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const SubscribersPage = lazy(() => import('@pages/portal/SubscribersPage').then((m) => ({ default: m.SubscribersPage })));
const CategoriesPage = lazy(() => import('@pages/portal/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const ProductsPage = lazy(() => import('@pages/portal/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const InterestPage = lazy(() => import('@pages/portal/InterestPage').then((m) => ({ default: m.InterestPage })));
const BeingFoundPage = lazy(() => import('@pages/portal/BeingFoundPage').then((m) => ({ default: m.BeingFoundPage })));
const FinancePage = lazy(() => import('@pages/portal/FinancePage').then((m) => ({ default: m.FinancePage })));
const OrdersPage = lazy(() => import('@pages/portal/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const ActivityPage = lazy(() => import('@pages/portal/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const NotesPage = lazy(() => import('@pages/portal/NotesPage').then((m) => ({ default: m.NotesPage })));
const CoveragePage = lazy(() => import('@pages/portal/CoveragePage').then((m) => ({ default: m.CoveragePage })));
const MetricsPage = lazy(() => import('@pages/portal/MetricsPage').then((m) => ({ default: m.MetricsPage })));
const SettingsPage = lazy(() => import('@pages/portal/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const EbayCallbackPage = lazy(() => import('@pages/portal/EbayCallbackPage').then((m) => ({ default: m.EbayCallbackPage })));

const deferred = (el) => <Suspense fallback={null}>{el}</Suspense>;

export const portalRouter = createBrowserRouter([
  { path: PORTAL_ROUTES.LOGIN, element: <LoginPage /> },

  // Outside the guard on purpose. eBay sends her here after she approves, and
  // there is no guarantee that browser still holds a session: the sign-in may
  // open elsewhere, she may approve on her phone, or the session may lapse
  // while she is on eBay's screen. Behind the guard she would be bounced to
  // login, the code would be lost from the address bar, and the code is good
  // for five minutes and one use.
  //
  // It needs no session anyway. The tenant arrives from eBay in `state`, and
  // the exchange happens in the edge function under the service role.
  { path: '/ebay/callback', element: deferred(<EbayCallbackPage />) },
  { path: '/ebay/declined', element: deferred(<EbayCallbackPage />) },
  {
    path: '/',
    element: <PortalProtected />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'candidates', element: <CandidatesPage /> },
      { path: 'approved', element: deferred(<ApprovedPage />) },
      { path: 'listings', element: deferred(<ListingsPage />) },
      { path: 'shop', element: deferred(<ShopPage />) },
      { path: 'products', element: deferred(<ProductsPage />) },
      { path: 'sections', element: deferred(<CategoriesPage />) },
      { path: 'reviews', element: deferred(<ReviewsPage />) },
      { path: 'customers', element: deferred(<CustomersPage />) },
      { path: 'requests', element: deferred(<RequestsPage />) },
      { path: 'subscribers', element: deferred(<SubscribersPage />) },
      { path: 'interest', element: deferred(<InterestPage />) },
      { path: 'being-found', element: deferred(<BeingFoundPage />) },
      { path: 'finance', element: deferred(<FinancePage />) },
      { path: 'orders', element: deferred(<OrdersPage />) },
      { path: 'messages', element: deferred(<MessagesPage />) },
      { path: 'orders/:reference/slip', element: deferred(<SlipPage />) },
      { path: 'notes', element: deferred(<NotesPage />) },
      { path: 'coverage', element: deferred(<CoveragePage />) },
      { path: 'metrics', element: deferred(<MetricsPage />) },
      { path: 'activity', element: deferred(<ActivityPage />) },
      { path: 'settings', element: deferred(<SettingsPage />) },
      // Catches everything unmatched, and does it inside the shell so she is
      // not thrown out of the portal by a typo in the address bar.
      { path: '*', element: <PortalNotFoundPage /> },
    ],
  },
]);
