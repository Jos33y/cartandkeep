/*
 * After a deploy, a tab opened before it still asks for the old build's page files, which no longer exist, and the
 * page fails with "Failed to fetch dynamically imported module". The fix is to load the new build. Once only: a
 * second failure within a minute is a real fault (offline, a bad deploy) and is left to the error screens, so a
 * broken build never reloads in a loop.
 */
const KEY = 'ck-stale-reload';
const WINDOW_MS = 60 * 1000;

export const isStaleBuild = (error) => /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i
  .test(String(error?.message ?? error ?? ''));

// True when this call reloads the page; false when it already did so a moment ago.
export function reloadOnce() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* storage blocked: reload anyway, once per load */ }
  if (Date.now() - last < WINDOW_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* as above */ }
  window.location.reload();
  return true;
}
