import { useMemo, useState } from 'react';
import { ProductImages } from '@components/ui/portal/ProductImages';
import { DescriptionPanel } from '@components/ui/portal/product/DescriptionPanel';
import { ChecksPanel } from '@components/ui/portal/product/ChecksPanel';
import { VariantsPanel } from '@components/ui/portal/product/VariantsPanel';
import { formatGbp } from '@utils/formatGbp';
import { visibleSpecs, hiddenSpecs } from '@utils/specs';
import { blockers, warnings, isLive, isArchived, marginFor, checksFor, CATEGORY_MIN } from '@hooks/useCatalogue';
import styles from '@styles/ui/portal/product-row.module.css';

/*
 * Written for somebody holding the product, not for somebody who knows the
 * regulations.
 *
 * The legal names for these are the returns class and the cancellation right,
 * and neither phrase appears below, because the person confirming it needs to
 * recognise the goods rather than the statute. The first version named the
 * grounds instead of the goods, so "on health or hygiene grounds" told her why
 * the law says it without telling her which of her products it covers.
 *
 * Standard is written at 30 days, not 14. Fourteen is the statutory period and
 * TERMS in src/data/legal.js extends it to thirty as a term of sale, which the
 * product page, the basket, the checkout and the returns page have all been
 * saying since they were built. This screen and the confirmation email were the
 * two places still saying fourteen.
 */
const RETURNS = [
  { value: 'standard', label: 'Standard', hint: 'Most things. They can send it back within 30 days for any reason' },
  { value: 'sealed', label: 'Sealed only', hint: 'Send back within 30 days, but only while the seal is unbroken. Hygiene and personal care' },
  { value: 'none', label: 'No return', hint: 'Food, drink, and anything that goes off. Faulty goods can still be returned' },
];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const leaf = (path) => String(path ?? '').split('|').pop()?.trim() || null;
const top = (path) => String(path ?? '').split('|')[0]?.trim() || null;

