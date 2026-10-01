import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductImages } from '@components/ui/portal/ProductImages';
import { DescriptionPanel } from '@components/ui/portal/product/DescriptionPanel';
import { ChecksPanel } from '@components/ui/portal/product/ChecksPanel';
import { VariantsPanel } from '@components/ui/portal/product/VariantsPanel';
import { StepMark } from '@components/ui/portal/product/StepMark';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { visibleSpecs, hiddenSpecs } from '@utils/specs';
import {
  blockers, isLive, isArchived, isBlocked, isNeedsYou, marginFor, checksFor, money, whole, needsLabel, rulesUnchecked, CATEGORY_MIN, PRICE_FLOOR,
} from '@hooks/useCatalogue';

const RETURNS_WORD = { standard: 'standard returns', sealed: 'returns only while sealed', none: 'no returns' };
import { stepsFor } from '@lib/readiness';
import row from '@styles/ui/portal/product-row.module.css';
import styles from '@styles/ui/portal/product-sheet.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const asText = (v) => (v === null || v === undefined ? '' : String(v));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const NEW_SECTION = '__new';

// The GB CLP hazard symbols, by the code printed beside them on a safety data sheet.
const PICTOGRAMS = [
  ['GHS01', 'Exploding bomb'], ['GHS02', 'Flame'], ['GHS03', 'Flame over circle'], ['GHS04', 'Gas cylinder'], ['GHS05', 'Corrosion'],
  ['GHS06', 'Skull and crossbones'], ['GHS07', 'Exclamation mark'], ['GHS08', 'Health hazard'], ['GHS09', 'Environment'],
];

const HEAD_LABEL = { archived: 'Archived', live: 'Live', blocked: 'Blocked', question: 'Needs you', ready: 'Ready' };

const TITLE_KINDS = [
  { key: 'search', hint: 'Search first' },
  { key: 'short', hint: 'Short' },
  { key: 'feature', hint: 'Feature led' },
];

function returnsOptions(days) {
  const window = days ? `within ${days} days` : 'within your returns window';
  return [
    { value: 'standard', label: 'Standard', hint: `Most things. They can send it back ${window} for any reason` },
    { value: 'sealed', label: 'Sealed only', hint: `Back ${window}, but only while the seal is unbroken. Hygiene and personal care` },
    { value: 'none', label: 'No return', hint: 'Food, drink, and anything that goes off. Faulty goods can still be returned' },
  ];
}

// The draft only fills what is still empty or still a guess, and marks what it filled.
function initialForm(product, draft) {
  const fresh = draft?.version === 2 && !draft.applied_at ? draft : null;
  const unconfirmedReturns = Boolean(product.derived_fields?.returns_class);
  const specs = visibleSpecs(product.specifications, { max: 0 }).map(([key, value]) => ({ key, value }));
  // Her saved label first; else what Keepr read off the shop page or the photographs, for her to check and save.
  const hazard = product.hazard ?? null;
  const read = !hazard && product.derived_fields?.hazard_draft ? product.derived_fields.hazard_draft : null;

  const form = {
    title: product.title ?? '',
    price: asText(product.price),
    description: product.description ?? '',
    brand: product.brand ?? '',
    section: product.section || '',
    inTheBox: product.in_the_box ?? '',
    specs,
    returnsClass: product.returns_class ?? 'standard',
    returnsNote: product.returns_note ?? '',
    landedCost: asText(product.landed_cost),
    postageCost: asText(product.postage_cost),
    costNote: product.cost_note ?? '',
    stock: asText(product.stock),
    availability: product.availability ?? 'in_stock',
    hazardNone: false,
    signal: hazard?.signal ?? read?.signal ?? '',
    statements: (hazard?.h ?? read?.h ?? []).join('\n'),
    precautions: (hazard?.p ?? read?.p ?? []).join('\n'),
    pictograms: hazard?.pictograms ?? read?.pictograms ?? [],
    sds: product.safety_data_sheet_url ?? '',
    biocide: product.biocide_reg_no ?? read?.biocide_reg_no ?? '',
    answers: {},
  };
  const suggested = {};
  if (read) suggested.hazard = true;
  if (!fresh) return { form, suggested };

  const fill = (key, value) => {
    if (value === undefined || value === null || value === '' || same(value, form[key])) return;
    form[key] = value;
    suggested[key] = true;
  };

  // On sale already: a new title is offered, never swapped in quietly.
  if (product.status !== 'live') fill('title', fresh.titles?.search);
  if (!form.description.trim()) fill('description', fresh.description);
  if (!form.brand && fresh.brand?.real) fill('brand', fresh.brand.name);
  if (!form.inTheBox) fill('inTheBox', fresh.in_the_box);
  if (fresh.details?.length) fill('specs', fresh.details.map((d) => ({ key: d.name, value: d.value })));
  if (!product.section && fresh.section) fill('section', fresh.section);
  // Keepr's returns check outranks the drafting pass's guess: it is the one the release guard waits on.
  if (unconfirmedReturns && !product.derived_fields?.rules) fill('returnsClass', fresh.returns_class);
  return { form, suggested };
}

