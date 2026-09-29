import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/unsubscribe-page.module.css';

/*
 * Leaving the list.
 *
 * Runs on load rather than asking somebody to confirm. A person who clicked
 * unsubscribe has already decided, and a page that then asks "are you sure"
 * is a page arguing with them about their own inbox. One tap, done.
 *
 * The link carries an address and a signature, so it works from an email with
 * nothing signed in. It cannot be forged without the key and there is no token
 * table, which would itself have been a list of subscribers.
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const email = params.get('e') ?? '';
  const token = params.get('t') ?? '';

  const [state, setState] = useState('working');

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const res = await fetch(`${BASE}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
          body: JSON.stringify({ action: 'unsubscribe', email, token }),
        });
        if (!live) return;
        setState(res.ok ? 'off' : 'failed');
      } catch {
        if (live) setState('failed');
      }
    })();

    return () => { live = false; };
  }, [email, token]);

  return (
    <section className={styles.page}>
      <Head title="Unsubscribe" description="Unsubscribe." path="/unsubscribe" noindex />

      {state === 'working' && (
        <p className={styles.working} role="status">Taking you off the list.</p>
      )}

      {state === 'off' && (
        <>
          <h1 className={`${styles.title} wide`}>You are off the list.</h1>
          {/* Said plainly and without asking for anything. No survey and no offer to stay:
              those are what turn one unsubscribe into a spam complaint. */}
          <p className={styles.body}>
            {email ? <><b>{email}</b> will not get any more emails from us.</> : 'You will not get any more emails from us.'}{' '}
            Anything you have ordered is not affected.
          </p>
          <p className={styles.note}>Changed your mind? You can sign up again at the foot of any page.</p>
          <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
        </>
      )}

      {state === 'failed' && (
        <>
          <h1 className={`${styles.title} wide`}>That link did not work.</h1>
          <p className={styles.body}>
            It may have been copied without the whole address. Write to us from the
            address you want taken off and we will do it by hand.
          </p>
          <Link className={styles.back} to={STORE_ROUTES.CONTACT}>Write to us</Link>
        </>
      )}
    </section>
  );
}
