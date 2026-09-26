import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronRightIcon, CloseIcon } from '@components/ui/store/icons';
import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/layout/store/mobile-menu.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

const HELP = [
  ['Track an order', STORE_ROUTES.ORDER_LOOKUP],
  ['Frequently asked', STORE_ROUTES.FAQ],
  ['Contact us', STORE_ROUTES.CONTACT],
  ['About the shop', STORE_ROUTES.ABOUT],
];

export function MobileMenu({ open, onClose, sections, total, subtotal, threshold, count }) {
  const panel = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // The page behind stays still while the sheet is open, and focus moves into it.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('a, button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const share = threshold > 0 ? Math.min(1, subtotal / threshold) : 0;

  return (
    <div className={styles.root} data-open={open || undefined} aria-hidden={!open}>
      <button type="button" className={styles.scrim} tabIndex={-1} aria-label="Close the menu" onClick={onClose} />
      <nav ref={panel} className={styles.panel} aria-label="Shop menu" inert={!open}>
        <div className={styles.top}>
          <p className={styles.title}>The shelves</p>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close the menu"><CloseIcon size={20} /></button>
        </div>

        <ul className={styles.tiles}>
          <li style={{ '--i': 0 }}>
            <Link to={STORE_ROUTES.SHOP} className={`${styles.tile} ${styles.tileAll}`}>
              <SectionGlyph kind="box" size={36} className={styles.glyph} />
              <span className={styles.tileName}>Everything</span>
              <span className={styles.tileCount}>{total}</span>
            </Link>
          </li>
          {sections.map((s, i) => (
            <li key={s.slug} style={{ '--i': i + 1 }}>
              <Link to={categoryPath(s.slug)} className={styles.tile}>
                <SectionGlyph name={s.name} size={36} className={styles.glyph} />
                <span className={styles.tileName}>{s.name}</span>
                <span className={styles.tileCount}>{s.count ?? s.items?.length ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>

        <ul className={styles.help}>
          {HELP.map(([label, to]) => (
            <li key={to}><Link to={to} className={styles.helpLink}>{label}<ChevronRightIcon size={16} /></Link></li>
          ))}
        </ul>

        <div className={styles.delivery} data-unlocked={(count > 0 && share >= 1) || undefined}>
          <p className={styles.deliveryText}>
            {count === 0 ? `Free UK delivery from ${formatGbp(threshold)}`
              : share >= 1 ? 'Your basket has free delivery'
                : `${formatGbp(threshold - subtotal)} more for free delivery`}
          </p>
          <span className={styles.bar} aria-hidden="true"><span style={{ transform: `scaleX(${count ? share : 0})` }} /></span>
        </div>
      </nav>
    </div>
  );
}
