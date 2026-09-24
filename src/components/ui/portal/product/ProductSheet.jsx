import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductImages } from '@components/ui/portal/ProductImages';
import { DescriptionPanel } from '@components/ui/portal/product/DescriptionPanel';
import { ChecksPanel } from '@components/ui/portal/product/ChecksPanel';
import { VariantsPanel } from '@components/ui/portal/product/VariantsPanel';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { visibleSpecs, hiddenSpecs } from '@utils/specs';
import { blockers, isLive, isArchived, marginFor, checksFor, CATEGORY_MIN } from '@hooks/useCatalogue';
import { stepsFor, isOpen } from '@lib/readiness';
import row from '@styles/ui/portal/product-row.module.css';
import styles from '@styles/ui/portal/product-sheet.module.css';

// Named as the goods in her hand, not the statute. Standard is 30 days, per TERMS in data/legal.js.
const RETURNS = [
  { value: 'standard', label: 'Standard', hint: 'Most things. They can send it back within 30 days for any reason' },
  { value: 'sealed', label: 'Sealed only', hint: 'Send back within 30 days, but only while the seal is unbroken. Hygiene and personal care' },
  { value: 'none', label: 'No return', hint: 'Food, drink, and anything that goes off. Faulty goods can still be returned' },
];

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const leaf = (path) => String(path ?? '').split('|').pop()?.trim() || null;
const top = (path) => String(path ?? '').split('|')[0]?.trim() || null;
const asText = (v) => (v === null || v === undefined ? '' : String(v));

