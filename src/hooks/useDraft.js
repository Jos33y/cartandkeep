import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * Pre-publish edits.
 *
 * Kept on the candidate rather than in component state so a reload does not
 * lose a rewritten title, and saved on a delay so typing is not a write per
 * keystroke.
 */
//
// onSaved hands each saved draft back to the page, so the closed row, its checks and anything sent in bulk read
// what she wrote rather than what the page loaded.
export function useDraft(candidate, tenantId, { onSaved, onRead } = {}) {
  const [draft, setDraft] = useState(candidate?.draft ?? {});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(null);
  const timer = useRef(null);
  const latest = useRef(draft);
  // Drafts this hook saved and handed back. When one returns as the candidate's draft it is already here, and
  // taking it again would drop whatever she typed while it was saving.
  const ours = useRef(new WeakSet());
  const told = useRef(onSaved);
  told.current = onSaved;
  const toldRead = useRef(onRead);
  toldRead.current = onRead;

  // A row opened after another was edited would otherwise show the first one's
  // draft.
  useEffect(() => {
    if (candidate?.draft && ours.current.has(candidate.draft)) return;
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
    if (error) { setFailed(error.message); return; }
    if (value) ours.current.add(value);
    told.current?.(value);
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

  // Saved now rather than in 700ms: for a server function that reads the draft from the card straight after.
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    await save(latest.current);
  }, [save]);

  const revert = useCallback(async () => {
    clearTimeout(timer.current);
    latest.current = {};
    setDraft({});
    await save(null);
  }, [save]);

  const generate = useCallback(async (kind) => {
    // The writing reads the card as saved: anything typed in the last 700ms (pasted supplier details) goes first.
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      await save(latest.current);
    }
    const { data, error } = await supabase.functions.invoke('ebay-compose', {
      body: { tenant_id: tenantId, candidate_id: candidate.id, kind },
    });
    // The shop page it read the first time, back to the page: its facts, and a barcode for eBay's catalogue.
    const said = data ?? await error?.context?.json?.().catch(() => null);
    if (said?.read) toldRead.current?.(said.read);
    if (error || data?.error) throw new Error(said?.error ?? data?.error ?? error.message);
    if (data?.conflict) throw new Error(`The sources disagree: ${data.conflict}. Check the product before listing.`);
    return kind === 'title' ? data.titles : data.description;
  }, [candidate?.id, tenantId, save]);

  // Stored under the tenant's folder so the storage policy can scope writes.
  const upload = useCallback(async (file) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${tenantId}/${candidate.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('listing-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('listing-images').getPublicUrl(path);
    return data.publicUrl;
  }, [candidate?.id, tenantId]);

  const edited = Object.keys(draft).length > 0;

  return { draft, change, flush, revert, generate, upload, saving, failed, edited };
}
