import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { PORTAL_NAV_SECTIONS, portalPath } from '@utils/constants';
import { Icon } from '@components/ui/icons';
import { useAccount } from '@hooks/useAccount';
import { supabase } from '@lib/supabase';
import { useNoIndex } from '@hooks/useNoIndex';
import styles from '@styles/layout/portal/portal-shell.module.css';

function Mark({ className }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Cart and Keep">
      <rect width="512" height="512" rx="72" fill="var(--c-ink)" />
      <text x="256" y="378" textAnchor="middle" fill="var(--c-base)"
        fontFamily="var(--font-ui)" fontWeight="500" fontSize="360" letterSpacing="-12">C</text>
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

function titleFor(pathname) {
  if (pathname === '/') return 'Overview';
  const [, first] = pathname.split('/');
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Overview';
}
