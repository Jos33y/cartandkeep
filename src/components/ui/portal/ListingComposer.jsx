import { useEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/listing-composer.module.css';

// eBay allows 80 and ranks full ones better.
const TITLE_MAX = 80;

/*
 * The listing, before it goes up.
 *
 * The words are hers: the draft starts empty, and Suggest and Write for eBay write new copy from the facts. Photos
 * are hers, or the shop's once Keepr has checked them: no shop name or logo, no watermark, nothing laid over, a
 * plain product shot of the same pack. Each photo in the draft says where it came from, and one that cannot go up
 * says why; the card will not go live with it.
 *
 * `judge(src)` answers for one photo ({ ok, source, why }). `checks` is Keepr's answer for the shop's photos, or
 * null before anyone has looked.
 */
export function ListingComposer({
  listing, draft, onChange, onGenerate, onUpload, judge = () => ({ ok: true, source: 'hers' }),
  checks = null, onCheck, checking = false, onWider = null,
}) {
  const title = draft.title ?? '';
  const description = draft.description ?? '';
  const images = draft.images ?? [];
  // Her own uploads she has taken out can be put back.
  const excluded = (draft.uploads ?? []).filter((src) => !images.includes(src));
  // The shop's photos: with Keepr's verdict once checked, as they are on the page before.
  const shopShots = checks
    ? (checks.images ?? []).map((i) => ({ url: i.url, use: i.copy ?? i.url, ok: i.ok && !checks.brand_rule, why: checks.brand_rule ? null : i.reasons?.[0] ?? null, checked: true }))
    : [...new Set(listing?.images ?? [])].slice(0, 6).map((url) => ({ url, use: url, ok: false, why: null, checked: false }));
  // What goes in the draft is our copy of a passed photo, so "in use" is judged by it.
  const inUse = (x) => images.includes(x.use) || images.includes(x.url);
  // Other UK shops matched to the same product, each with its photos as Keepr judged them; and the ones turned down.
  const matched = (checks?.others ?? []).filter((o) => o.ok);
  const refused = (checks?.others ?? []).filter((o) => !o.ok);
  const widerShots = checks?.brand_rule ? [] : matched.flatMap((o) => (o.images ?? []).map((i) => ({
    url: i.url, use: i.copy ?? i.url, ok: i.ok, why: i.reasons?.[0] ?? null, checked: true, shop: o.shop,
  })));
  const usable = [...shopShots, ...widerShots].filter((x) => x.ok && !inUse(x));
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

  // eBay needs one, but a photo that cannot go up can always come out.
  function drop(src) {
    if (images.length <= 1 && judge(src).ok) return;
    onChange({ images: images.filter((s) => s !== src) });
  }

  // Checked shop photos, added after hers, up to the gallery's twelve.
  function use(urls) {
    onChange({ images: [...images, ...urls.filter((u) => !images.includes(u))].slice(0, 12) });
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
          placeholder="Press Suggest, or write it"
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Listing title"
        />
        {!title && listing?.title && (
          <p className={styles.reference}>
            The shop calls it <q>{listing.title}</q>.{' '}
            <button type="button" className={styles.referenceUse} onClick={() => onChange({ title: String(listing.title).slice(0, TITLE_MAX) })}>
              Start from that
            </button>
          </p>
        )}

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
        hint="Yours, or the shop's once checked. The first is the search tile; drag to reorder."
        aside={
          <span className={styles.count} data-num>
            {images.length} going up
          </span>
        }
      >
        <ol className={styles.gallery}>
          {images.map((src, i) => {
            const j = judge(src);
            return (
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
              {!j.ok
                ? <span className={styles.notMine} title={j.why}>{j.why ? `${j.why.charAt(0).toUpperCase()}${j.why.slice(1)}` : 'Cannot go up'}</span>
                : j.source === 'shop' && <span className={styles.fromShop}>Shop's, checked</span>}

              {(images.length > 1 || !j.ok) && (
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
            );
          })}

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
        {!images.length && (
          <p className={styles.reference}>
            {usable.length ? `No photos yet. ${usable.length === 1 ? 'One photo passed' : `${usable.length} photos passed`} the check.`
              : checks ? 'No photos yet. Add your own.'
                : 'No photos yet. Check the shop\'s, or add your own.'}
          </p>
        )}
        {(shopShots.length > 0 || (onCheck && !checks)) && (
          <div className={styles.refShots} data-part="shop-photos">
            <span className={styles.refHead}>
              <span className={styles.refLabel}>
                {checks ? `The shop's photos, checked${checks.shop ? ` from ${checks.shop}` : ''}` : 'The shop\'s photos, not checked yet'}
              </span>
              {onCheck && (
                <button type="button" className={styles.referenceUse} disabled={checking} onClick={onCheck}>
                  {checking ? 'Checking' : checks ? 'Check again' : 'Check them'}
                </button>
              )}
              {usable.length > 1 && (
                <button type="button" className={styles.referenceUse} onClick={() => use(usable.map((x) => x.use))}>
                  Use all {usable.length}
                </button>
              )}
            </span>
            {checks?.brand_rule && (
              <p className={styles.reference}>{checks.brand} is a brand that reports listings on eBay, so its shop photos are not used. eBay's catalogue or your own.</p>
            )}
            {shopShots.length > 0 ? (
              <ul className={styles.refGrid}>
                {shopShots.map((x) => {
                  const inDraft = inUse(x);
                  return (
                    <li key={x.url} className={styles.refShot} data-state={!x.checked ? 'unchecked' : x.ok ? 'passed' : 'failed'}>
                      <img src={x.url} alt="" loading="lazy" />
                      <span className={styles.refVerdict} title={x.why ?? undefined}>
                        {!x.checked ? 'Not checked' : x.ok ? (inDraft ? 'In use' : 'Passed') : x.why ?? 'Not used'}
                      </span>
                      {x.ok && !inDraft && images.length < 12 && (
                        <button type="button" className={styles.refUse} onClick={() => use([x.use])}>Use</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : checks && !checks.brand_rule && <p className={styles.reference}>The shop page had no photos to check.</p>}
          </div>
        )}
        {checks && !checks.brand_rule && (matched.length > 0 || refused.length > 0 || onWider) && (
          <div className={styles.refShots} data-part="other-shops">
            <span className={styles.refHead}>
              <span className={styles.refLabel}>
                {matched.length
                  ? `From ${matched.length === 1 ? 'another UK shop' : `${matched.length} other UK shops`}, matched to this product`
                  : checks.others_for ? 'No other UK shop was a certain match' : 'Other UK shops, not looked at yet'}
              </span>
              {onWider && (
                <button type="button" className={styles.referenceUse} disabled={checking} onClick={onWider}>
                  {checking ? 'Looking' : checks.others_for ? 'Look again' : 'Look in other shops'}
                </button>
              )}
            </span>
            {matched.map((o) => (
              <div key={o.url} className={styles.otherShop}>
                <a className={styles.otherLink} href={o.url} target="_blank" rel="noreferrer noopener">{o.shop}</a>
                <span className={styles.otherVia}>matched by {o.via}</span>
                {(o.images ?? []).length > 0 ? (
                  <ul className={styles.refGrid}>
                    {o.images.map((i) => {
                      const x = { url: i.url, use: i.copy ?? i.url, ok: i.ok, why: i.reasons?.[0] ?? null };
                      const inDraft = inUse(x);
                      return (
                        <li key={i.url} className={styles.refShot} data-state={x.ok ? 'passed' : 'failed'}>
                          <img src={i.url} alt="" loading="lazy" />
                          <span className={styles.refVerdict} title={x.why ?? undefined}>{x.ok ? (inDraft ? 'In use' : 'Passed') : x.why ?? 'Not used'}</span>
                          {x.ok && !inDraft && images.length < 12 && (
                            <button type="button" className={styles.refUse} onClick={() => use([x.use])}>Use</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : <span className={styles.otherVia}>No photos on its page.</span>}
              </div>
            ))}
            {refused.length > 0 && (
              <p className={styles.reference}>
                Not used: {refused.map((o) => `${o.shop} (${o.via})`).join(', ')}.
              </p>
            )}
            {checks.others_error && <p className={styles.reference}>The search did not finish: {checks.others_error}</p>}
          </div>
        )}
      </Field>

      <Field
        label="Description"
        hint="Your words. The shop's are never used"
        action={
          <button type="button" className={styles.ghost} disabled={busy === 'description'}
            onClick={() => generate('description')}>
            <Icon name="IconRefresh" className={`${styles.icon} ${busy === 'description' ? styles.spin : ''}`} />
            {busy === 'description' ? 'Writing' : description ? 'Rewrite for eBay' : 'Write for eBay'}
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
            placeholder="Press Write for eBay: it writes from the facts, and stops if the pack and the text disagree."
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
