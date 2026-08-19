/*
 * Which of the three apps this document is.
 *
 * One build serves portal., status. and the shop, and three separate places
 * were deciding that: App.jsx, the inline script in index.html, and the
 * service worker registration. Three copies of a hostname test is how one of
 * them ends up disagreeing.
 */

/*
 * In development everything is localhost, so a query flag stands in for the
 * subdomain, and it is remembered for the tab.
 *
 * Reading the flag off the current URL alone was wrong: opening
 * /?status worked and then clicking through to /deliverables dropped the
 * query, the app decided it was the shop, and the link 404ed. A flag you have
 * to retype on every navigation is a flag nobody will use.
 *
 * sessionStorage rather than localStorage, so it clears when the tab closes
 * and you are never stuck in the portal wondering where the shop went. Dev
 * only, and never read in a production build.
 */
const KEY = 'ck.devHost';

function devHost() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;

  const flag = ['portal', 'status'].find((f) =>
    new URLSearchParams(window.location.search).has(f));

  if (flag) {
    try { window.sessionStorage.setItem(KEY, flag); } catch { /* private mode */ }
    return flag;
  }

  // ?shop clears it, so there is a way back without closing the tab.
  if (new URLSearchParams(window.location.search).has('shop')) {
    try { window.sessionStorage.removeItem(KEY); } catch { /* private mode */ }
    return null;
  }

  try { return window.sessionStorage.getItem(KEY); } catch { return null; }
}

export function hostMatches(prefix, devFlag) {
  if (typeof window === 'undefined') return false;
  if (window.location.hostname.startsWith(prefix)) return true;
  return devHost() === devFlag;
}

export const isPortalHost = () => hostMatches('portal.', 'portal');
export const isStatusHost = () => hostMatches('status.', 'status');

// The shop is the default, so it is defined by what it is not. A new subdomain
// added without touching this file lands on the shop, which is the safer
// failure: a stranger sees a shop rather than a review tool.
export const isStoreHost = () => !isPortalHost() && !isStatusHost();