export function ProductRow({
  product, selected, onSelect, onConfirmReturns, onSaveHazard, onUnpublish,
  onSaveDescription, onSaveDetails, onSaveImages, onRemoveImage, onSaveStock,
  onSaveRecord, onSaveCost, onDraft, onDiscardDraft, onAcknowledgeChecks,
  onAddVariant, onSaveVariant, onRemoveVariant, onArchive, onUnarchive,
  tenantId, categories, categoryCount, fees,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  /*
   * `derived_fields.returns_class` is a flag, not a value.
   *
   * `enrich-store.js` writes the guess into the real column and leaves `true`
   * here to mean nobody has confirmed it. This read it as the guess itself, so
   * the label rendered empty, and the radio state initialised to the boolean,
   * which left every choice unchecked and let Confirm returns write `true` into
   * a column with a check constraint on it.
   *
   * 27 of the 78 carry the flag: 16 no return and 11 sealed. The 51 standard
   * rows are unflagged and were never blocked.
   */
  const unconfirmed = Boolean(product.derived_fields?.returns_class);
  const guessed = product.returns_class ?? 'standard';
  const [returnsClass, setReturnsClass] = useState(guessed);
  const [note, setNote] = useState(product.returns_note ?? '');

  const [title, setTitle] = useState(product.title ?? '');
  const [price, setPrice] = useState(String(product.price ?? ''));
  const [landedCost, setLandedCost] = useState(
    product.landed_cost === null || product.landed_cost === undefined ? '' : String(product.landed_cost));
  const [postageCost, setPostageCost] = useState(
    product.postage_cost === null || product.postage_cost === undefined ? '' : String(product.postage_cost));
  const [costNote, setCostNote] = useState(product.cost_note ?? '');

  const [categoryPath, setCategoryPath] = useState(product.category_path ?? '');
  const [brand, setBrand] = useState(product.brand ?? '');
  const [inTheBox, setInTheBox] = useState(product.in_the_box ?? '');

  /*
   * Specifications as an ordered list of pairs rather than as the object they
   * are stored as. An object cannot hold a half typed key, and editing one in
   * place means every keystroke either loses a row or reorders the lot.
   */
  /*
   * The specifications she can actually act on.
   *
   * Her catalogue carries her own eBay policy ids on every row, and a
   * "Returns Po 264890281011" three lines under a real returns policy is the
   * field on this screen most likely to be misread. No limit on length here,
   * unlike the shop: she should see the long ones and decide herself.
   *
   * The hidden ones are held rather than dropped. This state is what Save
   * writes back, so filtering the display alone would delete them from her
   * record the first time she pressed it.
   */
  const [specs, setSpecs] = useState(() => visibleSpecs(product.specifications, { max: 0 })
    .map(([key, value]) => ({ key, value })));

  const keptSpecs = useMemo(() => hiddenSpecs(product.specifications), [product.specifications]);

  const [stock, setStock] = useState(product.stock === null || product.stock === undefined
    ? '' : String(product.stock));
  const [availability, setAvailability] = useState(product.availability ?? 'in_stock');
  const [notHazardous, setNotHazardous] = useState(false);
  const [signal, setSignal] = useState(product.hazard?.signal ?? '');
  const [statements, setStatements] = useState((product.hazard?.h ?? []).join('\n'));
  const [sds, setSds] = useState(product.safety_data_sheet_url ?? '');
  const [biocide, setBiocide] = useState(product.biocide_reg_no ?? '');

  // The live draft, for the panels that take a suggestion from it. Read once
  // here rather than reached for through derived_fields in four places.
  const suggested = product.derived_fields?.draft ?? null;

  const checks = checksFor(product);
  const stops = blockers(product);
  const notes = warnings(product);
  const live = isLive(product);

  /*
   * Every save on this row goes through here, and until now none of them said
   * anything when they worked.
   *
   * The only signal was the button greying out, which it also does when there
   * is nothing to save, so "saved" and "nothing to save" looked identical. On a
   * screen whose whole job is confirming things, that is the wrong pair to
   * leave ambiguous.
   *
   * A flag rather than a message, so each panel can say it in its own words and
   * an action keeps its name through the flow. Cleared after a few seconds
   * because a permanent "Saved" is furniture, and cleared at the start of the
   * next save so two in a row both report.
   */
  const [saved, setSaved] = useState(false);

  async function run(fn) {
    setBusy(true);
    setFailed(null);
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const state = live ? 'stateLive' : stops.length ? 'stateBlocked' : 'stateReady';
  const thin = top(product.category_path) && categoryCount > 0 && categoryCount < CATEGORY_MIN;

  /*
   * The state panel, placed by what the row is for.
   *
   * A live row and a draft row are different jobs. On a draft, what matters is
   * what is blocking it. On a live product the only questions are what state it
   * is in and how to pull it, and both are here, which is why it moves to the
   * top rather than sitting under eight panels that do not apply.
   */
  const archived = isArchived(product);
  const [reason, setReason] = useState('');

  const onShop = (
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

            {/*
              * Out for good, or back into the queue.
              *
              * Not a delete, because an order still points at this row and a
              * shop that stopped stocking something has to be able to say what
              * it was when somebody asks about an order from March.
              *
              * The reason is asked for because "the supplier stopped making it"
              * and "it never sold" are different facts, and the second one is
              * research she paid for. Optional, so it never blocks the action.
              */}
            {archived ? (
              <div className={styles.archived}>
                <p className={styles.settled}>
                  Out of the shop{product.archived_reason ? `. ${product.archived_reason}` : '.'}
                  {' '}Old orders still show it.
                </p>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => run(() => onUnarchive({ id: product.id }))}
                >
                  Put it back in the queue
                </button>
              </div>
            ) : (
              <details className={styles.archiveBox}>
                <summary>Take it out of the shop for good</summary>
                <label className={styles.field}>
                  <span className={styles.label}>Why, for your own records</span>
                  <input
                    className={styles.input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Supplier stopped making it"
                  />
                </label>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => run(() => onArchive({ id: product.id, reason }))}
                >
                  Archive it
                </button>
                <p className={styles.hint}>
                  It comes off the shop and out of your lists. The page keeps
                  working for anyone holding a link, and old orders are
                  untouched. You can put it back.
                </p>
              </details>
            )}
          </section>
  );

  return (
    <article className={`${styles.row} ${styles[state]} ${open ? styles.rowOpen : ''}`}>
      <div className={styles.head}>
        {/* Outside the expander, because a tick that also opens a panel is a
            tick nobody trusts on a phone. */}
        <label className={styles.pick}>
          {/* Live rows tick too. The bar decides what each half of a mixed
              selection can do, which is a better place for that judgement than
              a disabled control that never says why. */}
          <input
            type="checkbox"
            checked={selected}
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

          {live && onShop}

          {/* First on the row when it exists, because it is why the row is
              blocked and that should not need scrolling for. */}
          {checks && (
            <ChecksPanel
              product={product}
              checks={checks}
              busy={busy}
              run={run}
              onAcknowledge={onAcknowledgeChecks}
            />
          )}

          <section className={styles.panel}>
            <h4 className="micro">Returns</h4>

            {unconfirmed ? (
              <p className={styles.guessed}>
                Nobody has set the returns policy for this yet. A script read the title and
                suggested <strong>{RETURNS.find((r) => r.value === guessed)?.label}</strong>.
                Check that is right and confirm it. This is what the customer&apos;s
                confirmation email tells them about sending it back.
              </p>
            ) : (
              <p className={styles.settled}>
                Returns policy: {RETURNS.find((r) => r.value === product.returns_class)?.label ?? product.returns_class}.
                Change it below if that is wrong.
              </p>
            )}

            {/*
              * The second opinion, and it is worth more than the first.
              *
              * The script read the title. This read the title, the full
              * specifications, the supplier text and the photograph, which is
              * how it can tell a jar of moisturiser from a saucepan in a sealed
              * box. It selects the radio and saves nothing, same as everywhere
              * else on this row: she still presses Confirm returns.
              *
              * Hidden once the radio already matches, so a suggestion she has
              * taken does not sit there asking again.
              */}
            {suggested && suggested.returns_class !== returnsClass && (
              <div className={styles.draft}>
                <p className="micro">The draft suggests</p>
                <p className={styles.draftBody}>
                  <strong>{RETURNS.find((r) => r.value === suggested.returns_class)?.label}</strong>
                  {suggested.returns_reason ? `. ${suggested.returns_reason}` : ''}
                </p>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => setReturnsClass(suggested.returns_class)}
                >
                  Select that
                </button>
              </div>
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
              {/*
                * Named as the thing in her hand rather than as the regulation.
                *
                * This read "a classified mixture under GB CLP" and "label
                * elements", which are the correct terms and are two phrases
                * nobody reads off a bottle. What the law wants is the warning
                * from the label repeated in the online offer, so that is what
                * it asks for.
                */}
              <p className={styles.guessed}>
                This looks like a cleaning chemical. If the bottle has a warning label on
                it, the shop has to show the same warning next to the price. Pick the
                bottle up and copy across what is printed on it.
              </p>

              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={notHazardous}
                  onChange={(e) => setNotHazardous(e.target.checked)}
                />
                <span>No warning label on this bottle. I have checked.</span>
              </label>

              {!notHazardous && (
                <>
                  <label className={styles.field}>
                    <span className={styles.label}>Signal word</span>
                    <span className={styles.hint}>The word in bold on the label</span>
                    <select className={styles.input} value={signal} onChange={(e) => setSignal(e.target.value)}>
                      <option value="">Choose one</option>
                      <option value="Warning">Warning</option>
                      <option value="Danger">Danger</option>
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Warnings, one per line</span>
                    <span className={styles.hint}>
                      Each one starts with H, like H315 Causes skin irritation
                    </span>
                    <textarea
                      className={styles.textarea}
                      rows={4}
                      value={statements}
                      onChange={(e) => setStatements(e.target.value)}
                      placeholder="H315 Causes skin irritation"
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Safety data sheet link</span>
                    <span className={styles.hint}>Optional, if the supplier gave you one</span>
                    <input className={styles.input} type="url" value={sds}
                      onChange={(e) => setSds(e.target.value)} placeholder="https://" />
                  </label>

                  {/* Jeyes Fluid and the wasp killer are biocidal products and
                      carry an HSE registration number on the label. Required
                      rather than optional on those, so the hint says so plainly
                      instead of hedging it into a preference. */}
                  <label className={styles.field}>
                    <span className={styles.label}>HSE number</span>
                    <span className={styles.hint}>
                      On pest killers and disinfectants only. Required there, and printed
                      on the label
                    </span>
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

          {/* After Title and price, because a variant is a price and a count
              and that is where both already live. */}
          <VariantsPanel
            product={product}
            busy={busy}
            run={run}
            onAdd={onAddVariant}
            onSave={onSaveVariant}
            onRemove={onRemoveVariant}
          />

          <DescriptionPanel
            product={product}
            busy={busy}
            run={run}
            onSave={onSaveDescription}
            onDraft={onDraft}
            onDiscardDraft={onDiscardDraft}
            saved={saved}
            /* Fills the box in the panel above rather than saving. The title
               is a separate decision from the description and it keeps its own
               Save, so nothing is committed by accepting a suggestion. */
            onUseTitle={setTitle}
          />

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

            {/* Only when the source actually said. The model returns an empty
                string rather than counting things in the photograph, so an
                absent suggestion here means nobody knows, which is a better
                answer than a list somebody invented. */}
            {suggested?.in_the_box && suggested.in_the_box !== inTheBox && (
              <div className={styles.draft}>
                <p className="micro">The draft suggests</p>
                <p className={styles.draftBody}>{suggested.in_the_box}</p>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy}
                  onClick={() => setInTheBox(suggested.in_the_box)}
                >
                  Use this
                </button>
              </div>
            )}

            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => run(() => onSaveRecord({
                id: product.id,
                specifications: specs,
                // The rows hidden from this editor, handed back so the hook can
                // write them alongside hers. Filtering the display alone would
                // delete them from her record the first time she pressed Save.
                keepSpecs: keptSpecs,
                inTheBox,
              }))}
            >
              Save details
            </button>
          </section>

          <section className={styles.panel}>
            <h4 className="micro">What it costs you</h4>

            <div className={styles.pair}>
              <label className={styles.field}>
                <span className={styles.label}>Cost of one, landed</span>
                <span className={styles.control}>
                  <span className={styles.affix} aria-hidden="true">£</span>
                  <input
                    className={styles.bare}
                    data-num
                    inputMode="decimal"
                    value={landedCost}
                    onChange={(e) => setLandedCost(e.target.value)}
                  />
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Postage you pay</span>
                <span className={styles.control}>
                  <span className={styles.affix} aria-hidden="true">£</span>
                  <input
                    className={styles.bare}
                    data-num
                    inputMode="decimal"
                    value={postageCost}
                    onChange={(e) => setPostageCost(e.target.value)}
                  />
                </span>
              </label>
            </div>

            <p className={styles.hint}>
              What one unit costs to reach you, including shipping and duty. Not the
              supplier's list price, because a figure that leaves freight out flatters
              every margin underneath it.
            </p>

            {/*
              * Recomputed as she types, before saving.
              *
              * The point of this panel is the answer to "what if I paid nine
              * pounds for it", and a figure that only appears after a save
              * makes her save three times to find out.
              */}
            <Margin
              price={product.price}
              landedCost={landedCost}
              postageCost={postageCost}
              fees={fees}
            />

            <label className={styles.field}>
              <span className={styles.label}>Where the price came from</span>
              <input
                className={styles.input}
                value={costNote}
                onChange={(e) => setCostNote(e.target.value)}
                placeholder="Supplier and date, so it can be checked later"
              />
            </label>

            {product.cost_updated_at && (
              <p className={styles.hint}>
                Recorded <span data-num>
                  {new Date(product.cost_updated_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>. A supplier price from August is not a supplier price in December.
              </p>
            )}

            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => run(() => onSaveCost({
                id: product.id, landedCost, postageCost, note: costNote,
              }))}
            >
              Save cost
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

          {/* On a draft row this sits last, because the questions it answers
              are the least urgent ones. On a live row it is rendered first
              instead, above the fold, since it is the only panel a live
              product actually needs. */}
          {!live && onShop}

          {failed && <p className={styles.error} role="alert">{failed}</p>}
        </div>
      )}
    </article>
  );
}

/*
 * What is left, per channel.
 *
 * Three rows rather than one, because the same product at the same price is a
 * different business on each of them: eBay takes 12.8 per cent and the shop
 * takes 1.5. Seeing those side by side is the argument for the shop, and it is
 * an argument made with her own numbers rather than with a claim.
 *
 * Nothing at all when the cost is unknown, rather than dashes in a table. An
 * empty table invites somebody to read a zero into it.
 */
function Margin({ price, landedCost, postageCost, fees }) {
  const m = marginFor({ price, landedCost, postageCost, fees });

  if (!m) {
    return (
      <p className={styles.hint}>
        Put a cost in and this shows what is left after fees on each channel.
      </p>
    );
  }

  const rows = [
    ['Your shop', m.store],
    ['eBay', m.ebay],
    ['TikTok Shop', m.tiktok],
  ];

  return (
    <dl className={styles.margins}>
      {rows.map(([label, v]) => (
        <div key={label} className={styles.margin}>
          <dt className={styles.marginName}>{label}</dt>
          <dd className={`${styles.marginNet} ${v.net <= 0 ? styles.marginBad : ''}`} data-num>
            {formatGbp(v.net)}
          </dd>
          <dd className={styles.marginPct} data-num>{v.pct}%</dd>
        </div>
      ))}
    </dl>
  );
}
