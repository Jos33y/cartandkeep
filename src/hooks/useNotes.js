import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { isDemo } from '@lib/mode';

const DEMO_NOTES = [
  {
    id: 'demo-note-1',
    title: 'Supplier contacts',
    body: 'Ada, packaging supplier, 07700 900412.\nCall before Thursday about the padded mailers.',
    pinned: true,
    updated_at: '2026-07-28T10:20:00Z',
  },
  {
    id: 'demo-note-2',
    title: 'Ideas to check',
    body: 'Bundle the gua sha with the roller. Same postage band, better price point.',
    pinned: false,
    updated_at: '2026-07-27T18:05:00Z',
  },
];

const sort = (rows) =>
  [...rows].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at),
  );

export function useNotes(tenantId) {
  const demo = isDemo();
  const [state, setState] = useState(
    demo ? { status: 'ready', rows: sort(DEMO_NOTES) } : { status: 'loading', rows: [] },
  );

  const load = useCallback(async () => {
    if (demo || !tenantId) return;

    const { data, error } = await supabase
      .from('notes')
      .select('id, title, body, pinned, created_at, updated_at')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) return setState({ status: 'error', rows: [] });
    setState({ status: 'ready', rows: data ?? [] });
  }, [tenantId, demo]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async () => {
    const draft = {
      id: `tmp-${Date.now()}`,
      title: '',
      body: '',
      pinned: false,
      updated_at: new Date().toISOString(),
    };

    if (demo) {
      setState((s) => ({ ...s, rows: [draft, ...s.rows] }));
      return draft.id;
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({ tenant_id: tenantId, title: '', body: '' })
      .select('id, title, body, pinned, created_at, updated_at')
      .single();

    if (error) throw error;
    setState((s) => ({ ...s, rows: [data, ...s.rows] }));
    return data.id;
  }, [demo, tenantId]);

  const save = useCallback(async (id, patch) => {
    setState((s) => ({
      ...s,
      rows: sort(s.rows.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n))),
    }));

    if (demo) return;

    const { error } = await supabase.from('notes').update(patch).eq('id', id);
    if (error) {
      await load();
      throw error;
    }
  }, [demo, load]);

  const remove = useCallback(async (id) => {
    setState((s) => ({ ...s, rows: s.rows.filter((n) => n.id !== id) }));
    if (demo) return;

    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      await load();
      throw error;
    }
  }, [demo, load]);

  return { ...state, reload: load, create, save, remove };
}
