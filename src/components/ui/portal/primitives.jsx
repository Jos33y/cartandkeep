import styles from '@styles/ui/portal/primitives.module.css';

// Anything on a third screen becomes a primitive. These were being rewritten
// on every page.

export function Card({ raised, pad = true, className = '', children, ...rest }) {
  return (
    <div
      className={`${styles.card} ${raised ? styles.raised : ''} ${pad ? '' : styles.flush} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHead({ title, note, aside }) {
  return (
    <header className={styles.cardHead}>
      <div className={styles.cardHeadText}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {note && <p className={styles.cardNote}>{note}</p>}
      </div>
      {aside && <div className={styles.cardAside}>{aside}</div>}
    </header>
  );
}

// Label above, figure below. Beside each other they compete at the same weight.
export function Stat({ label, value, foot, tone, size = 'figure' }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${size === 'display' ? 'display' : 'figure'} ${styles.statValue} ${tone ? styles[tone] : ''}`}>
        {value}
      </span>
      {foot && <span className={styles.statFoot}>{foot}</span>}
    </div>
  );
}

export function Pill({ tone = 'quiet', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

// Quiet supporting facts. Not a table, not a card.
export function Facts({ items }) {
  return (
    <dl className={styles.facts}>
      {items.filter(Boolean).map(({ label, value, sub }) => (
        <div key={label} className={styles.fact}>
          <dt className={styles.factLabel}>{label}</dt>
          <dd className={styles.factValue}>
            {value}
            {sub && <span className={styles.factSub}>{sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
