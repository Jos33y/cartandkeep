import { useRef, useState } from 'react';
import { uploadProductImage } from '@lib/productImages';
import styles from '@styles/ui/portal/product-images.module.css';

/*
 * Photographs for one product.
 *
 * The first image is the one the card, the shelf and the search result use, so
 * "make this the first one" is the only ordering control worth having. A full
 * drag and drop reorder is a lot of code to answer a question nobody asks about
 * the fourth and fifth pictures.
 *
 * Uploads run one at a time rather than in parallel. She is likely on a phone
 * or a home connection, five simultaneous uploads of a resized photograph each
 * finish slower than five in a row, and a queue can report which one it is on.
 */
export function ProductImages({ tenantId, productId, images, onChange, onRemove, disabled }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(null);

  async function pick(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;

    setFailed(null);
    const added = [];

    for (let i = 0; i < files.length; i += 1) {
      setBusy(`Adding ${i + 1} of ${files.length}`);
      try {
        added.push(await uploadProductImage({ tenantId, productId, file: files[i] }));
      } catch (e) {
        // Named rather than counted. "2 uploads failed" is not something
        // anybody can act on.
        setFailed(`${files[i].name}: ${e?.message ?? 'did not upload'}`);
        break;
      }
    }

    setBusy(null);
    if (added.length) await onChange([...images, ...added]);
  }

  const makeFirst = (url) => onChange([url, ...images.filter((u) => u !== url)]);

  return (
    <div className={styles.wrap}>
      <ul className={styles.grid}>
        {images.map((url, i) => (
          <li key={url} className={styles.item}>
            <img className={styles.image} src={url} alt="" loading="lazy" />

            {i === 0
              ? <span className={styles.primary}>Main</span>
              : (
                <button type="button" className={styles.make} onClick={() => makeFirst(url)}>
                  Make main
                </button>
              )}

            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemove(url)}
              aria-label="Remove this photograph"
            >
              ×
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            className={styles.add}
            disabled={disabled || Boolean(busy)}
            onClick={() => input.current?.click()}
          >
            {busy ?? 'Add photographs'}
          </button>
        </li>
      </ul>

      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={pick}
      />

      {/* Said once, here, rather than as a warning after a bad upload. */}
      <p className={styles.hint}>
        Daylight, plain background, the product filling the frame. Anything you take
        will beat the supplier's picture. They are resized on the way up, so the
        size of the file does not matter.
      </p>

      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </div>
  );
}
