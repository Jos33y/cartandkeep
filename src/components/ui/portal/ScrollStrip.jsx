import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/scroll-strip.module.css';

/*
 * A row of tabs that scrolls sideways. The fade shows only on a side with more to reveal, and that side gets a
 * small arrow, so a cut-off tab always reads as "there is more" and never as a broken layout. The chosen tab is
 * brought into view whenever it changes.
 */
export function ScrollStrip({ children, label, className, frameClassName, current }) {
  const strip = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const l = el.scrollLeft > 1;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [measure, children]);

  // Brings the chosen tab into view by scrolling the strip alone, never the page.
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector('[aria-selected="true"]');
    if (!tab) return;
    const pad = 56;
    const left = tab.offsetLeft - pad;
    const right = tab.offsetLeft + tab.offsetWidth + pad;
    if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left);
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
  }, [current]);

  const nudge = (dir) => {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className={`${styles.frame} ${frameClassName ?? ''}`} data-l={edge.l || undefined} data-r={edge.r || undefined}>
      <div ref={strip} className={`${styles.strip} ${className ?? ''}`} role="tablist" aria-label={label}>
        {children}
      </div>
      {edge.l && (
        <button type="button" className={styles.nudge} data-side="l" tabIndex={-1} aria-hidden="true" onClick={() => nudge(-1)}>
          <Icon name="IconCaret" className={styles.arrow} />
        </button>
      )}
      {edge.r && (
        <button type="button" className={styles.nudge} data-side="r" tabIndex={-1} aria-hidden="true" onClick={() => nudge(1)}>
          <Icon name="IconCaret" className={styles.arrow} />
        </button>
      )}
    </div>
  );
}
