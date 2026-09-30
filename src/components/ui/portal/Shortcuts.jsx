import { Icon } from '@components/ui/icons';
import { usePopover } from '@components/ui/portal/Menu';
import styles from '@styles/ui/portal/shortcuts.module.css';

// The keyboard, laid out as keys rather than a sentence. Hidden on touch screens, where there is no keyboard to use.
const KEYS = [
  { keys: ['J', 'K'], what: 'Move down and up' },
  { keys: ['O'], what: 'Open the card' },
  { keys: ['A'], what: 'Approve' },
  { keys: ['L'], what: 'Save for later' },
  { keys: ['R', '1 to 7'], what: 'Reject, then pick the reason' },
  { keys: ['U'], what: 'Undo a decision' },
  { keys: ['C'], what: 'Confirm the pack. Far apart in price, the first press opens it to compare' },
  { keys: ['T'], what: 'Try a cost' },
  { keys: ['X'], what: 'Select, Shift X for a run' },
  { keys: ['/'], what: 'Find' },
];

export function Shortcuts() {
  const { open, setOpen, close, wrap, trigger } = usePopover();
  return (
    <div ref={wrap} className={styles.wrap}>
      <button ref={trigger} type="button" className={styles.button} aria-expanded={open} aria-label="Keyboard shortcuts"
        onClick={() => setOpen((v) => !v)}>
        <Icon name="IconKeyboard" className={styles.icon} />
      </button>
      {open && (
        <div className={styles.card} role="dialog" aria-label="Keyboard shortcuts"
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}>
          <p className={styles.head}>Keyboard</p>
          <dl className={styles.grid}>
            {KEYS.map((k) => (
              <div key={k.what} className={styles.row}>
                <dt className={styles.keys}>{k.keys.map((x) => <kbd key={x}>{x}</kbd>)}</dt>
                <dd>{k.what}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.foot}>With cards selected, A, L and R act on all of them.</p>
        </div>
      )}
    </div>
  );
}
