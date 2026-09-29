import { useState } from 'react';
import { CheckIcon, FilesIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/copy-ticket.module.css';

// A dashed ticket that copies its value. A bare mailto opens nothing on many laptops; copied text always works.
// An email address may wrap after the @, never in the middle of a word.
const breakable = (v) => {
  const at = String(v).indexOf('@');
  return at < 0 ? v : <>{v.slice(0, at)}<wbr />{v.slice(at)}</>;
};

export function CopyTicket({ label, value, className = '' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* the value is on screen to copy by hand */ }
  }

  return (
    <>
      <button type="button" className={`${styles.ticket} ${className}`} onClick={copy} aria-label={`Copy ${value}`}>
        <span className={styles.label}>{copied ? 'Copied' : label}</span>
        <span className={styles.value}>{breakable(value)}</span>
        <span className={styles.icon} aria-hidden="true">{copied ? <CheckIcon size={16} /> : <FilesIcon size={16} />}</span>
      </button>
      <span className="visually-hidden" role="status">{copied ? `Copied ${value}` : ''}</span>
    </>
  );
}
