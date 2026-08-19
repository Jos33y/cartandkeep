import { RouterProvider } from 'react-router';
import { storeRouter } from './storeRouter';

// The shop's faces live here rather than in main.jsx, so they load with this
// chunk and the portal never downloads them. Archivo's width axis file is 90KB
// on its own, which is not weight a review tool should carry.
//
// `wdth` rather than the package root: it carries both axes, weight 100 to 900
// and width 62% to 125%, and the extended display type needs the width one.
// The family is 'Archivo Variable' and the axis is set with font-stretch.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/inter';

// Store tokens, for the same reason. Additive over tokens.css, no name in it
// collides, and it cannot reach the portal.
import '@styles/base/store-tokens.css';

export default function StoreApp() {
  return <RouterProvider router={storeRouter} />;
}
