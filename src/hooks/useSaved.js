import { useCallback, useEffect, useState } from 'react';
import { trackSave } from '@lib/analytics';

/*
 * Saved items.
 *
 * The heart on every product card did nothing. A control that looks like it
 * works and does not is worse than no control, because somebody taps it,
 * believes the thing is saved, and finds out it is not when they come back.
 *
 * Ids only, resolved against the live catalogue, so anything she takes down
 * drops out rather than sitting there at a stale price. Same shape as
 * useRecentlyViewed, deliberately: two hooks that behave differently for no
 * reason is how one of them ends up with a bug the other does not.
 */
const KEY = 'ck.saved.v1';

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// The storage event only reaches other tabs; this one tells the header and every card in this tab.
const EVENT = 'ck:saved';

function write(ids) {
  try { window.localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* full or private */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useSaved() {
  const [ids, setIds] = useState(read);

  /*
   * Computed from `ids` rather than inside the updater.
   *
   * The event is fired here rather than in the card, because the heart appears
   * in more than one place and each call site is another chance for one of them
   * to be forgotten. But it cannot go inside `setIds`: React invokes an updater
   * twice under StrictMode, so a side effect in there records every save as
   * two. The write moves out for the same reason, even though writing the same
   * value twice is harmless.
   *
   * Only the save is counted, not the unsave. An unsave is somebody tidying a
   * list rather than rejecting a product, and netting the two off gives a
   * number that means neither thing.
   */
  // Read from storage, not this instance's state: another component may have changed it a moment ago.
  const toggle = useCallback((id) => {
    if (!id) return;
    const current = read();
    const saving = !current.includes(id);
    const next = saving ? [id, ...current] : current.filter((x) => x !== id);
    setIds(next);
    write(next);
    if (saving) trackSave(id);
  }, []);

  const remove = useCallback((id) => {
    const next = read().filter((x) => x !== id);
    setIds(next);
    write(next);
  }, []);

  // Two tabs are the same person. A heart filled in one and hollow in the
  // other is the kind of thing that stops somebody trusting the shop.
  useEffect(() => {
    function onStorage(e) { if (e.key === KEY) setIds(read()); }
    function onLocal() { setIds(read()); }
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT, onLocal);
    };
  }, []);

  return { ids, toggle, remove, has: (id) => ids.includes(id) };
}
