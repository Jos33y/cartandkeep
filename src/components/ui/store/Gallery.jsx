import { useCallback, useEffect, useRef, useState } from 'react';
import { imageAt } from '@utils/categories';
import { ChevronRightIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/gallery.module.css';

// One photograph reads as a single square; several get arrows on the photo and a strip that keeps the chosen one in view.
export function Gallery({ images, title, afterFrame = null }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState(false);
  const strip = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  // A new product resets the selection, or a related product opens on someone else's third photograph.
  useEffect(() => { setActive(0); setBroken(false); }, [images.join('|')]);

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = strip.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro?.disconnect(); };
  }, [measure, images.length]);

  // Keeps the chosen thumbnail in view by scrolling the strip only; scrollIntoView would move the page too.
  useEffect(() => {
    const el = strip.current;
    const thumb = el?.children[active];
    if (!el || !thumb) return;
    const left = thumb.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft) el.scrollTo({ left, behavior: 'smooth' });
    else if (left + thumb.offsetWidth > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: left + thumb.offsetWidth - el.clientWidth, behavior: 'smooth' });
    }
  }, [active]);

  if (images.length === 0 || broken) {
    return (
      <div className={styles.gallery}>
        <div className={`${styles.frame} ${styles.empty}`} data-gallery-frame>
          <p>No photograph yet</p>
        </div>
        {afterFrame}
      </div>
    );
  }

  const many = images.length > 1;
  const step = (d) => setActive((i) => (i + d + images.length) % images.length);

  return (
    <div className={styles.gallery}>
      <div className={styles.frame} data-gallery-frame>
        <img
          className={styles.image}
          src={imageAt(images[active], 800)}
          srcSet={`${imageAt(images[active], 800)} 1x, ${imageAt(images[active], 1600)} 2x`}
          alt={title}
          loading="eager"
          decoding="async"
          onError={() => setBroken(true)}
        />
        {many && (
          <>
            <button type="button" className={`${styles.step} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous photograph">
              <ChevronRightIcon size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className={`${styles.step} ${styles.next}`} onClick={() => step(1)} aria-label="Next photograph">
              <ChevronRightIcon size={18} />
            </button>
            <span className={styles.count} data-price aria-hidden="true">{active + 1} / {images.length}</span>
          </>
        )}
      </div>

      {afterFrame}

      {many && (
        <div className={styles.stripWrap} data-start={edges.start || undefined} data-end={edges.end || undefined}>
          <ul className={styles.thumbs} ref={strip}>
            {images.map((src, i) => (
              <li key={src}>
                <button
                  type="button"
                  className={styles.thumb}
                  data-active={i === active || undefined}
                  onClick={() => setActive(i)}
                  aria-label={`Photograph ${i + 1} of ${images.length}`}
                  aria-current={i === active}
                >
                  <img src={imageAt(src, 300)} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
