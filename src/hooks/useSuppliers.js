import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// Named once and reused, so one supplier does not become three spellings.
export function useSuppliers(tenantId) {
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, kind, country, url, note')
      .eq('tenant_id', tenantId)
      .order('name');
    setRows(data ?? []);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // A name typed into the form that is not on the list becomes one, so the list
  // grows from use rather than from an admin screen nobody opens.
  const remember = useCallback(async ({ tenantId: tid, name, kind, country }) => {
    const clean = String(name ?? '').trim();
    if (!clean || rows.some((r) => r.name.toLowerCase() === clean.toLowerCase())) return;

    const { data } = await supabase
      .from('suppliers')
      .insert({ tenant_id: tid, name: clean, kind: kind ?? 'unknown', country: country ?? null })
      .select('id, name, kind, country, url, note')
      .single();

    if (data) setRows((s) => [...s, data].sort((a, b) => a.name.localeCompare(b.name)));
  }, [rows]);

  return { suppliers: rows, remember, reload: load };
}
