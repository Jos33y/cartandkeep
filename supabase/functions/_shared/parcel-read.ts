// Keeper reads the size and the weight off her Amazon page the way a person would (Joseey, 4 October: "regardless of
// how the weight and co is measured or done, its meant to read and understand"). Amazon writes them every way there
// is: "30 x 20 x 10 cm; 1.2 kg", "13.4L x 13.4W x 4.5H centimetres", a Depth, a Width and a Height on lines of their
// own, pounds and ounces, inches. Claude reads the facts and gives centimetres and kilograms; the packing rules stay
// in code (parcelFromFacts), so the box is worked out the same way every time. The pattern reader in parcel.ts is
// what is used when this cannot be had.

import { askTool } from './claude.ts';
import { packedKg } from './amazon-source.ts';
import type { Parcel } from './parcel.ts';

type Json = Record<string, any>;

export type SizeFacts = {
  product: { length_cm: number; width_cm: number; height_cm: number; weight_kg: number | null } | null;
  package: { length_cm: number; width_cm: number; height_cm: number; weight_kg: number | null } | null;
  // Only a weight, when no size is given with it.
  product_weight_kg: number | null;
  package_weight_kg: number | null;
  note: string;
};

export const PARCEL_SYSTEM = `You read a UK Amazon product page's facts and give the product's size and weight, and its
package's size and weight, in centimetres and kilograms.

- Read every way they are written: "30 x 20 x 10 cm; 1.2 kg", "13.4L x 13.4W x 4.5H
  centimetres", Depth, Width and Height on separate lines, "Item dimensions L x W x H",
  "Package Dimensions", "Item Weight", "Package Weight", the bullet points and the description.
- Convert every unit: millimetres, metres and inches to centimetres; grams, pounds and
  ounces to kilograms. 0.44 lb is 0.2 kg; 1 inch is 2.54 cm.
- Product: the item itself. Package: the box it ships in (Package Dimensions, Package Weight,
  Shipping Weight, Parcel). Never mix the two.
- Depth counts as length. Diameter counts for both length and width.
- Ignore what is not the item's own size or weight: a maximum load, a capacity, a screen
  size, a cable or hose length, a recommended dog weight, a coverage.
- Where the page disagrees with itself, the product details table wins over the bullet points.
- Never guess. A figure the page does not give is 0.`;

const FIELD = { type: 'number', description: 'Centimetres or kilograms; 0 when the page does not give it.' };
const TOOL = {
  name: 'parcel_facts',
  description: 'The product and package size and weight read off the page, in centimetres and kilograms.',
  input_schema: {
    type: 'object',
    properties: {
      product_length_cm: FIELD, product_width_cm: FIELD, product_height_cm: FIELD, product_weight_kg: FIELD,
      package_length_cm: FIELD, package_width_cm: FIELD, package_height_cm: FIELD, package_weight_kg: FIELD,
      note: { type: 'string', description: 'Where the figures came from, in a few words, for example "Depth, Width and Height lines; Item Weight 0.44 lb".' },
    },
  },
};

const ok = (v: unknown, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 1000) / 1000 : null; };
const box = (l: unknown, w: unknown, h: unknown, kg: number | null) => {
  const dims = [ok(l, 300), ok(w, 300), ok(h, 300)];
  return dims.every((d) => d != null) ? { length_cm: dims[0]!, width_cm: dims[1]!, height_cm: dims[2]!, weight_kg: kg } : null;
};

// Claude's answer as SizeFacts: every figure checked for sense, a box only when all three measures are there.
export function factsOf(a: Json): SizeFacts {
  const productKg = ok(a.product_weight_kg, 70);
  const packageKg = ok(a.package_weight_kg, 70);
  return {
    product: box(a.product_length_cm, a.product_width_cm, a.product_height_cm, productKg),
    package: box(a.package_length_cm, a.package_width_cm, a.package_height_cm, packageKg),
    product_weight_kg: productKg,
    package_weight_kg: packageKg,
    note: String(a.note ?? '').slice(0, 200),
  };
}

// The facts Keeper reads from, as the page gives them.
export function pageText(read: Json | null | undefined) {
  const f = read?.facts;
  if (!f) return null;
  return [
    f.title && `Title: ${f.title}`,
    (f.details ?? []).length && `Product details (Amazon's table):\n${(f.details as string[]).join('\n')}`,
    (f.bullets ?? []).length && `Bullet points:\n${(f.bullets as string[]).join('\n')}`,
    f.description && `Description:\n${String(f.description).slice(0, 2500)}`,
  ].filter(Boolean).join('\n\n') || null;
}

export async function readSize(key: string, read: Json | null | undefined): Promise<SizeFacts | null> {
  const text = pageText(read);
  if (!text) return null;
  const { input } = await askTool(key, { system: PARCEL_SYSTEM, content: text, maxTokens: 600, tool: TOOL });
  const f = factsOf(input);
  return f.product || f.package || f.product_weight_kg || f.package_weight_kg ? f : null;
}

const upCm = (cm: number) => Math.ceil(Math.round(cm * 1000) / 1000);
const up50 = (kg: number) => Math.ceil(Math.round(kg * 20 * 1e6) / 1e6) / 20;
const show = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)}g` : `${Math.round(kg * 100) / 100}kg`);

/*
 * The parcel from what Keeper read, by the same rules as parcelFromRead: the package as it is, rounded up; else the
 * product with 2cm added each way; a package weight as it is, else the product's weight packed.
 */
export function parcelFromFacts(f: SizeFacts | null): Parcel | null {
  if (!f) return null;
  const pkgKg = f.package?.weight_kg ?? f.package_weight_kg;
  const prodKg = f.product?.weight_kg ?? f.product_weight_kg;
  let size: number[] | null = null;
  let sizeFrom: Parcel['size_from'] = null;
  if (f.package) { size = [f.package.length_cm, f.package.width_cm, f.package.height_cm].map(upCm); sizeFrom = 'package'; }
  else if (f.product) { size = [f.product.length_cm, f.product.width_cm, f.product.height_cm].map((d) => upCm(d + 2)); sizeFrom = 'product'; }
  if (size) size.sort((a, b) => b - a);
  let weight: number | null = null;
  let weightFrom: Parcel['weight_from'] = null;
  if (pkgKg) { weight = up50(pkgKg); weightFrom = 'package'; } else if (prodKg) { weight = packedKg(prodKg); weightFrom = 'product'; }
  if (!size && weight == null) return null;

  const said = { package: "Amazon's package", product: "Amazon's product size", words: "the page's description" } as const;
  const parts: string[] = [];
  if (size) parts.push(`${size.join(' x ')}cm${sizeFrom === 'package' ? '' : ' (2cm added each way)'}`);
  if (weight != null) parts.push(`${show(weight)}${weightFrom === 'package' ? '' : ' packed'}`);
  const sources = [...new Set([sizeFrom, weightFrom].filter(Boolean))].map((k) => said[k as keyof typeof said]);
  return {
    weight_kg: weight,
    length_cm: size?.[0] ?? null,
    width_cm: size?.[1] ?? null,
    height_cm: size?.[2] ?? null,
    from: `From ${sources.join(' and ')}: ${parts.join(', ')}`,
    size_from: sizeFrom,
    weight_from: weightFrom,
    note: null,
  };
}

// The product's own size and weight for eBay's item details, as productSize gives it from the pattern reader.
export function productOf(f: SizeFacts | null) {
  if (!f?.product) return null;
  return { ...f.product, weight_kg: f.product.weight_kg ?? f.product_weight_kg };
}
