import { LockIcon, MailIcon, ReturnIcon, ShieldIcon } from '@components/ui/store/icons';
import { replyPromise, returnsTerms } from '@lib/storeConfig';
import styles from '@styles/ui/store/trust-strip.module.css';

/*
 * Four answers to the four reasons a stranger does not buy from a shop they
 * have not heard of: I might be stuck with it, I do not want an account, I do
 * not trust you with my card, and nobody will answer if it goes wrong.
 *
 * Delivery is not in here. It is at the top of the page, and saying it twice
 * was what made this look like filler.
 *
 * Each title is the claim and each note is the proof of it. A title that needs
 * its note to make sense is a title that has not been written yet.
 */
// Built on render: the return window and the email are Settings, not copy.
const claims = () => [
  {
    Icon: ReturnIcon,
    title: `${returnsTerms().days ?? 30} days to change your mind`,
    note: returnsTerms().postagePaidBy === 'customer'
      ? 'For any reason. Faulty items come back free.'
      : 'For any reason. We pay the return postage.',
  },
  {
    Icon: LockIcon,
    title: 'No account, ever',
    note: 'Email, address, pay. That is all.',
  },
  {
    Icon: ShieldIcon,
    title: 'Stripe takes the payment',
    note: 'Your card details never reach us.',
  },
  {
    Icon: MailIcon,
    title: 'A person answers',
    note: `Not a bot. A reply ${replyPromise()}.`,
  },
];

export function TrustStrip() {
  return (
    <section className={styles.strip} aria-label="How buying here works">
      <ul className={styles.inner}>
        {claims().map(({ Icon, title, note }) => (
          <li key={title} className={styles.item}>
            <span className={styles.badge} aria-hidden="true"><Icon size={19} /></span>
            <span className={styles.text}>
              <b className={styles.title}>{title}</b>
              <span className={styles.note}>{note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
