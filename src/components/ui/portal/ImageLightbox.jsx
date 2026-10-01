import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/image-lightbox.module.css';

// eBay serves any size off the same path, so the full view asks for the big one.
export const large = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l1600.') : null);

const SELLERS = 'The seller’s own photograph, here so you can see the product. It cannot be used in your own listing.';

/*
 * A photograph at full size. One (`src`), or a set to step through (`images`, each a url or { src, label }) from
 * `start`, with the arrow keys or the buttons. `note` is the line under it; the default is for another seller's photo.
 */
export function ImageLightbox({ src, alt, images = null, start = 0, note = SELLERS, onClose }) {
  const list = (images ?? [src]).map((x) => (typeof x === 'string' ? { src: x } : x)).filter((x) => x?.src);
  const [index, setIndex] = useState(Math.min(start, Math.max(0, list.length - 1)));
  const closeBtn = useRef(null);
  const returnTo = useRef(null);
  const many = list.length > 1;

  const step = useCallback((d) => setIndex((i) => (i + d + list.length) % list.length), [list.length]);

  useEffect(() => {
    returnTo.current = document.activeElement;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowRight') step(1);
      else if (many && e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = before;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [onClose, step, many]);

  const shot = list[index];
  if (!shot) return null;
  const label = shot.label ?? alt;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={alt ?? 'Photograph'} onClick={onClose}>
      <figure className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <div className={styles.stage}>
          <img key={shot.src} className={styles.image} src={large(shot.src)} alt={label ?? ''} />
          {many && (
            <>
              <button type="button" className={`${styles.step} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous photograph">
                <Icon name="IconCaret" className={styles.stepIcon} />
              </button>
              <button type="button" className={`${styles.step} ${styles.next}`} onClick={() => step(1)} aria-label="Next photograph">
                <Icon name="IconCaret" className={styles.stepIcon} />
              </button>
            </>
          )}
        </div>
        {(label || note || many) && (
          <figcaption className={styles.caption}>
            <span className={styles.captionHead}>
              {label && <span>{label}</span>}
              {many && <span className={styles.count} data-num>{index + 1} of {list.length}</span>}
            </span>
            {note && <span className={styles.note}>{note}</span>}
          </figcaption>
        )}
        {many && (
          <ol className={styles.strip} aria-label="All photographs">
            {list.map((x, i) => (
              <li key={x.src}>
                <button type="button" className={styles.thumb} aria-current={i === index ? 'true' : undefined}
                  aria-label={`Photograph ${i + 1}`} onClick={() => setIndex(i)}>
                  <img src={x.src} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </figure>

      <button ref={closeBtn} type="button" className={styles.close} onClick={onClose}>Close</button>
    </div>,
    document.body,
  );
}
