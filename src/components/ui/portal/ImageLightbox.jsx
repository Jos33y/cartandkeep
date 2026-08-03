import { useEffect } from 'react';
import styles from '@styles/ui/portal/image-lightbox.module.css';

// eBay serves any size off the same path, so the full view asks for the big one.
export const large = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l1600.') : null);

export function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <figure className={styles.frame} onClick={(e) => e.stopPropagation()}>
        <img className={styles.image} src={large(src)} alt={alt} />
        <figcaption className={styles.caption}>
          {alt}
          <span className={styles.note}>
            The seller&rsquo;s own photograph, here so you can see the product. It cannot
            be used in your own listing.
          </span>
        </figcaption>
      </figure>

      <button className={styles.close} onClick={onClose} autoFocus>Close</button>
    </div>
  );
}
