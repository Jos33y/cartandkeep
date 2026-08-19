import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, MailIcon } from '@components/ui/store/icons';
import { fetchOrder } from '@lib/checkout';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/order-lookup.module.css';

/*
 * Finding an order again.
 *
 * The confirmation link carries a token, which is what makes it safe to share
 * by email and useless to guess. It is also the thing people lose. Without
 * this page, somebody who deleted the email has no route back except writing
 * to us, which is a support ticket for a lookup.
 *
 * Reference plus email rather than reference alone. The reference is short
 * enough to say down a phone, so on its own it is guessable given enough
 * attempts, and the email is the second thing only the customer has.
 *
 * A wrong pair and a reference that does not exist give the same answer.
 */
export function OrderLookupPage() {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setFailed(false);

    const ref = reference.trim().toUpperCase();
    if (!ref || !email.trim()) { setFailed(true); return; }

    setBusy(true);
    try {
      const { token } = await fetchOrder(ref, null, email.trim());
      navigate(`/order/${ref}?token=${token}`);
    } catch {
      // Deliberately one message. Telling somebody the reference was right and
      // the email wrong tells them which half to keep guessing at.
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <Head
        title="Find your order"
        description="Look up an order with your reference and the email you used."
        path="/orders"
        noindex
      />

      <h1 className={`${styles.title} wide`}>Find your order</h1>
      <p className={styles.body}>
        The link in your confirmation email is the quickest way back. If it has
        gone, the reference and the email address you ordered with will do.
      </p>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>Order reference</span>
          <input
            value={reference}
            onChange={(e) => { setReference(e.target.value); setFailed(false); }}
            placeholder="CK-A4KP-9RMT"
            autoComplete="off"
            spellCheck="false"
            disabled={busy}
          />
          <span className={styles.hint}>On your confirmation email, starting CK.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFailed(false); }}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={busy}
          />
        </label>

        {failed && (
          <p className={styles.failed} role="alert">
            We cannot find an order with those details. Check the reference and
            the address, and if it still will not come up write to
            support@cartandkeep.com and we will look it up by hand.
          </p>
        )}

        <button type="submit" className={styles.go} disabled={busy}>
          {busy ? 'Looking' : <>Find it <ArrowRightIcon size={16} /></>}
        </button>
      </form>

      <div className={styles.aside}>
        <MailIcon size={18} />
        <p>
          Tracking arrives by email when the parcel leaves, so if you have had a
          dispatch email the link in that one goes straight there.
        </p>
      </div>

      <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
    </section>
  );
}
