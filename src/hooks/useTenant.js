import { useEffect, useState } from 'react';
import { loadTenant } from '@lib/tenant';

/*
 * The tenant, with its failure handled.
 *
 * `loadTenant` throws, and three pages were each calling it with a bare
 * `.then`. An unhandled rejection left tenant as undefined, which every
 * consumer reads as "still loading", so a missing env var or a dead connection
 * showed as a page that loads forever rather than a page that says what
 * happened.
 *
 * undefined means not resolved yet. null means resolved to nothing.
 */
export function useTenant() {
  const [tenant, setTenant] = useState(undefined);

  useEffect(() => {
    let live = true;

    loadTenant()
      .then((t) => { if (live) setTenant(t ?? null); })
      .catch((err) => {
        if (!live) return;
        console.error('[store] could not load tenant', err);
        setTenant(null);
      });

    return () => { live = false; };
  }, []);

  return tenant;
}
