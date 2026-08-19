import { useOnline } from '@hooks/useOnline';
import styles from '@styles/ui/store/offline-notice.module.css';

/*
 * Shown when a page fails and the browser is offline.
 *
 * Not a banner that sits there whenever the connection drops. Somebody reading
 * a product page with no signal is not having a problem, and telling them they
 * are is how an app feels fragile. This only replaces an error that has
 * already happened, and only when being offline is the likeliest reason for
 * it.
 */
export function OfflineNotice({ children }) {
  const online = useOnline();
  if (online) return children;

  return (
    <div className={styles.notice} role="status">
      <p className={styles.lead}>You are offline</p>
      <p className={styles.body}>
        The shop is installed on this device, so the pages you have already
        opened still work. Prices and stock need a connection, so this part will
        fill in as soon as you have one.
      </p>
      <button type="button" className={styles.retry} onClick={() => window.location.reload()}>
        Try again
      </button>
    </div>
  );
}
