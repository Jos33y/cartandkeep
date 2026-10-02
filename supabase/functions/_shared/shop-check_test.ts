// The shop check: run with
//   deno test supabase/functions/_shared/shop-check_test.ts

import { costPence, dashless, duplicates, lineFor, mayRetitle, settle, slugFor, titleProblems } from './shop-check.ts';

function eq(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
const ok = (v: unknown, why: string) => { if (!v) throw new Error(why); };

const words = (over: Record<string, unknown> = {}) => ({
  returns_class: 'standard', returns_reason: 'Ordinary household goods.', chemical: false, chemical_reason: 'Plastic clips.',
  biocide: false, needs_photos: false, title: 'Blind Valance Clips, 2.5 Inch, Pack of 10', title_reason: 'What it is, then size and count.',
  title_clear: true, brand_is_seller: false, facts_errors: [], corrected_description: '', ...over,
});
const clips = {
  id: 'p1', source_kind: 'ebay_listing', brand: 'Lechisenop',
  title: '10Pcs Blind Valance Clips 2.5" Window Blinds Hidden Clip Retainer Holder', derived_fields: { returns_class: 'standard' },
};
const FACTS = 'Title: 10Pcs Blind Valance Clips 2.5" Window Blinds Hidden Clip Retainer Holder\nDetails: Size: 2.5 inch; Type: Set of 10';

Deno.test('a shop title is plain, true to the facts and free of eBay habits', () => {
  eq(titleProblems('Blind Valance Clips, 2.5 Inch, Pack of 10', FACTS), []);
  eq(titleProblems('#winning Coin Slot Machine Desktop One Armed Bandit', 'Coin Slot Machine'), ['has a hashtag']);
  eq(titleProblems('10Pcs Blind Valance Clips Hidden Holder', FACTS), ['starts with a count']);
  eq(titleProblems('Blind Valance Clips UK Seller Fast Dispatch', FACTS), ['has seller wording']);
  eq(titleProblems('Blind Valance Clips, 5 Inch, Pack of 10', FACTS), ['5 is not in the facts']);
  eq(titleProblems('Blind Clips \u2013 Pack of 10 for Blinds', FACTS), ['has a dash', 'repeats "blinds"']);
  eq(titleProblems('Clips', FACTS), ['too short to say what it is']);
  eq(titleProblems('BLIND VALANCE CLIPS Pack of 10', FACTS), ['written in capitals']);
});

Deno.test('the address comes from the title, without the listing number', () => {
  eq(slugFor('Blind Valance Clips, 2.5 Inch, Pack of 10'), 'blind-valance-clips-2-5-inch-pack-of-10');
  eq(slugFor('Pots & Pans Café Set'), 'pots-and-pans-cafe-set');
});

Deno.test('the same product twice is paired, never one picked', () => {
  const pairs = duplicates([
    { id: 'a', title: 'HG Mould Remover Spray | Kills Black Mold & Mildew on Walls 500ml' },
    { id: 'b', title: 'HG Mould Remover Spray, Kills Black Mold and Mildew on Walls, 500ml' },
    { id: 'c', title: 'HG Mould Remover Spray 1 Litre' },
    { id: 'd', gtin: '734730596013', title: 'Mini massager' },
    { id: 'e', gtin: '734730596013', title: 'Shaving massager 16 heads' },
  ]);
  eq(pairs.get('a'), ['b']);
  eq(pairs.get('c'), undefined);
  eq(pairs.get('d'), ['e']);
});

Deno.test('a plain eBay copy with standard returns is ready, with a new title and address', () => {
  const r = settle(clips, words(), null, FACTS, [], 'T');
  eq(r.tray, 'ready');
  eq(r.title, 'Blind Valance Clips, 2.5 Inch, Pack of 10');
  eq(r.slug, 'blind-valance-clips-2-5-inch-pack-of-10');
  eq(r.patch.returns_class, null);
  eq(r.returns, 'standard');
});

Deno.test('a title that breaks a rule is not saved; it goes to her with the suggestion', () => {
  const r = settle(clips, words({ title: 'Blind Valance Clips, 5 Inch, Pack of 10' }), null, FACTS, [], 'T');
  eq(r.tray, 'choose');
  eq(r.title, null);
  eq(r.patch.check.suggested_title, 'Blind Valance Clips, 5 Inch, Pack of 10');
  eq(r.patch.check.title_problems, ['5 is not in the facts']);
});

Deno.test('her title, and a title from the Approved page, are never changed', () => {
  eq(settle({ ...clips, derived_fields: { title_by: 'her' } }, words(), null, FACTS).title, null);
  eq(settle({ ...clips, source_kind: 'candidate' }, words(), null, FACTS).title, null);
  eq(settle({ ...clips, source_kind: 'manual' }, words(), null, FACTS).tray, 'ready');
  eq(mayRetitle({ source_kind: 'ebay_listing', derived_fields: { title_by: 'keeper' } }), false);
});

Deno.test('sealed goes to her; once she has chosen, it does not again', () => {
  const shampoo = { id: 's', source_kind: 'ebay_listing', title: 'Rice Water Shampoo and Conditioner Set', derived_fields: {} };
  const w = words({ returns_class: 'sealed', returns_reason: 'Applied to the hair; cannot be resold once opened.', title: 'Rice Water Shampoo and Conditioner Set' });
  eq(settle(shampoo, w, null, 'Title: Rice Water Shampoo and Conditioner Set').tray, 'choose');
  eq(settle({ ...shampoo, derived_fields: { returns_by: 'her' } }, w, null, 'x').tray, 'ready');
});

Deno.test('a chemical lands in the label tray with what was read; a label she saved is not asked for again', () => {
  const bait = { id: 'b', source_kind: 'ebay_listing', title: 'Cockroach Gel Bait Syringe 10g', derived_fields: {} };
  const w = words({ chemical: true, chemical_reason: 'An insecticide gel.', biocide: true, needs_photos: true, title: 'Cockroach Gel Bait Syringe 10g' });
  const label = { chemical: true, biocide: true, label: { signal: 'Warning', h: ['H410 Very toxic to aquatic life with long lasting effects.'], p: [], pictograms: ['GHS09'], read_from: 'photo 1, the box' } };
  const r = settle(bait, w, label, 'Title: Cockroach Gel Bait Syringe 10g');
  eq(r.tray, 'label');
  eq(r.patch.hazard_suspect, true);
  eq(r.patch.hazard_draft.h, ['H410 Very toxic to aquatic life with long lasting effects.']);
  ok(r.line.includes('photo 1, the box'), r.line);
  eq(settle({ ...bait, hazard: { signal: 'Warning' } }, w, label, 'x').tray, 'ready');
});

Deno.test('a product flagged by a word that is not a chemical gets its own tray, and the flag is left for her', () => {
  const pads = { id: 'g', source_kind: 'ebay_listing', title: 'Pest Sticky Pads Trap, 11 Packs', derived_fields: { hazard_suspect: true } };
  const r = settle(pads, words({ chemical_reason: 'Glue traps with no poison.', title: 'Pest Sticky Pads Trap, 11 Packs' }), null, 'Title: Pest Sticky Pads Trap, 11 Packs');
  eq(r.tray, 'not_chemical');
  eq('hazard_suspect' in r.patch, false);
  ok(r.line.startsWith('Standard returns') === false && r.line.includes('Not a chemical'), r.line);
});

Deno.test('Keeper puts right a wrong number in its own unsaved description, and only its own', () => {
  const own = { version: 2, description: 'Clear clips. 5 inch blinds, they suit faux wood.', titles: { search: 'Blind Valance Clips 2.5 inch, Pack of 10' } };
  const w = words({ facts_errors: [{ field: 'description', says: '5 inch', facts: '2.5 inch' }], corrected_description: 'Clear clips. For 2.5 inch blinds, they suit faux wood.' });
  const r = settle({ ...clips, derived_fields: { draft: own } }, w, null, FACTS);
  eq(r.patch.draft.description, 'Clear clips. For 2.5 inch blinds, they suit faux wood.');
  ok(r.line.includes('5 inch is 2.5 inch'), r.line);
  const applied = settle({ ...clips, derived_fields: { draft: { ...own, applied_at: 'T' } } }, w, null, FACTS);
  eq('draft' in applied.patch, false);
});

Deno.test('a duplicate goes to her whatever else is right', () => {
  eq(settle(clips, words(), null, FACTS, ['p9']).tray, 'choose');
});

Deno.test('a seller name in the brand box is pointed out', () => {
  const r = settle(clips, words({ brand_is_seller: true }), null, FACTS);
  ok(r.line.includes('"Lechisenop" looks like a seller'), r.line);
});

Deno.test('nothing she reads carries a dash', () => {
  eq(dashless('Glue traps \u2014 no poison \u2013 safe'), 'Glue traps, no poison, safe');
  const r = settle(clips, words({ returns_reason: 'Plastic clips \u2014 ordinary goods.' }), null, FACTS);
  ok(!/[‒-―]/.test(r.line), r.line);
});

Deno.test('cost in pence from the token counts', () => {
  const prices = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, gbpPerUsd: 0.8 };
  eq(costPence({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 2000 }, prices), 0.528);
  eq(costPence(undefined, prices), 0);
});

Deno.test('the line for a ready product reads as one plain sentence or two', () => {
  const r = settle(clips, words(), null, FACTS);
  eq(r.line, 'Standard returns: Ordinary household goods. New title: Blind Valance Clips, 2.5 Inch, Pack of 10.');
  void lineFor;
});
