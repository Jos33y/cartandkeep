import { useState } from 'react';
import { ProductImages } from '@components/ui/portal/ProductImages';
import { formatGbp } from '@utils/formatGbp';
import { blockers, warnings, isLive, CATEGORY_MIN } from '@hooks/useCatalogue';
import styles from '@styles/ui/portal/product-row.module.css';

const RETURNS = [
  { value: 'standard', label: 'Standard', hint: '14 day right, extended to 30 as a goodwill term' },
  { value: 'sealed', label: 'Sealed only', hint: 'Returnable while sealed, on health or hygiene grounds' },
  { value: 'none', label: 'No return', hint: 'Consumable or perishable. Statutory rights unaffected' },
];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const leaf = (path) => String(path ?? '').split('|').pop()?.trim() || null;
const top = (path) => String(path ?? '').split('|')[0]?.trim() || null;

export function ProductRow({
  product, selected, onSelect, onConfirmReturns, onSaveHazard, onUnpublish,
  onSaveDescription, onSaveDetails, onSaveImages, onRemoveImage, onSaveStock,
  onSaveRecord, tenantId, categories, categoryCount,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const guessed = product.derived_fields?.returns_class;
  const [returnsClass, setReturnsClass] = useState(guessed ?? product.returns_class ?? 'standard');
  const [note, setNote] = useState(product.returns_note ?? '');

  const [title, setTitle] = useState(product.title ?? '');
  const [price, setPrice] = useState(String(product.price ?? ''));
  const [description, setDescription] = useState(product.description ?? '');
  const [categoryPath, setCategoryPath] = useState(product.category_path ?? '');
  const [brand, setBrand] = useState(product.brand ?? '');
  const [inTheBox, setInTheBox] = useState(product.in_the_box ?? '');

  /*
   * Specifications as an ordered list of pairs rather than as the object they
   * are stored as. An object cannot hold a half typed key, and editing one in
   * place means every keystroke either loses a row or reorders the lot.
   */
  const [specs, setSpecs] = useState(() => Object.entries(product.specifications ?? {})
    .map(([key, value]) => ({ key, value: String(value ?? '') })));

  const [stock, setStock] = useState(product.stock === null || product.stock === undefined
    ? '' : String(product.stock));
  const [availability, setAvailability] = useState(product.availability ?? 'in_stock');
  const [notHazardous, setNotHazardous] = useState(false);
  const [signal, setSignal] = useState(product.hazard?.signal ?? '');
  const [statements, setStatements] = useState((product.hazard?.h ?? []).join('\n'));
  const [sds, setSds] = useState(product.safety_data_sheet_url ?? '');
  const [biocide, setBiocide] = useState(product.biocide_reg_no ?? '');

  const stops = blockers(product);
  const notes = warnings(product);
  const live = isLive(product);

  async function run(fn) {
    setBusy(true);
    setFailed(null);
    try { await fn(); } catch (e) { setFailed(e?.message ?? 'Not saved. Try again.'); }
    finally { setBusy(false); }
  }

  const state = live ? 'stateLive' : stops.length ? 'stateBlocked' : 'stateReady';
  const thin = top(product.category_path) && categoryCount > 0 && categoryCount < CATEGORY_MIN;

  return (
    <article className={`${styles.row} ${styles[state]} ${open ? styles.rowOpen : ''}`}>
      <div className={styles.head}>
        {/* Outside the expander, because a tick that also opens a panel is a
            tick nobody trusts on a phone. */}
        <label className={styles.pick}>
          <input
            type="checkbox"
            checked={selected}
            disabled={live}
            onChange={(e) => onSelect(product.id, e.target.checked)}
          />
          <span className="visually-hidden">Select {product.title}</span>
        </label>

        <button
          type="button"
          className={styles.opener}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {product.image_url
            ? <img className={styles.thumb} src={thumb(product.image_url)} alt="" loading="lazy" />
            : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

          <span className={styles.middle}>
            <span className={styles.title}>{product.title}</span>
            <span className={styles.meta}>
              <span className={styles.state}>
                {live ? 'Live' : stops.length ? 'Blocked' : 'Ready'}
              </span>
              {leaf(product.category_path) && <> · {leaf(product.category_path)}</>}
              {stops.length > 0 && <> · {stops.join(', ')}</>}
              {stops.length === 0 && notes.length > 0 && <> · {notes.join(', ')}</>}
            </span>
          </span>

          <span className={`figure ${styles.price}`}>{formatGbp(product.price)}</span>

          <span className={styles.caret} aria-hidden="true" data-open={open || undefined}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </span>
        </button>
      </div>

      {open && (
        <div className={styles.detail}>
          {/* Only shown when it is true, so it disappears the moment a third
              product joins the category rather than sitting there stale. */}
          {thin && (
            <p className={styles.thin}>
              {top(product.category_path)} has {categoryCount} live{' '}
              {categoryCount === 1 ? 'product' : 'products'} and needs {CATEGORY_MIN} before
              it gets its own section on the shop. Below that it folds into Everything else.
            </p>
          )}

          <section className={styles.panel}>
            <h4 className="micro">Returns</h4>

            {guessed ? (
              <p className={styles.guessed}>
                A script read the title and guessed <strong>{RETURNS.find((r) => r.value === guessed)?.label}</strong>.
                Nobody has confirmed it, so this cannot go live until you do.
              </p>
            ) : (
              <p className={styles.settled}>
                Set to {RETURNS.find((r) => r.value === product.returns_class)?.label ?? product.returns_class}.
              </p>
            )}

            <div className={styles.choices}>
              {RETURNS.map((r) => (
                <label key={r.value} className={styles.choice}>
                  <input
                    type="radio"
                    name={`returns-${product.id}`}
                    value={r.value}
                    checked={returnsClass === r.value}
                    onChange={() => setReturnsClass(r.value)}
                  />
                  <span>
                    <span className={styles.choiceLabel}>{r.label}</span>
                    <span className={styles.choiceHint}>{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Anything to add, optional</span>
              <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => run(() => onConfirmReturns({ id: product.id, returnsClass, note }))}
            >
              Confirm returns
            </button>
          </section>

          {product.derived_fields?.hazard_suspect && (
            <section className={styles.panel}>
              <h4 className="micro">Hazard</h4>
              <p className={styles.guessed}>
                The title suggests a classified mixture under GB CLP. An online offer for one
                carries its label elements near the price. Read the bottle, or say it is not one.
              </p>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={notHazardous}
                  onChange={(e) => setNotHazardous(e.target.checked)}
                />
                <span>Not a classified mixture. I have checked the label.</span>
              </label>

              {!notHazardous && (
                <>
                  <label className={styles.field}>
                    <span className={styles.label}>Signal word</span>
                    <select className={styles.input} value={signal} onChange={(e) => setSignal(e.target.value)}>
                      <option value="">Choose one</option>
                      <option value="Warning">Warning</option>
                      <option value="Danger">Danger</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Hazard statements, one per line</span>
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      value={statements}
                      onChange={(e) => setStatements(e.target.value)}
                      placeholder="H315 Causes skin irritation"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Safety data sheet link, optional</span>
                    <input className={styles.input} type="url" value={sds}
                      onChange={(e) => setSds(e.target.value)} placeholder="https://" />
                  </label>

                  {/* Jeyes Fluid and the wasp killer are biocidal products and
                      carry an HSE registration number on the label. */}
                  <label className={styles.field}>
                    <span className={styles.label}>HSE registration number, if it is a biocide</span>
                    <input className={styles.input} value={biocide}
                      onChange={(e) => setBiocide(e.target.value)} />
                  </label>
                </>
              )}

              <button
                type="button"
                className={styles.primary}
                disabled={busy || (!notHazardous && !signal)}
                onClick={() => run(() => onSaveHazard({
                  id: product.id,
                  notHazardous,
                  hazard: notHazardous ? null : {
                    signal,
                    h: statements.split('\n').map((l) => l.trim()).filter(Boolean),
                    p: [],
                  },
                  sdsUrl: sds,
                  biocideRegNo: biocide,
                }))}
              >
                Save hazard details
              </button>
            </section>
          )}

          <section className={styles.panel}>
            <h4 className="micro">Photographs</h4>
            <ProductImages
              tenantId={tenantId}
              productId={product.id}
              images={product.images ?? []}
              disabled={busy}
              onChange={(images) => run(() => onSaveImages({ id: product.id, images }))}
              onRemove={(url) => run(() => onRemoveImage({ id: product.id, url }))}
            />
          </section>

          <section className={styles.panel}>
            <h4 className="micro">Title and price</h4>

            <label className={styles.field}>
              <span className={styles.label}>Title</span>
              <textarea
                className={styles.textarea}
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {/* Feed titles run past eighty characters and the card clips at
                  two lines, so the count is the useful thing to show. */}
              <span className={styles.count} data-num>{title.trim().length}</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Price</span>
              <input
                className={styles.input}
                value={price}
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>

            {/* The web address does not follow the title. A URL that changes
                when somebody fixes a typo breaks every link anyone shared. */}
            <p className={styles.slug}>/p/{product.slug}</p>

            <button
              type="button"
              className={styles.primary}
              disabled={busy
                || (title.trim() === (product.title ?? '') && price === String(product.price ?? ''))
                || !title.trim()}
              onClick={() => run(() => onSaveDetails({ id: product.id, title, price }))}
            >
              Save title and price
            </button>
          </section>

          <section className={styles.panel}>
            <h4 className="micro">Description</h4>

            {/*
              * Hers, above the supplier's. A description written from a feed
              * title is the feed title with more words, which is why this is
              * the one field on this screen nothing tries to guess for her.
              */}
            <label className={styles.field}>
              <span className={styles.label}>
                What would you tell somebody in a shop who picked this up
              </span>
              <textarea
                className={styles.textarea}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Two or three sentences. What it is, who it suits, anything the photograph does not show."
              />
            </label>

            <div className={styles.split}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || description === (product.description ?? '')}
                onClick={() => run(() => onSaveDescription({ id: product.id, description }))}
              >
                Save description
              </button>
              <span className={styles.count} data-num>{description.trim().length}</span>
            </div>

            {product.source_description && (
              <details className={styles.supplier}>
                <summary>What the supplier wrote</summary>
                <p>{product.source_description}</p>
              </details>
            )}
          </section>

          <section className={styles.panel}>
            <h4 className="micro">Where it sits</h4>

            <label className={styles.field}>
              <span className={styles.label}>Section</span>
              <select
                className={styles.input}
                value={categoryPath}
                onChange={(e) => setCategoryPath(e.target.value)}
              >
                <option value="">Everything else</option>
                {(categories ?? []).map((c) => (
                  <option key={c.path} value={c.path}>{c.label} · {c.count}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Brand</span>
              <input
                className={styles.input}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Leave empty if it has none"
                autoComplete="off"
              />
            </label>

            <button
              type="button"
              className={styles.primary}
              disabled={busy
                || (categoryPath === (product.category_path ?? '')
                  && brand === (product.brand ?? ''))}
              onClick={() => run(() => onSaveRecord({ id: product.id, categoryPath, brand }))}
            >
              Save
            </button>
          </section>

          <section className={styles.panel}>
            <h4 className="micro">Details</h4>
            <p className={styles.hint}>
              Size, weight, material, capacity. These sit in a table under the description,
              and they are what somebody checks before buying rather than reads.
            </p>

            <ul className={styles.specs}>
              {specs.map((row, i) => (
                <li key={i} className={styles.spec}>
                  <input
                    className={styles.input}
                    value={row.key}
                    placeholder="Capacity"
                    aria-label="Detail name"
                    onChange={(e) => setSpecs(specs.map((s, j) =>
                      (j === i ? { ...s, key: e.target.value } : s)))}
                  />
                  <input
                    className={styles.input}
                    value={row.value}
                    placeholder="4.7 litres"
                    aria-label="Detail value"
                    onChange={(e) => setSpecs(specs.map((s, j) =>
                      (j === i ? { ...s, value: e.target.value } : s)))}
                  />
                  <button
                    type="button"
                    className={styles.dropRow}
                    aria-label="Remove this detail"
                    onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className={styles.ghost}
              onClick={() => setSpecs([...specs, { key: '', value: '' }])}
            >
              Add a detail
            </button>

            <label className={styles.field}>
              <span className={styles.label}>What is in the box</span>
              <textarea
                className={styles.textarea}
                rows={2}
                value={inTheBox}
                onChange={(e) => setInTheBox(e.target.value)}
                placeholder="A five piece pan set is five what, exactly"
              />
            </label>

            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => run(() => onSaveRecord({
                id: product.id, specifications: specs, inTheBox,
              }))}
            >
              Save details
            </button>
          </section>

          <section className={styles.panel}>
            <h4 className="micro">How many</h4>

            <label className={styles.field}>
              <span className={styles.label}>In stock</span>
              <input
                className={styles.input}
                value={stock}
                inputMode="numeric"
                placeholder="Leave empty if you can always get more"
                onChange={(e) => setStock(e.target.value)}
              />
              <span className={styles.hint}>
                {stock === ''
                  ? 'Untracked. It stays on sale however many people buy it.'
                  : 'Counts down as orders are paid for. It goes off sale at zero.'}
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>On sale</span>
              <select
                className={styles.input}
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              >
                <option value="in_stock">Yes</option>
                <option value="out_of_stock">Out of stock for now</option>
                <option value="discontinued">Not selling it again</option>
              </select>
            </label>

            <button
              type="button"
              className={styles.primary}
              disabled={busy
                || (stock === (product.stock === null || product.stock === undefined ? '' : String(product.stock))
                  && availability === (product.availability ?? 'in_stock'))}
              onClick={() => run(() => onSaveStock({ id: product.id, stock, availability }))}
            >
              Save
            </button>
          </section>

          <section className={styles.panel}>
            <h4 className="micro">On the shop</h4>
            <dl className={styles.facts}>
              <div><dt>Status</dt><dd>{live ? 'Live' : 'Draft'}</dd></div>
              <div><dt>Brand</dt><dd>{product.brand ?? 'Not set'}</dd></div>
              <div>
                <dt>Details</dt>
                <dd data-num>{Object.keys(product.specifications ?? {}).length}</dd>
              </div>
              <div><dt>Photographs</dt><dd data-num>{(product.images ?? []).length}</dd></div>
              <div>
                <dt>Stock</dt>
                <dd data-num>
                  {product.stock === null || product.stock === undefined ? 'Untracked' : product.stock}
                </dd>
              </div>
            </dl>

            {live && (
              <button
                type="button"
                className={styles.ghost}
                disabled={busy}
                onClick={() => run(() => onUnpublish([product.id]))}
              >
                Take back to draft
              </button>
            )}
          </section>

          {failed && <p className={styles.error} role="alert">{failed}</p>}
        </div>
      )}
    </article>
  );
}
