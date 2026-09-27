import { useId } from 'react';
import { formatPhone, isUkPhone } from '@lib/phone';
import styles from '@styles/ui/store/phone-field.module.css';

// The Union flag at label size, drawn rather than an emoji so it looks the same on every device.
function UkFlag({ clip }) {
  return (
    <svg className={styles.flag} viewBox="0 0 60 30" aria-hidden="true" focusable="false">
      <clipPath id={clip}><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

/*
 * A UK phone number, with the country shown rather than asked for.
 *
 * Laid out as it is read aloud once they leave the box, not on every key, so
 * the cursor never jumps while somebody is correcting a digit in the middle.
 */
export function PhoneField({ label, value, onChange, error, onError, hint, autoComplete = 'tel', name }) {
  const id = useId();

  function leave() {
    const v = value.trim();
    if (!v) return;
    if (!isUkPhone(v)) {
      onError?.('That does not look like a UK number. Mobiles start 07.');
      return;
    }
    onChange(formatPhone(v));
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.group} data-invalid={Boolean(error) || undefined}>
        <span className={styles.prefix} aria-hidden="true"><UkFlag clip={`${id}-flag`.replace(/:/g, '')} /><span>+44</span></span>
        <input
          id={id}
          name={name}
          data-field
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={value}
          placeholder="07700 900077"
          onChange={(e) => { onChange(e.target.value.replace(/[^\d+\s()-]/g, '')); if (error) onError?.(null); }}
          onBlur={leave}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
          enterKeyHint="next"
        />
      </div>
      <span className={error ? styles.error : styles.hint} id={`${id}-hint`}>{error ?? hint}</span>
    </div>
  );
}
