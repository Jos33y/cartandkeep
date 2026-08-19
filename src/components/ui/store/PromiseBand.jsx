import { ArrowRightIcon, MailIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/promise-band.module.css';

/*
 * The one thing this shop can do that Amazon cannot.
 *
 * The first version said "we add products every Monday, say what you are after
 * and we will look for it before we buy anything else", which buried the offer
 * inside a sentence about our purchasing schedule. Nobody cares when we buy.
 * They care that a person will go and find the thing.
 *
 * That is the general store's oldest promise: the shop that orders it in for
 * you. It is worth a section rather than a line.
 *
 * A mailto rather than a form, because a form needs somewhere to post and
 * there is nothing behind it yet. A button that opens an email always works,
 * and a form that silently loses a request is worse than no form.
 */
const SUBJECT = encodeURIComponent('Can you stock this?');
const BODY = encodeURIComponent(
  'What I am after:\n\n\nWhere I usually buy it:\n\n\nRough budget:\n\n',
);

export function PromiseBand() {
  return (
    <section className={styles.band} aria-labelledby="ask">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Requests welcome</p>
          <h2 id="ask" className={`${styles.title} wide`}>
            Cannot find it? Ask us to stock it.
          </h2>
          <p className={styles.body}>
            New stock lands every Monday. If there is something you keep buying
            somewhere else because it is not here, tell us what it is and we
            will price it up.
          </p>
        </div>

        <div className={styles.action}>
          <a className={styles.cta} href={`mailto:support@cartandkeep.com?subject=${SUBJECT}&body=${BODY}`}>
            <MailIcon size={18} />
            Ask for a product
            <ArrowRightIcon size={16} />
          </a>
          <p className={styles.small}>
            One person reads these. No form, no account, no newsletter.
          </p>
        </div>
      </div>
    </section>
  );
}
