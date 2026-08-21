import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/request-page.module.css';

/*
 * Asking the shop to stock something.
 *
 * The band on the home page has promised this since the shop was built and it
 * went to an email client, which meant she received an unstructured message
 * with none of what makes a request useful, and most people never sent one at
 * all because opening a mail app is where a request goes to die.
 *
 * One required field. Everything else is optional and every one of them is
 * a percentage of people who stop, so each has to earn its place.
 *
 * Not a support form. Somebody with a problem replies to their order email,
 * which reaches her the same day, and the page says so rather than quietly
 * collecting complaints in a list she reads on Mondays.
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function RequestPage() {
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    // Prefilled when the band on a product page sends somebody here, because
    // the usual reason for asking from a product page is that the thing found
    // was nearly right.
    wanted: params.get('for') ?? '',
    paying: '',
    seenAt: '',
    email: '',
    name: '',
    // The honeypot. Hidden from people, filled in by a bot, and a filled one
    // gets a cheerful reply and no row.
    website: '',
  });

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch(`${BASE}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ ...form, source: params.get('from') ?? '/request' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'That did not send. Try again.');
      setDone(true);
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className={styles.page}>
        <Head title="Asked" description="Thank you." path="/request" noindex />
        <h1 className={`${styles.title} wide`}>Asked</h1>
        <p className={styles.body}>
          One person reads these and it is usually the same day.
          {form.email
            ? ' If it is something worth stocking, you will hear back.'
            : ' You left no email, so the way you will know is it appearing in the shop.'}
        </p>

        {/* No sign up box here. The list lives in the footer, in one place,
            so asking for a product never looks like it signs you up for
            anything. */}
        <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Head
        title="Ask us to stock something"
        description="Tell us what you are after and we will look for it before we buy anything else."
        path="/request"
      />

      <header className={styles.head}>
        <p className={styles.eyebrow}>Requests welcome</p>
        <h1 className={`${styles.title} wide`}>Tell us what you need</h1>
        {/* The same two clauses as the band, since somebody arriving here has
            just read them. Nothing explains why the price box exists: a
            shopkeeper asking what you pay for something is not a question that
            needs a reason. */}
        <p className={styles.body}>
          We add stock every week, and requests come first. Tell us what you
          need and what you pay for it now.
        </p>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>What are you after?</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={form.wanted}
            maxLength={300}
            onChange={set('wanted')}
            placeholder="Bed rails for a hospital bed, the kind that fits under the mattress"
          />
          <span className={styles.hint}>
            Brand and size if you have them. Vague requests get vague results.
          </span>
        </label>

        {/* The two that turn a wish into something she can price. Side by side
            so they read as one question rather than two more things to fill
            in. */}
        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.label}>What do you pay for it now?</span>
            <input
              className={styles.input}
              value={form.paying}
              onChange={set('paying')}
              inputMode="decimal"
              placeholder="About £30"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Where do you buy it?</span>
            <input
              className={styles.input}
              value={form.seenAt}
              onChange={set('seenAt')}
              placeholder="Amazon, Boots, a link"
            />
          </label>
        </div>

        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.label}>Your name</span>
            <input className={styles.input} value={form.name} onChange={set('name')} autoComplete="name" />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Your email</span>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              placeholder="Only if you want an answer"
            />
          </label>
        </div>

        {/* Hidden from people, visible to a bot. Not a captcha, which would be
            a tax on everybody who would have used the form to stop the handful
            who abuse it. */}
        <input
          className={styles.trap}
          value={form.website}
          onChange={set('website')}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        {failed && <p className={styles.error} role="alert">{failed}</p>}

        <button
          type="button"
          className={styles.submit}
          disabled={busy || !form.wanted.trim()}
          onClick={submit}
        >
          {busy ? 'Sending' : 'Ask us for it'}
        </button>

        {/*
          * Said here rather than left to be discovered. A request list quietly
          * filling with delivery complaints helps nobody, least of all the
          * person waiting on a parcel.
          *
          * "us", not "her". This is the shop speaking to its customer, and a
          * shop that refers to its own owner in the third person on a page a
          * customer reads sounds like it is run by somebody else.
          */}
        <p className={styles.aside}>
          Waiting on an order instead? Reply to your order email, which reaches
          us directly, or <Link to={STORE_ROUTES.CONTACT}>get in touch</Link>.
        </p>
      </div>
    </section>
  );
}
