// Keeper's parcel from her Amazon page (Joseey, 4 October). Run with
//   deno test supabase/functions/_shared/parcel_test.ts

import { parcelFromRead, parcelPatch, sizeOf } from './parcel.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const read = (details: string[], bullets: string[] = [], description = '') => ({ facts: { details, bullets, description } });

Deno.test('sizes: units once at the end, on each, mm, inches, longest first', () => {
  assertEquals(sizeOf('30 x 20 x 10 cm; 1.2 kg'), [30, 20, 10]);
  assertEquals(sizeOf('10cm x 30cm x 20cm'), [30, 20, 10]);
  assertEquals(sizeOf('300 x 200 x 100 mm'), [30, 20, 10]);
  assertEquals(sizeOf('10 x 5 x 2 inches')?.map((d) => Math.round(d * 100) / 100), [25.4, 12.7, 5.08]);
  assertEquals(sizeOf('2 x 3 x 4', { needUnit: true }), null);
  assertEquals(sizeOf('2 x 3 x 4 in the box', { needUnit: true }), null);
  assertEquals(sizeOf('Size: Large'), null);
});

Deno.test('the package wins: taken as it is, weight from the same line', () => {
  const p = parcelFromRead(read(['Product Dimensions: 25 x 15 x 8 cm; 900 g', 'Package Dimensions: 30.4 x 20 x 10 cm; 1.2 kg']))!;
  assertEquals([p.length_cm, p.width_cm, p.height_cm, p.weight_kg], [31, 20, 10, 1.2]);
  assertEquals(p.size_from, 'package');
  assertEquals(p.weight_from, 'package');
  assertEquals(p.from, "From Amazon's package: 31 x 20 x 10cm, 1.2kg");
});

Deno.test('the product: 2cm added each way, the weight packed', () => {
  const p = parcelFromRead(read(['Item dimensions L x W x H: 20 x 10 x 5 Centimetres', 'Item Weight: 500 g']))!;
  assertEquals([p.length_cm, p.width_cm, p.height_cm, p.weight_kg], [22, 12, 7, 0.6]);
  assertEquals(p.from, "From Amazon's product size: 22 x 12 x 7cm (2cm added each way), 600g packed");
});

Deno.test('a package size with a product weight, and a weight in grams on the product line', () => {
  const p = parcelFromRead(read(['Package Dimensions: 40 x 30 x 20 cm', 'Product Dimensions: 35 x 25 x 15 cm; 2 Kilograms']))!;
  assertEquals([p.length_cm, p.weight_kg, p.size_from, p.weight_from], [40, 2.3, 'package', 'product']);
});

Deno.test('the words, only with a unit', () => {
  const p = parcelFromRead(read(['Brand: Minky'], ['Measures 50 x 40 x 3cm when folded', 'Weighs just 1.5kg']))!;
  assertEquals([p.length_cm, p.width_cm, p.height_cm, p.weight_kg, p.size_from], [52, 42, 5, 1.75, 'words']);
  assertEquals(parcelFromRead(read(['Brand: X'], ['Pack of 2 x 3 x 4'])), null);
});

Deno.test('the table and the words far apart: the table, with a note', () => {
  const p = parcelFromRead(read(['Item Weight: 500 g'], ['Weight: 2kg']))!;
  assertEquals(p.weight_kg, 0.6);
  assertEquals(p.note, "Amazon's table gives 500g, the description 2kg. The table's figure is used.");
});

Deno.test('a load or capacity is not a weight; nothing to say is null', () => {
  assertEquals(parcelFromRead(read(['Maximum Weight Recommendation: 120 Kilograms'])), null);
  assertEquals(parcelFromRead(null), null);
});

Deno.test('the draft keeps what she set: a whole size, and a weight', () => {
  const p = parcelFromRead(read(['Package Dimensions: 30 x 20 x 10 cm; 1.2 kg']))!;
  assertEquals(parcelPatch(null, p), { length_cm: 30, width_cm: 20, height_cm: 10, weight_kg: 1.2 });
  assertEquals(parcelPatch({ weight_kg: 2 }, p), { length_cm: 30, width_cm: 20, height_cm: 10 });
  assertEquals(parcelPatch({ length_cm: 45, width_cm: 35, height_cm: 16 }, p), { weight_kg: 1.2 });
  assertEquals(parcelPatch({ length_cm: 45, width_cm: 35, height_cm: 16, weight_kg: 2 }, p), null);
});
