import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { imageAt } from '@utils/categories';
import { ChevronRightIcon, CloseIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/lightbox.module.css';

const MAX_SCALE = 2.5;

// Look closer: full screen on ink, a click zooms towards the pointer, never past the photograph's real size.
export function Lightbox({ images, start = 0, title, onClose }) {
  const [index, setIndex] = useState(start);
  const [scale, setScale] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const photo = useRef(null);
  const closeBtn = useRef(null);
  const returnTo = useRef(null);
  const swipe = useRef(null);

  const step = useCallback((d) => {
    setZoomed(false);
    setIndex((i) => (i + d + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    returnTo.current = document.activeElement;
    closeBtn.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable';

    function onKey(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = before.overflow;
      html.style.scrollbarGutter = before.gutter;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [onClose, step]);

  // How far this photograph can honestly go: its own pixels against the size it is shown at.
  function measure() {
    const el = photo.current;
    if (!el?.naturalWidth || !el.clientWidth) return;
    const ratio = el.naturalWidth / el.clientWidth;
    setScale(ratio > 1.15 ? Math.min(MAX_SCALE, ratio) : 1);
  }

  const aim = (e) => {
    const r = photo.current.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };

  function onPhotoClick(e) {
    if (scale <= 1) return;
    aim(e);
    setZoomed((z) => !z);
  }

  const onTouchStart = (e) => { swipe.current = e.touches.length === 1 ? e.touches[0].clientX : null; };
  const onTouchEnd = (e) => {
    if (swipe.current == null || zoomed) return;
    const dx = e.changedTouches[0].clientX - swipe.current;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    swipe.current = null;
  };

  return createPortal(
    <div className={styles.box} role="dialog" aria-modal="true" aria-label={`Photographs of ${title}`}>
      <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <CloseIcon size={20} />
      </button>

      <div className={styles.stage} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img
          ref={photo}
          key={images[index]}
          className={styles.photo}
          src={imageAt(images[index], 1600)}
          alt={`${title}, photograph ${index + 1} of ${images.length}`}
          onLoad={measure}
          onClick={onPhotoClick}
          onMouseMove={zoomed ? aim : undefined}
          data-can-zoom={scale > 1 || undefined}
          data-zoomed={zoomed || undefined}
          style={{ transform: zoomed ? `scale(${scale})` : 'none', transformOrigin: origin }}
        />
      </div>

      {images.length > 1 && (
        <>
          <button type="button" className={`${styles.step} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous photograph">
            <ChevronRightIcon size={22} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button type="button" className={`${styles.step} ${styles.next}`} onClick={() => step(1)} aria-label="Next photograph">
            <ChevronRightIcon size={22} />
          </button>
          <div className={styles.foot}>
            <span className={styles.count} data-price>{index + 1} / {images.length}</span>
            <ul className={styles.thumbs}>
              {images.map((src, i) => (
                <li key={src}>
                  <button type="button" className={styles.thumb} data-active={i === index || undefined} onClick={() => { setZoomed(false); setIndex(i); }} aria-label={`Photograph ${i + 1}`} aria-current={i === index}>
                    <img src={imageAt(src, 300)} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
