import { useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { supplierWarnings } from '@lib/supplierWatch';

/*
 * Every approved card whose Amazon supplier has been read, live or not, with what she needs telling today: out of
 * stock, dearer than she costed, a deal about to end. Read by the Overview, because a card that went live has left
 * the Approved page and the morning check is the only eye on it.
 */
export function useSupplierWatch(tenantId) {
  const [state, setState] = useState({ status: 'loading', items: [], checked: null });

  useEffect(() => {
    if (!tenantId) return undefined;
    let live = true;
    (async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, title, draft_title:draft->>title, supplier_read, decisions!inner ( action )')
        .eq('tenant_id', tenantId)
        .eq('decisions.action', 'approve')
        .not('supplier_read', 'is', null)
        .limit(1000);
      if (!live) return;
      // Not fatal: the Overview stands without it.
      if (error) { setState({ status: 'error', items: [], checked: null }); return; }
      const rank = { stop: 0, warn: 1 };
      const items = (data ?? [])
        .map((c) => ({
          id: c.id,
          title: c.draft_title || c.title,
          url: c.supplier_read?.url ?? null,
          warnings: supplierWarnings(c.supplier_read).filter((w) => w.level !== 'note'),
        }))
        .filter((x) => x.warnings.length)
        .sort((a, b) => rank[a.warnings[0].level] - rank[b.warnings[0].level] || a.title.localeCompare(b.title));
      const checked = (data ?? []).map((c) => c.supplier_read?.read_at).filter(Boolean).sort().pop() ?? null;
      setState({ status: 'ready', items, checked, watched: (data ?? []).length });
    })();
    return () => { live = false; };
  }, [tenantId]);

  return state;
}
