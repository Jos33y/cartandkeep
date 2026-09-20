import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Pre-publish edits.
 *
 * Kept on the candidate rather than in component state so a reload does not
 * lose a rewritten title, and saved on a delay so typing is not a write per
 * keystroke.
 */
export function useDraft(candidate, tenantId) {
  const [draft, setDraft] = useState(candidate?.draft ?? {});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const timer = useRef(null);
  const latest = useRef(draft);

  // A row opened after another was edited would otherwise show the first one's
  // draft.
  useEffect(() => {
    setDraft(candidate?.draft ?? {});
    latest.current = candidate?.draft ?? {};
  }, [candidate?.id, candidate?.draft]);

  const save = useCallback(async (value) => {
    setSaving(true);
    setFailed(null);
    const { error } = await supabase
      .from('candidates')
      .update({ draft: value })
      .eq('id', candidate.id)
      .eq('tenant_id', tenantId);
    setSaving(false);
    if (error) setFailed(error.message);
  }, [candidate?.id, tenantId]);

  const change = useCallback((patch) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);

    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 700);
  }, [save]);

  // A draft saved 700ms from now is lost if the row closes first.
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      save(latest.current);
    }
  }, [save]);

  const revert = useCallback(async () => {
    clearTimeout(timer.current);
    latest.current = {};
    setDraft({});
    await save(null);
  }, [save]);

  const generate = useCallback(async (kind) => {
    const { data, error } = await supabase.functions.invoke('ebay-compose', {
      body: { tenant_id: tenantId, candidate_id: candidate.id, kind },
    });
    if (error || data?.error) throw new Error(data?.error ?? error.message);
    return kind === 'title' ? data.titles : data.description;
  }, [candidate?.id, tenantId]);

  const edited = Object.keys(draft).length > 0;

  return { draft, change, revert, generate, saving, failed, edited };
}
