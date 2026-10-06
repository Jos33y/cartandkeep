import { useEffect, useMemo, useState } from 'react';
import { useAlerts } from '@hooks/useAlerts';
import { GROUPS } from '@lib/alerts';
import { loadTenant } from '@lib/tenant';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card } from '@components/ui/portal/primitives';
import { AlertRow } from '@components/ui/portal/AlertRow';
import { Icon } from '@components/ui/icons';
import styles from '@styles/pages/portal/alerts-page.module.css';

/*
 * Everything that needs a look, in one place (Joseey, 5 October: "a full notification page where alerts and other
 * things fall into"). Worked out from how things are now: an alert leaves on its own once its cause is fixed, so
 * there is nothing to tick off. Worst first; the chips narrow it to one kind.
 */
const clock = (d) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).replace(/\s/g, '');

export function AlertsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);
  const agent = tenant?.store?.agent?.name || null;
  const al = useAlerts(tenant?.id, { agent });
  const [group, setGroup] = useState('all');
  const [checked, setChecked] = useState(null);
  useEffect(() => { if (al.status === 'ready') setChecked(new Date()); }, [al.status, al.alerts]);

  const shown = useMemo(() => (group === 'all' ? al.alerts : al.alerts.filter((a) => a.group === group)), [al.alerts, group]);

  if (tenant === undefined || al.status === 'loading') return <PageSkeleton rows={4} />;

  const { counts } = al;
  const all = al.alerts.length;
  const label = (g) => (g.id === 'keeper' && agent ? agent : g.label);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Alerts</p>
        <h1 className={styles.title}>
          {all === 0 ? 'Nothing needs a look.' : all === 1 ? 'One thing needs a look.' : `${all} things need a look.`}
        </h1>
        <p className={styles.lede}>
          Each one clears on its own once it is fixed.
          {checked && <> Checked at {clock(checked)}.</>}
          <button type="button" className={styles.again} onClick={al.reload}>
            <Icon name="IconRefresh" className={styles.againIcon} />Check again
          </button>
        </p>
      </header>

      {al.alerts.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Show">
          <button type="button" className={styles.chip} aria-pressed={group === 'all'} onClick={() => setGroup('all')}>
            All <span data-num>{counts.all}</span>
          </button>
          {GROUPS.filter((g) => counts[g.id] > 0 || group === g.id).map((g) => (
            <button key={g.id} type="button" className={styles.chip} aria-pressed={group === g.id}
              onClick={() => setGroup(group === g.id ? 'all' : g.id)}>
              {label(g)} <span data-num>{counts[g.id]}</span>
            </button>
          ))}
          {counts.stop > 0 && (
            <span className={styles.key}><i data-level="stop" />action now<i data-level="warn" />a look soon</span>
          )}
        </div>
      )}

      {al.partial && (
        <p className={styles.partial}>Part of this could not be read just now, so something may be missing. Check again in a minute.</p>
      )}

      {shown.length ? (
        <Card pad={false}>
          <ul className={styles.list}>
            {shown.map((a) => <AlertRow key={a.key} a={a} />)}
          </ul>
        </Card>
      ) : (
        <p className={styles.clear}>
          <Icon name="IconCheck" className={styles.clearIcon} />
          {group === 'all'
            ? 'Your suppliers, the eBay queue, Keeper and your stock are all fine.'
            : 'Nothing here now.'}
        </p>
      )}
    </div>
  );
}
