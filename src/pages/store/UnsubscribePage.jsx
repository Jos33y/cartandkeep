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

      {state === 'working' && <p className={styles.body}>One moment.</p>}

      {state === 'off' && (
        <>
          <h1 className={`${styles.title} wide`}>Done</h1>
          {/* Said plainly and without asking for anything. No survey, no offer
              to stay, no reduced frequency option. Those are what turn one
              unsubscribe into a spam complaint. */}
          <p className={styles.body}>
            {email ? `${email} is off the list.` : 'You are off the list.'} No
            more emails, and nothing else changes about your orders.
          </p>
          <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
        </>
      )}

      {state === 'failed' && (
        <>
          <h1 className={`${styles.title} wide`}>That link did not work</h1>
          <p className={styles.body}>
            It may have been copied without the whole address. Write to us and
            we will take you off by hand, which takes a minute.
          </p>
          <Link className={styles.back} to={STORE_ROUTES.CONTACT}>Get in touch</Link>
        </>
      )}
    </section>
  );
}
