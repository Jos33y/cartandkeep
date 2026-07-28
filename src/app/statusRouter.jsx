import { createBrowserRouter, Navigate } from 'react-router';
import { StatusShell } from '@components/layout/status/StatusShell';
import { StatusPage } from '@pages/status/StatusPage';

export const statusRouter = createBrowserRouter([
  {
    element: <StatusShell />,
    children: [
      { path: '/', element: <StatusPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
