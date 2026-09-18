import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/settings-page.module.css';

/*
 * Where eBay sends her back to after she approves.
 *
 * The code arrives in the query string, is worth one exchange, and expires in
 * five minutes, so this does the swap immediately and then gets out of the way.
 * Route it at /ebay/callback, which is the auth accepted URL registered on the
 * developer account. The declined URL can point at the same component: eBay
 * sends no code, and the copy below covers it.
 */
export function EbayCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'working' });
  // React runs effects twice in development and the code only works once, so
  // the second run would report a failure on a connection that succeeded.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const code = params.get('code');
    const tenantId = params.get('state');

    if (!code) {
      setState({ status: 'declined' });
      return;
    }
    if (!tenantId) {
      setState({ status: 'failed', message: 'eBay did not say which account this was for.' });
      return;
    }

    (async () => {
      const { supabase } = await import('@lib/supabase');
      const { data, error } = await supabase.functions.invoke('ebay-oauth', {
        body: { action: 'finish', tenant_id: tenantId, code },
      });

      if (error || data?.error) {
        setState({ status: 'failed', message: data?.error ?? error.message });
        return;
      }

      setState({ status: 'done' });
      setTimeout(() => navigate(portalPath('/settings')), 1500);
    })();
  }, [params, navigate]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>eBay</p>
        <h1 className={styles.title}>
          {state.status === 'working' && 'Connecting'}
          {state.status === 'done' && 'Connected'}
          {state.status === 'declined' && 'Not connected'}
          {state.status === 'failed' && 'That did not connect'}
        </h1>
      </header>

      <p className={styles.note}>
        {state.status === 'working' && 'Finishing up with eBay.'}
        {state.status === 'done' && 'Your seller account is connected. Taking you back to settings.'}
        {state.status === 'declined' && 'Nothing was granted, so nothing has changed. You can try again from settings whenever you like.'}
        {state.status === 'failed' && `${state.message} The link is only good for a few minutes, so starting again from settings usually fixes it.`}
      </p>
    </div>
  );
}
