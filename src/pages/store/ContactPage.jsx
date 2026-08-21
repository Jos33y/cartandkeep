import { useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ChevronRightIcon, MailIcon, ReturnIcon, VanIcon } from '@components/ui/store/icons';
import { TRADER } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/contact-page.module.css';

/*
 * Contact.
 *
 * Every route to us was a mailto, which opens nothing on a machine with no
 * mail client configured, and that is a lot of laptops. This gives the address
 * as text somebody can copy, a set of prefilled subjects for the three things
 * people actually write about, and the trader identity that distance selling
 * requires and that had nowhere to live.
 *
 * No form. A form needs somewhere to post and there is nothing behind it yet,
 * and a form that silently loses a message is worse than an address.
 */
const REASONS = [
  {
    key: 'order',
    Icon: VanIcon,
    title: 'About an order',
    body: 'Have the reference to hand, the one starting CK. It is on your confirmation email and it is the fastest way for us to find you.',
    subject: 'Order enquiry',
    template: 'Order reference:\n\nWhat has happened:\n\n',
    link: { to: '/orders', label: 'Look up an order' },
  },
  {
    key: 'return',
    Icon: ReturnIcon,
    title: 'Sending something back',
    body: 'Tell us the reference and what is coming back. You do not need a form and you do not need to give a reason.',
    subject: 'Return',
    template: 'Order reference:\n\nWhat I am returning:\n\n',
    link: { to: '/legal/returns', label: 'Read the returns policy' },
  },
  {
    /*
     * The one reason on this page that is not an email.
     *
     * Its own copy calls this the most useful message the shop gets, and it
     * was routed through a mail client with a three line template she then had
     * to read out of unstructured prose. There is a page for it now, so the
     * card sends people there and the mailto is gone.
     */
    key: 'stock',
    Icon: MailIcon,
    title: 'Asking us to stock something',
    body: 'The most useful thing you can tell us. Say what it is and what you pay for it now.',
    to: STORE_ROUTES.REQUEST,
    link: null,
  },
];

const mailto = (subject, template) =>
  `mailto:${TRADER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(template)}`;

export function ContactPage() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(TRADER.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission, or an insecure origin. The address is right
      // there as text, so this failing costs nothing.
      setCopied(false);
    }
  }

  return (
    <section className={styles.page}>
      <Head
        title="Contact us"
        description="How to reach Cart & Keep about an order, a return, or something you would like us to stock."
        path="/contact"
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">Contact</span>
      </nav>

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Talk to us</h1>
        <p className={styles.lede}>
          One address, read by a person. We answer most things the same working
          day, and everything within two.
        </p>
        <p className={styles.confirm}>
          <span className={styles.confirmTag}>Needs confirming</span>
          That response time is a promise made on her behalf and she has not
          agreed to it. Change it or cut it before the shop goes live.
        </p>
      </header>

      <div className={styles.address}>
        {/* Text, not just a link. A mailto opens nothing on a machine with no
            mail client and the address still has to be usable there. */}
        <a className={styles.email} href={`mailto:${TRADER.email}`}>{TRADER.email}</a>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy address'}
        </button>
      </div>

      <ul className={styles.reasons}>
        {REASONS.map(({ key, Icon, title, body, subject, template, to, link }) => (
          <li key={key} className={styles.reason}>
            <span className={styles.badge} aria-hidden="true"><Icon size={19} /></span>
            <div className={styles.reasonBody}>
              <h2 className={styles.reasonTitle}>{title}</h2>
              <p className={styles.reasonText}>{body}</p>
              <div className={styles.reasonActions}>
                {/* A page where the reason names one, an email where it does
                    not. Order and returns questions genuinely belong in her
                    inbox, because they are a conversation about one parcel.
                    A stock request is not a conversation, it is a record. */}
                {to
                  ? (
                    <Link className={styles.write} to={`${to}?from=${encodeURIComponent('contact')}`}>
                      Ask us for it
                    </Link>
                  )
                  : <a className={styles.write} href={mailto(subject, template)}>Write about this</a>}
                {link && <Link className={styles.secondary} to={link.to}>{link.label}</Link>}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.trader}>
        <h2 className={styles.traderHead}>Who you are buying from</h2>
        <address>
          <span>{TRADER.name}</span>
          <span>{TRADER.address}</span>
          <span>{TRADER.company}</span>
        </address>
        <p className={styles.traderNote}>
          We are not VAT registered, so no VAT is charged and none is shown
          separately. The <Link to="/legal/terms">terms of sale</Link> set out
          the rest.
        </p>
      </div>
    </section>
  );
}
