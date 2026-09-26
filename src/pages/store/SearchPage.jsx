import { Navigate, useSearchParams } from 'react-router';
import { STORE_ROUTES } from '@utils/constants';

// Search is the whole shop with a search in it: the same filters, counts and paging, so there is one results page to keep right.
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q');
  return <Navigate to={q ? `${STORE_ROUTES.SHOP}?q=${encodeURIComponent(q)}` : STORE_ROUTES.SHOP} replace />;
}
