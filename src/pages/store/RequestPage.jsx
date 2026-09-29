import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { Postmark } from '@components/ui/store/Postmark';
import { replyPromise, storeConfig } from '@lib/storeConfig';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/request-page.module.css';

/*
 * The request slip, carried through from the home page and stamped when it is received.
 *
 * One required line; every other line is optional, because each one is a
 * share of people who stop. Not a support form: order problems are pointed at
 * Contact rather than collected here.
 */

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const today = () => {
  const d = new Date();
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' }).format(d).slice(0, 3);
  return `${day} ${month}`;
};

export function RequestPage() {
  const [params] = useSearchParams();
  const examples = useMemo(() => storeConfig().voice?.requestExamples ?? [], []);
  const promise = replyPromise();
  const wantedRef = useRef(null);

  const [form, setForm] = useState({
    wanted: params.get('for') ?? '',
    paying: '',
    seenAt: '',
    name: '',
    email: '',
    // The honeypot: hidden from people, filled in by bots, and a filled one gets a cheerful reply and no row.
    website: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);
  const [missing, setMissing] = useState(false);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (key === 'wanted') setMissing(false);
  };

  async function submit(event) {
    event.preventDefault();
    // The button never looks dead; an empty first line is pointed at instead.
    if (!form.wanted.trim()) {
      setMissing(true);
      wantedRef.current?.focus();
      return;
    }
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
      // Up to the heading and the slip, so the stamp landing is seen rather than happening off screen.
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <Head
        title={done ? 'Request received' : 'Ask us to stock something'}
        description="Tell us what you are after and we will look for it."
        path="/request"
        noindex={done}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">Request</span>
      </nav>

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>
          {done ? 'Received.' : <><span className={styles.titleLine}>Name it.</span> <span className={styles.titleLine}>We will look for it.</span></>}
        </h1>
        <p className={styles.lede}>
          {done
            ? (form.email.trim()
              ? `A person reads every request. You will hear back ${promise}.`
              : 'A person reads every request. You left no email, so you will know when it appears in the shop.')
            : 'Model numbers, spare parts, the one you always buy. Tell us what it is and what you pay for it now.'}
        </p>
      </header>

      <form className={styles.slip} onSubmit={submit} noValidate data-done={done || undefined}>
        <div className={styles.slipHead}>
          <span className={styles.slipLabel}>Request slip</span>
          {done
            ? <Postmark className={styles.received} top="Received" word={today()} label={`Received ${today()}`} />
            : <span className={styles.stamp} aria-hidden="true">Free<br />to ask</span>}
        </div>

        <label className={styles.field} data-missing={missing || undefined}>
          <span className={styles.lineLabel}>I am looking for</span>
          <input
            ref={wantedRef}
            className={styles.big}
            value={form.wanted}
            onChange={set('wanted')}
            maxLength={300}
            placeholder={done ? undefined : "Make, model or part number"}
            autoComplete="off"
            readOnly={done}
            aria-invalid={missing || undefined}
            aria-describedby={missing ? 'wanted-missing' : undefined}
          />
          {missing && <span id="wanted-missing" className={styles.missing} role="alert">Start here: what are you looking for?</span>}
        </label>

        {!done && examples.length > 0 && (
          <div className={styles.try}>
            <span className={styles.tryLabel}>Try</span>
            {examples.map((ex) => (
              <button key={ex} type="button" className={styles.tryChip} aria-pressed={form.wanted === ex} onClick={() => { setForm((f) => ({ ...f, wanted: ex })); setMissing(false); wantedRef.current?.focus(); }}>
                {ex}
              </button>
            ))}
          </div>
        )}

        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.lineLabel}>What I pay for it now</span>
            <input className={styles.line} value={form.paying} onChange={set('paying')} inputMode="decimal" placeholder={done ? undefined : "About £30"} readOnly={done} />
          </label>
          <label className={styles.field}>
            <span className={styles.lineLabel}>Where I buy it</span>
            <input className={styles.line} value={form.seenAt} onChange={set('seenAt')} placeholder={done ? undefined : "A shop or a link"} readOnly={done} />
          </label>
        </div>

        <div className={styles.pair}>
          <label className={styles.field}>
            <span className={styles.lineLabel}>My name</span>
            <input className={styles.line} value={form.name} onChange={set('name')} autoComplete="name" readOnly={done} />
          </label>
          <label className={styles.field}>
            <span className={styles.lineLabel}>My email, if I want an answer</span>
            <input className={styles.line} type="email" value={form.email} onChange={set('email')} autoComplete="email" readOnly={done} />
          </label>
        </div>

        {/* Off screen rather than display none, which is the one thing some bots check for. */}
        <input className={styles.trap} value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" />

        {failed && <p className={styles.error} role="alert">{failed}</p>}

        {done ? (
          <div className={styles.foot}>
            <Link className={styles.send} to={STORE_ROUTES.SHOP}>Back to the shop <ArrowRightIcon size={16} /></Link>
          </div>
        ) : (
          <div className={styles.foot}>
            <button type="submit" className={styles.send} disabled={busy}>
              {busy ? 'Sending' : 'Send the request'} {!busy && <ArrowRightIcon size={16} />}
            </button>
            <span className={styles.fine}>Only the first line is needed. No account, and a person replies {promise}.</span>
          </div>
        )}
      </form>

      <p className={styles.aside}>
        Waiting on an order instead? <Link to={STORE_ROUTES.CONTACT}>Write to us</Link> with your order reference.
      </p>
    </section>
  );
}
