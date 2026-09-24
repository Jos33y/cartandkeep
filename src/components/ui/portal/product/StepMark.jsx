import styles from '@styles/ui/portal/step-mark.module.css';

const GLYPH = {
  done: <path d="M3.5 8.5l3 3 6-7" />,
  wait: <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />,
  check: <><path d="M8 4v5" /><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  missing: <path d="M8 4.5v7M4.5 8h7" />,
};

export const STATE_WORD = {
  done: 'Done',
  wait: 'Waiting for you',
  check: 'To read',
  missing: 'Missing',
};

export function StepMark({ state, size = 'md' }) {
  if (state === 'none') return <span className={styles.none} aria-hidden="true" />;
  return (
    <span className={styles.mark} data-state={state} data-size={size} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round">
        {GLYPH[state]}
      </svg>
    </span>
  );
}

// The same four states as a thin bar, for places too narrow for the glyph.
export function StepBar({ state }) {
  return <span className={styles.bar} data-state={state} aria-hidden="true" />;
}
