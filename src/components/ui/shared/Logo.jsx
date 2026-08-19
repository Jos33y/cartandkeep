import styles from '@styles/ui/shared/logo.module.css';

/*
 * The mark. A shopping basket with the ampersand inside it, because the
 * ampersand is the middle word of the name and a tick would have meant nothing.
 *
 * In shared rather than store, because the shop, the status page and the
 * portal all need it. The status page was still drawing a letter C in a
 * rounded square from July, which meant the one page she is most likely to
 * send somebody carried a different logo from her shop.
 *
 * Path data, not text. The ampersand is an outline extracted from Inter 700
 * rather than a glyph, so the mark never waits on a webfont and never flashes
 * a fallback. Archivo's own ampersand is an Et ligature that is handsome at
 * 96px and unreadable at 16, which was tested rather than assumed.
 *
 * `variant` picks by size and not by taste. The outline closes up below 32px,
 * where the basket walls meet the ampersand and the counters fill in, so the
 * solid one exists for favicons, list rows and anything small.
 */

const BODY = 'M5 10.5h20l-2 13.2a2 2 0 0 1-2 1.7H9a2 2 0 0 1-2-1.7L5 10.5Z';
const HANDLE = 'M10.6 10.5V8.2a4.4 4.4 0 0 1 8.8 0v2.3';
const SOLID_BODY = 'M4.6 9.8h20.8l-2.1 14a2.4 2.4 0 0 1-2.4 2H9.1a2.4 2.4 0 0 1-2.4-2l-2.1-14Z';
const SOLID_HANDLE = 'M10.6 9.8V8a4.4 4.4 0 0 1 8.8 0v1.8';
const AMP = 'M14.185 23Q13.319 23 12.69 22.685Q12.06 22.37 11.723 21.842Q11.386 21.314 11.386 20.667Q11.386 20.161 11.585 19.779Q11.785 19.397 12.142 19.074Q12.499 18.751 12.965 18.43L14.562 17.373Q14.736 17.261 14.876 17.118Q15.017 16.974 15.098 16.809Q15.18 16.643 15.18 16.452Q15.18 16.165 14.978 15.963Q14.775 15.76 14.399 15.76Q14.151 15.76 13.966 15.856Q13.78 15.951 13.679 16.126Q13.578 16.3 13.578 16.536Q13.578 16.811 13.716 17.084Q13.853 17.357 14.095 17.655Q14.337 17.952 14.652 18.318L18.614 22.876H16.838L13.539 19.183Q13.196 18.784 12.87 18.38Q12.544 17.975 12.33 17.517Q12.116 17.059 12.116 16.519Q12.116 15.918 12.4 15.437Q12.684 14.956 13.196 14.678Q13.707 14.4 14.387 14.4Q15.056 14.4 15.54 14.667Q16.023 14.934 16.287 15.381Q16.551 15.828 16.551 16.373Q16.551 16.761 16.414 17.104Q16.276 17.447 16.029 17.739Q15.781 18.031 15.438 18.284L13.73 19.515Q13.387 19.768 13.21 20.018Q13.033 20.268 13.033 20.6Q13.033 20.915 13.184 21.151Q13.336 21.387 13.606 21.513Q13.876 21.64 14.236 21.64Q14.696 21.64 15.132 21.437Q15.568 21.235 15.925 20.861Q16.282 20.487 16.492 19.968Q16.703 19.448 16.703 18.818H18.114Q18.114 19.594 17.945 20.204Q17.777 20.813 17.484 21.258Q17.192 21.702 16.821 21.983L16.388 22.264Q15.927 22.64 15.337 22.82Q14.747 23 14.185 23Z';

export function LogoMark({ size = 32, variant = 'auto', tone = 'dark', className }) {
  // Auto picks by size, which is the rule: outline from 32 up, solid below,
  // because the basket walls close on the ampersand and the counters fill in.
  const solid = variant === 'solid' || (variant === 'auto' && size < 32);

  return (
    <svg
      className={className}
      data-tone={tone}
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {solid ? (
        <>
          <path d={SOLID_BODY} className={styles.solidBody} />
          <path d={SOLID_HANDLE} className={styles.solidHandle} strokeWidth="2.1" strokeLinecap="round" />
          <path d={AMP} className={styles.ampKnockout} />
        </>
      ) : (
        <>
          <path d={BODY} className={styles.body} strokeWidth="1.7" strokeLinejoin="round" />
          <path d={HANDLE} className={styles.handle} strokeWidth="1.9" strokeLinecap="round" />
          <path d={AMP} className={styles.amp} />
        </>
      )}
    </svg>
  );
}

/*
 * Mark and name. The ampersand in the wordmark is sage so it rhymes with the
 * one in the basket, and it is a real character rather than an image, so it
 * reads to a screen reader and to search.
 */
export function Logo({ size = 32, tone = 'dark' }) {
  return (
    <span className={styles.lockup} data-tone={tone}>
      <LogoMark size={size} tone={tone} />
      <span className={styles.word}>
        Cart <span className={styles.wordAmp}>&amp;</span> Keep
      </span>
    </span>
  );
}