export function ProductSheet({
  product, focus, onClose, columns, catalogue, categories, categoryCount, fees, tenantId,
}) {
  const {
    publish, unpublish, confirmReturns, saveHazard, saveDescription, saveDetails, saveImages,
    removeImage, saveStock, saveRecord, saveCost, draftCopy, discardDraft, acknowledgeChecks,
    addVariant, saveVariant, removeVariant, archive, unarchive,
  } = catalogue;

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [saved, setSaved] = useState(null);

  // derived_fields.returns_class is a flag meaning unconfirmed; the guess sits in the real column.
  const unconfirmed = Boolean(product.derived_fields?.returns_class);
  const [returnsClass, setReturnsClass] = useState(product.returns_class ?? 'standard');
  const [note, setNote] = useState(product.returns_note ?? '');
  const [title, setTitle] = useState(product.title ?? '');
  const [price, setPrice] = useState(asText(product.price));
  const [landedCost, setLandedCost] = useState(asText(product.landed_cost));
  const [postageCost, setPostageCost] = useState(asText(product.postage_cost));
  const [costNote, setCostNote] = useState(product.cost_note ?? '');
  const ebayTop = top(product.category_path) ?? '';
  const [section, setSection] = useState(product.section || ebayTop);
  const [brand, setBrand] = useState(product.brand ?? '');
  const [inTheBox, setInTheBox] = useState(product.in_the_box ?? '');
  const [specs, setSpecs] = useState(() => visibleSpecs(product.specifications, { max: 0 })
    .map(([key, value]) => ({ key, value })));
  // Held back from the editor and written back on save, or Save would delete them.
  const keptSpecs = useMemo(() => hiddenSpecs(product.specifications), [product.specifications]);
  const [stock, setStock] = useState(asText(product.stock));
  const [availability, setAvailability] = useState(product.availability ?? 'in_stock');
  const [notHazardous, setNotHazardous] = useState(false);
  const [signal, setSignal] = useState(product.hazard?.signal ?? '');
  const [statements, setStatements] = useState((product.hazard?.h ?? []).join('\n'));
  const [sds, setSds] = useState(product.safety_data_sheet_url ?? '');
  const [biocide, setBiocide] = useState(product.biocide_reg_no ?? '');
  const [reason, setReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  const suggested = product.derived_fields?.draft ?? null;
  const checks = checksFor(product);
  const live = isLive(product);
  const archived = isArchived(product);
  const stops = blockers(product);
  const steps = stepsFor(product, columns);
  const step = Object.fromEntries(steps.map((s) => [s.key, s]));
  const placed = product.section || ebayTop;
  const placedLabel = (categories ?? []).find((c) => c.path === placed)?.label ?? placed;
  const thin = placed && categoryCount > 0 && categoryCount < CATEGORY_MIN;

  const closeRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`sheet-${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focus]);

  async function run(fn, what) {
    setBusy(true);
    setFailed(null);
    setSaved(null);
    try {
      await fn();
      setSaved(what ?? 'Saved');
      setTimeout(() => setSaved(null), 4000);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const jump = (key) => document.getElementById(`sheet-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  const sections = [
    step.checks && checks && {
      key: 'checks', title: 'What the supplier contradicts',
      body: <ChecksPanel product={product} checks={checks} busy={busy} run={run} onAcknowledge={acknowledgeChecks} />,
    },
    step.hazard && product.derived_fields?.hazard_suspect && {
      key: 'hazard', title: 'Label warning', body: (
        <div className={row.panel}>
          <p className={row.guessed}>
            This looks like a cleaning chemical. If the bottle has a warning label, the shop has to show
            the same warning next to the price. Copy across what is printed on it.
          </p>
          <label className={row.check}>
            <input type="checkbox" checked={notHazardous} onChange={(e) => setNotHazardous(e.target.checked)} />
            <span>No warning label on this bottle. I have checked.</span>
          </label>
          {!notHazardous && (
            <>
              <label className={row.field}>
                <span className={row.label}>Signal word</span>
                <span className={row.hint}>The word in bold on the label</span>
                <select className={row.input} value={signal} onChange={(e) => setSignal(e.target.value)}>
                  <option value="">Choose one</option>
                  <option value="Warning">Warning</option>
                  <option value="Danger">Danger</option>
                </select>
              </label>
              <label className={row.field}>
                <span className={row.label}>Warnings, one per line</span>
                <textarea className={row.textarea} rows={4} value={statements}
                  onChange={(e) => setStatements(e.target.value)} placeholder="H315 Causes skin irritation" />
              </label>
              <div className={row.pair}>
                <label className={row.field}>
                  <span className={row.label}>Safety data sheet link</span>
                  <input className={row.input} type="url" value={sds} onChange={(e) => setSds(e.target.value)} placeholder="https://" />
                </label>
                <label className={row.field}>
                  <span className={row.label}>HSE number</span>
                  <input className={row.input} value={biocide} onChange={(e) => setBiocide(e.target.value)} />
                  <span className={row.hint}>Required on pest killers and disinfectants, printed on the label</span>
                </label>
              </div>
            </>
          )}
          <button type="button" className={row.primary} disabled={busy || (!notHazardous && !signal)}
            onClick={() => run(() => saveHazard({
              id: product.id,
              notHazardous,
              hazard: notHazardous ? null : {
                signal, h: statements.split('\n').map((l) => l.trim()).filter(Boolean), p: [],
              },
              sdsUrl: sds,
              biocideRegNo: biocide,
            }), 'Label warning saved')}>
            Save label warning
          </button>
        </div>
      ),
    },
    {
      key: 'returns', title: 'Returns', body: (
        <div className={row.panel}>
          {unconfirmed && (
            <p className={row.guessed}>
              A script read the title and guessed <strong>{RETURNS.find((r) => r.value === product.returns_class)?.label ?? 'Standard'}</strong>.
              The customer&apos;s confirmation email quotes this, so check it and confirm.
            </p>
          )}
          {suggested?.returns_class && suggested.returns_class !== returnsClass && (
            <div className={row.draft}>
              <p className={row.draftBody}>
                The draft read the whole record and suggests <strong>{RETURNS.find((r) => r.value === suggested.returns_class)?.label}</strong>
                {suggested.returns_reason ? `. ${suggested.returns_reason}` : ''}
              </p>
              <button type="button" className={row.ghost} disabled={busy}
                onClick={() => setReturnsClass(suggested.returns_class)}>Select that</button>
            </div>
          )}
          <div className={row.choices} role="radiogroup" aria-label="Returns">
            {RETURNS.map((r) => (
              <label key={r.value} className={row.choice} data-on={returnsClass === r.value || undefined}>
                <input type="radio" name={`returns-${product.id}`} value={r.value}
                  checked={returnsClass === r.value} onChange={() => setReturnsClass(r.value)} />
                <span>
                  <span className={row.choiceLabel}>{r.label}</span>
                  <span className={row.choiceHint}>{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <label className={row.field}>
            <span className={row.label}>Anything to add, optional</span>
            <input className={row.input} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {(unconfirmed || returnsClass !== (product.returns_class ?? 'standard') || note !== (product.returns_note ?? '')) && (
            <button type="button" className={row.primary} disabled={busy}
              onClick={() => run(() => confirmReturns({ id: product.id, returnsClass, note }), 'Returns confirmed')}>
              Confirm returns
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'cost', title: 'What it costs you', body: (
        <div className={row.panel}>
          <div className={row.pair}>
            <label className={row.field}>
              <span className={row.label}>Cost of one, landed</span>
              <span className={row.control}>
                <span className={row.affix} aria-hidden="true">£</span>
                <input className={row.bare} data-num inputMode="decimal" placeholder="0.00"
                  value={landedCost} onChange={(e) => setLandedCost(e.target.value)} />
              </span>
              <span className={row.hint}>Goods, freight and duty, on a repeat order</span>
            </label>
            <label className={row.field}>
              <span className={row.label}>Postage you pay</span>
              <span className={row.control}>
                <span className={row.affix} aria-hidden="true">£</span>
                <input className={row.bare} data-num inputMode="decimal" placeholder="0.00"
                  value={postageCost} onChange={(e) => setPostageCost(e.target.value)} />
              </span>
              <span className={row.hint}>Including packaging</span>
            </label>
          </div>
          <Split price={product.price} landedCost={landedCost} postageCost={postageCost} fees={fees} />
          <label className={row.field}>
            <span className={row.label}>Where the price came from</span>
            <input className={row.input} value={costNote} onChange={(e) => setCostNote(e.target.value)}
              placeholder="Supplier and date, so it can be checked later" />
          </label>
          {product.cost_updated_at && (
            <p className={row.hint}>
              Recorded <span data-num>{new Date(product.cost_updated_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}</span>
            </p>
          )}
          {(landedCost !== asText(product.landed_cost) || postageCost !== asText(product.postage_cost)
            || costNote !== (product.cost_note ?? '')) && (
            <button type="button" className={row.primary} disabled={busy}
              onClick={() => run(() => saveCost({ id: product.id, landedCost, postageCost, note: costNote }), 'Cost saved')}>
              Save cost
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'description', title: 'Description', body: (
        <DescriptionPanel product={product} busy={busy} run={run} onSave={saveDescription}
          onDraft={draftCopy} onDiscardDraft={discardDraft} saved={Boolean(saved)} onUseTitle={setTitle} />
      ),
    },
    {
      key: 'photo', title: 'Photographs', body: (
        <div className={row.panel}>
          <ProductImages tenantId={tenantId} productId={product.id} images={product.images ?? []} disabled={busy}
            onChange={(images) => run(() => saveImages({ id: product.id, images }), 'Photographs saved')}
            onRemove={(url) => run(() => removeImage({ id: product.id, url }), 'Photograph removed')} />
        </div>
      ),
    },
    {
      key: 'price', title: 'Title and price', body: (
        <div className={row.panel}>
          <label className={row.field}>
            <span className={row.split}>
              <span className={row.label}>Title</span>
              <span className={row.count} data-num data-over={title.trim().length > 80 || undefined}>{title.trim().length}/80</span>
            </span>
            <textarea className={row.textarea} rows={2} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className={row.field}>
            <span className={row.label}>Price</span>
            <span className={row.control}>
              <span className={row.affix} aria-hidden="true">£</span>
              <input className={row.bare} data-num inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </span>
          </label>
          <p className={row.slug} data-num>/p/{product.slug}</p>
          {(title.trim() !== (product.title ?? '') || price !== asText(product.price)) && (
            <button type="button" className={row.primary} disabled={busy || !title.trim()}
              onClick={() => run(() => saveDetails({ id: product.id, title, price }), 'Title and price saved')}>
              Save title and price
            </button>
          )}
          <VariantsPanel product={product} busy={busy} run={run} onAdd={addVariant} onSave={saveVariant} onRemove={removeVariant} />
        </div>
      ),
    },
    {
      key: 'section', title: 'Where it sits', body: (
        <div className={row.panel}>
          {thin && (
            <p className={row.thin}>
              {placedLabel} has <span data-num>{categoryCount}</span> live {categoryCount === 1 ? 'product' : 'products'}.
              It needs {CATEGORY_MIN} to get its own section on the shop; until then these sit in Everything else.
            </p>
          )}
          <div className={row.pair}>
            <label className={row.field}>
              <span className={row.label}>Section</span>
              <select className={row.input} value={section} onChange={(e) => setSection(e.target.value)}>
                {!ebayTop && <option value="">Everything else</option>}
                {(categories ?? []).map((c) => (
                  <option key={c.path} value={c.path}>
                    {c.label}{c.path === ebayTop ? ', its eBay department' : ''}
                  </option>
                ))}
              </select>
              <span className={row.hint}>Moves it on your shop only. Its eBay category stays for Google.</span>
            </label>
            <label className={row.field}>
              <span className={row.label}>Brand</span>
              <input className={row.input} value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="Leave empty if it has none" autoComplete="off" />
            </label>
          </div>
          {(section !== placed || brand !== (product.brand ?? '')) && (
            <button type="button" className={row.primary} disabled={busy}
              onClick={() => run(() => saveRecord({
                id: product.id, section: section === ebayTop ? null : section, brand,
              }), 'Section saved')}>
              Save section and brand
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'details', title: 'Details', state: specs.length ? 'done' : 'none', note: `${specs.length} listed under the description`, body: (
        <div className={row.panel}>
          <ul className={row.specs}>
            {specs.map((s, i) => (
              <li key={i} className={row.spec}>
                <input className={row.input} value={s.key} placeholder="Capacity" aria-label="Detail name"
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                <input className={row.input} value={s.value} placeholder="4.7 litres" aria-label="Detail value"
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <button type="button" className={row.dropRow} aria-label="Remove this detail"
                  onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>
                  <Icon name="IconX" width="14" height="14" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={row.ghost} onClick={() => setSpecs([...specs, { key: '', value: '' }])}>
            <Icon name="IconPlus" width="14" height="14" /> Add a detail
          </button>
          <label className={row.field}>
            <span className={row.label}>What is in the box</span>
            <textarea className={row.textarea} rows={2} value={inTheBox} onChange={(e) => setInTheBox(e.target.value)}
              placeholder="A five piece pan set is five what, exactly" />
          </label>
          {/* Empty from the model means the source never said, which beats a guessed list. */}
          {suggested?.in_the_box && suggested.in_the_box !== inTheBox && (
            <div className={row.draft}>
              <p className={row.draftBody}>{suggested.in_the_box}</p>
              <button type="button" className={row.ghost} disabled={busy} onClick={() => setInTheBox(suggested.in_the_box)}>
                Use the draft
              </button>
            </div>
          )}
          <button type="button" className={row.primary} disabled={busy}
            onClick={() => run(() => saveRecord({ id: product.id, specifications: specs, keepSpecs: keptSpecs, inTheBox }), 'Details saved')}>
            Save details
          </button>
        </div>
      ),
    },
    {
      key: 'stock', title: 'How many', body: (
        <div className={row.panel}>
          <div className={row.pair}>
            <label className={row.field}>
              <span className={row.label}>In stock</span>
              <input className={row.input} data-num value={stock} inputMode="numeric"
                placeholder="Untracked" onChange={(e) => setStock(e.target.value)} />
              <span className={row.hint}>
                {stock === '' ? 'Stays on sale however many sell' : 'Counts down as orders are paid. Off sale at zero'}
              </span>
            </label>
            <label className={row.field}>
              <span className={row.label}>On sale</span>
              <select className={row.input} value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option value="in_stock">Yes</option>
                <option value="out_of_stock">Out of stock for now</option>
                <option value="discontinued">Not selling it again</option>
              </select>
            </label>
          </div>
          {(stock !== asText(product.stock) || availability !== (product.availability ?? 'in_stock')) && (
            <button type="button" className={row.primary} disabled={busy}
              onClick={() => run(() => saveStock({ id: product.id, stock, availability }), 'Stock saved')}>
              Save stock
            </button>
          )}
        </div>
      ),
    },
  ].filter(Boolean);

  // What needs her comes first, in step order; finished sections follow.
  const need = (s) => isOpen(step[s.key]?.state ?? s.state);
  const ordered = [...sections.filter(need), ...sections.filter((s) => !need(s))];

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <aside className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={`sheet-title-${product.id}`}>
        <header className={styles.top}>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="IconX" width="18" height="18" />
          </button>
          <div className={styles.id}>
            {product.image_url
              ? <img className={styles.thumb} src={thumb(product.image_url)} alt="" />
              : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}
            <div className={styles.idText}>
              <h2 id={`sheet-title-${product.id}`} className={styles.title}>{product.title}</h2>
              <p className={styles.meta}>
                <span className={styles.state} data-state={archived ? 'archived' : live ? 'live' : stops.length ? 'blocked' : 'ready'}>
                  <i aria-hidden="true" />
                  {archived ? 'Archived' : live ? 'Live' : stops.length ? 'Blocked' : 'Ready'}
                </span>
                <span>{product.section ? placedLabel : leaf(product.category_path) ?? 'Everything else'}</span>
              </p>
            </div>
            <span className={styles.price} data-num>{formatGbp(product.price)}</span>
          </div>
          <nav className={styles.steps} aria-label="Steps">
            {steps.filter((s) => s.state !== 'none').map((s) => (
              <button key={s.key} type="button" className={styles.step} data-state={s.state}
                onClick={() => jump(s.key)} title={s.note}>
                <StepMark state={s.state} size="sm" />
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </header>

        <div ref={bodyRef} className={styles.body}>
          {ordered.map((s) => {
            const st = step[s.key] ?? { state: s.state, note: s.note };
            return (
              <section key={s.key} id={`sheet-${s.key}`} className={styles.section}
                data-open={isOpen(st.state) || undefined} data-focus={focus === s.key || undefined}>
                <header className={styles.sectionHead}>
                  <StepMark state={st.state === 'none' ? 'done' : st.state} />
                  <h3 className={styles.sectionTitle}>{s.title}</h3>
                  <span className={styles.sectionNote}>{st.note}</span>
                </header>
                <div className={styles.sectionBody}>{s.body}</div>
              </section>
            );
          })}

          {/* Not a delete: an order still points at this row. */}
          <section className={`${styles.section} ${styles.archive}`}>
            <header className={styles.sectionHead}>
              <span className={styles.archiveIcon} aria-hidden="true"><Icon name="IconBox" width="16" height="16" /></span>
              <h3 className={styles.sectionTitle}>{archived ? 'Archived' : 'Stop selling this'}</h3>
            </header>
            <div className={styles.sectionBody}>
              {archived ? (
                <div className={row.panel}>
                  <p className={row.settled}>
                    Out of the shop{product.archived_reason ? `: ${product.archived_reason}` : ''}. Old orders still show it.
                  </p>
                  <button type="button" className={row.ghost} disabled={busy}
                    onClick={() => run(() => unarchive({ id: product.id }), 'Back in the queue')}>
                    Put it back in the queue
                  </button>
                </div>
              ) : archiving ? (
                <div className={row.panel}>
                  <label className={row.field}>
                    <span className={row.label}>Why, for your own records</span>
                    <input className={row.input} value={reason} autoFocus onChange={(e) => setReason(e.target.value)}
                      placeholder="Supplier stopped making it" />
                  </label>
                  <div className={styles.archiveActions}>
                    <button type="button" className={styles.danger} disabled={busy}
                      onClick={() => run(() => archive({ id: product.id, reason }), 'Archived')}>
                      Archive it
                    </button>
                    <button type="button" className={row.ghost} disabled={busy} onClick={() => setArchiving(false)}>Keep it</button>
                  </div>
                </div>
              ) : (
                <div className={styles.archiveRow}>
                  <p className={row.hint}>
                    Comes off the shop and out of your lists. Old orders and shared links keep working, and you can put it back.
                  </p>
                  <button type="button" className={styles.dangerQuiet} onClick={() => setArchiving(true)}>Archive</button>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className={styles.foot}>
          <p className={styles.status} role="status" aria-live="polite">
            {failed ? <span className={styles.failed}>{failed}</span>
              : saved ? <span className={styles.saved}><Icon name="IconCheck" width="14" height="14" />{saved}</span>
                : !live && stops.length ? <span>Before it can go live: {stops.join(', ').toLowerCase()}</span>
                  : null}
          </p>
          {live && (
            <button type="button" className={styles.quiet} disabled={busy}
              onClick={() => run(() => unpublish([product.id]), 'Taken off the shop')}>
              Take off the shop
            </button>
          )}
          {!live && !archived && (
            <button type="button" className={styles.go} disabled={busy || stops.length > 0}
              onClick={() => run(() => publish([product.id]), 'Live on the shop')}>
              Take live
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}

// Where the price goes on each channel, redrawn as she types a cost.
function Split({ price, landedCost, postageCost, fees }) {
  const p = Number(price);
  if (!(p > 0)) return null;
  const known = landedCost !== '' && Number.isFinite(Number(landedCost));
  const m = marginFor({ price, landedCost: known ? landedCost : 0, postageCost, fees });
  if (!m) return null;
  const post = Number(postageCost) || 0;
  const cost = known ? Number(landedCost) : 0;
  const pct = (v) => `${Math.max(0, (v / p) * 100)}%`;

  const rows = [['Your shop', m.store], ['eBay', m.ebay], ['TikTok Shop', m.tiktok]];

  return (
    <div className={styles.split}>
      {rows.map(([label, v]) => {
        const left = v.net;
        return (
          <div key={label} className={styles.splitRow}>
            <span className={styles.splitName}>{label}</span>
            <span className={styles.splitBar} role="img"
              aria-label={`${label}: fees ${formatGbp(v.fee)}, postage ${formatGbp(post)}${known ? `, goods ${formatGbp(cost)}, you keep ${formatGbp(left)}` : `, ${formatGbp(left)} left for the goods and you`}`}>
              <span className={styles.segFee} style={{ width: pct(v.fee) }} />
              {post > 0 && <span className={styles.segPost} style={{ width: pct(post) }} />}
              {known && <span className={styles.segGoods} style={{ width: pct(cost) }} />}
              {known
                ? left > 0 && <span className={styles.segKeep} style={{ flex: 1 }} />
                : <span className={styles.segOpen} style={{ flex: 1 }} />}
            </span>
            <span className={styles.splitFigure}>
              <strong data-num data-bad={known && left <= 0 || undefined} data-open={!known || undefined}>{formatGbp(left)}</strong>
              <small>{known ? <>you keep, <span data-num>{v.pct}%</span></> : 'for goods and you'}</small>
            </span>
          </div>
        );
      })}
      <p className={styles.key}>
        <span><i className={styles.segFee} />Fees</span>
        {post > 0 && <span><i className={styles.segPost} />Postage</span>}
        <span><i className={known ? styles.segGoods : styles.segOpen} />{known ? 'The goods' : 'Goods and profit, until you add a cost'}</span>
        {known && <span><i className={styles.segKeep} />You keep</span>}
      </p>
      {post === 0 && <p className={row.hint}>No postage entered, so these figures are higher than a real sale.</p>}
    </div>
  );
}