// Everything the sheet changed, as one row update. Throws in her words when a box cannot be saved.
function buildPatch(product, form, checks, draft) {
  const patch = {};
  const set = (column, value, current) => { if (!same(value, current)) patch[column] = value; };

  const title = form.title.trim();
  if (!title) throw new Error('A title is needed.');
  set('title', title, product.title);

  const price = money(form.price, 'Price');
  if (!(price > 0)) throw new Error('A price is needed.');
  set('price', price, Number(product.price));

  set('description', form.description.trim() || null, product.description?.trim() || null);
  set('brand', form.brand.trim() || null, product.brand || null);
  set('in_the_box', form.inTheBox.trim() || null, product.in_the_box || null);
  set('section', form.section || null, product.section || null);

  const pairs = {};
  for (const { key, value } of form.specs) {
    const k = String(key ?? '').trim();
    if (k) pairs[k] = String(value ?? '').trim();
  }
  const before = Object.fromEntries(visibleSpecs(product.specifications, { max: 0 }));
  if (!same(pairs, before)) patch.specifications = { ...hiddenSpecs(product.specifications), ...pairs };

  set('returns_class', form.returnsClass, product.returns_class ?? 'standard');
  set('returns_note', form.returnsNote.trim() || null, product.returns_note || null);

  const landed = money(form.landedCost, 'Cost');
  const postage = money(form.postageCost, 'Postage');
  const costNote = form.costNote.trim() || null;
  const costChanged = !same(landed, product.landed_cost ?? null) || !same(postage, product.postage_cost ?? null)
    || !same(costNote, product.cost_note || null);
  if (costChanged) {
    Object.assign(patch, { landed_cost: landed, postage_cost: postage, cost_note: costNote });
    // A date against an empty cost would say somebody checked when nobody did.
    patch.cost_updated_at = landed === null ? null : new Date().toISOString();
  }

  set('stock', whole(form.stock, 'Stock'), product.stock ?? null);
  set('availability', form.availability, product.availability ?? 'in_stock');

  const derived = { ...(product.derived_fields ?? {}) };
  // Saving the sheet is her approval of the returns class shown in it, and from then on Keepr leaves it alone.
  if (derived.returns_class || patch.returns_class) {
    delete derived.returns_class;
    derived.returns_by = 'her';
  }

  if (needsLabel(product) && (form.hazardNone || form.signal)) {
    delete derived.hazard_suspect;
    delete derived.hazard_draft;
    derived.hazard_checked = true;
    const lines = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);
    patch.hazard = form.hazardNone ? null : {
      signal: form.signal, h: lines(form.statements), p: lines(form.precautions), pictograms: form.pictograms,
    };
    patch.safety_data_sheet_url = form.sds.trim() || null;
    patch.biocide_reg_no = form.biocide.trim() || null;
  }

  if (checks) {
    derived.checks = {
      decide: checks.decide.map((q) => ({ ...q, answer: form.answers[q.id] ?? q.answer ?? null })),
      done: checks.done,
    };
  }
  if (draft?.version === 2 && !draft.applied_at) derived.draft = { ...draft, applied_at: new Date().toISOString() };

  if (!same(derived, product.derived_fields ?? {})) patch.derived_fields = derived;
  return patch;
}

// Unsaved edits survive a close and a reload, until they are saved or she starts again.
const keyOf = (id) => `ck:sheet:${id}`;
function readKept(id) {
  try { return JSON.parse(window.localStorage.getItem(keyOf(id)) ?? 'null'); } catch { return null; }
}
function writeKept(id, form, touched) {
  try {
    window.localStorage.setItem(keyOf(id), JSON.stringify({ form, touched: [...touched] }));
  } catch { /* storage off: edits still live for this visit */ }
}
function dropKept(id) {
  try { window.localStorage.removeItem(keyOf(id)); } catch { /* nothing kept */ }
}

