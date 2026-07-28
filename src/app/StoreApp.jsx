import { RouterProvider } from 'react-router';
import { storeRouter } from './storeRouter';

export default function StoreApp() {
  return <RouterProvider router={storeRouter} />;
}
