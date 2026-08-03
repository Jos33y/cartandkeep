import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';

// Append only, so this is a plain read with no current-state logic in it. What
// happened is what the table says happened.
export function useActivity(tenantId, limit = 200) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('decision_events')
      .select(`
        id, happened_at, candidate_id, candidate_title, external_ref,
        from_action, to_action, from_reason, to_reason, note, actor
      `)
      .eq('tenant_id', tenantId)
      .order('happened_at', { ascending: false })
      .limit(limit);

    if (error) return setState({ status: 'error', rows: [], error });
    setState({ status: 'ready', rows: data, error: null });
  }, [tenantId, limit]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
