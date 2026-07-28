import { RouterProvider } from 'react-router';
import { statusRouter } from './statusRouter';

export default function StatusApp() {
  return <RouterProvider router={statusRouter} />;
}
