import { useState } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '@components/ui/shared/Logo';
import { InstagramIcon, MailIcon, TiktokIcon } from '@components/ui/store/icons';
import { LEGAL_COLUMN, LEGAL_LINKS } from '@data/legal';
import { useSections } from '@hooks/useSections';
import { STORE_ROUTES } from '@utils/constants';
import { storeConfig, supportEmail, trader } from '@lib/storeConfig';
import { Subscribe } from '@components/ui/store/Subscribe';
import styles from '@styles/layout/store/store-footer.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

const HELP = [
  ['Track an order', STORE_ROUTES.ORDER_LOOKUP],
  ['Frequently asked', STORE_ROUTES.FAQ],
  ['Contact us', STORE_ROUTES.CONTACT],
  ['About us', STORE_ROUTES.ABOUT],
  ['Writing', STORE_ROUTES.BLOG],
];

// Marks only render once their files have loaded, so a missing file never shows as an empty frame.
const PAYMENT = [
  ['visa', 'Visa'],
  ['mastercard', 'Mastercard'],
  ['amex', 'American Express'],
  ['apple-pay', 'Apple Pay'],
];

export function StoreFooter() {
  const { sections } = useSections();
  const [payment, setPayment] = useState(PAYMENT);
  const [loaded, setLoaded] = useState(() => new Set());
  const { socials = {} } = storeConfig();
  const handle = (v) => String(v ?? '').trim().replace(/^@/, '');
  const instagram = handle(socials.instagram);
  const tiktok = handle(socials.tiktok);
  const email = supportEmail();
  const name = storeConfig().shopName ?? trader().tradingAs ?? null;

  // Her real sections, the same list the header shows; the whole shop is always the last way in.
  const shop = [
    ...sections.slice(0, 5).map((s) => [s.name, categoryPath(s.slug)]),
    ['Everything in the shop', STORE_ROUTES.SHOP],
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link to={STORE_ROUTES.HOME} className={styles.mark} aria-label="Cart and Keep, home">
              <LogoMark size={30} tone="light" />
              <span className={styles.word}>Cart <span className={styles.wordAmp}>&amp;</span> Keep</span>
            </Link>
            <Subscribe source="footer" tone="dark" />
          </div>

          <nav className={styles.col} aria-label="Shop">
            <h2 className={styles.head}>Shop</h2>
            <ul className={styles.list}>
              {shop.map(([label, to]) => <li key={to}><Link to={to}>{label}</Link></li>)}
            </ul>
          </nav>

          <nav className={styles.col} aria-label="Help">
            <h2 className={styles.head}>Help</h2>
            <ul className={styles.list}>
              {HELP.map(([label, to]) => <li key={to}><Link to={to}>{label}</Link></li>)}
            </ul>
          </nav>
        </div>

        <div className={styles.bottom}>
          <p className={styles.small}>
            &copy; {new Date().getFullYear()}{name ? ` ${name}` : ''}
            <span aria-hidden="true"> · </span>
            <a href={`mailto:${email}`}>{email}</a>
          </p>

          <nav className={styles.legal} aria-label="Legal">
            {LEGAL_COLUMN.map((slug) => <Link key={slug} to={`/legal/${slug}`}>{LEGAL_LINKS[slug]}</Link>)}
          </nav>

          <div className={styles.end}>
            {payment.length > 0 && (
              <ul className={styles.payment} aria-label="Payment methods we accept">
                {payment.map(([file, label]) => (
                  <li key={file} className={styles.payMark} data-ready={loaded.has(file) || undefined}>
                    <img
                      src={`/payment/${file}.svg`}
                      alt={label}
                      width="34"
                      height="22"
                      loading="lazy"
                      onLoad={() => setLoaded((s) => new Set(s).add(file))}
                      onError={() => setPayment((c) => c.filter(([f]) => f !== file))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.social}>
              {instagram && (
                <a href={`https://instagram.com/${instagram}`} className={styles.socialLink} aria-label="Instagram"><InstagramIcon size={16} /></a>
              )}
              {tiktok && (
                <a href={`https://tiktok.com/@${tiktok}`} className={styles.socialLink} aria-label="TikTok"><TiktokIcon size={16} /></a>
              )}
              <a href={`mailto:${email}`} className={styles.socialLink} aria-label="Email us"><MailIcon size={16} /></a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
