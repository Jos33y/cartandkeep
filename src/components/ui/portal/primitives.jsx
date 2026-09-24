import { useId } from 'react';
import { Icon } from '@components/ui/icons';
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

// place="below" for a tip near the top of a clipped container, where opening upwards would be cut off.
// tone="light" for a tip sitting on a dark panel, where the ink icon would vanish on hover.
export function Tip({ children, label = 'What this means', side, place, tone }) {
  const id = useId();
  return (
    <span className={styles.tip} data-side={side} data-place={place} data-tone={tone}>
      <button type="button" className={styles.tipButton} aria-label={label} aria-describedby={id}>
        <Icon name="IconInfo" className={styles.tipIcon} width="14" height="14" />
      </button>
      <span id={id} role="tooltip" className={styles.tipBody}>{children}</span>
    </span>
  );
}
