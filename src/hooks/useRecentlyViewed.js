import { useCallback, useEffect, useState } from 'react';

const KEY = 'ck.viewed.v1';
// Keeping the refusal is strictly necessary: without it the next product view starts recording again.
const OFF_KEY = 'ck.viewed.off';
const CAP = 12;
const CHANGED = 'ck:viewed-changed';

export function recentlyViewedOff() {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}

function read() {
  if (typeof window === 'undefined' || recentlyViewedOff()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// The cookies page's switch. Turning it off also deletes what was kept.
export function setRecentlyViewed(on) {
  try {
    if (on) {
      window.localStorage.removeItem(OFF_KEY);
    } else {
      window.localStorage.setItem(OFF_KEY, '1');
      window.localStorage.removeItem(KEY);
    }
  } catch { /* private mode: nothing was kept anyway */ }
  window.dispatchEvent(new Event(CHANGED));
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState(read);
  const [off, setOff] = useState(recentlyViewedOff);

  const record = useCallback((id) => {
    if (!id || recentlyViewedOff()) return;
    setIds((current) => {
      if (current[0] === id) return current;
      const next = [id, ...current.filter((x) => x !== id)].slice(0, CAP);
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* full or private */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const sync = () => { setIds(read()); setOff(recentlyViewedOff()); };
    const onStorage = (e) => { if (e.key === KEY || e.key === OFF_KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGED, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGED, sync);
    };
  }, []);

  return { ids, record, off };
}
