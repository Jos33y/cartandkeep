// Is an eBay listing the product she sends? A first reading from the titles and barcodes, before Keepr looks. It
// ranks which listings are worth Keepr's time and catches what no wording can overrule: two different barcodes, two
// different model numbers, two different pack sizes.

type Side = { title?: string | null; brand?: string | null; gtin?: string | null };

const squash = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const COUNT_WORDS = 's|pk|pack|packs|sticks|chews|bars|washes|pods|capsules|caps|tablets|tabs|piece|pieces|pcs|count|ct|sachets|pouches|trays|tins|rolls|wipes|pads|bags|servings';
const COUNT = new RegExp(`\\bx\\s?(\\d+)\\b|\\b(\\d+)\\s?(?:${COUNT_WORDS})\\b|\\bpack of (\\d+)\\b|^(\\d+)\\s`, 'gi');
const WEIGHT = /\b(\d+(?:\.\d+)?)\s?(kg|g|ml|l|litre|litres)\b/gi;

// The pack a title states, when it states exactly one. The same rule the research uses (scripts/lib/row.js).
export function packOf(title: unknown): { kind: 'count' | 'weight'; n: number } | null {
  if (!title) return null;
  const t = String(title);
  if (/\d+\s?x\s?\d+/i.test(t)) return null;
  const counts = [...t.matchAll(COUNT)].map((m) => Number(m[1] ?? m[2] ?? m[3] ?? m[4])).filter((n) => n > 1);
  if (counts.length > 1) return null;
  const weights = [...new Set([...t.matchAll(WEIGHT)].map((m) => {
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    return u === 'kg' || u.startsWith('l') ? n * 1000 : n;
  }))];
  if (counts.length === 1 && weights.length <= 1) return { kind: 'count', n: counts[0] };
  if (!counts.length && weights.length === 1) return { kind: 'weight', n: weights[0] };
  return null;
}

const SIZE_TOKEN = /^\d+(\.\d+)?(ml|l|ltr|g|kg|mg|w|v|a|m|mm|cm|in|pc|pcs|pk|x|oz|lb|ft|kw|mah|gb|tb|p)$/;

// Model numbers: letters and digits together, or a long run of digits, that is not a size. "MG 16" reads as mg16.
export function modelsIn(text: unknown): string[] {
  const t = String(text ?? '').toLowerCase();
  const out = new Set<string>();
  for (const w of t.split(/[^a-z0-9]+/)) {
    if (w.length >= 4 && /\d/.test(w) && (/[a-z]/.test(w) || /^\d{4,}$/.test(w)) && !SIZE_TOKEN.test(w) && !/^(19|20)\d\d$/.test(w)) out.add(w);
  }
  // Spaced codes only in capitals, as makers print them ("MG 16", "WBP 1"): "gun 2" and "pods 40" are words.
  for (const m of String(text ?? '').matchAll(/\b([A-Z]{1,4})[\s-](\d{1,5}[A-Za-z]{0,2})\b/g)) {
    if (/^(X|NO|OF|PK|SET|PACK)$/.test(m[1])) continue;
    const code = `${m[1]}${m[2]}`.toLowerCase();
    if (code.length >= 3 && !SIZE_TOKEN.test(code) && !SIZE_TOKEN.test(m[2].toLowerCase())) out.add(code);
  }
  return [...out];
}

const STOP = new Set(['the', 'and', 'for', 'with', 'new', 'pack', 'set', 'from', 'uk', 'free', 'fast', 'post', 'delivery', 'genuine', 'brand', 'boxed']);
const words = (t: unknown) => new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));

const barcode = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 14 ? d.replace(/^0+/, '') : null;
};

export type Reading = { score: number; via: string; rules_out: boolean };

/*
 * 0 to 1. A shared barcode settles it. Otherwise the brand has to be on both, model numbers and packs have to agree
 * where both state one, and the rest of the words carry what is left. `rules_out` is a fact that no judgement can
 * outweigh, so Keepr never swaps through it.
 */
export function matchScore(a: Side, b: Side): Reading {
  const ga = barcode(a.gtin);
  const gb = barcode(b.gtin);
  if (ga && gb) return ga === gb ? { score: 1, via: 'same barcode', rules_out: false } : { score: 0, via: 'different barcodes', rules_out: true };

  const ta = String(a.title ?? '');
  const tb = String(b.title ?? '');
  const ma = modelsIn(ta);
  const mb = modelsIn(tb);
  if (ma.length && mb.length && !ma.some((m) => mb.includes(m))) {
    return { score: 0.1, via: `model ${ma[0]} against ${mb[0]}`, rules_out: true };
  }
  const pa = packOf(ta);
  const pb = packOf(tb);
  if (pa && pb && pa.kind === pb.kind && pa.n !== pb.n) {
    return { score: 0.2, via: `pack of ${pa.n} against ${pb.n}`, rules_out: true };
  }

  const brand = squash(a.brand) || squash(ta.split(/\s+/)[0]);
  const brandOn = brand.length >= 3 && (squash(tb).includes(brand) || squash(b.brand) === brand);
  const wa = words(ta);
  const wb = words(tb);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  const overlap = wa.size ? shared / Math.min(wa.size, Math.max(wb.size, 1)) : 0;
  const model = ma.some((m) => mb.includes(m));

  if (brandOn && model) return { score: pa && pb ? 0.9 : 0.85, via: 'brand and model', rules_out: false };
  if (brandOn) return { score: Math.round((0.4 + 0.4 * overlap) * 100) / 100, via: 'brand and words', rules_out: false };
  if (brand.length >= 3 && squash(b.brand) && squash(b.brand) !== brand) {
    return { score: 0.15, via: 'another brand', rules_out: false };
  }
  return { score: Math.round(0.6 * overlap * 100) / 100, via: 'words only', rules_out: false };
}
