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
export function ListingComposer({ listing, draft, onChange, onGenerate }) {
  const title = draft.title ?? listing?.title ?? '';
  const description = draft.description ?? listing?.description ?? '';
  const images = draft.images ?? listing?.images ?? [];

  const [busy, setBusy] = useState(null);
  const [options, setOptions] = useState(null);
  const [failed, setFailed] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);

  const area = useRef(null);
  useEffect(() => {
    if (!area.current) return;
    area.current.style.height = 'auto';
    area.current.style.height = `${area.current.scrollHeight}px`;
  }, [description]);

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
        hint="The first one is the search tile, which is most of why a listing gets opened"
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
              {i === 0 ? (
                <span className={styles.leadTag}>Tile</span>
              ) : (
                <button type="button" className={styles.makeLead}
                  onClick={() => { setDragFrom(i); reorder(0); }}>
                  Make tile
                </button>
              )}
            </li>
          ))}
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
        <textarea
          ref={area}
          className={styles.area}
          value={description}
          rows={4}
          onChange={(e) => onChange({ description: e.target.value })}
          aria-label="Listing description"
        />
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
