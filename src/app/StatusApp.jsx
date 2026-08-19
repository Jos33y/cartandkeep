import { RouterProvider } from 'react-router';
import { statusRouter } from './statusRouter';

// Same faces as the portal. Both chunks import them and Rollup emits the CSS
// once into a shared chunk, so this is not a second copy.
import '@fontsource-variable/geist';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

export default function StatusApp() {
  return <RouterProvider router={statusRouter} />;
}
