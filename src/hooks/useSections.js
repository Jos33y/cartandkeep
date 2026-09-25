import { useMemo } from 'react';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { groupCategories, visibleGroups } from '@utils/categories';

const LEFTOVER = 'Everything else';

// The shop's real sections, the same grouping the home page and category pages use, so the nav can never promise a department that is not there.
export function useSections() {
  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows } = useStoreProducts(tenantId);
  const names = useCategoryNames();

  const sections = useMemo(
    () => visibleGroups(groupCategories(rows, { names })).filter((g) => g.path !== LEFTOVER),
    [rows, names],
  );

  return { status, rows, sections };
}
