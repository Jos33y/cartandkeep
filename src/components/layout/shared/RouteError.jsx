import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router';
import { isStaleBuild, reloadOnce } from '@lib/staleBuild';
import { isPortalHost } from '@lib/host';
import styles from '@styles/layout/shared/route-error.module.css';

/*
 * What a route shows when it fails, in place of React Router's developer screen.
 *   The site was updated while the tab was open: it loads the new version by itself, once.
 *   It still fails, or something else broke: plain words, Reload, and a way back to the start.
 * The technical message is shown only in the portal, folded away; never on the shop.
 */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleBuild(error);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stale) setLoading(reloadOnce());
    else console.error('Route failed', error);
  }, [stale, error]);

  const copy = stale
    ? loading
      ? { kicker: 'One moment', title: 'Getting the latest version', body: 'The site was updated while this page was open.' }
      : { kicker: 'Updated', title: 'A newer version is ready', body: 'Reload to carry on where you were.' }
    : { kicker: 'Something went wrong', title: 'This page did not load', body: 'Reload to try again. If it keeps happening, give it a few minutes and come back.' };
  const message = String(error?.message ?? error?.statusText ?? error ?? '');

  return (
    <div className={styles.page}>
      <section className={styles.card} data-kind={stale ? 'stale' : 'fault'} role="alert" aria-busy={loading || undefined}>
        <Mark stale={stale} />
        <p className={styles.kicker}>{copy.kicker}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.body}>{copy.body}</p>
        {loading ? (
          <div className={styles.loading} aria-hidden="true"><i /></div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5V5h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Reload
            </button>
            <a className={styles.home} href="/">Go to the start</a>
          </div>
        )}
        {!stale && isPortalHost() && message && (
          <details className={styles.details}>
            <summary>What failed</summary>
            <pre>{message}</pre>
          </details>
        )}
      </section>
    </div>
  );
}

// An update: a page with a turning arrow. A fault: a page torn across.
function Mark({ stale }) {
  return (
    <svg className={styles.mark} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M11 5h16l8 8v26H11z" fill="var(--c-sunk)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M27 5v8h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {stale ? (
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 25a5 5 0 1 1-1.6-3.7" />
          <path d="M28 18.5v3.2h-3.2" />
        </g>
      ) : (
        <path d="M11 24l5-2 4 3 5-3 5 2 5-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
