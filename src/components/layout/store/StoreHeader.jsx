import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from '@components/ui/shared/Logo';
import { CloseIcon, HeartIcon, MenuIcon, SearchIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { useSaved } from '@hooks/useSaved';
import { useSections } from '@hooks/useSections';
import { useGroups } from '@hooks/useCatalogue';
import { visibleGroups } from '@utils/categories';
import { freeOver } from '@lib/storeConfig';
import { priceGroups } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import { HeaderSearch } from './HeaderSearch';
import { BasketRing } from './BasketRing';
import { MobileMenu } from './MobileMenu';
import styles from '@styles/layout/store/store-header.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

// The shelf rail's highlight glides to whatever the pointer is over and settles back on the current page.
function useGlide(railRef, deps) {
  const [box, setBox] = useState(null);
  const place = useCallback((el) => {
    const rail = railRef.current;
    if (!rail || !el) { setBox(null); return; }
    const r = rail.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setBox({ x: b.left - r.left + rail.scrollLeft, w: b.width });
  }, [railRef]);
  const rest = useCallback(() => place(railRef.current?.querySelector('[aria-current="page"]')), [place, railRef]);
  useLayoutEffect(() => { rest(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { box, place, rest };
}

export function StoreHeader() {
  const { count, subtotal } = useBasket();
  const { ids } = useSaved();
  const { rows } = useSections();
  // The rail's sections and counts come from the database: the old list stopped at 1,000 and split same-named sections in two.
  const { groups, total: shopTotal } = useGroups();
  const sections = useMemo(() => visibleGroups(groups), [groups]);
  const { pathname } = useLocation();
  const threshold = freeOver();
  const bands = useMemo(() => priceGroups(rows), [rows]);

  // Only saves that are still on sale: a count of products the customer can no longer buy is a count that misleads.
  const savedCount = useMemo(() => {
    const live = new Set(rows.map((p) => p.id));
    return ids.filter((id) => live.has(id)).length;
  }, [ids, rows]);

  const header = useRef(null);
  const rail = useRef(null);
  const searchInput = useRef(null);
  const [stuck, setStuck] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const { box, place, rest } = useGlide(rail, [pathname, sections.length]);
  const closeMenu = useCallback(() => setMenu(false), []);

  // The header's real height, rail and all, published for anything that pins under it. It changes as the rail tucks away.
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--store-header-h', `${Math.round(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty('--store-header-h'); };
  }, []);

  // Scrolling down tucks the shelf rail away; any scroll up brings it back.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setStuck(y > 8);
      // No tucking: collapsing the rail changed the header's height mid-scroll, which moved the page under the pointer and jolted the pinned toolbar.
      if (Math.abs(y - last) > 6) setTucked(false);
      last = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Anything pinned under the header, or scrolled to an anchor, reads the header's real height.
  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--store-bar-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ctrl K or Cmd K from anywhere, and / when not already typing.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName ?? '');
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        if (window.matchMedia('(min-width: 1024px)').matches) searchInput.current?.focus();
        else setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setSearching(false); }, [pathname]);

  const shelves = [
    { key: 'all', label: 'Everything', to: STORE_ROUTES.SHOP, count: shopTotal, all: true },
    ...sections.map((s) => ({ key: s.slug, label: s.name, to: categoryPath(s.slug), count: s.count })),
    ...bands.map((b) => ({ key: b.slug, label: b.name, to: categoryPath(b.slug), band: true })),
  ];

  return (
    <header ref={header} className={styles.header} data-stuck={stuck || undefined} data-tucked={tucked || undefined}>
      <div className={styles.bar}>
        <button type="button" className={`${styles.icon} ${styles.menuButton}`} aria-label="Open the menu" aria-expanded={menu} onClick={() => setMenu(true)}>
          <MenuIcon />
        </button>

        <Link to={STORE_ROUTES.HOME} className={styles.mark} aria-label="Cart and Keep, home">
          <Logo size={32} />
        </Link>

        <div className={styles.search}>
          <HeaderSearch rows={rows} sections={sections} inputRef={searchInput} />
        </div>

        <div className={styles.tools}>
          <button type="button" className={`${styles.icon} ${styles.searchButton}`} aria-label="Search" onClick={() => setSearching(true)}>
            <SearchIcon />
          </button>

          <NavLink to={STORE_ROUTES.SAVED} className={styles.saved} data-has={savedCount > 0 || undefined} aria-label={savedCount ? `Saved, ${savedCount}` : 'Saved'}>
            <span className={styles.heart}>
              <HeartIcon size={22} />
              {savedCount > 0 && <span className={styles.pip} data-price aria-hidden="true">{savedCount}</span>}
            </span>
            <span className={styles.toolLabel}>Saved</span>
          </NavLink>

          <NavLink
            to={STORE_ROUTES.CART}
            className={styles.basket}
            aria-label={count === 0 ? 'Basket, empty' : `Basket, ${count} ${count === 1 ? 'item' : 'items'}`}
          >
            <BasketRing count={count} subtotal={subtotal} threshold={threshold} />
          </NavLink>
        </div>
      </div>

      {/* One shelf is not a nav: the rail waits until there are at least two real sections to choose between. */}
      {sections.length >= 2 && (
      <nav className={styles.rail} aria-label="Shelves">
        <div className={styles.railInner}>
          <ul ref={rail} className={styles.shelves} onPointerLeave={rest}>
            {box && <li className={styles.glide} aria-hidden="true" style={{ transform: `translateX(${box.x}px)`, width: box.w }} />}
            {shelves.map((s) => (
              <li key={s.key}>
                <NavLink
                  to={s.to}
                  className={styles.shelf}
                  onPointerEnter={(e) => place(e.currentTarget)}
                  onFocus={(e) => place(e.currentTarget)}
                  onBlur={rest}
                >
                  {s.label}
                  {s.count != null && <span className={styles.count}>{s.count}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      )}

      {/* Portalled: the header's backdrop blur makes it the containing block for anything fixed inside it. */}
      {searching && createPortal(
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Search the shop">
          <div className={styles.sheetTop}>
            <HeaderSearch rows={rows} sections={sections} sheet onClose={() => setSearching(false)} />
            <button type="button" className={styles.icon} aria-label="Close search" onClick={() => setSearching(false)}><CloseIcon /></button>
          </div>
        </div>,
        document.body,
      )}

      {createPortal(
        <MobileMenu
          open={menu}
          onClose={closeMenu}
          sections={sections}
          total={shopTotal}
          subtotal={subtotal}
          threshold={threshold}
          count={count}
        />,
        document.body,
      )}
    </header>
  );
}
