import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { PORTAL_NAV_SECTIONS, portalPath } from '@utils/constants';
import { Icon } from '@components/ui/icons';
import { ScrollToTop } from '@components/layout/shared/ScrollToTop';
import { PortalTopbar } from '@components/layout/portal/PortalTopbar';
import { CommandPalette } from '@components/layout/portal/CommandPalette';
import { useAccount } from '@hooks/useAccount';
import { useAwaitingCount } from '@hooks/useThreads';
import { useRecordVisit, screenFor } from '@hooks/usePortalVisits';
import { loadTenant } from '@lib/tenant';
import { useNoIndex } from '@hooks/useNoIndex';
import styles from '@styles/layout/portal/portal-shell.module.css';

// The basket and ampersand from the favicon and the shop, not a letter in a box.
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
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const burgerRef = useRef(null);
  const navRef = useRef(null);
  const returnFocusRef = useRef(null);
  const account = useAccount();
  useNoIndex();

  const [tenantId, setTenantId] = useState(null);
  useEffect(() => { loadTenant().then((t) => setTenantId(t?.id ?? null)); }, []);
  const badges = { awaiting: useAwaitingCount(tenantId) };
  const previousAt = useRecordVisit(tenantId, pathname);

  const openSearch = useCallback(() => {
    returnFocusRef.current = document.activeElement;
    setDrawerOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchOpen) closeSearch(); else openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, openSearch, closeSearch]);

  // Fades only on the side with more to see, so the edge of the rail says whether it scrolls.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const update = () => {
      nav.toggleAttribute('data-more-above', nav.scrollTop > 2);
      nav.toggleAttribute('data-more-below', nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2);
    };
    update();
    nav.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => {
      nav.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // The current screen is kept in view: on a laptop Settings otherwise loads below the rail's fold.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!link) return;
    const margin = 48;
    const top = link.offsetTop - nav.offsetTop;
    const bottom = top + link.offsetHeight;
    if (top - margin < nav.scrollTop) nav.scrollTop = Math.max(0, top - margin);
    else if (bottom + margin > nav.scrollTop + nav.clientHeight) nav.scrollTop = bottom + margin - nav.clientHeight;
  }, [pathname]);

  // A scrim with no keyboard dismissal leaves a keyboard user stuck behind it.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        burgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className={styles.shell}>
      <a href="#portal-main" className={styles.skip}>Skip to content</a>
      <ScrollToTop />

      <aside className={`${styles.sidebar} ${drawerOpen ? styles.open : ''}`} id="portal-sidebar" aria-label="Portal">
        <div className={styles.brand}>
          <Mark className={styles.brandMark} />
          <span className={styles.brandName}>Cart &amp; Keep</span>
          <span className={styles.brandSub}>Operations</span>
        </div>

        <nav ref={navRef} className={styles.nav} aria-label="Sections">
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
                  {/* Absent at zero: a nought beside Messages every day stops being read. */}
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
        <PortalTopbar
          crumb={crumbFor(pathname)}
          account={account}
          tenantId={tenantId}
          previousAt={previousAt}
          burgerRef={burgerRef}
          drawerOpen={drawerOpen}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenSearch={openSearch}
        />

        <main id="portal-main" className={styles.main}>
          {children}
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={closeSearch} />
    </div>
  );
}

// From the nav, not the path: /ebay/traffic is "Traffic" and /orders/AB12/slip is "Orders".
function crumbFor(pathname) {
  const screen = screenFor(pathname);
  for (const s of PORTAL_NAV_SECTIONS) {
    const item = s.items.find((i) => i.route === screen);
    if (item) return { section: s.label, page: item.label };
  }
  const last = pathname.split('/').filter(Boolean).pop();
  return { section: null, page: last ? last.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Overview' };
}
