import { Link } from 'react-router';
import { ArrowRightIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/empty-hero.module.css';

/*
 * An empty page that still looks like the shop.
 *
 * The same warm card as a full Saved, with its board of pinned photographs
 * waiting empty: dashed frames where the things will go, the page's own mark
 * in the middle one. Then the one thing to do next, and underneath, whatever
 * the page can offer from what the shopper has already saved or looked at.
 */
export function EmptyHero({ Icon, kicker, title, children, cta = null, secondary = null, extra = null }) {
  return (
    <header className={styles.hero}>
      <div className={styles.text}>
        <p className={styles.kicker}><Icon size={16} /> {kicker}</p>
        <h1 className={`${styles.title} wide`}>{title}</h1>
        <div className={styles.body}>{children}</div>
        {extra && <div className={styles.extra}>{extra}</div>}
        {(cta || secondary) && (
          <div className={styles.actions}>
            {cta && <Link className={styles.cta} to={cta.to}>{cta.label} <ArrowRightIcon size={16} /></Link>}
            {secondary && <Link className={styles.secondary} to={secondary.to}>{secondary.label}</Link>}
          </div>
        )}
      </div>

      <div className={styles.board} aria-hidden="true">
        <span className={styles.frame} />
        <span className={`${styles.frame} ${styles.middle}`}><Icon size={30} /></span>
        <span className={styles.frame} />
      </div>
    </header>
  );
}
