import { Link } from 'react-router';
import {
  DELIVERABLE_GROUPS,
  SCOPE_VERSION,
  groupsFor,
  lastUpdated,
  tally,
} from '@data/deliverables';
import { StateIcon } from '@components/status/StateIcon';
import styles from '@styles/pages/status/deliverables-page.module.css';

const STATE_LABEL = {
  done: 'Complete',
  active: 'In progress',
  queued: 'Waiting',
  client: 'With you',
};

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts }).format(
    new Date(`${iso}T12:00:00Z`),
  );

function Row({ item }) {
  return (
    <li className={styles.row}>
      <StateIcon state={item.state} className={styles.icon} pulseClass={styles.pulse} />
      <span className={styles.rowMain}>
        <span className={styles.rowLabel}>{item.label}</span>
        {item.detail ? <span className={styles.rowDetail}>{item.detail}</span> : null}
      </span>
      <span className={`${styles.stateText} ${styles[item.state] ?? ''}`.trim()}>
        {STATE_LABEL[item.state]}
      </span>
    </li>
  );
}

function Group({ group }) {
  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockLabel}>{group.label}</h2>
        <span className={styles.blockCount}>{group.section}</span>
      </div>
      {group.note ? <p className={styles.blockNote}>{group.note}</p> : null}
      <ul className={styles.list}>
        {group.items.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function DeliverablesPage() {
  const t = tally();
  const updated = lastUpdated();

  // Reading the counts off the data rather than writing them means a shipped
  // item moves every number on the page at once, and none of them can be
  // stale while the list underneath is current.
  const figures = [
    { value: t.done, label: 'Done' },
    { value: t.active, label: 'In build' },
    { value: t.queued, label: 'Waiting' },
    { value: t.client, label: 'With you' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link className={styles.back} to="/">Status</Link>
        <span className={styles.crumb}>Deliverables</span>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.title}>Delivery status</h1>
        <p className={styles.lede}>
          Every deliverable in the signed scope, with where it stands. This counts what was
          promised, not what has been built, so it reads lower than the build progress on the
          status page. Nothing is left off, including the items that are not done.
        </p>

        <ul className={styles.tally}>
          {figures.map((f) => (
            <li key={f.label}>
              <span className={styles.tallyFigure}>{f.value}</span>
              <span className={styles.tallyLabel}>{f.label}</span>
            </li>
          ))}
        </ul>

        {/*
          * Rewritten on 19 August, because it had stopped being true.
          *
          * The store being unbuilt used to be the whole explanation. It is
          * built now, and what stands between these columns has changed shape:
          * the domain pointing at it, and a handful of things only she can
          * supply. Leaving the old sentence up would have been a page
          * explaining a blockage that had moved.
          */}
        <p className={styles.explain}>
          The shop is built. What is left is the domain pointing at it and{' '}
          <strong>{t.client}</strong> things only you can supply, from your trading name to the
          product descriptions. <strong>{t.blockedByStore}</strong> of the{' '}
          <strong>{t.total}</strong> committed items wait on the shop being publicly live, and
          several of those then need real orders before they show you anything, which is time
          passing rather than work outstanding.
        </p>
      </section>

      {groupsFor(['month-one', 'seo', 'analytics']).map((group) => (
        <Group key={group.key} group={group} />
      ))}

      {groupsFor(['early', 'with-you']).map((group) => (
        <Group key={group.key} group={group} />
      ))}

      <footer className={styles.foot}>
        <span>
          Against Engagement Scope version {SCOPE_VERSION}
          {updated ? `, updated ${fmt(updated, { day: 'numeric', month: 'long' })}` : ''}
        </span>
        <a className={styles.footLink} href="mailto:hello@thebrickdev.com">
          hello@thebrickdev.com
        </a>
      </footer>
    </div>
  );
}
