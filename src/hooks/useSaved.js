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

/*
 * What each saved thing looked like when it was saved: name, photo and address.
 *
 * Beside the ids rather than in place of them, so a list saved before this
 * existed still reads. It is what lets a product she takes down stay on Saved
 * as a greyed card with its name, rather than become a bare number nobody can
 * act on. The live row still wins whenever there is one.
 */
const META = 'ck.saved.meta.v1';

function readMeta() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(META) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  try { window.localStorage.setItem(META, JSON.stringify(meta)); } catch { /* full or private */ }
}

// Only the fields a greyed card needs, so a whole product row never lands in storage.
function snapshotOf(item) {
  if (!item) return null;
  const title = typeof item.title === 'string' ? item.title : null;
  if (!title) return null;
  // The price only for something with one price; a product with sizes has a range, and comparing a range says nothing.
  const sized = (item.variantCount ?? item.variant_count ?? item.variants?.length ?? 0) > 0 || Boolean(item.variantId);
  const price = Number(item.price);
  return {
    title,
    slug: typeof item.slug === 'string' ? item.slug : null,
    image_url: typeof item.image_url === 'string' ? item.image_url : null,
    price: !sized && Number.isFinite(price) && price > 0 ? price : null,
    at: Date.now(),
  };
}

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
  // `item` is the product or basket line being saved, for its name and photo; optional.
  const toggle = useCallback((id, item) => {
    if (!id) return;
    const current = read();
    const saving = !current.includes(id);
    const next = saving ? [id, ...current] : current.filter((x) => x !== id);
    const meta = readMeta();
    const snap = snapshotOf(item);
    if (saving && snap) meta[id] = snap;
    if (!saving) delete meta[id];
    writeMeta(meta);
    setIds(next);
    write(next);
    if (saving) trackSave(id);
  }, []);

  // A shared list kept on this device: new ones go to the top in the list's order, ones already saved stay where they are.
  const addMany = useCallback((items) => {
    const current = read();
    const have = new Set(current);
    const fresh = (items ?? []).filter((item) => item?.id && !have.has(item.id));
    if (!fresh.length) return 0;
    const meta = readMeta();
    fresh.forEach((item) => { const snap = snapshotOf(item); if (snap) meta[item.id] = snap; });
    writeMeta(meta);
    const next = [...fresh.map((item) => item.id), ...current];
    setIds(next);
    write(next);
    fresh.forEach((item) => trackSave(item.id));
    return fresh.length;
  }, []);

  // Undo for an unsave: back where it was, with what it looked like when first saved.
  const restore = useCallback((id, index, snap) => {
    if (!id) return;
    const current = read();
    if (current.includes(id)) return;
    const next = [...current];
    next.splice(Math.max(0, Math.min(index ?? 0, next.length)), 0, id);
    if (snap) { const meta = readMeta(); meta[id] = snap; writeMeta(meta); }
    setIds(next);
    write(next);
  }, []);

  // Several at once, for clearing what is no longer sold in one write.
  const removeMany = useCallback((drop) => {
    const gone = new Set(drop);
    if (!gone.size) return;
    const next = read().filter((x) => !gone.has(x));
    const meta = readMeta();
    gone.forEach((id) => { delete meta[id]; });
    writeMeta(meta);
    setIds(next);
    write(next);
  }, []);

  const remove = useCallback((id) => removeMany([id]), [removeMany]);

  // Fills in names for saves made before snapshots existed, from the live rows, so they can be named if they go.
  const remember = useCallback((items) => {
    const meta = readMeta();
    const saved = new Set(read());
    let changed = false;
    (items ?? []).forEach((item) => {
      if (!item?.id || !saved.has(item.id) || meta[item.id]) return;
      const snap = snapshotOf(item);
      // When it was really saved is unknown here, so no date, rather than a wrong one.
      if (snap) { meta[item.id] = { ...snap, at: null }; changed = true; }
    });
    if (changed) writeMeta(meta);
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

  return { ids, toggle, remove, removeMany, remember, addMany, restore, has: (id) => ids.includes(id), snapshot: (id) => readMeta()[id] ?? null };
}
