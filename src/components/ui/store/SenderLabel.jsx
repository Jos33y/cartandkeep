import { CopyTicket } from '@components/ui/store/CopyTicket';
import { LogoMark } from '@components/ui/shared/Logo';
import { gbp, legalTerms, legalTrader } from '@data/legal';
import { replyPromise, storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/sender-label.module.css';

/*
 * The other side of the parcel label: who it comes from.
 *
 * Checkout writes the customer's address onto a label; this is the sender's
 * half, with the shop's terms as the receipt below the tear. No street address,
 * on purpose: it is not a shop anyone can walk into, and the legal pages carry it.
 */
export function SenderLabel() {
  const T = legalTerms();
  const tr = legalTrader();
  const { voice = {}, shopName } = storeConfig();
  const name = tr.tradingAs || shopName;
  // The legal name only: the trading name is already the heading of the label.
  const who = tr.name ? `${tr.name}${tr.company ? `, company number ${tr.company}` : ''}` : null;
  const transit = T.transitMin === T.transitMax ? `${T.transitMax}` : `${T.transitMin} to ${T.transitMax}`;

  const terms = [
    ['Delivery', `${gbp(T.postage)}, free from ${gbp(T.freeDeliveryOver)}`],
    ['Arrives', `${transit} working days later`],
    ['Returns', `${T.returnDays} days${T.postagePaidBy === 'customer' ? '' : ', return postage paid'}`],
    ['Paying', 'By card, no account'],
    ['Replies', `From a person, ${replyPromise()}`],
  ];

  return (
    <aside className={styles.board} aria-label="Who your parcel comes from">
      <div className={styles.label}>
        <header className={styles.top}>
          <span className={styles.micro}>From</span>
          <LogoMark size={56} className={styles.mark} />
        </header>

        <p className={`${styles.name} wide`}>{name}</p>
        {voice.tagline && <p className={styles.strap}>{voice.tagline}</p>}
        {who && (
          <p className={styles.who}>
            <span className={styles.micro}>Run by</span>
            {who}
          </p>
        )}

        <div className={styles.perforation} aria-hidden="true" />

        <dl className={styles.terms}>
          {terms.map(([k, v]) => (
            <div key={k} className={styles.term}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <CopyTicket className={styles.write} label="Write to us" value={tr.email} />
      </div>
    </aside>
  );
}
