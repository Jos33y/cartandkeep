// Keeper's questions in screen words: run with  deno test supabase/functions/_shared/screen-words_test.ts
import { NOT_A_FINDING, screenWords } from './screen-words.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test('the slips seen on 2 October read as plain words', () => {
  assertEquals(screenWords('in_the_box field is null, so what comes with it?'), 'What is in the box is missing, so what comes with it?');
  assertEquals(screenWords('The GB CLP pictograms are not readable in the photograph'), 'The label warning pictograms are not readable in the photograph');
});

Deno.test('known fields, unknown fields and shorthand', () => {
  assertEquals(screenWords('specifications say 50ml but current_title says 250ml'), 'The details say 50ml but the title says 250ml');
  assertEquals(screenWords('Is the max_load_kg right?'), 'Is the max load kg right?');
  assertEquals(screenWords('The EAN differs from the supplier'), 'The barcode differs from the supplier');
  assertEquals(screenWords('the brand field is empty string'), 'The brand is missing');
  assertEquals(screenWords('colour is undefined'), 'Colour is missing');
});

Deno.test('ordinary words are left alone', () => {
  assertEquals(screenWords('What weight does it hold?'), 'What weight does it hold?');
  assertEquals(screenWords('Is it a 3-in-1 or a 4-in-1 pack?'), 'Is it a 3-in-1 or a 4-in-1 pack?');
  assertEquals(screenWords('Does the football field set include goals?'), 'Does the football field set include goals?');
});

Deno.test('the shop rules are not findings', () => {
  assertEquals(NOT_A_FINDING.some((p) => p.test('Returns policy is standard')), true);
  assertEquals(NOT_A_FINDING.some((p) => p.test('Which size is it?')), false);
});
