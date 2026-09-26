import { useState } from 'react';

const KEY = 'ck:status:visit';
const GAP_MS = 30 * 60 * 1000;

// Public page, no account: the last visit is this browser's, kept in its own storage.
// Read once on first render, so "New" does not vanish as the page records this visit.
export function useStatusLastVisit() {
  const [previous] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
      const now = Date.now();
      const last = saved?.last ?? null;
      const prev = last && now - last > GAP_MS ? last : saved?.prev ?? null;
      window.localStorage.setItem(KEY, JSON.stringify({ last: now, prev }));
      return prev ? new Date(prev) : null;
    } catch (error) {
      console.warn('[status] last visit not available', error);
      return null;
    }
  });
  return previous;
}
