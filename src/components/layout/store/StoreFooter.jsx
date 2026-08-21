import { useState } from 'react';
import { Link } from 'react-router';
import { LogoMark } from '@components/ui/shared/Logo';
import { InstagramIcon, MailIcon, TiktokIcon } from '@components/ui/store/icons';
import { LEGAL_COLUMN } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import { Subscribe } from '@components/ui/store/Subscribe';
import styles from '@styles/layout/store/store-footer.module.css';

// From @data/legal rather than @utils/constants, so a slug with no page behind
// it can never appear here. The old list carried five and the route rendered a
// stub for every one of them.
const LEGAL_LABELS = {
  terms: 'Terms of sale',
  privacy: 'Privacy',
  returns: 'Returns and refunds',
  delivery: 'Delivery',
  cookies: 'Cookies',
};

// Six or seven per column: enough to be useful, short enough to scan. The
// departments are hard coded rather than derived, for the same reason the
// header's are not: the footer renders on every route including the checkout.
const SHOP = [
  ['Home, furniture & DIY', '/c/home-furniture-and-diy'],
  ['Health & beauty', '/c/health-and-beauty'],
  ['Vehicle parts & accessories', '/c/vehicle-parts-and-accessories'],
  ['Sporting goods', '/c/sporting-goods'],
  ['Pet supplies', '/c/pet-supplies'],
  ['Everything in the shop', STORE_ROUTES.SHOP],
];

// Delivery and returns were in here and in the legal column, so the footer
// listed both twice. They are policy pages, so they live under Legal and Help
// carries the things that are not.
/*
 * Help carries what is not a policy. Delivery and returns are policies, they
 * live under Legal, and they were in both columns because I put them here and
 * then never took them out when the Legal column started rendering real pages.
 *
 * The rule, since it keeps getting broken: every page appears in this footer
 * exactly once. Anything that resolves to /legal/ belongs in LEGAL_LABELS
 * below and nowhere else.
 */
const HELP = [
  ['Track an order', STORE_ROUTES.ORDER_LOOKUP],
  ['Frequently asked', '/legal/faq'],
  ['About us', STORE_ROUTES.ABOUT],
  ['Writing', STORE_ROUTES.BLOG],
  ['Contact us', STORE_ROUTES.CONTACT],
];

/*
 * Payment marks are trademarks. They are served as static files downloaded
 * from Visa's and Mastercard's own brand centres, never redrawn and never
 * recoloured to fit the palette. Each sits in a neutral frame, which is
 * framing rather than altering.
 */
const PAYMENT = [
  ['visa', 'Visa'],
  ['mastercard', 'Mastercard'],
  ['amex', 'American Express'],
  ['apple-pay', 'Apple Pay'],
];

export function StoreFooter() {
  // The marks are static files downloaded from the card schemes. Until they
  // are in public/payment/ the row would show four broken image icons, which
  // reads as a broken shop rather than as a missing asset.
  const [payment, setPayment] = useState(PAYMENT);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.about}>
            <Link to={STORE_ROUTES.HOME} className={styles.mark} aria-label="Cart and Keep, home">
              <LogoMark size={32} tone="light" />
              <span className={styles.word}>Cart <span className={styles.wordAmp}>&amp;</span> Keep</span>
            </Link>
            <p className={styles.blurb}>
              A general store for the house, run from the UK. Eight departments,
              one basket, and no account needed to buy anything.
            </p>
            {/*
              * The mailing list, here and nowhere else on the shop.
              *
              * In the footer rather than in a band, because the band is the
              * request and that is the one thing this shop can do that a
              * marketplace cannot. A newsletter is what every shop has, so it
              * gets the place where a newsletter belongs: below everything, in
              * the way of nothing.
              */}
            <Subscribe source="footer" tone="dark" />

            <div className={styles.social}>
              <a href="https://instagram.com/cartandkeep" className={styles.socialLink} aria-label="Instagram">
                <InstagramIcon size={17} />
              </a>
              <a href="https://tiktok.com/@cartandkeep" className={styles.socialLink} aria-label="TikTok">
                <TiktokIcon size={17} />
              </a>
              <a href="mailto:support@cartandkeep.com" className={styles.socialLink} aria-label="Email us">
                <MailIcon size={17} />
              </a>
            </div>
          </div>

          <nav className={styles.col} aria-label="Shop">
            <h2 className={styles.head}>Shop</h2>
            <ul className={styles.list}>
              {SHOP.map(([label, to]) => (
                <li key={to}><Link to={to}>{label}</Link></li>
              ))}
            </ul>
          </nav>

          <nav className={styles.col} aria-label="Help">
            <h2 className={styles.head}>Help</h2>
            <ul className={styles.list}>
              {HELP.map(([label, to]) => (
                <li key={to}>
                  {to.startsWith('mailto:')
                    ? <a href={to}>{label}</a>
                    : <Link to={to}>{label}</Link>}
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.col} aria-label="Legal">
            <h2 className={styles.head}>Legal</h2>
            <ul className={styles.list}>
              {LEGAL_COLUMN.map((slug) => (
                <li key={slug}>
                  <Link to={`/legal/${slug}`}>{LEGAL_LABELS[slug] ?? slug}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} Cart &amp; Keep</span>
          <a href="mailto:support@cartandkeep.com">support@cartandkeep.com</a>
          {payment.length > 0 && (
            <ul className={styles.payment} aria-label="Payment methods we accept">
              {payment.map(([file, label]) => (
                <li key={file} className={styles.payMark}>
                  <img
                    src={`/payment/${file}.svg`}
                    alt={label}
                    width="34"
                    height="22"
                    loading="lazy"
                    onError={() => setPayment((c) => c.filter(([f]) => f !== file))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
