// Keeper's size reader: Claude's answer checked, and the box worked out by the packing rules. Run with
//   deno test supabase/functions/_shared/parcel-read_test.ts

import { factsOf, pageText, parcelFromFacts, productOf } from './parcel-read.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test('an answer with zeros for what the page does not give: no package box, the product kept', () => {
  const f = factsOf({ product_length_cm: 13.3, product_width_cm: 5.4, product_height_cm: 13.3, product_weight_kg: 0.2, package_length_cm: 0, package_width_cm: 0, package_height_cm: 0, package_weight_kg: 0, note: 'x' });
  assertEquals(f.package, null);
  assertEquals(f.product, { length_cm: 13.3, width_cm: 5.4, height_cm: 13.3, weight_kg: 0.2 });
  assertEquals(productOf(f), { length_cm: 13.3, width_cm: 5.4, height_cm: 13.3, weight_kg: 0.2 });
});

Deno.test('the package wins as it is; a package weight alone with a product size', () => {
  const p = parcelFromFacts(factsOf({ product_length_cm: 25, product_width_cm: 15, product_height_cm: 8, product_weight_kg: 0.9, package_length_cm: 30.4, package_width_cm: 20, package_height_cm: 10, package_weight_kg: 1.2, note: '' }))!;
  assertEquals([p.length_cm, p.width_cm, p.height_cm, p.weight_kg, p.from], [31, 20, 10, 1.2, "From Amazon's package: 31 x 20 x 10cm, 1.2kg"]);
  const q = parcelFromFacts(factsOf({ product_length_cm: 20, product_width_cm: 10, product_height_cm: 5, product_weight_kg: 0, package_length_cm: 0, package_width_cm: 0, package_height_cm: 0, package_weight_kg: 0.75, note: '' }))!;
  assertEquals([q.length_cm, q.width_cm, q.height_cm, q.weight_kg], [22, 12, 7, 0.75]);
});

Deno.test('nonsense is dropped; nothing at all is no parcel', () => {
  assertEquals(parcelFromFacts(factsOf({ product_length_cm: -1, product_width_cm: 5000, product_height_cm: 2, product_weight_kg: 900, package_length_cm: 0, package_width_cm: 0, package_height_cm: 0, package_weight_kg: 0, note: '' })), null);
  assertEquals(pageText({ facts: { title: 'X', details: ['Item Weight: 1 kg'], bullets: [], description: '' } }), "Title: X\n\nProduct details (Amazon's table):\nItem Weight: 1 kg");
});
