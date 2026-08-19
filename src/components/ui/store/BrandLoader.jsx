import styles from '@styles/ui/store/brand-loader.module.css';

/*
 * The app boot.
 *
 * One moment, and it is the mark drawing itself: the basket strokes on, then
 * the ampersand arrives. It replaces a grey "Loading" that told a first time
 * visitor nothing about whose shop they had opened.
 *
 * `pathLength="1"` normalises each path to a length of one, so the dash
 * animation is the same duration on both regardless of their real geometry and
 * neither has to have its length measured.
 *
 * It never appears for less than a moment and never becomes a spinner: if the
 * shop is still drawing this after two seconds the problem is not the
 * animation, and the caller should be showing an error instead.
 */

const BODY = 'M5 10.5h20l-2 13.2a2 2 0 0 1-2 1.7H9a2 2 0 0 1-2-1.7L5 10.5Z';
const HANDLE = 'M10.6 10.5V8.2a4.4 4.4 0 0 1 8.8 0v2.3';
const AMP = 'M14.185 23Q13.319 23 12.69 22.685Q12.06 22.37 11.723 21.842Q11.386 21.314 11.386 20.667Q11.386 20.161 11.585 19.779Q11.785 19.397 12.142 19.074Q12.499 18.751 12.965 18.43L14.562 17.373Q14.736 17.261 14.876 17.118Q15.017 16.974 15.098 16.809Q15.18 16.643 15.18 16.452Q15.18 16.165 14.978 15.963Q14.775 15.76 14.399 15.76Q14.151 15.76 13.966 15.856Q13.78 15.951 13.679 16.126Q13.578 16.3 13.578 16.536Q13.578 16.811 13.716 17.084Q13.853 17.357 14.095 17.655Q14.337 17.952 14.652 18.318L18.614 22.876H16.838L13.539 19.183Q13.196 18.784 12.87 18.38Q12.544 17.975 12.33 17.517Q12.116 17.059 12.116 16.519Q12.116 15.918 12.4 15.437Q12.684 14.956 13.196 14.678Q13.707 14.4 14.387 14.4Q15.056 14.4 15.54 14.667Q16.023 14.934 16.287 15.381Q16.551 15.828 16.551 16.373Q16.551 16.761 16.414 17.104Q16.276 17.447 16.029 17.739Q15.781 18.031 15.438 18.284L13.73 19.515Q13.387 19.768 13.21 20.018Q13.033 20.268 13.033 20.6Q13.033 20.915 13.184 21.151Q13.336 21.387 13.606 21.513Q13.876 21.64 14.236 21.64Q14.696 21.64 15.132 21.437Q15.568 21.235 15.925 20.861Q16.282 20.487 16.492 19.968Q16.703 19.448 16.703 18.818H18.114Q18.114 19.594 17.945 20.204Q17.777 20.813 17.484 21.258Q17.192 21.702 16.821 21.983L16.388 22.264Q15.927 22.64 15.337 22.82Q14.747 23 14.185 23Z';

export function BrandLoader({ label = 'Opening the shop' }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <svg className={styles.mark} viewBox="0 0 30 30" width="56" height="56" fill="none" aria-hidden="true">
        <path d={BODY} pathLength="1" className={styles.body} strokeWidth="1.7" strokeLinejoin="round" />
        <path d={HANDLE} pathLength="1" className={styles.handle} strokeWidth="1.9" strokeLinecap="round" />
        <path d={AMP} className={styles.amp} />
      </svg>
      <p className={styles.label}>{label}</p>
    </div>
  );
}
