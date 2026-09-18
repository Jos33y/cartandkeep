import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import styles from '@styles/ui/portal/ebay-connection.module.css';

/*
 * Connect, and see whether the connection is still good.
 *
 * Nothing here ever touches the token. The browser asks the edge function to
 * build a consent URL, sends her to eBay, and later asks whether a token
 * exists. The token itself is written and read by the service role only, which
 * is why tenant_credentials has row level security on and no policy: a token a
 * browser can read is a token that can be taken from a browser.
 */

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function EbayConnection({ tenantId }) {
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const check = useCallback(async () => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'status', tenant_id: tenantId },
    });
    if (error) return setState({ status: 'error', message: error.message });
    setState({ status: 'ready', ...data });
  }, [tenantId]);

  useEffect(() => { check(); }, [check]);

  async function connect() {
    setBusy(true);
    setFailed(null);
    const { data, error } = await supabase.functions.invoke('ebay-oauth', {
      body: { action: 'start', tenant_id: tenantId },
    });
    if (error || !data?.url) {
      setBusy(false);
      return setFailed(error?.message ?? 'Could not start the connection.');
    }
    // A full navigation rather than a popup. eBay's consent screen asks her to
    // sign in, and a popup that gets blocked looks like a broken button.
    window.location.href = data.url;
  }

  if (!tenantId || state.status === 'loading') {
    return <p className={styles.quiet} role="status">Checking</p>;
  }

  if (state.status === 'error') {
    return <p className={styles.failed} role="alert">{state.message}</p>;
  }

  const lapses = when(state.expires_at);

  return (
    <div className={styles.wrap}>
      <p className={styles.line}>
        <span className={state.connected ? styles.dotOn : styles.dotOff} aria-hidden="true" />
        {state.connected
          ? `Connected since ${when(state.connected_at)}`
          : state.lapsed
            ? 'The connection has lapsed and needs granting again'
            : 'Not connected yet'}
      </p>

      {state.connected && lapses && (
        <p className={styles.quiet}>
          Good until {lapses}. eBay expires it then and it has to be granted again.
        </p>
      )}

      {!state.connected && (
        <p className={styles.quiet}>
          You will be sent to eBay to sign in and approve. Nothing is listed
          automatically, and your eBay password is never shared with us.
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={busy} onClick={connect}>
          {busy ? 'Opening eBay' : state.connected ? 'Reconnect' : 'Connect eBay'}
        </button>
      </div>

      {failed && <p className={styles.failed} role="alert">{failed}</p>}
    </div>
  );
}
