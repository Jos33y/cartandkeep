// The parcel a card goes out in, from what her Amazon supplier's page says (Joseey, 4 October): the size and the
// weight, so postage is worked out from the real box rather than the postage band's. Used by Keeper when it gets a
// card ready (keeper-run/ready.ts).
//
// In order of trust:
//   1. Amazon's package: "Package Dimensions: 30 x 20 x 10 cm; 1.2 kg", "Package Weight: 1.2 Kilograms". Already the
//      box it ships in, so taken as it is, rounded up.
//   2. Amazon's product: "Product Dimensions" or "Item dimensions L x W x H", and "Item Weight". The product alone, so
//      2cm is added to each measure and the weight is packed (packedKg: 15% more, at least 50g, up to the next 50g).
//   3. The page's own words (bullets and description): a size or a weight written with its unit. Packed the same way.
// The table's figure wins over the words when both are there; a big difference is noted, never a stop.

import { packedKg, weightKg } from './amazon-source.ts';

type Json = Record<string, any>;

export type Parcel = {
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  // Where the size and the weight came from, in her words: "From Amazon's package: 30 x 20 x 10cm, 1.2kg".
  from: string;
  size_from: 'package' | 'product' | 'words' | null;
  weight_from: 'package' | 'product' | 'words' | null;
  note: string | null;
};

const N = String.raw`(\d+(?:[.,]\d+)?)`;
// Longest first, so "mm" is not read as "m" and "centimetres" not as "cm" left over.
const U = String.raw`(centimetres?|centimeters?|millimetres?|millimeters?|metres?|meters?|inches|inch|cm|mm|in|m|")`;
const X = String.raw`\s*(?:x|×|\*)\s*`;
const SIZE = new RegExp(`${N}\\s*${U}?${X}${N}\\s*${U}?${X}${N}\\s*${U}?(?![a-z])`, 'i');

