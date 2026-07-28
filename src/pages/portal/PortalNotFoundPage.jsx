import { Link } from 'react-router';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/not-found.module.css';

export function PortalNotFoundPage() {
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>
      <h1 className={styles.title}>That page does not exist</h1>
      <p className={styles.body}>
        The address may have changed, or the link may have been mistyped.
      </p>
      <Link to={portalPath('/')} className={styles.action}>Back to the overview</Link>
    </div>
  );
}
