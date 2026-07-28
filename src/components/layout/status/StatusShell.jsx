import { Outlet } from 'react-router';
import { useNoIndex } from '@hooks/useNoIndex';
import styles from '@styles/layout/status/status-shell.module.css';

export function StatusShell() {
  useNoIndex();

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
