// Demo renders fixtures so a screen can be judged before its data exists.
// Off unless asked for, per tab, and never remembered across a browser session,
// because a client seeing invented numbers as real is the worst failure here.

const KEY = 'ck.mode';

function read() {
  if (typeof window === 'undefined') return 'live';

  const p = new URLSearchParams(window.location.search);
  if (p.get('demo') === '1') {
    sessionStorage.setItem(KEY, 'demo');
    return 'demo';
  }
  if (p.get('live') === '1') {
    sessionStorage.removeItem(KEY);
    return 'live';
  }

  return sessionStorage.getItem(KEY) === 'demo' ? 'demo' : 'live';
}

export const MODE = read();
export const isDemo = () => MODE === 'demo';

// A reload rather than state, so every hook re-reads its source in one step.
export function setMode(mode) {
  if (typeof window === 'undefined') return;
  if (mode === 'demo') sessionStorage.setItem(KEY, 'demo');
  else sessionStorage.removeItem(KEY);

  const url = new URL(window.location.href);
  url.searchParams.delete('demo');
  url.searchParams.delete('live');
  window.location.replace(url.toString());
}
