import { useEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/listing-composer.module.css';

// eBay allows 80 and ranks full ones better.
const TITLE_MAX = 80;

/*
 * The listing, before it goes up.
 *
 * Home Bargains writes for a shelf label. eBay buyers arrive by searching, so
 * the title decides whether a listing is ever shown and the first photograph
 * decides whether it is opened.
 */
export function ListingComposer({ listing, draft, onChange, onGenerate, onUpload }) {
  const title = draft.title ?? listing?.title ?? '';
  const description = draft.description ?? listing?.description ?? '';
  const images = draft.images ?? listing?.images ?? [];
  const all = [...new Set([...(listing?.images ?? []), ...(draft.uploads ?? [])])];
  const excluded = all.filter((src) => !images.includes(src));
  const [uploading, setUploading] = useState(false);

  const [busy, setBusy] = useState(null);
  const [options, setOptions] = useState(null);
  const [failed, setFailed] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [full, setFull] = useState(false);

  // Grows while editing, capped when it is not. Twenty lines of copy pushed the
  // publish button a full screen away.
  const area = useRef(null);
  const [tall, setTall] = useState(false);
  useEffect(() => {
    if (!area.current) return;
    area.current.style.height = 'auto';
    const h = area.current.scrollHeight;
    setTall(h > 240);
    area.current.style.height = `${full ? h : Math.min(h, 240)}px`;
  }, [description, full]);

  async function generate(kind) {
    setBusy(kind);
    setFailed(null);
    try {
      const out = await onGenerate(kind);
      if (kind === 'title') setOptions(out);
      else onChange({ description: out });
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(null);
    }
  }

  function reorder(to) {
    if (dragFrom == null || dragFrom === to) return;
    const next = [...images];
    next.splice(to, 0, next.splice(dragFrom, 1)[0]);
    onChange({ images: next });
    setDragFrom(null);
  }

  function lead(i) {
    const next = [...images];
    next.unshift(next.splice(i, 1)[0]);
    onChange({ images: next });
  }

  // eBay needs one. Removing the last would publish nothing.
  function drop(src) {
    if (images.length <= 1) return;
    onChange({ images: images.filter((s) => s !== src) });
  }

  function restore(src) {
    onChange({ images: [...images, src] });
  }

  // eBay takes up to 24; 12 keeps the gallery readable.
  async function add(files) {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 12 - images.length);
    if (!list.length) return;
    setUploading(true);
    setFailed(null);
    try {
      const urls = [];
      for (const f of list) urls.push(await onUpload(f));
      onChange({
        images: [...images, ...urls],
        uploads: [...(draft.uploads ?? []), ...urls],
      });
    } catch (e) {
      setFailed(e.message);
    } finally {
      setUploading(false);
    }
  }

  const over = title.length > TITLE_MAX;

  return (
    <div className={styles.wrap}>
      <Field
        label="Title"
        hint="What eBay matches a search against"
        aside={
          <span className={over ? styles.countOver : styles.count} data-num>
            {title.length}/{TITLE_MAX}
          </span>
        }
        action={
          <button type="button" className={styles.ghost} disabled={busy === 'title'}
            onClick={() => generate('title')}>
            <Icon name="IconRefresh" className={`${styles.icon} ${busy === 'title' ? styles.spin : ''}`} />
            {busy === 'title' ? 'Writing' : 'Suggest'}
          </button>
        }
      >
        <input
          lang="en-GB"
          className={`${styles.input} ${over ? styles.inputOver : ''}`}
          value={title}
          maxLength={TITLE_MAX + 20}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Listing title"
        />

        {options?.length > 0 && (
          <ul className={styles.options}>
            {options.map((o) => (
              <li key={o}>
                <button type="button" className={styles.option}
                  onClick={() => { onChange({ title: o }); setOptions(null); }}>
                  <span>{o}</span>
                  <span className={styles.optionCount} data-num>{o.length}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <Field
        label="Photographs"
        hint="The first is the search tile. Drag to reorder."
        aside={
          <span className={styles.count} data-num>
            {images.length} of {all.length} going up
          </span>
        }
      >
        <ol className={styles.gallery}>
          {images.map((src, i) => (
            <li
              key={src}
              className={`${styles.shot} ${i === 0 ? styles.shotLead : ''} ${dragFrom === i ? styles.shotDrag : ''}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(i)}
              onDragEnd={() => setDragFrom(null)}
            >
              <img src={src} alt="" loading="lazy" />

              {images.length > 1 && (
                <button type="button" className={styles.remove} onClick={() => drop(src)}
                  aria-label="Leave this photograph out">
                  <Icon name="IconX" className={styles.removeIcon} />
                </button>
              )}

              {i === 0
                ? <span className={styles.leadTag}>Tile</span>
                : (
                  <button type="button" className={styles.makeLead} onClick={() => lead(i)}>
                    Make tile
                  </button>
                )}
            </li>
          ))}

          {excluded.map((src) => (
            <li key={src} className={`${styles.shot} ${styles.shotOut}`}>
              <img src={src} alt="" loading="lazy" />
              <button type="button" className={styles.restore} onClick={() => restore(src)}>
                Put back
              </button>
            </li>
          ))}

          {onUpload && images.length < 12 && (
            <li className={styles.addShot}>
              <label className={styles.addLabel}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
                <input type="file" accept="image/*" multiple className={styles.fileInput}
                  onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
                <Icon name="IconPlus" className={styles.addIcon} />
                <span>{uploading ? 'Uploading' : 'Add photo'}</span>
              </label>
            </li>
          )}
        </ol>
      </Field>

      <Field
        label="Description"
        hint="Seeded from the shop's own copy"
        action={
          <button type="button" className={styles.ghost} disabled={busy === 'description'}
            onClick={() => generate('description')}>
            <Icon name="IconRefresh" className={`${styles.icon} ${busy === 'description' ? styles.spin : ''}`} />
            {busy === 'description' ? 'Writing' : 'Rewrite for eBay'}
          </button>
        }
      >
        <div className={`${styles.areaWrap} ${tall && !full ? styles.areaClipped : ''}`}>
          <textarea
            ref={area}
            lang="en-GB"
            spellCheck
            className={styles.area}
            value={description}
            rows={4}
            onFocus={() => setFull(true)}
            onChange={(e) => onChange({ description: e.target.value })}
            aria-label="Listing description"
          />
        </div>
        {tall && (
          <button type="button" className={styles.expand} onClick={() => setFull((v) => !v)}>
            {full ? 'Show less' : 'Show all'}
          </button>
        )}
      </Field>

      {failed && <p className={styles.failed} role="alert">{failed}</p>}
    </div>
  );
}

function Field({ label, hint, aside, action, children }) {
  return (
    <section className={styles.field}>
      <header className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{label}</span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
        <span className={styles.fieldSide}>
          {aside}
          {action}
        </span>
      </header>
      {children}
    </section>
  );
}