export function ProductSheet({
  product, focus, onClose, catalogue, categories, categoryCount, fees, tenantId, returnDays, agent, keeper, onCreateSection,
}) {
  const { unpublish, saveSheet, saveImages, removeImage,
    addVariant, saveVariant, removeVariant, archive, unarchive } = catalogue;

  const draft = product.derived_fields?.draft ?? null;
  const checks = checksFor(product);
  const live = isLive(product);
  const archived = isArchived(product);
  const steps = Object.fromEntries(stepsFor(product).map((s) => [s.key, s]));

  const [kept] = useState(() => readKept(product.id));
  const start = useMemo(() => initialForm(product, draft), [product, draft]);
  const [form, setForm] = useState(() => {
    if (!kept?.touched?.length) return start.form;
    const out = { ...start.form };
    for (const k of kept.touched) if (k in kept.form) out[k] = kept.form[k];
    return out;
  });
  const touched = useRef(new Set(kept?.touched ?? []));
  const [restored, setRestored] = useState(Boolean(kept?.touched?.length));

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [saved, setSaved] = useState(null);
  const [askFailed, setAskFailed] = useState(null);
  const [naming, setNaming] = useState(null);
  const [arrived, setArrived] = useState(() => new Set());
  const [landed, setLanded] = useState(null);
  const job = keeper?.stateOf(product.id) ?? null;
  const reading = Boolean(job);
  const last = keeper?.lastFor(product.id);
  const readFailed = askFailed ?? (last?.state === 'failed' ? last.error : null);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState('');

  // A draft that lands while the sheet is open fills only the boxes she has not touched.
  const draftStamp = draft?.drafted_at ?? null;
  const seenStamp = useRef(draftStamp);
  useEffect(() => {
    if (draftStamp === seenStamp.current) return;
    seenStamp.current = draftStamp;
    const fresh = Object.keys(start.suggested).filter((k) => !touched.current.has(k));
    setForm((f) => {
      const next = { ...f };
      for (const k of fresh) next[k] = start.form[k];
      return next;
    });
    setArrived(new Set(fresh));
    setLanded({ questions: (draft?.decide ?? []).length });
    const t = setTimeout(() => setArrived(new Set()), 1800);
    return () => clearTimeout(t);
  }, [draftStamp, start, draft]);

  const change = (key, value) => {
    touched.current.add(key);
    setLanded(null);
    setForm((f) => {
      const next = { ...f, [key]: value };
      writeKept(product.id, next, touched.current);
      return next;
    });
  };

  const sections = useMemo(() => (categories ?? []).map((c) => ({ path: c.path, label: c.label })), [categories]);

  async function makeSection(name) {
    const clean = String(name ?? '').trim();
    if (!clean) return;
    setBusy(true);
    setFailed(null);
    try {
      const path = await onCreateSection(clean);
      change('section', path);
      setNaming(null);
    } catch (e) {
      setFailed(e?.message ?? 'The section was not made. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function askAgent() {
    setAskFailed(null);
    try { await keeper.ask([product.id], sections, { quiet: true }); } catch (e) { setAskFailed(e?.message ?? 'That did not start.'); }
  }

  // Keepr's returns and label check, for a draft that came from an approved card and has not been checked.
  const rules = product.derived_fields?.rules ?? null;
  const rulesWaiting = rulesUnchecked(product);
  const [checkingRules, setCheckingRules] = useState(false);
  const [rulesFailed, setRulesFailed] = useState(null);
  async function checkRules() {
    setCheckingRules(true);
    setRulesFailed(null);
    try { await catalogue.checkRules([product.id]); } catch (e) { setRulesFailed(`The check did not finish: ${e?.message ?? 'try again'}.`); } finally { setCheckingRules(false); }
  }
  // A check that lands while the sheet is open fills the label boxes she has not touched, as a draft does.
  const rulesStamp = rules?.at ?? null;
  const seenRules = useRef(rulesStamp);
  useEffect(() => {
    if (rulesStamp === seenRules.current) return;
    seenRules.current = rulesStamp;
    const fresh = initialForm(product, draft).form;
    const keys = ['signal', 'statements', 'precautions', 'pictograms', 'biocide', 'returnsClass'].filter((k) => !touched.current.has(k));
    setForm((f) => {
      const next = { ...f };
      for (const k of keys) next[k] = fresh[k];
      return next;
    });
    setArrived(new Set(keys));
    const t = setTimeout(() => setArrived(new Set()), 1800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesStamp]);
  const askedRules = useRef(false);
  useEffect(() => {
    if (askedRules.current || !rulesWaiting || !catalogue.checkRules) return;
    askedRules.current = true;
    checkRules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulesWaiting]);

  // The agent reads each product once, on first open, so the sheet arrives filled in.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || archived || draft?.version === 2 || job || !keeper) return;
    asked.current = true;
    askAgent();
  }, []);

  const closeRef = useRef(null);
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
    if (focus) document.getElementById(`sheet-${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focus]);

  let patch = null;
  let invalid = null;
  try { patch = buildPatch(product, form, checks, draft); } catch (e) { invalid = e.message; }
  const dirty = Boolean(patch && Object.keys(patch).length);
  const projected = patch ? { ...product, ...patch } : product;
  const stops = blockers(projected);

  async function save(goLive) {
    if (!patch) { setFailed(invalid); return; }
    setBusy(true);
    setFailed(null);
    setSaved(null);
    try {
      await saveSheet({ id: product.id, patch, goLive });
      dropKept(product.id);
      touched.current = new Set();
      setRestored(false);
      setSaved(goLive ? 'Saved and live on the shop' : 'Saved');
      setTimeout(() => setSaved(null), 4000);
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function run(fn, what) {
    setBusy(true);
    setFailed(null);
    try {
      await fn();
      if (what) { setSaved(what); setTimeout(() => setSaved(null), 4000); }
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function discardKept() {
    dropKept(product.id);
    touched.current = new Set();
    setForm(start.form);
    setRestored(false);
  }

  function answer(q, option) {
    change('answers', { ...form.answers, [q.id]: option });
    if (!q.detail) return;
    const at = form.specs.findIndex((s) => s.key.trim().toLowerCase() === q.detail.toLowerCase());
    change('specs', at === -1
      ? [...form.specs, { key: q.detail, value: option }]
      : form.specs.map((s, i) => (i === at ? { ...s, value: option } : s)));
  }

  const FILLABLE = ['title', 'description', 'specs', 'inTheBox', 'brand', 'section', 'returnsClass'];
  const by = (key) => {
    if (reading && FILLABLE.includes(key) && !touched.current.has(key)) {
      return <span className={styles.by} data-pending="">{agent}</span>;
    }
    return start.suggested[key] && !touched.current.has(key) ? <span className={styles.by}>{agent}</span> : null;
  };
  const fx = (key) => ({ 'data-arrived': arrived.has(key) || undefined });

  const titles = draft?.version === 2
    ? TITLE_KINDS.map((k) => ({ ...k, text: draft.titles?.[k.key] })).filter((t) => t.text)
    : [];
  const titleChoices = [...titles, { key: 'current', hint: 'As it is now', text: product.title }]
    .filter((t, i, all) => all.findIndex((x) => x.text === t.text) === i);

  const openAnswers = (checks?.decide ?? []).filter((q) => !(form.answers[q.id] ?? q.answer)).length;
  const labelOf = (path) => (categories ?? []).find((c) => c.path === path)?.label ?? null;
  const placedLabel = labelOf(form.section) ?? form.section;
  // Her section names only; eBay's category words never reach her screens.
  const shelfLabel = labelOf(product.section) ?? 'Odds and ends';
  const thin = form.section && categoryCount > 0 && categoryCount < CATEGORY_MIN;
  const suggestedSection = !form.section && draft?.version === 2 && draft.new_section
    && !(categories ?? []).some((c) => c.label.toLowerCase() === draft.new_section.toLowerCase()) ? draft.new_section : null;
  const returns = returnsOptions(returnDays);

  const groups = [
    {
      name: 'What it is',
      items: [
        { key: 'photo', title: 'Photographs', body: (
          <ProductImages tenantId={tenantId} productId={product.id} images={product.images ?? []} disabled={busy}
            onChange={(images) => run(() => saveImages({ id: product.id, images }), 'Photographs saved')}
            onRemove={(url) => run(() => removeImage({ id: product.id, url }), 'Photograph removed')} />
        ) },
        { key: 'title', title: 'Title', body: (
          <div className={row.panel}>
            {titleChoices.length > 1 && (
              <div className={row.choices} role="radiogroup" aria-label="Title options">
                {titleChoices.map((t) => (
                  <label key={t.key} className={row.choice} data-on={form.title === t.text || undefined}>
                    <input type="radio" name={`title-${product.id}`} checked={form.title === t.text}
                      onChange={() => change('title', t.text)} />
                    <span>
                      <span className={row.choiceLabel}>{t.text}</span>
                      <span className={row.choiceHint}>{t.hint}, <span data-num>{t.text.length}</span> characters</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <label className={row.field} {...fx('title')}>
              <span className={row.split}>
                <span className={row.label}>Title{by('title')}</span>
                <span className={row.count} data-num data-over={form.title.trim().length > 80 || undefined}>{form.title.trim().length}/80</span>
              </span>
              <textarea className={row.textarea} rows={2} value={form.title} onChange={(e) => change('title', e.target.value)} />
            </label>
            <p className={row.slug} data-num>/p/{product.slug}</p>
          </div>
        ) },
        { key: 'description', title: 'Description', body: (
          <DescriptionPanel value={form.description} onChange={(v) => change('description', v)}
            badge={by('description')} arrived={arrived.has('description')} agent={agent} sourceText={product.source_description}
            alternative={draft?.version === 2 && !draft.applied_at && product.description?.trim()
              && draft.description !== form.description ? draft.description : null}
            onUseAlternative={() => change('description', draft.description)} />
        ) },
        { key: 'details', title: 'Details', body: (
          <div className={row.panel}>
            <span className={row.label}>Listed under the description{by('specs')}</span>
            <ul className={row.specs} {...fx('specs')}>
              {form.specs.map((s, i) => (
                <li key={i} className={row.spec}>
                  <input className={row.input} value={s.key} placeholder="Capacity" aria-label="Detail name"
                    onChange={(e) => change('specs', form.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
                  <input className={row.input} value={s.value} placeholder="4.7 litres" aria-label="Detail value"
                    onChange={(e) => change('specs', form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className={row.dropRow} aria-label="Remove this detail"
                    onClick={() => change('specs', form.specs.filter((_, j) => j !== i))}>
                    <Icon name="IconX" width="14" height="14" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={row.ghost} onClick={() => change('specs', [...form.specs, { key: '', value: '' }])}>
              <Icon name="IconPlus" width="14" height="14" /> Add a detail
            </button>
            <div className={row.pair}>
              <label className={row.field} {...fx('inTheBox')}>
                <span className={row.label}>What is in the box{by('inTheBox')}</span>
                <input className={row.input} value={form.inTheBox} onChange={(e) => change('inTheBox', e.target.value)} />
              </label>
              <label className={row.field} {...fx('brand')}>
                <span className={row.label}>Brand{by('brand')}</span>
                <input className={row.input} value={form.brand} onChange={(e) => change('brand', e.target.value)}
                  placeholder="Leave empty if it has none" autoComplete="off" />
              </label>
            </div>
          </div>
        ) },
      ],
    },
    {
      name: 'Selling it',
      items: [
        { key: 'price', title: 'Price and options', body: (
          <div className={row.panel}>
            <label className={row.field}>
              <span className={row.label}>Price</span>
              <span className={row.control}>
                <span className={row.affix} aria-hidden="true">£</span>
                <input className={row.bare} data-num inputMode="decimal" value={form.price} onChange={(e) => change('price', e.target.value)} />
              </span>
            </label>
            <FloorNote price={form.price} postageCost={form.postageCost} fees={fees} />
            <VariantsPanel product={product} busy={busy} run={run} onAdd={addVariant} onSave={saveVariant} onRemove={removeVariant} />
          </div>
        ) },
        { key: 'cost', title: 'What it costs you', body: (
          <div className={row.panel}>
            <div className={row.pair}>
              <label className={row.field}>
                <span className={row.label}>Cost of one, landed</span>
                <span className={row.control}>
                  <span className={row.affix} aria-hidden="true">£</span>
                  <input className={row.bare} data-num inputMode="decimal" placeholder="0.00"
                    value={form.landedCost} onChange={(e) => change('landedCost', e.target.value)} />
                </span>
                <span className={row.hint}>Goods, freight and duty, on a repeat order</span>
              </label>
              <label className={row.field}>
                <span className={row.label}>Postage you pay</span>
                <span className={row.control}>
                  <span className={row.affix} aria-hidden="true">£</span>
                  <input className={row.bare} data-num inputMode="decimal" placeholder="0.00"
                    value={form.postageCost} onChange={(e) => change('postageCost', e.target.value)} />
                </span>
                <span className={row.hint}>Including packaging</span>
              </label>
            </div>
            <Split price={form.price} landedCost={form.landedCost} postageCost={form.postageCost} fees={fees} />
            <label className={row.field}>
              <span className={row.label}>Where the price came from</span>
              <input className={row.input} value={form.costNote} onChange={(e) => change('costNote', e.target.value)}
                placeholder="Supplier and date, so it can be checked later" />
            </label>
          </div>
        ) },
        { key: 'stock', title: 'How many', body: (
          <div className={row.pair}>
            <label className={row.field}>
              <span className={row.label}>On your shop</span>
              <input className={row.input} data-num value={form.stock} inputMode="numeric"
                placeholder="Untracked" onChange={(e) => change('stock', e.target.value)} />
              <span className={row.hint}>
                {form.stock === '' ? 'Stays on sale however many sell' : 'Counts down as orders are paid. Off sale at zero. eBay keeps its own count'}
              </span>
            </label>
            <label className={row.field}>
              <span className={row.label}>On sale</span>
              <select className={row.input} value={form.availability} onChange={(e) => change('availability', e.target.value)}>
                <option value="in_stock">Yes</option>
                <option value="out_of_stock">Out of stock for now</option>
                <option value="discontinued">Not selling it again</option>
              </select>
            </label>
          </div>
        ) },
        { key: 'section', title: 'Where it sits', body: (
          <div className={row.panel}>
            {thin && (
              <p className={row.thin}>
                {placedLabel} has <span data-num>{categoryCount}</span> live {categoryCount === 1 ? 'product' : 'products'}.
                It needs {CATEGORY_MIN} to get its own section on the shop; until then these sit in Odds and ends.
              </p>
            )}
            {suggestedSection && (
              <div className={row.draft}>
                <p className={row.draftBody}>
                  None of your sections fits this. {agent} suggests a new one: <strong>{suggestedSection}</strong>.
                </p>
                <button type="button" className={row.ghost} disabled={busy} onClick={() => makeSection(suggestedSection)}>
                  Create it and put this here
                </button>
              </div>
            )}
            <label className={row.field} {...fx('section')}>
              <span className={row.label}>Section{by('section')}</span>
              <select className={row.input} value={form.section} onChange={(e) => {
                if (e.target.value === NEW_SECTION) setNaming(''); else change('section', e.target.value);
              }}>
                <option value="">Odds and ends</option>
                {(categories ?? []).map((c) => <option key={c.path} value={c.path}>{c.label}</option>)}
                <option value={NEW_SECTION}>New section…</option>
              </select>
              <span className={row.hint}>Where it shows on your shop. Its eBay category stays for Google.</span>
            </label>
            {naming !== null && (
              <form className={row.variantAdd} onSubmit={(e) => { e.preventDefault(); makeSection(naming); }}>
                <label className={row.field}>
                  <span className={row.label}>New section name</span>
                  <input className={row.input} value={naming} autoFocus onChange={(e) => setNaming(e.target.value)}
                    placeholder="Kitchen and dining" onKeyDown={(e) => { if (e.key === 'Escape') setNaming(null); }} />
                </label>
                <button type="submit" className={row.ghost} disabled={busy || !naming.trim()}>Create</button>
              </form>
            )}
          </div>
        ) },
      ],
    },
    {
      name: 'The rules',
      items: [
        { key: 'returns', title: 'Returns', body: (
          <div className={row.panel}>
            {by('returnsClass') && draft?.returns_reason && !rules && <p className={row.guessed}>{draft.returns_reason}</p>}
            {by('returnsClass') && !rules && <span className={row.label}>Suggested{by('returnsClass')}</span>}
            {rules && product.derived_fields?.returns_class && (
              <p className={row.guessed}>{agent} suggests {RETURNS_WORD[rules.returns]}: {rules.returns_reason} Choose and save to confirm it.</p>
            )}
            {rules && !product.derived_fields?.returns_class && product.derived_fields?.returns_by !== 'her' && (
              <p className={row.hint}>{agent} checked it: {rules.returns_reason} Standard returns apply, so nothing to confirm.</p>
            )}
            {rulesWaiting && (
              <p className={row.guessed}>
                {checkingRules ? `${agent} is checking the returns and any label warning.` : rulesFailed ?? `${agent} has not checked the returns or the label yet.`}
                {!checkingRules && <> <button type="button" className={row.link} onClick={checkRules}>Check now</button></>}
              </p>
            )}
            <div className={row.choices} role="radiogroup" aria-label="Returns" {...fx('returnsClass')}>
              {returns.map((r) => (
                <label key={r.value} className={row.choice} data-on={form.returnsClass === r.value || undefined}>
                  <input type="radio" name={`returns-${product.id}`} value={r.value}
                    checked={form.returnsClass === r.value} onChange={() => change('returnsClass', r.value)} />
                  <span>
                    <span className={row.choiceLabel}>{r.label}</span>
                    <span className={row.choiceHint}>{r.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {!returnDays && <p className={row.hint}>Set how many days in Settings, under Returns.</p>}
            <label className={row.field}>
              <span className={row.label}>Anything to add, optional</span>
              <input className={row.input} value={form.returnsNote} onChange={(e) => change('returnsNote', e.target.value)} />
            </label>
          </div>
        ) },
        needsLabel(product) && { key: 'hazard', title: 'Label warning', body: (
          <div className={row.panel}>
            <p className={row.guessed}>
              If the bottle has a warning label, the shop has to show the same warning next to the price.
              {product.derived_fields?.hazard_draft && !product.hazard
                ? ` ${agent} read this from ${product.derived_fields?.hazard_draft?.read_from ?? 'the product facts'}. Check it against the bottle, then save.`
                : ' Copy across what is printed on it.'}
            </p>
            {rules?.chemical_reason && <p className={row.hint}>{rules.chemical_reason}</p>}
            <label className={row.check}>
              <input type="checkbox" checked={form.hazardNone} onChange={(e) => change('hazardNone', e.target.checked)} />
              <span>No warning label on this bottle. I have checked.</span>
            </label>
            {!form.hazardNone && (
              <>
                <label className={row.field}>
                  <span className={row.label}>Signal word</span>
                  <select className={row.input} value={form.signal} onChange={(e) => change('signal', e.target.value)}>
                    <option value="">Choose one</option>
                    <option value="Warning">Warning</option>
                    <option value="Danger">Danger</option>
                  </select>
                </label>
                <div className={row.field}>
                  <span className={row.label}>Symbols on the label</span>
                  <div className={row.symbols} role="group" aria-label="Symbols on the label">
                    {PICTOGRAMS.map(([code, name]) => (
                      <label key={code} className={row.check}>
                        <input type="checkbox" checked={form.pictograms.includes(code)}
                          onChange={(e) => change('pictograms', e.target.checked ? [...form.pictograms, code] : form.pictograms.filter((c) => c !== code))} />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className={row.field}>
                  <span className={row.label}>Warnings, one per line</span>
                  <textarea className={row.textarea} rows={4} value={form.statements}
                    onChange={(e) => change('statements', e.target.value)} placeholder="H315 Causes skin irritation" />
                </label>
                <label className={row.field}>
                  <span className={row.label}>Precautions, one per line</span>
                  <textarea className={row.textarea} rows={3} value={form.precautions}
                    onChange={(e) => change('precautions', e.target.value)} placeholder="P102 Keep out of reach of children." />
                </label>
                <div className={row.pair}>
                  <label className={row.field}>
                    <span className={row.label}>Safety data sheet link</span>
                    <input className={row.input} type="url" value={form.sds} onChange={(e) => change('sds', e.target.value)} placeholder="https://" />
                  </label>
                  <label className={row.field}>
                    <span className={row.label}>HSE number</span>
                    <input className={row.input} value={form.biocide} onChange={(e) => change('biocide', e.target.value)} />
                    <span className={row.hint}>On pest killers and disinfectants, printed on the label</span>
                  </label>
                </div>
              </>
            )}
          </div>
        ) },
      ].filter(Boolean),
    },
    (checks?.decide.length || checks?.done.length) && {
      name: 'The checks',
      items: [
        { key: 'checks', title: checks?.decide.length ? 'Decide' : 'Done for you',
          note: openAnswers ? `${openAnswers} to answer` : 'All answered', body: (
          <ChecksPanel checks={checks} answers={form.answers} onAnswer={answer} agent={agent} />
        ) },
      ],
    },
  ].filter(Boolean);

  const chips = groups.flatMap((g) => g.items);
  const headState = archived ? 'archived' : live ? 'live' : isBlocked(product) ? 'blocked' : isNeedsYou(product) ? 'question' : 'ready';
  const markOf = (key) => {
    if (key === 'checks') return openAnswers ? 'wait' : 'done';
    return steps[key]?.state ?? 'none';
  };
  const jump = (key) => document.getElementById(`sheet-${key}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  const status = failed ? <span className={styles.failed}>{failed}</span>
    : saved ? <span className={styles.saved}><Icon name="IconCheck" width="14" height="14" />{saved}</span>
      : reading ? <span>{agent} is reading this product. The marked boxes fill in when it is done.</span>
        : landed && landed.questions > 0 ? (
          <span>
            {agent} filled it in. {landed.questions === 1 ? '1 question' : `${landed.questions} questions`} for you.
            <button type="button" className={styles.again} onClick={() => jump('checks')}>Go to it</button>
          </span>
        )
        : landed ? <span>{agent} filled it in. Read it over and save.</span>
        : invalid && dirty === false ? <span className={styles.failed}>{invalid}</span>
          : !live && !archived && stops.length ? <span>Before it can go live: {stops.join(', ').toLowerCase()}</span>
            : dirty ? <span>Not saved yet</span> : null;

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
                <span className={styles.state} data-state={headState}>
                  <i aria-hidden="true" />
                  {HEAD_LABEL[headState]}
                </span>
                <span className={styles.where}>{shelfLabel}</span>
                {!archived && !reading && keeper && (
                  <button type="button" className={styles.again} onClick={askAgent}>Ask {agent} again</button>
                )}
              </p>
              {readFailed && !reading && <p className={styles.failedLine}>{agent} could not fill it in: {readFailed}</p>}
            </div>
            <span className={styles.price} data-num>{formatGbp(product.price)}</span>
          </div>
          <nav className={styles.steps} aria-label="Sections">
            {chips.map((c) => (
              <button key={c.key} type="button" className={styles.step} data-state={markOf(c.key)} onClick={() => jump(c.key)}>
                <StepMark state={markOf(c.key)} size="sm" />
                <span>{c.title}</span>
              </button>
            ))}
          </nav>
        </header>

        <div className={styles.body}>
          {restored && (
            <p className={styles.restored}>
              Your unsaved changes from last time are back.
              <button type="button" className={styles.again} onClick={discardKept}>Start again</button>
            </p>
          )}

          {groups.map((g) => (
            <div key={g.name} className={styles.group}>
              <h3 className={styles.groupName}>{g.name}</h3>
              {g.items.map((s) => {
                const mark = markOf(s.key);
                return (
                  <section key={s.key} id={`sheet-${s.key}`} className={styles.section}
                    data-open={mark === 'missing' || mark === 'check' || mark === 'wait' || undefined}
                    data-focus={focus === s.key || undefined}>
                    <header className={styles.sectionHead}>
                      <StepMark state={mark === 'none' ? 'done' : mark} />
                      <h4 className={styles.sectionTitle}>{s.title}</h4>
                      <span className={styles.sectionNote}>{s.note ?? steps[s.key]?.note}</span>
                    </header>
                    <div className={styles.sectionBody}>{s.body}</div>
                  </section>
                );
              })}
            </div>
          ))}

          {/* Not a delete: an order still points at this row. */}
          <section className={`${styles.section} ${styles.archive}`}>
            <header className={styles.sectionHead}>
              <span className={styles.archiveIcon} aria-hidden="true"><Icon name="IconBox" width="16" height="16" /></span>
              <h4 className={styles.sectionTitle}>{archived ? 'Archived' : 'Stop selling this'}</h4>
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
          <p className={styles.status} role="status" aria-live="polite">{status}</p>
          {live && (
            <>
              <button type="button" className={styles.quiet} disabled={busy}
                onClick={() => run(() => unpublish([product.id]), 'Taken off the shop')}>
                Take off the shop
              </button>
              <button type="button" className={styles.go} disabled={busy || !dirty} onClick={() => save(false)}>Save</button>
            </>
          )}
          {!live && !archived && (
            <>
              <button type="button" className={styles.quiet} disabled={busy || !dirty} onClick={() => save(false)}>Save</button>
              <button type="button" className={styles.go} disabled={busy || reading || !patch || stops.length > 0}
                onClick={() => save(true)}>
                {dirty ? 'Save and take live' : 'Take live'}
              </button>
            </>
          )}
          {archived && (
            <button type="button" className={styles.quiet} disabled={busy || !dirty} onClick={() => save(false)}>Save</button>
          )}
        </footer>
      </aside>
    </>
  );
}

// A quiet note, never a block: under the floor the shop rarely covers a unit once fees and postage are paid.
function FloorNote({ price, postageCost, fees }) {
  const m = marginFor({ price, landedCost: 0, postageCost, fees });
  if (!m || m.store.net >= PRICE_FLOOR) return null;
  const withPostage = Number(postageCost) > 0;
  return (
    <p className={row.thin}>
      After the shop&apos;s fee{withPostage ? ' and your postage' : ''}, <span data-num>{formatGbp(m.store.net)}</span> is left
      for the goods and you. Under <span data-num>{formatGbp(PRICE_FLOOR)}</span> a sale rarely pays for itself.
    </p>
  );
}

// Where the price goes on each channel, redrawn as she types. Nothing is drawn until there is a cost to draw.
function Split({ price, landedCost, postageCost, fees }) {
  const p = Number(price);
  const known = String(landedCost).trim() !== '' && Number.isFinite(Number(landedCost));
  if (!(p > 0) || !known) {
    return <p className={row.hint}>Add what one costs you and this shows what each sale leaves you, on each channel.</p>;
  }
  const m = marginFor({ price, landedCost, postageCost, fees });
  if (!m) return null;
  const post = Number(postageCost) || 0;
  const cost = Number(landedCost);
  const pct = (v) => `${Math.max(0, (v / p) * 100)}%`;
  const rows = [['Your shop', m.store], ['eBay', m.ebay], ['TikTok Shop', m.tiktok]];

  return (
    <div className={styles.split}>
      {rows.map(([label, v]) => (
        <div key={label} className={styles.splitRow}>
          <span className={styles.splitName}>{label}</span>
          <span className={styles.splitBar} role="img"
            aria-label={`${label}: fees ${formatGbp(v.fee)}, postage ${formatGbp(post)}, goods ${formatGbp(cost)}, you keep ${formatGbp(v.net)}`}>
            <span className={styles.segFee} style={{ width: pct(v.fee) }} />
            {post > 0 && <span className={styles.segPost} style={{ width: pct(post) }} />}
            <span className={styles.segGoods} style={{ width: pct(cost) }} />
            {v.net > 0 && <span className={styles.segKeep} style={{ flex: 1 }} />}
          </span>
          <span className={styles.splitFigure}>
            <strong data-num data-bad={v.net <= 0 || undefined}>{formatGbp(v.net)}</strong>
            <small>you keep, <span data-num>{v.pct}%</span></small>
          </span>
        </div>
      ))}
      <p className={styles.key}>
        <span><i className={styles.segFee} />Fees</span>
        {post > 0 && <span><i className={styles.segPost} />Postage</span>}
        <span><i className={styles.segGoods} />The goods</span>
        <span><i className={styles.segKeep} />You keep</span>
      </p>
      {post === 0 && <p className={row.hint}>No postage entered, so these figures are higher than a real sale.</p>}
    </div>
  );
}
