import { Link } from 'react-router';
import styles from '@styles/ui/portal/alert-row.module.css';

const LEVEL = { stop: 'Needs action now', warn: 'Needs a look' };

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).replace(/\s/g, '');
  return d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) === today
    ? time
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
};

/*
 * One alert on one line: a dot for how serious, the product, what is wrong in a few words, where it is, and the
 * button that fixes it. The full sentence sits underneath, quiet, for when the few words are not enough.
 * `compact` drops the sentence and keeps one button, the few words under the name (the Overview's narrow column).
 */
export function AlertRow({ a, compact = false }) {
  const at = when(a.at);
  return (
    <li className={styles.row} data-level={a.level} data-compact={compact || undefined}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.body}>
        <span className={styles.line}>
          <span className="visually-hidden">{LEVEL[a.level]}: </span>
          <span className={styles.title} title={a.title}>{a.title}</span>
          <span className={styles.what}>{a.what}</span>
        </span>
        {!compact && (
          <span className={styles.sub}>
            <span className={styles.where}>{a.where}{at ? `, ${at}` : ''}</span>
            <span className={styles.text}>{a.text}</span>
          </span>
        )}
      </span>
      <span className={styles.actions}>
        {(compact ? a.actions.slice(0, 1) : a.actions).map((x, i) => (x.to
          ? <Link key={x.label} to={x.to} className={styles.act} data-main={i === 0 || undefined}>{x.label}</Link>
          : <a key={x.label} href={x.href} target="_blank" rel="noreferrer noopener" className={styles.act} data-main={i === 0 || undefined}>{x.label}</a>))}
      </span>
    </li>
  );
}
