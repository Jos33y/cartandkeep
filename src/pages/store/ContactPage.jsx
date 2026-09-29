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
 * They write on the card; their own email app sends it, with the lines in a
 * set order so an order reference is always in the same place. Nothing is
 * posted from here: nothing sits behind a form yet, and a form that loses a
 * message is worse than an address. No street address either: it is an online
 * shop, and the terms carry that.
 */
const reasonsFor = (prefix) => [
  {
    key: 'order',
    tab: 'About an order',
    subject: 'Order enquiry',
    lines: [
      { key: 'ref', label: 'Order reference', placeholder: `${prefix}XXXX-XXXX` },
      { key: 'what', label: 'What has happened', long: true },
    ],
    note: 'The reference is on your confirmation email. It is the quickest way for us to find your order.',
    link: { to: STORE_ROUTES.ORDER_LOOKUP, label: 'Look up an order' },
  },
  {
    key: 'return',
    tab: 'Sending something back',
    subject: 'Return',
    lines: [
      { key: 'ref', label: 'Order reference', placeholder: `${prefix}XXXX-XXXX` },
      { key: 'what', label: 'What you are sending back', long: true },
    ],
    note: 'You do not need a form, and you do not need to give a reason.',
    link: { to: '/legal/returns', label: 'How returns work' },
  },
  {
    key: 'other',
    tab: 'Something else',
    subject: 'A question',
    lines: [{ key: 'what', label: 'Your question', long: true }],
    note: 'Anything at all, including a question before you buy.',
    link: null,
  },
];

// "within 24 hours" becomes a stamp reading 24 HOURS; anything else is printed as she wrote it.
function stampFor(promise) {
  const m = /(\d+)\s*(hour|day|working day)s?/i.exec(promise);
  return m ? { big: m[1], small: `${m[2]}s`.toUpperCase() } : { big: null, small: promise };
}

// The message as their email app will show it: each line's label, then what they wrote under it.
const clean = (key, v) => (key === 'ref' ? v.trim().toUpperCase() : v.trim());
const bodyOf = (lines, values) => lines.map((l) => `${l.label}:\n${clean(l.key, values[l.key] ?? '')}\n`).join('\n');
const mailto = (email, subject, body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

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
  // Kept per reason, so switching tab and back does not lose what was typed.
  const [values, setValues] = useState({});
  const mine = values[r.key] ?? {};
  const put = (k) => (e) => setValues((v) => ({ ...v, [r.key]: { ...v[r.key], [k]: e.target.value } }));
  const body = bodyOf(r.lines, mine);
  // The reference in the subject too, so it can be found in her inbox without opening the message.
  const subject = mine.ref?.trim() ? `${r.subject} ${clean('ref', mine.ref)}` : r.subject;
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(`To: ${tr.email}\nSubject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* the message is on screen to copy by hand */ }
  }

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
          <p className={styles.micro}>Your message</p>
          <div className={styles.lines}>
            {r.lines.map((l) => (
              <label key={`${r.key}-${l.key}`} className={styles.line}>
                <span>{l.label}</span>
                {l.long
                  ? <textarea rows={3} value={mine[l.key] ?? ''} onChange={put(l.key)} maxLength={1500} />
                  : <input value={mine[l.key] ?? ''} onChange={put(l.key)} placeholder={l.placeholder} autoComplete="off" maxLength={40} />}
              </label>
            ))}
          </div>
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
          <p className={styles.subject}><span>Subject</span>{subject}</p>
          <CopyTicket className={styles.ticket} label="Email address" value={tr.email} />
        </div>
      </article>

      <div className={styles.actions}>
        <a className={styles.send} href={mailto(tr.email, subject, body)}>
          <MailIcon size={18} /> Open in your email app
        </a>
        <button type="button" className={styles.copyMsg} onClick={copyMessage}>
          {copied ? 'Copied' : 'Copy the message'}
        </button>
        <p className={styles.hint}>Nothing is sent from this page. Your email sends it, so you keep a copy. Use Copy the message if you write from Gmail or Outlook in a browser.</p>
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
