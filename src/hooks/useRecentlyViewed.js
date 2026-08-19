import { useCallback, useEffect, useState } from 'react';

/*
 * What this visitor has looked at.
 *
 * Ids only. Storing whole products would mean a shelf of stale prices for
 * anything she edits, so ids are resolved against the live catalogue and
 * anything that has gone simply drops out.
 *
 * A real marketplace signal and an honest one: the visitor's own behaviour,
 * rather than a "customers also bought" invented from data we do not have.
 */
const KEY = 'ck.viewed.v1';
const CAP = 12;

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState(read);

  const record = useCallback((id) => {
    if (!id) return;
    setIds((current) => {
      if (current[0] === id) return current;
      const next = [id, ...current.filter((x) => x !== id)].slice(0, CAP);
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* full or private */ }
      return next;
    });
  }, []);

  useEffect(() => {
    function onStorage(e) { if (e.key === KEY) setIds(read()); }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { ids, record };
}
