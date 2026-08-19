import { RouterProvider } from 'react-router';
import { portalRouter } from './portalRouter';

// The portal's faces load with the portal chunk. They were in main.jsx, which
// meant a shopper downloaded Geist and IBM Plex Mono to look at a saucepan.
import '@fontsource-variable/geist';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

export default function PortalApp() {
  return <RouterProvider router={portalRouter} />;
}
