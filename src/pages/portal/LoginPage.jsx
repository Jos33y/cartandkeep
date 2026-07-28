import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '@lib/supabase';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/login-page.module.css';

const RESEND_SECONDS = 45;

// Supabase OTP length is a dashboard setting and has been 6 or 8. Accept a
// range rather than hardcoding one and truncating the other.
const MIN_CODE = 6;
const MAX_CODE = 10;

// Deterministic so the sky is the same on every load.
const SKY = (() => {
  let s = 20260726;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  const stars = [];

  const push = (x, y) => {
    if (x < 4 || x > 596 || y < 4 || y > 796) return;
    const bright = rnd() > 0.94;
    stars.push({
      x,
      y,
      r: bright ? 1.9 + rnd() * 0.9 : 0.5 + rnd() ** 2 * 1.4,
      o: bright ? 0.75 + rnd() * 0.2 : 0.1 + rnd() ** 1.7 * 0.5,
    });
  };

  for (let i = 0; i < 130; i += 1) push(rnd() * 600, rnd() * 800);

  // A drift of denser stars, so the field has a grain rather than an even wash.
  for (let i = 0; i < 150; i += 1) {
    const x = rnd() * 620 - 10;
    push(x, x * 0.95 + 110 + gauss() * 150);
  }

  return stars;
})();

// The asset renders its C as SVG text in a face we do not load, so as an <img>
// it falls back per machine. Inline, it inherits the page font.
function Mark({ className }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Cart and Keep">
      <rect width="512" height="512" rx="72" fill="var(--c-ink)" />
      <text x="256" y="378" textAnchor="middle" fill="var(--c-base)"
        fontFamily="var(--font-ui)" fontWeight="500" fontSize="360" letterSpacing="-12">C</text>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true" focusable="false">
      <path d="M3 8.4l3.6 3.6L13 5" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.7v4.1M8 11.4v.1" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);
  const navigate = useNavigate();

  // PortalProtected only mounts under "/", so nothing here listens for auth.
  // A session already in storage has to be acted on by this page.
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live && data.session) navigate(portalPath('/'), { replace: true });
    });
    return () => { live = false; };
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function sendCode(e) {
    e?.preventDefault();
    setError(null);
    setBusy(true);

    // shouldCreateUser false, or any address on earth can open the portal shell.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });

    setBusy(false);

    if (error) {
      setError(
        /not found|signups not allowed/i.test(error.message)
          ? 'That address does not have access to this portal.'
          : error.message,
      );
      return;
    }

    setStep('code');
    setCooldown(RESEND_SECONDS);
  }

  async function verify(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });

    setBusy(false);

    if (error) {
      // Supabase returns "Token has expired or is invalid" for both cases, so
      // naming one of them is a guess that sends people down the wrong path.
      setError('That code did not work. Request a new one.');
      setCode('');
      codeRef.current?.focus();
      return;
    }

    // Replace, or Back returns to a login form with a live session behind it.
    navigate(portalPath('/'), { replace: true });
  }

  const onCode = step === 'code';

  return (
    <div className={styles.page}>
      <section className={styles.slab}>
        <div className={styles.slabHead}>
          <Mark className={styles.mark} />
          <span className={styles.wordmark}>Cart &amp; Keep</span>
        </div>

        <div className={styles.body}>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.blurb}>
            {onCode
              ? 'Enter the code sent to your email.'
              : 'Access is by email code. No password to remember.'}
          </p>

          <div className={styles.steps} aria-hidden="true">
            <span className={`${styles.seg} ${styles.segOn}`} />
            <span className={`${styles.seg} ${onCode ? styles.segOn : ''}`} />
          </div>
          <div className={styles.stepLabels} aria-hidden="true">
            <span className={onCode ? '' : styles.stepNow}>Email</span>
            <span className={onCode ? styles.stepNow : ''}>Code</span>
          </div>
          <p className={styles.srOnly}>
            {onCode ? 'Step 2 of 2, enter code' : 'Step 1 of 2, enter email'}
          </p>

          {onCode ? (
            <form className={styles.form} onSubmit={verify}>
              <p className={styles.sentTo}>
                <CheckIcon />
                <span>Sent to <strong>{email}</strong></span>
              </p>

              <label className={styles.label} htmlFor="code">Code</label>
              <input
                ref={codeRef}
                id="code"
                name="one-time-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={MAX_CODE}
                required
                aria-describedby="auth-error"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_CODE))}
                className={`${styles.input} ${styles.codeInput}`}
              />

              <button type="submit" className={styles.button} disabled={busy || code.length < MIN_CODE}>
                {busy ? 'Checking' : 'Sign in'}
              </button>

              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.link}
                  disabled={cooldown > 0 || busy}
                  onClick={sendCode}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                >
                  Change email
                </button>
              </div>
            </form>
          ) : (
            <form className={styles.form} onSubmit={sendCode}>
              <label className={styles.label} htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                aria-describedby="auth-error"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
              <button type="submit" className={styles.button} disabled={busy || !email}>
                {busy ? 'Sending' : 'Send code'}
              </button>
            </form>
          )}

          <p id="auth-error" className={styles.error} role="alert" aria-live="assertive">
            {error ? <><AlertIcon /><span>{error}</span></> : null}
          </p>
        </div>

        <p className={styles.slabFoot}>The Brick Dev Studios</p>
      </section>

      <aside className={styles.field}>
        <svg
          className={styles.art}
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          {SKY.map((st, i) => (
            <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="var(--c-base)" opacity={st.o} />
          ))}
        </svg>
      </aside>
    </div>
  );
}
