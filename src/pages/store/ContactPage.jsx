import { useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon, MailIcon } from '@components/ui/store/icons';
import { CopyTicket } from '@components/ui/store/CopyTicket';
import { legalTrader, traderIdentity } from '@data/legal';
import { replyPromise, storeConfig } from '@lib/storeConfig';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/contact-page.module.css';

/*
 * A postcard addressed to the shop.
 *
 * The writing side shows what is worth putting in the message for the chosen
 * reason; the address side carries the address to copy and her reply promise
 * as the stamp. No form: nothing sits behind one yet, and a form that loses a
 * message is worse than an address. No street address either: it is an online
 * shop, and the terms carry that.
 */
const reasonsFor = (prefix) => [
  {
    key: 'order',
    tab: 'About an order',
    subject: 'Order enquiry',
    lines: [`Order reference (it starts ${prefix})`, 'What has happened'],
    note: 'The reference is on your confirmation email. It is the quickest way for us to find your order.',
    link: { to: STORE_ROUTES.ORDER_LOOKUP, label: 'Look up an order' },
  },
  {
    key: 'return',
    tab: 'Sending something back',
    subject: 'Return',
    lines: ['Order reference', 'What you are sending back'],
    note: 'You do not need a form, and you do not need to give a reason.',
    link: { to: '/legal/returns', label: 'How returns work' },
  },
  {
    key: 'other',
    tab: 'Something else',
    subject: 'A question',
    lines: ['Your question'],
    note: 'Anything at all, including a question before you buy.',
    link: null,
  },
];

// "within 24 hours" becomes a stamp reading 24 HOURS; anything else is printed as she wrote it.
function stampFor(promise) {
  const m = /(\d+)\s*(hour|day|working day)s?/i.exec(promise);
  return m ? { big: m[1], small: `${m[2]}s`.toUpperCase() } : { big: null, small: promise };
}

const mailto = (email, subject, lines) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.map((l) => `${l}:\n\n`).join(''))}`;

export function ContactPage() {
  const tr = legalTrader();
  const { referencePrefix = 'CK', shopName } = storeConfig();
  const name = tr.tradingAs || shopName;
  const reasons = reasonsFor(`${referencePrefix}-`);
  const [key, setKey] = useState(reasons[0].key);
  const r = reasons.find((x) => x.key === key) ?? reasons[0];
  const promise = replyPromise();
  const stamp = stampFor(promise);
  const who = traderIdentity(tr);

  return (
    <section className={styles.page}>
      <Head
        title="Contact us"
        description={`How to reach ${name} about an order, a return or a question. A person replies ${promise}.`}
        path="/contact"
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">Contact</span>
      </nav>

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Talk to us</h1>
        <p className={styles.lede}>One address, read by a person. A reply comes {promise}.</p>
      </header>

      <div className={styles.tabs} role="group" aria-label="What it is about">
        {reasons.map((x) => (
          <button key={x.key} type="button" className={styles.tab} aria-pressed={x.key === key} onClick={() => setKey(x.key)}>
            {x.tab}
          </button>
        ))}
      </div>

      <article className={styles.card} aria-label={`A message about: ${r.tab}`}>
        <div className={styles.write}>
          <p className={styles.micro}>Worth putting in it</p>
          <ul className={styles.lines}>
            {r.lines.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <p className={styles.note}>{r.note}</p>
          {r.link && <Link className={styles.more} to={r.link.to}>{r.link.label} <ArrowRightIcon size={14} /></Link>}
        </div>

        <div className={styles.addr}>
          <span className={styles.stamp} role="img" aria-label={`A person replies ${promise}`}>
            <span className={styles.stampTop}>Reply</span>
            {stamp.big && <span className={styles.stampBig}>{stamp.big}</span>}
            <span className={styles.stampSmall}>{stamp.small}</span>
          </span>

          <p className={styles.micro}>To</p>
          <p className={`${styles.to} wide`}>{name}</p>
          <p className={styles.subject}><span>Subject</span>{r.subject}</p>
          <CopyTicket className={styles.ticket} label="Email address" value={tr.email} />
        </div>
      </article>

      <div className={styles.actions}>
        <a className={styles.send} href={mailto(tr.email, r.subject, r.lines)}>
          <MailIcon size={18} /> Open in your email app
        </a>
        <p className={styles.hint}>No email app on this device? Copy the address above and write from your usual email.</p>
      </div>

      <p className={styles.stock}>
        Looking for something we do not sell yet? <Link to={`${STORE_ROUTES.REQUEST}?from=contact`}>Send a request</Link> and we will look for it.
      </p>

      {(who || tr.company || tr.vat) && (
        <footer className={styles.trader}>
          <h2 className={styles.traderHead}>Who you are buying from</h2>
          <p>
            {who ?? name}
            {tr.vat ? `. VAT number ${tr.vat}` : '. Not VAT registered, so no VAT is charged'}.
          </p>
          <p>The <Link to="/legal/terms">terms of sale</Link> set out the rest.</p>
        </footer>
      )}
    </section>
  );
}
