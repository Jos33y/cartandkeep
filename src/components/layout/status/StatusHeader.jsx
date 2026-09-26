import { Link } from 'react-router';
import { LogoMark } from '@components/ui/shared/Logo';
import styles from '@styles/layout/status/status-header.module.css';

// Same host, other subdomain, so the next tenant's status page opens the next tenant's portal.
export function portalHref(route = '/') {
  if (typeof window === 'undefined') return route;
  const { protocol, hostname } = window.location;
  if (hostname.startsWith('status.')) return `${protocol}//${hostname.replace(/^status\./, 'portal.')}${route}`;
  return `${route}${route.includes('?') ? '&' : '?'}portal`;
}

// Shared by both public pages, each linking to the other.
export function StatusHeader({ on }) {
  return (
    <header className={styles.head}>
      <Link to="/" className={styles.brand} aria-label="Cart and Keep, delivery status">
        <LogoMark size={32} className={styles.mark} />
        <span className={styles.wordmark}>Cart &amp; Keep</span>
      </Link>
      {on === 'deliverables'
        ? <Link className={styles.link} to="/">Status</Link>
        : <Link className={styles.link} to="/deliverables">Deliverables</Link>}
      <a className={styles.portal} href={portalHref('/')}>Access portal</a>
    </header>
  );
}
