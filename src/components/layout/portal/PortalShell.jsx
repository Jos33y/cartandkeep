import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { PORTAL_NAV_SECTIONS, portalPath } from '@utils/constants';
import { Icon } from '@components/ui/icons';
import { ScrollToTop } from '@components/layout/shared/ScrollToTop';
import { useAccount } from '@hooks/useAccount';
import { useAwaitingCount } from '@hooks/useThreads';
import { loadTenant } from '@lib/tenant';
import { supabase } from '@lib/supabase';
import { useNoIndex } from '@hooks/useNoIndex';
import styles from '@styles/layout/portal/portal-shell.module.css';

/*
 * The actual mark, not a letter in a box.
 *
 * The sidebar drew a dark rounded square with a C in it, which is not the logo
 * and never was. The basket and ampersand are what is on the favicon, the app
 * icon and the shop, so the one place she looks at all day was the one place
 * showing something else.
 */
function Mark({ className }) {
  return (
    <svg viewBox="0 0 30 30" className={className} fill="none" role="img" aria-label="Cart and Keep">
      <path d="M4.6 9.8h20.8l-2.1 14a2.4 2.4 0 0 1-2.4 2H9.1a2.4 2.4 0 0 1-2.4-2l-2.1-14Z" fill="var(--c-ink)" />
      <path d="M10.6 9.8V8a4.4 4.4 0 0 1 8.8 0v1.8" stroke="var(--c-brand)" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14.014 23.7Q12.968 23.7 12.206 23.319Q11.445 22.939 11.037 22.3Q10.629 21.661 10.629 20.879Q10.629 20.267 10.871 19.805Q11.112 19.343 11.544 18.952Q11.975 18.561 12.539 18.174L14.47 16.896Q14.681 16.76 14.85 16.587Q15.02 16.413 15.119 16.213Q15.218 16.012 15.218 15.781Q15.218 15.434 14.973 15.19Q14.728 14.945 14.273 14.945Q13.974 14.945 13.749 15.061Q13.525 15.176 13.403 15.387Q13.28 15.598 13.28 15.883Q13.28 16.216 13.447 16.546Q13.613 16.875 13.906 17.236Q14.198 17.596 14.579 18.038L19.371 23.55H17.223L13.233 19.085Q12.818 18.602 12.424 18.113Q12.03 17.623 11.771 17.069Q11.513 16.515 11.513 15.863Q11.513 15.135 11.856 14.554Q12.199 13.973 12.818 13.636Q13.437 13.3 14.259 13.3Q15.068 13.3 15.653 13.623Q16.237 13.946 16.557 14.486Q16.876 15.027 16.876 15.686Q16.876 16.155 16.71 16.57Q16.543 16.984 16.244 17.338Q15.945 17.691 15.53 17.997L13.464 19.486Q13.049 19.792 12.835 20.094Q12.621 20.396 12.621 20.798Q12.621 21.178 12.804 21.464Q12.988 21.749 13.314 21.902Q13.641 22.055 14.076 22.055Q14.633 22.055 15.16 21.81Q15.687 21.566 16.118 21.114Q16.55 20.662 16.805 20.033Q17.06 19.404 17.06 18.643H18.766Q18.766 19.581 18.562 20.318Q18.358 21.056 18.004 21.593Q17.651 22.13 17.202 22.47L16.679 22.81Q16.122 23.265 15.408 23.482Q14.694 23.7 14.014 23.7Z" fill="var(--c-base)" />
    </svg>
  );
}

export function PortalShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  const burgerRef = useRef(null);
  const account = useAccount();
  useNoIndex();

  /*
   * What is waiting, carried on every screen.
   *
   * A conversation nobody answers is worse than no conversation, so the count
   * has to be visible from wherever she is rather than found by opening the
   * screen it lives on. One head request against the partial index in 0067,
   * not two hundred rows nobody is looking at.
   *
   * `loadTenant` is cached after the first call, so this costs no round trip
   * on any screen that has already read it, which is all of them.
   */
  const [tenantId, setTenantId] = useState(null);
  useEffect(() => { loadTenant().then((t) => setTenantId(t?.id ?? null)); }, []);
  const badges = { awaiting: useAwaitingCount(tenantId) };

  // A scrim with no keyboard dismissal leaves a keyboard user stuck behind it.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        burgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const initial = account.email ? account.email[0].toUpperCase() : '';

  return (
    <div className={styles.shell}>
      <a href="#portal-main" className={styles.skip}>Skip to content</a>

      {/* The storefront has mounted this since it was built and the portal
          never did, so scrolling to the foot of Products and opening Orders
          landed at the foot of Orders. */}
      <ScrollToTop />

      <aside className={`${styles.sidebar} ${drawerOpen ? styles.open : ''}`} id="portal-sidebar" aria-label="Portal">
        <div className={styles.brand}>
          <Mark className={styles.brandMark} />
          <span className={styles.brandName}>Cart &amp; Keep</span>
          <span className={styles.brandSub}>Operations</span>
        </div>

        <nav className={styles.nav} aria-label="Sections">
          {PORTAL_NAV_SECTIONS.map((section) => (
            <div key={section.key} className={styles.section}>
              <p className={styles.sectionLabel}>{section.label}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.route}
                  to={portalPath(item.route)}
                  end={item.route === '/'}
                  className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon name={item.icon} className={styles.icon} />
                  <span>{item.label}</span>

                  {/* Absent at zero rather than showing one. A nought beside
                      Messages every day is furniture, and furniture is what
                      the count stops being read as the moment it appears. */}
                  {item.badge && badges[item.badge] > 0 && (
                    <span className={styles.badge} data-num>
                      {badges[item.badge]}
                      <span className={styles.srOnly}> waiting on you</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.account}>
          {account.email && (
            <div className={styles.who}>
              <span className={styles.avatar} aria-hidden="true">{initial}</span>
              <span className={styles.whoText}>
                <span className={styles.whoEmail} title={account.email}>{account.email}</span>
                {account.role && <span className={styles.whoRole}>{account.role}</span>}
              </span>
            </div>
          )}

          <button
            className={styles.signOut}
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await supabase.auth.signOut();
            }}
          >
            <Icon name="IconExit" className={styles.icon} />
            <span>{signingOut ? 'Signing out' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <button
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => {
            setDrawerOpen(false);
            burgerRef.current?.focus();
          }}
        />
      )}

      <div className={styles.body}>
        <header className={styles.topbar}>
          <button
            ref={burgerRef}
            className={styles.burger}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="portal-sidebar"
            onClick={() => setDrawerOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <span className={styles.crumb}>{titleFor(pathname)}</span>
        </header>

        <main id="portal-main" className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

/*
 * The crumb, from the nav rather than from the path.
 *
 * Taking the first segment broke as soon as a route nested: /ebay/traffic read
 * as "Ebay", and /orders/:reference/slip reads as "Orders". The nav already
 * holds the name each route is called, so it is the honest source, and a route
 * with no nav entry falls back to the last segment rather than the first.
 */
function titleFor(pathname) {
  if (pathname === '/') return 'Overview';

  const named = PORTAL_NAV_SECTIONS
    .flatMap((s) => s.items)
    .find((i) => i.route !== '/' && pathname.startsWith(portalPath(i.route)));
  if (named) return named.label;

  const last = pathname.split('/').filter(Boolean).pop();
  return last ? last.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Overview';
}
