import { SCOPE_VERSION, SCOPE_DATE, MONTH_ONE_DUE, groupsFor, tally } from '@data/deliverables';
import { StateIcon } from '@components/status/StateIcon';
import { StatusHeader } from '@components/layout/status/StatusHeader';
import styles from '@styles/pages/status/deliverables-page.module.css';

// The checklist to hold against the contract: one line per item. The story lives on the status page.
const COMMITTED = ['month-one', 'seo', 'analytics'];
const AFTER = ['early', 'with-you'];

const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts })
  .format(new Date(`${iso}T12:00:00Z`));

function outcome(item, groupKey) {
  const hers = groupKey === 'with-you';
  if (item.state === 'done') {
    const word = hers ? 'Done by you' : 'Delivered';
    return { tone: 'done', text: item.date ? `${word}, ${fmt(item.date, { day: 'numeric', month: 'short' })}` : word };
  }
  if (item.state === 'client') return { tone: 'hers', text: 'With you' };
  return { tone: 'open', text: item.why ?? 'Not yet' };
}

function Section({ group }) {
  const done = group.items.filter((i) => i.state === 'done').length;
  return (
    <section className={styles.section} aria-labelledby={`s-${group.key}`}>
      <header className={styles.sectionHead}>
        <h2 id={`s-${group.key}`} className={styles.sectionTitle}>{group.label}</h2>
        <span className={styles.ref}>{group.section}</span>
        {group.key === 'month-one' && <span className={styles.ref}>Due {fmt(MONTH_ONE_DUE, { day: 'numeric', month: 'long' })}</span>}
        <span className={styles.count} data-num>{done} of {group.items.length}</span>
      </header>
      <ul className={styles.list}>
        {group.items.map((item) => {
          const o = outcome(item, group.key);
          return (
            <li key={item.label} className={`${styles.line} ${styles[o.tone]}`}>
              <StateIcon state={item.state === 'done' ? 'done' : item.state === 'client' ? 'client' : 'queued'} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
              <span className={styles.outcome}>{o.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DeliverablesPage() {
  const t = tally();

  return (
    <div className={styles.page}>
      <StatusHeader on="deliverables" />

      <div className={styles.intro}>
        <h1 className={styles.title}>The signed scope.</h1>
        <p className={styles.lede}>
          Engagement Scope {SCOPE_VERSION}, signed {fmt(SCOPE_DATE, { day: 'numeric', month: 'long', year: 'numeric' })}.{' '}
          <strong className={styles.lead} data-num>{t.done} of {t.total}</strong> delivered.
        </p>
      </div>

      {groupsFor(COMMITTED).map((g) => <Section key={g.key} group={g} />)}
      <div className={styles.after}>
        {groupsFor(AFTER).map((g) => <Section key={g.key} group={g} />)}
      </div>

      <footer className={styles.foot}>
        <span>Built by The Brick Dev Studios</span>
        <a className={styles.footLink} href="mailto:hello@thebrickdev.com">hello@thebrickdev.com</a>
      </footer>
    </div>
  );
}
