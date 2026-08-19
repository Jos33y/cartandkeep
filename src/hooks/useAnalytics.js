import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { setAnalyticsTenant, trackPageView } from '@lib/analytics';

/*
 * Page views on every route change.
 *
 * A single page app never reloads, so nothing fires on its own. This has to
 * sit inside the router and above the routes, which is the shell.
 */
export function usePageViews(tenantId) {
  const { pathname, search } = useLocation();

  useEffect(() => { setAnalyticsTenant(tenantId ?? null); }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    // The path only. A search page carries the term in the query string and
    // that is recorded as a search event with its own shape, not smuggled
    // into a page view.
    trackPageView(pathname);
  }, [pathname, search, tenantId]);
}
