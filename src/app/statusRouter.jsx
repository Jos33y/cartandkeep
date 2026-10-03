import { RouteError } from '@components/layout/shared/RouteError';
import { createBrowserRouter, Navigate } from 'react-router';
import { StatusShell } from '@components/layout/status/StatusShell';
import { StatusPage } from '@pages/status/StatusPage';
import { DeliverablesPage } from '@pages/status/DeliverablesPage';

export const statusRouter = createBrowserRouter([
  {
    element: <StatusShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <StatusPage /> },
      // Ahead of the catch-all, which redirects everything unmatched to '/'.
      { path: '/deliverables', element: <DeliverablesPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
