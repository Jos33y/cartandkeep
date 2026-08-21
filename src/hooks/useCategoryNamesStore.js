import { useEffect, useState } from 'react';
import { loadCategoryNames } from '@lib/tenant';

/*
 * Her names, for the shop side.
 *
 * A thin hook over the cached loader so a component can use them without an
 * effect of its own. Returns an empty array until they arrive, which is the
 * same as having none, which renders exactly what the shop renders today. So
 * there is no loading state to handle and no flash of eBay's words followed by
 * hers: the first paint after the cache fills is the only one that changes.
 */
export function useCategoryNames() {
  const [names, setNames] = useState([]);

  useEffect(() => {
    let live = true;
    loadCategoryNames().then((rows) => { if (live) setNames(rows); });
    return () => { live = false; };
  }, []);

  return names;
}
