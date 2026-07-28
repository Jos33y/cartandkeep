import { isDemo, setMode } from '@lib/mode';
import styles from '@styles/layout/portal/demo-banner.module.css';

export function DemoBanner() {
  if (!isDemo()) return null;

  return (
    <div className={styles.bar} role="status">
      <span className={styles.tag}>Demo</span>
      <span className={styles.text}>
        Everything on screen is sample data. Nothing here is saved.
      </span>
      <button type="button" className={styles.exit} onClick={() => setMode('live')}>
        Switch to live
      </button>
    </div>
  );
}
