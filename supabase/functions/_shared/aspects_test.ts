// Item details held to eBay's list: run with
//   deno test supabase/functions/_shared/aspects_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { aspectFacts, keepValid } from './aspects.ts';

const wanted = [
  { name: 'Type', mode: 'SELECTION_ONLY', values: ['Handheld Massager', 'Massage Gun', 'Electric Eye Massager'], required: true },
  { name: 'Colour', mode: 'FREE_TEXT', values: ['Red', 'Blue'], required: false },
  { name: 'Power Source', mode: 'FREE_TEXT', values: [], required: false },
];

Deno.test('a choice from eBay\'s list comes back exactly as eBay spells it; one not on it is dropped', () => {
  assertEquals(keepValid([{ name: 'type', value: 'handheld massager' }], wanted), { Type: 'Handheld Massager' });
  assertEquals(keepValid([{ name: 'Type', value: 'Vibrating ball' }], wanted), {});
});

Deno.test('free values: eBay\'s spelling when listed, else trimmed and capped; unknowns and strangers dropped', () => {
  assertEquals(keepValid([{ name: 'Colour', value: 'red' }], wanted), { Colour: 'Red' });
  assertEquals(keepValid([{ name: 'Colour', value: ' Rose pink ' }], wanted), { Colour: 'Rose pink' });
  assertEquals(keepValid([{ name: 'Power Source', value: 'Not stated' }, { name: 'Weight', value: '1kg' }], wanted), {});
  assertEquals((keepValid([{ name: 'Power Source', value: 'x'.repeat(90) }], wanted)['Power Source']).length, 65);
});

Deno.test('the facts block carries her words first and skips what is empty', () => {
  const f = aspectFacts({ title: 'Beurer MG16', listing: { brand: 'Beurer', features: ['Battery operated', 'Red'] } }, { title: 'Beurer MG16 Mini Massager Red' }, 'Massagers');
  assertEquals(f.split('\n')[0], 'eBay category: Massagers');
  assertEquals(f.includes('Features: Battery operated; Red'), true);
  assertEquals(f.includes('Her description'), false);
});
