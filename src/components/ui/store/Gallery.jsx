import { useEffect, useState } from 'react';
import { imageAt } from '@utils/categories';
import styles from '@styles/ui/store/gallery.module.css';

/*
 * Product photography, such as it is.
 *
 * Most rows carry one image and a few carry several, so this has to look
 * deliberate at one and still work at five. With one it is a single square and
 * no thumbnails, rather than a carousel with one slide and a dot under it.
 *
 * Her photographs come from the supplier feed at 300px. They are requested at
 * 800 here and at 1600 for the large view, which eBay serves by resizing the
 * original, so the ceiling is whatever the seller uploaded. Real photography
 * is a conversation with her, not something the front end can fix.
 */
export function Gallery({ images, title }) {
  const [active, setActive] = useState(0);
  const [broken, setBroken] = useState(false);

  // A product change has to reset the selection, or arriving from a related
  // product shows the third photograph of something you are no longer looking
  // at.
  useEffect(() => { setActive(0); setBroken(false); }, [images.join('|')]);

  if (images.length === 0 || broken) {
    return (
      <div className={styles.gallery}>
        <div className={`${styles.frame} ${styles.empty}`}>
          <p>No photograph yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.frame}>
        <img
          className={styles.image}
          src={imageAt(images[active], 800)}
          srcSet={`${imageAt(images[active], 800)} 1x, ${imageAt(images[active], 1600)} 2x`}
          alt={title}
          loading="eager"
          decoding="async"
          onError={() => setBroken(true)}
        />
      </div>

      {images.length > 1 && (
        <ul className={styles.thumbs}>
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
      )}
    </div>
  );
}
