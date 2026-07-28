import { useEffect } from 'react';
import { useLocation } from 'react-router';

export function ScrollToTop() {
  const { pathname } = useLocation();

  // Braces matter: an implicit return here becomes React's cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
