import { checksFor, openDecisions, needsLabel, isLive } from '@hooks/useCatalogue';
import { formatGbp } from '@utils/formatGbp';

// Gate steps mirror blockers() in useCatalogue. Change both together.
export const STEPS = [
  { key: 'photo', label: 'Photos', gate: true },
  { key: 'price', label: 'Price', gate: true },
  { key: 'returns', label: 'Returns', gate: true },
  { key: 'checks', label: 'Checks', gate: true },
  { key: 'hazard', label: 'Hazard', gate: true, flagged: true },
  { key: 'stock', label: 'Stock', gate: true },
  { key: 'description', label: 'Description', short: 'Text' },
  { key: 'section', label: 'Section' },
  { key: 'cost', label: 'Cost' },
];

const RETURNS_LABEL = { standard: 'Standard', sealed: 'Sealed only', none: 'No return' };

const leaf = (path) => String(path ?? '').split('|').pop()?.trim() || null;

function unsellable(p) {
  if (p.availability === 'out_of_stock') return 'Marked out of stock for now';
  if (p.availability === 'discontinued') return 'Marked as not selling again';
  const variants = p.store_variants ?? [];
  if (variants.length) {
    const sellable = variants.filter((v) => v.availability !== 'out_of_stock'
      && v.availability !== 'discontinued'
      && !(typeof v.stock === 'number' && v.stock <= 0));
    return sellable.length ? null : 'Every option is out';
  }
  return typeof p.stock === 'number' && p.stock <= 0 ? 'None left' : null;
}

function judge(key, p) {
  switch (key) {
    case 'photo': {
      const n = (p.images ?? []).length || (p.image_url ? 1 : 0);
      return p.image_url
        ? { state: 'done', note: `${n} ${n === 1 ? 'photograph' : 'photographs'}` }
        : { state: 'missing', note: 'No photograph. Nothing goes live without one.' };
    }
    case 'price':
      return Number(p.price) > 0
        ? { state: 'done', note: formatGbp(p.price) }
        : { state: 'missing', note: 'No price.' };
    case 'returns':
      return p.derived_fields?.returns_class
        ? { state: 'wait', note: `Guessed as ${RETURNS_LABEL[p.returns_class] ?? 'Standard'}. Confirm it.` }
        : { state: 'done', note: RETURNS_LABEL[p.returns_class] ?? 'Standard' };
    case 'checks': {
      const c = checksFor(p);
      const open = openDecisions(p);
      if (!c?.decide.length) return { state: 'done', note: c?.done.length ? 'Fixed for you' : 'Nothing to decide' };
      if (!open) return { state: 'done', note: 'Decided' };
      // A question for her is waiting on her, never a failure.
      return isLive(p)
        ? { state: 'wait', note: `${open} new to decide` }
        : { state: 'wait', note: `${open} to decide before it sells` };
    }
    case 'hazard':
      if (!needsLabel(p)) return { state: 'none', note: 'Not a chemical' };
      return p.hazard
        ? { state: 'done', note: `Label warning: ${p.hazard.signal}` }
        : { state: 'missing', note: 'Looks like a chemical. Copy the label warning across.' };
    case 'stock': {
      const why = unsellable(p);
      if (why) return { state: 'missing', note: why };
      return typeof p.stock === 'number'
        ? { state: 'done', note: `${p.stock} in stock` }
        : { state: 'done', note: 'Untracked, always on sale' };
    }
    case 'description':
      if (p.description?.trim()) return { state: 'done', note: 'Written' };
      return p.derived_fields?.draft
        ? { state: 'wait', note: 'Written for you. Read it and save.' }
        : { state: 'missing', note: 'No description. Google will not list it without one.' };
    case 'section':
      if (p.section) return { state: 'done', note: 'Placed by you' };
      return p.category_path
        ? { state: 'done', note: leaf(p.category_path) }
        : { state: 'missing', note: 'Not in a section, so it sits in Everything else.' };
    case 'cost':
      return p.landed_cost === null || p.landed_cost === undefined
        ? { state: 'missing', note: 'No cost yet, so nothing can say what a sale earns.' }
        : { state: 'done', note: `${formatGbp(p.landed_cost)} landed` };
    default:
      return { state: 'none', note: '' };
  }
}

export function stepsFor(product, steps = STEPS) {
  return steps.map((s) => ({ ...s, ...judge(s.key, product) }));
}

// The hazard column only exists when something in the catalogue is flagged.
export function columnsFor(rows) {
  const flagged = rows.some(needsLabel);
  return STEPS.filter((s) => !s.flagged || flagged);
}

export const isOpen = (state) => state === 'missing' || state === 'wait' || state === 'check';

// Catalogue totals and the one gap worth doing next. A gate step on a draft beats a bigger gap on something live.
export function summarise(rows) {
  const columns = columnsFor(rows);
  const out = { done: 0, wait: 0, check: 0, missing: 0, total: 0, gap: null };
  const byStep = Object.fromEntries(columns.map((c) => [c.key, { ...c, open: 0, first: null, firstLive: null }]));
  for (const r of rows) {
    for (const s of stepsFor(r, columns)) {
      if (s.state === 'none') continue;
      out[s.state] += 1;
      out.total += 1;
      if (s.state === 'done') continue;
      const b = byStep[s.key];
      b.open += 1;
      if (!isLive(r) && !b.first) b.first = r.id;
      if (!b.firstLive) b.firstLive = r.id;
    }
  }
  const steps = Object.values(byStep);
  const blocking = steps.find((b) => b.gate && b.first);
  const widest = [...steps].sort((a, b) => b.open - a.open)[0];
  if (blocking) out.gap = { key: blocking.key, label: blocking.label, open: blocking.open, id: blocking.first };
  else if (widest?.open) out.gap = { key: widest.key, label: widest.label, open: widest.open, id: widest.firstLive };
  return out;
}
