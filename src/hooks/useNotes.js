import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

const sort = (rows) =>
  [...rows].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
  );

export function useNotes(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [] });

  const load = useCallback(async () => {
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('notes')
      .select('id, title, body, pinned, created_at, updated_at')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) return setState({ status: 'error', rows: [] });
    setState({ status: 'ready', rows: data ?? [] });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    const { data, error } = await supabase
      .from('notes')
      .insert({ tenant_id: tenantId, title: '', body: '' })
      .select('id, title, body, pinned, created_at, updated_at')
      .single();

    if (error) throw error;
    setState((s) => ({ ...s, rows: [data, ...s.rows] }));
    return data.id;
  }, [tenantId]);

  const save = useCallback(async (id, patch) => {
    setState((s) => ({
      ...s,
      rows: sort(s.rows.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))),
    }));

    const { error } = await supabase.from('notes').update(patch).eq('id', id);
    if (error) {
      await load();
      throw error;
    }
  }, [load]);

  const remove = useCallback(async (id) => {
    setState((s) => ({ ...s, rows: s.rows.filter((n) => n.id !== id) }));

    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      await load();
      throw error;
    }
  }, [load]);

  return { ...state, reload: load, create, save, remove };
}
