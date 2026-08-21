import { useState } from 'react';
import styles from '@styles/ui/store/subscribe.module.css';

/*
 * The sign up box.
 *
 * One address, one deliberate act. Nobody is added by buying something: that
 * would be the soft opt in route and it needs its own separately worded tick
 * box at checkout, which is not here on purpose.
 *
 * The wording is a constant and it is sent with the address. That is the part
 * the law cares about, because proving consent later means proving what this
 * box said at the time, and a copy change in October must not rewrite what
 * somebody agreed to in August.
 */

/*
 * Changing this is changing what people agreed to.
 *
 * Old rows keep the old wording, which is the point of storing it. Anybody
 * signing up after a change has agreed to the new one, so the promise has to
 * be one the shop will keep. One a week is a commitment, not a flourish.
 *
 * Two sentences and no more. It sits in a narrow footer column and the version
 * with "about what has landed" in it wrapped to a second line carrying one
 * word, which is what an orphan looks like on every width that column takes.
 */
export const SUBSCRIBE_WORDING =
  'One email a week at most. Leave whenever you like.';

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/*
 * `tone` is where it is standing, not what it looks like.
 *
 * The stylesheet holds both palettes and swaps them on the attribute, so a
 * dark footer does not need a second copy of this component and the footer
 * stylesheet does not need to know anything about the inside of it.
 */
export function Subscribe({ source = 'footer', tone = 'light' }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);

  async function submit(event) {
    // Never a form element. React artifacts aside, a form here means a page
    // reload on any browser that does not run the handler.
    event?.preventDefault?.();
    setBusy(true);
    setFailed(null);

    try {
      const res = await fetch(`${BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ email, source, wording: SUBSCRIBE_WORDING }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'That did not work. Try again.');
      setDone(true);
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={styles.block} data-tone={tone}>
        {/* The heading stays. Without it the whole block collapses to one
            paragraph and everything under it jumps up the page, which reads
            as something having gone wrong rather than having worked. */}
        <p className={styles.label}>On the list</p>
        <p className={styles.done}>
          There is an unsubscribe link on every email, and it works without
          signing in to anything.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.block} data-tone={tone}>
      <p className={styles.label} id="sub-label">Told when stock lands</p>

      <div className={styles.row}>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-labelledby="sub-label"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && email) submit(e); }}
          placeholder="Your email"
        />
        <button
          type="button"
          className={styles.button}
          disabled={busy || !email.trim()}
          onClick={submit}
        >
          {busy ? 'Adding' : 'Keep me posted'}
        </button>
      </div>

      {/* The same words that are sent with the address. Written once and read
          from one place, so what she can prove and what somebody saw cannot
          drift apart. */}
      <p className={styles.wording}>{SUBSCRIBE_WORDING}</p>

      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </div>
  );
}
