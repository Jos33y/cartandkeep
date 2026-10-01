import { formatGbp } from '@utils/formatGbp';
import { Icon } from '@components/ui/icons';
import { offerLine, riskLine, supplierWarnings } from '@lib/supplierWatch';
import styles from '@styles/ui/portal/supplier-watch.module.css';

/*
 * Her Amazon supplier on the card: what it costs her today and whether it is in stock (read every morning), what
 * changed, and what Amazon's buyers complain about. The buyers' part is for her before she lists it; none of it
 * goes in a listing.
 */
export function SupplierWatch({ page, read, costed = null, reading = false, onRead }) {
  if (!page) return null;
  const offer = offerLine(read);
  const warnings = supplierWarnings(read, costed);
  const risk = riskLine(read);
  const deal = read?.offer?.deal && read.offer.was ? read.offer.was : null;

  return (
    <section className={styles.watch} aria-label="Your Amazon supplier">
      <div className={styles.head}>
        <span className={styles.title}>
          <Icon name="IconBox" className={styles.icon} />
          Amazon
          {offer ? (
            <span className={styles.today}>
              <b>{offer.text}</b>
              {deal && <span className={styles.was}>usually {formatGbp(deal)}</span>}
            </span>
          ) : (
            <span className={styles.today}>{page.uk ? 'not read yet' : 'on another Amazon'}</span>
          )}
        </span>
        <span className={styles.side}>
          {offer?.checked && <span className={styles.when}>Checked {offer.checked}</span>}
          {page.uk && (
            <button type="button" className={styles.again} disabled={reading} onClick={onRead}>
              {reading ? 'Reading' : read ? 'Read again' : 'Read the page'}
            </button>
          )}
          <a className={styles.open} href={page.url} target="_blank" rel="noreferrer">Open</a>
        </span>
      </div>

      {!page.uk && <p className={styles.note}>Only amazon.co.uk pages are read: another Amazon prices in another currency and ships from abroad.</p>}
      {page.uk && !read && <p className={styles.note}>Read once, its price and stock are checked every morning at 7.</p>}

      {warnings.length > 0 && (
        <ul className={styles.warnings}>
          {warnings.map((w) => (
            <li key={w.text} data-level={w.level}>
              <i aria-hidden="true" />
              {w.text}
            </li>
          ))}
        </ul>
      )}

      {risk && (risk.concerns.length > 0 || risk.head) && (
        <div className={styles.risk}>
          <span className={styles.riskHead}>
            What Amazon buyers say
            <span className={styles.riskHint}>For you, never in the listing.</span>
          </span>
          {risk.head && <span className={styles.riskLine}>{risk.head}{risk.concerns.length ? '.' : ', with no topic mostly complained about.'}</span>}
          {risk.concerns.map((c) => (
            <span key={c.topic} className={styles.concern}>
              <b>{c.topic}</b>: {c.text}.
              {c.quote && <q className={styles.quote}>{c.quote}</q>}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
