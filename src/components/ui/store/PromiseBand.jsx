import { Link } from 'react-router';
import { ArrowRightIcon, MailIcon } from '@components/ui/store/icons';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/promise-band.module.css';

/*
 * The one thing this shop can do that Amazon cannot.
 *
 * The general store's oldest promise: the shop that orders it in for you. It is
 * worth a section rather than a line.
 *
 * It was a mailto, because there was nowhere to post a form and a form that
 * silently loses a request is worse than no form. There is somewhere now, and
 * an email client is where a request goes to die: it collects an unstructured
 * message with none of what makes a request useful, and most people never send
 * one at all because opening a mail app is a decision.
 *
 * `from` rides along so she can see whether a request came off a product page,
 * which usually means the thing they found was nearly right.
 */
export function PromiseBand({ from }) {
  return (
    <section className={styles.band} aria-labelledby="ask">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Requests welcome</p>
          <h2 id="ask" className={`${styles.title} wide`}>
            Cannot find it? Ask us to stock it.
          </h2>
          {/*
            * Two clauses. The first is why asking is worth their time, the
            * second is what to type.
            *
            * It read "New stock lands every Monday. If there is something you
            * keep buying somewhere else because it is not here, tell us what it
            * is and we will price it up", which explained to somebody why they
            * might want a thing they already buy, and ended on a market stall.
            * Nothing here justifies the form: a shopkeeper asking what you pay
            * for something is not a question that needs a reason.
            */}
          <p className={styles.body}>
            We add stock every week, and requests come first. Tell us what you
            need and what you pay for it now.
          </p>
        </div>

        <div className={styles.action}>
          <Link
            className={styles.cta}
            to={from ? `${STORE_ROUTES.REQUEST}?from=${encodeURIComponent(from)}` : STORE_ROUTES.REQUEST}
          >
            <MailIcon size={18} />
            Ask for a product
            <ArrowRightIcon size={16} />
          </Link>
          {/* "No newsletter" was true when this was a mailto and there was no
              list. There is one now, in the footer, so the promise that still
              holds is the one about not needing an account. Asking for a
              product still signs you up for nothing. */}
          <p className={styles.small}>
            One person reads these. No account needed.
          </p>
        </div>
      </div>
    </section>
  );
}
