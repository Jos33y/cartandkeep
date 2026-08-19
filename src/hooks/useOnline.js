import { useEffect, useState } from 'react';

/*
 * Whether the browser thinks it has a connection.
 *
 * The shop is installable, so somebody can open it from a home screen on a
 * train with no signal. Without this the catalogue query fails and the page
 * says "the catalogue did not load, and if it keeps happening the problem is
 * at our end", which is both wrong and the opposite of reassuring.
 *
 * navigator.onLine is famously optimistic: it means an interface is up, not
 * that anything is reachable. That is fine here, because it is only ever used
 * to soften a failure that has already happened rather than to predict one.
 */
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