const toCm = (n: number, unit: string | undefined) => {
  const u = String(unit ?? 'cm').toLowerCase();
  if (/^(mm|millimet)/.test(u)) return n / 10;
  if (/^(in|inch|")/.test(u)) return n * 2.54;
  if (/^(m|met)/.test(u) && !/^mm/.test(u)) return n * 100;
  return n;
};

/*
 * Three measures read from a piece of text, in centimetres, longest first. The unit is the one written after any of
 * them (Amazon writes it once at the end: "30 x 20 x 10 cm"). `needUnit` refuses three bare numbers, for the page's
 * own words, where "2 x 3 x 4" can be a count.
 */
export function sizeOf(text: unknown, { needUnit = false } = {}): [number, number, number] | null {
  const m = SIZE.exec(String(text ?? ''));
  if (!m) return null;
  const unit = m[6] ?? m[4] ?? m[2];
  if (needUnit && !unit) return null;
  // In running words a bare "in" is more often the word than inches: "2 x 3 x 4 in the box".
  if (needUnit && /^in$/i.test(unit)) return null;
  const dims = [m[1], m[3], m[5]].map((v, i) => toCm(Number(v.replace(',', '.')), [m[2], m[4], m[6]][i] ?? unit));
  if (dims.some((d) => !(d >= 0.1 && d <= 300))) return null;
  return dims.sort((a, b) => b - a) as [number, number, number];
}

// A details line's key and value: "Package Dimensions: 30 x 20 x 10 cm; 1.2 kg".
const split = (line: string) => {
  const i = line.indexOf(':');
  return i < 0 ? null : { key: line.slice(0, i).trim().toLowerCase(), value: line.slice(i + 1).trim() };
};

const upCm = (cm: number) => Math.ceil(Math.round(cm * 1000) / 1000);
// A package weight is taken as the box weighs, rounded up to the next 50g (the same steps packedKg uses).
const up50 = (kg: number) => Math.ceil(Math.round(kg * 20 * 1e6) / 1e6) / 20;
const sane = (kg: number | null) => (kg != null && kg > 0 && kg <= 70 ? kg : null);

// A weight in the page's own words: "Weight: 2.5kg", "weighs only 800g". The unit is required.
function wordsWeight(text: string): number | null {
  const m = /\bweigh(?:s|t|ing)?\b[^.\n\d]{0,24}(\d+(?:[.,]\d+)?\s*(?:kg|kilograms?|g|grams?|lbs?|pounds?|oz|ounces?))\b/i.exec(text);
  return m ? weightKg(m[1]) : null;
}

const show = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)}g` : `${Math.round(kg * 100) / 100}kg`);

/*
 * The parcel from a reading of her Amazon page, or null when it says nothing about size or weight. Each figure is
 * taken from the most trusted place that has it, so a package size can sit with a product weight.
 */
export function parcelFromRead(read: Json | null | undefined): Parcel | null {
  const facts = read?.facts;
  if (!facts) return null;
  const lines = ((facts.details ?? []) as string[]).map(String).map(split).filter(Boolean) as Array<{ key: string; value: string }>;
  const find = (re: RegExp, not: RegExp | null = null) => lines.find((l) => re.test(l.key) && !(not && not.test(l.key)));

  // 1. The package.
  const pkgLine = find(/package dimensions|parcel dimensions|package size|shipping dimensions|packaging dimensions/);
  const pkgSize = pkgLine ? sizeOf(pkgLine.value) : null;
  const pkgWeightLine = find(/package weight|parcel weight|shipping weight/);
  const pkgWeight = sane(
    (pkgWeightLine ? weightKg(pkgWeightLine.value) : null)
      ?? (pkgLine && pkgLine.value.includes(';') ? weightKg(pkgLine.value.split(';').slice(1).join(';')) : null),
  );

  // 2. The product.
  const prodLine = find(/product dimensions|item dimensions|^dimensions|^size \(|^item size/, /package|parcel|shipping/);
  const prodSize = prodLine ? sizeOf(prodLine.value) : null;
  const itemLine = find(/^(item weight|weight|product weight|net weight)$/)
    ?? lines.find((l) => /weight/.test(l.key) && !/package|parcel|shipping|capacity|max|load/.test(l.key));
  const itemWeight = sane(
    (itemLine ? weightKg(itemLine.value) : null)
      ?? (prodLine && prodLine.value.includes(';') ? weightKg(prodLine.value.split(';').slice(1).join(';')) : null),
  );

  // 3. The page's own words.
  const words = [((facts.bullets ?? []) as string[]).join('\n'), facts.description ?? ''].join('\n');
  const wordsSize = sizeOf(words, { needUnit: true });
  const wordsKg = sane(wordsWeight(words));

  let size: [number, number, number] | null = null;
  let sizeFrom: Parcel['size_from'] = null;
  if (pkgSize) { size = pkgSize; sizeFrom = 'package'; } else if (prodSize) { size = prodSize; sizeFrom = 'product'; } else if (wordsSize) { size = wordsSize; sizeFrom = 'words'; }
  const box = size ? size.map((d) => upCm(sizeFrom === 'package' ? d : d + 2)) as [number, number, number] : null;

  let weight: number | null = null;
  let weightFrom: Parcel['weight_from'] = null;
  if (pkgWeight) { weight = up50(pkgWeight); weightFrom = 'package'; } else if (itemWeight) { weight = packedKg(itemWeight); weightFrom = 'product'; } else if (wordsKg) { weight = packedKg(wordsKg); weightFrom = 'words'; }

  if (!box && weight == null) return null;

  const said = { package: "Amazon's package", product: "Amazon's product size", words: "the page's description" } as const;
  const parts: string[] = [];
  if (box) parts.push(`${box.join(' x ')}cm${sizeFrom === 'package' ? '' : ' (2cm added each way)'}`);
  if (weight != null) parts.push(`${show(weight)}${weightFrom === 'package' ? '' : ' packed'}`);
  const sources = [...new Set([sizeFrom, weightFrom].filter(Boolean))].map((k) => said[k as keyof typeof said]);
  const from = `From ${sources.join(' and ')}: ${parts.join(', ')}`;

  // The table and the words far apart: worth her eye, never a stop. The table's figure is the one used.
  const table = pkgWeight ?? itemWeight;
  const note = table && wordsKg && Math.max(table, wordsKg) / Math.min(table, wordsKg) > 1.5
    ? `Amazon's table gives ${show(table)}, the description ${show(wordsKg)}. The table's figure is used.`
    : null;

  return {
    weight_kg: weight,
    length_cm: box?.[0] ?? null,
    width_cm: box?.[1] ?? null,
    height_cm: box?.[2] ?? null,
    from,
    size_from: sizeFrom,
    weight_from: weightFrom,
    note,
  };
}

/*
 * What the parcel puts in her draft: only the measures her parcel does not have. A size she set stays whole (three
 * measures go together), and so does a weight she set. Null when there is nothing to add.
 */
export function parcelPatch(have: Json | null | undefined, p: Parcel | null) {
  if (!p) return null;
  const pkg = have ?? {};
  const hasSize = Number(pkg.length_cm) > 0 && Number(pkg.width_cm) > 0 && Number(pkg.height_cm) > 0;
  const hasWeight = Number(pkg.weight_kg) > 0;
  const add: Json = {};
  if (!hasSize && p.length_cm && p.width_cm && p.height_cm) Object.assign(add, { length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm });
  if (!hasWeight && p.weight_kg) add.weight_kg = p.weight_kg;
  return Object.keys(add).length ? add : null;
}
