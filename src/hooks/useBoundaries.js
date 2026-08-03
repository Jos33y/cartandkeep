import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

export function useBoundaries(tenantId) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('category_boundaries')
      .select('ebay_path_prefix, label, agreed')
      .eq('tenant_id', tenantId)
      .then(({ data }) => setRows(data ?? []));
  }, [tenantId]);

  return rows;
}
