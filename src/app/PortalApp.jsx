import { RouterProvider } from 'react-router';
import { portalRouter } from './portalRouter';

export default function PortalApp() {
  return <RouterProvider router={portalRouter} />;
}
