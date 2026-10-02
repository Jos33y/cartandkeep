// The shop check: run with
//   deno test supabase/functions/_shared/shop-check_test.ts

import { checksOf, costPence, dashless, duplicates, liveMatches, mayRetitle, settle, slugFor, slugNeedsWork, titleProblems } from './shop-check.ts';

function eq(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
const ok = (v: unknown, why: string) => { if (!v) throw new Error(why); };

const words = (over: Record<string, unknown> = {}) => ({
  returns_class: 'standard', returns_sure: true, returns_reason: 'Ordinary household goods.', chemical: false, chemical_reason: 'Plastic clips.',
  biocide: false, biocide_kind: '', needs_photos: false, title: 'Blind Valance Clips, 2.5 Inch, Pack of 10', title_reason: 'What it is, then size and count.',
  title_clear: true, brand_is_seller: false, same_as: '', answers: [], facts_errors: [], corrected_description: '', ...over,
});
const clips = {
  id: 'p1', source_kind: 'ebay_listing', brand: 'Lechisenop', price: 4.99, image_url: 'https://i.ebayimg.com/a.jpg',
  slug: '10pcs-blind-valance-clips-318720407192',
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

Deno.test('the address is six words at most, short, with no listing number', () => {
  eq(slugFor('Blind Valance Clips, 2.5 Inch, Pack of 10'), 'blind-valance-clips-2-5-inch-pack');
  eq(slugFor('Pots & Pans Café Set'), 'pots-pans-cafe-set');
  eq(slugFor('Bed Assist Rail with Storage Pouch Non-Slip Handle Black'), 'bed-assist-rail-storage-pouch-non-slip');
  ok(slugFor('Extraordinarily Long Words Everywhere Throughout Particularly Unnecessarily').length <= 50, 'too long');
  eq(slugNeedsWork('bed-rails-for-elderly-adults-adjustable-bed-assist-rail-safe-318720407192'), true);
  eq(slugNeedsWork('bed-assist-rail'), false);
});

Deno.test('the same product twice among drafts is paired, never one picked', () => {
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

Deno.test('a draft against the shop: barcode or listing is certain, close words go to Claude lettered', () => {
  const live = [
    { id: 'L1', title: 'Bed Assist Rail with Storage Bag, Adjustable' },
    { id: 'L2', title: 'Cesar Country Stew Wet Dog Food' },
    { id: 'L3', title: 'Massager', gtin: '5012345678900' },
    { id: 'L4', title: 'Lamp', source_ref: '318720407192' },
  ];
  const bed = { title: 'Bed Rails for Elderly Adults Adjustable Bed Assist Rail Safety Handle Seniors' };
  const m = liveMatches(bed, live);
  eq(m.similar, [{ ref: 'A', id: 'L1', title: 'Bed Assist Rail with Storage Bag, Adjustable' }]);
  eq(m.certain, []);
  eq(liveMatches({ title: 'x', gtin: '5012345678900' }, live).certain.map((c) => c.id), ['L3']);
  eq(liveMatches({ title: 'x', source_ref: '318720407192' }, live).certain.map((c) => c.id), ['L4']);
});

Deno.test('a plain eBay copy is ready, with a new title, a short address and returns set', () => {
  const r = settle(clips, words(), null, FACTS, {}, 'T');
  eq(r.tray, 'ready');
  eq(r.title, 'Blind Valance Clips, 2.5 Inch, Pack of 10');
  eq(r.slug, 'blind-valance-clips-2-5-inch-pack');
  eq(r.returns, 'standard');
  eq(r.patch.returns_by, 'keeper');
  eq(r.patch.returns_class, null);
  eq(r.line, 'Standard returns, new title, shorter address.');
});

Deno.test('a title that breaks a rule is left as a suggestion, and does not hold the product', () => {
  const r = settle(clips, words({ title: 'Blind Valance Clips, 5 Inch, Pack of 10' }), null, FACTS, {}, 'T');
  eq(r.tray, 'ready');
  eq(r.title, null);
  eq(r.patch.check.suggested_title, 'Blind Valance Clips, 5 Inch, Pack of 10');
  eq(r.patch.check.title_problems, ['5 is not in the facts']);
  eq(r.slug, 'blind-valance-clips-2-5-window-blinds');
});

Deno.test('her title, and a title from the Approved page, are never changed', () => {
  eq(settle({ ...clips, derived_fields: { title_by: 'her' } }, words(), null, FACTS).title, null);
  eq(settle({ ...clips, source_kind: 'candidate' }, words(), null, FACTS).title, null);
  eq(settle({ ...clips, source_kind: 'manual' }, words(), null, FACTS).tray, 'ready');
  eq(mayRetitle({ source_kind: 'ebay_listing', derived_fields: { title_by: 'keeper' } }), false);
});

Deno.test('Keeper decides sealed returns itself; only a real either way comes to her; hers stands', () => {
  const paint = { ...clips, id: 'f', title: 'Halloween Face Paint Kit', slug: 'face-paint', derived_fields: {} };
  const w = words({ returns_class: 'sealed', returns_reason: 'Applied to the skin.', title: 'Halloween Face Paint Kit' });
  const sure = settle(paint, w, null, 'Title: Halloween Face Paint Kit');
  eq(sure.tray, 'ready');
  eq(sure.returns, 'sealed');
  eq(sure.patch.returns_class, null);
  ok(sure.line.startsWith('Returns if unopened'), sure.line);
  const unsure = settle(paint, { ...w, returns_sure: false }, null, 'x');
  eq(unsure.tray, 'choose');
  eq(unsure.returns, null);
  eq(unsure.patch.returns_class, 'sealed');
  const hers = settle({ ...paint, derived_fields: { returns_by: 'her' } }, w, null, 'x');
  eq(hers.returns, null);
  eq('returns_class' in hers.patch, false);
});

Deno.test('a chemical: warnings read go on the page; none read is a note, never a hold', () => {
  const bait = { ...clips, id: 'b', title: 'Cockroach Gel Bait Syringe 10g', slug: 'gel', description: 'Kills roaches fast.', derived_fields: { hazard_suspect: true } };
  const w = words({ chemical: true, chemical_reason: 'An insecticide gel.', biocide: true, biocide_kind: 'insecticides', needs_photos: true, title: 'Cockroach Gel Bait Syringe 10g' });
  const label = { chemical: true, biocide: true, label: { signal: 'Warning', h: ['H410 Very toxic to aquatic life with long lasting effects.'], p: [], pictograms: ['GHS09'], hse_number: 'UK-2020-0001', read_from: 'photo 1' } };
  const r = settle(bait, w, label, 'Title: Cockroach Gel Bait Syringe 10g');
  eq(r.tray, 'label');
  eq(r.hazard?.signal, 'Warning');
  eq(r.biocideReg, 'UK-2020-0001');
  eq(r.patch.hazard_suspect, false);
  eq(r.patch.hazard_checked, true);
  eq(r.description, 'Kills roaches fast.\n\nUse insecticides safely. Always read the label and product information before use.');
  ok(r.line.includes('label warnings added') && r.line.includes('safety line added'), r.line);
  const blind = settle(bait, w, { chemical: true, biocide: true, label: {} }, 'x');
  eq(blind.tray, 'ready');
  eq(blind.hazard, null);
  ok(blind.patch.check.notes[0].includes('no warnings could be read'), blind.patch.check.notes[0]);
  eq(settle({ ...bait, hazard: { signal: 'Danger' } }, w, label, 'x').hazard, null);
  eq(settle({ ...bait, description: 'Kills roaches. Use insecticides safely. Always read the label and product information before use.' }, w, label, 'x').description, null);
});

Deno.test('words the law does not allow on a biocide are pointed out, not rewritten', () => {
  const spray = { ...clips, id: 'n', title: 'Natural Ant Killer Spray', slug: 'ant', description: 'Non-toxic and harmless to pets.', derived_fields: {} };
  const r = settle(spray, words({ chemical: true, biocide: true, biocide_kind: 'insecticides', title: 'Ant Killer Spray, 500ml' }), null, 'x');
  const note = r.patch.check.notes.find((n: string) => n.startsWith('Says'));
  ok(note && note.includes('"natural"') && note.includes('"non-toxic"') && note.includes('"harmless"'), String(note));
  ok(r.description?.startsWith('Non-toxic and harmless to pets.'), 'her words kept');
});

Deno.test('questions left earlier are answered; a disputed detail is left out of the details', () => {
  const rail = {
    ...clips, id: 'r', title: 'Bed Rails for Elderly', slug: 'bed-rail', specifications: { 'Maximum load capacity': '50 kg', Colour: 'Black' },
    derived_fields: { checks: { decide: [
      { id: 'load', question: 'What is the maximum load capacity?', options: ['50 kg (from details)', '150 kg (from supplier text)'], detail: 'Maximum load capacity', answer: null },
      { id: 'width', question: 'Should the handle width be included?', options: ['Yes, 35 cm handle width', 'No'], detail: 'Handle width', answer: null },
      { id: 'legacy-0', question: 'Weights only in supplier text.', options: ['Noted'], detail: null, answer: null },
    ], done: ['Price checked'] } },
  };
  const w = words({ title: 'Bed Rails for Elderly', answers: [{ id: 'load', answer: 'Leave out' }, { id: 'width', answer: 'Yes, 35 cm handle width' }] });
  const r = settle(rail, w, null, 'x');
  eq(r.tray, 'ready');
  eq(r.specs, { Colour: 'Black', 'Handle width': 'Yes, 35 cm handle width' });
  eq(r.patch.checks.decide.map((q: Record<string, unknown>) => q.answer), ['Left out', 'Yes, 35 cm handle width', 'Noted']);
  eq(r.patch.checks.done, ['Price checked']);
  ok(r.line.includes('3 old questions sorted, 1 disputed detail left out'), r.line);
  eq(checksOf({ derived_fields: {} }), null);
});

Deno.test('a question Keeper cannot settle, or a missing price, keeps it with her, and says what for', () => {
  const plug = { ...clips, id: 'u', derived_fields: { checks: { decide: [
    { id: 'plug', question: 'Is the plug UK?', options: ['UK plug', 'EU plug'], holds: ['EU plug'], hold: 'Not a UK plug', answer: null },
  ], done: [] } } };
  const open = settle(plug, words(), null, FACTS);
  eq(open.tray, 'choose');
  eq(open.patch.check.gaps, ['an answer to one question']);
  const held = settle(plug, words({ answers: [{ id: 'plug', answer: 'EU plug' }] }), null, FACTS);
  eq(held.patch.check.gaps, ['not a uk plug']);
  const noPrice = settle({ ...clips, price: 0 }, words(), null, FACTS);
  eq(noPrice.tray, 'choose');
  ok(noPrice.line.endsWith('needs a price.'), noPrice.line);
});

Deno.test('the same product as one on the shop, or another draft, comes to her', () => {
  const live = [{ ref: 'A', id: 'L1', title: 'Bed Assist Rail with Storage Bag, Adjustable' }];
  const r = settle(clips, words({ same_as: 'A' }), null, FACTS, { live });
  eq(r.tray, 'choose');
  eq(r.patch.check.same_as_live, { id: 'L1', title: 'Bed Assist Rail with Storage Bag, Adjustable' });
  ok(r.line.startsWith('Same as "Bed Assist Rail'), r.line);
  eq(settle(clips, words({ same_as: 'B' }), null, FACTS, { live }).tray, 'ready');
  eq(settle(clips, words(), null, FACTS, { certain: [{ id: 'L9', title: 'Clips' }] }).tray, 'choose');
  eq(settle(clips, words(), null, FACTS, { partners: ['p9'] }).tray, 'choose');
});

Deno.test('Keeper puts right a wrong number in its own unsaved description, and only its own', () => {
  const own = { version: 2, description: 'Clear clips. 5 inch blinds, they suit faux wood.', titles: { search: 'Blind Valance Clips 2.5 inch, Pack of 10' } };
  const w = words({ facts_errors: [{ field: 'description', says: '5 inch', facts: '2.5 inch' }], corrected_description: 'Clear clips. For 2.5 inch blinds, they suit faux wood.' });
  const r = settle({ ...clips, derived_fields: { draft: own } }, w, null, FACTS);
  eq(r.patch.draft.description, 'Clear clips. For 2.5 inch blinds, they suit faux wood.');
  ok(r.line.includes('own description corrected'), r.line);
  const applied = settle({ ...clips, derived_fields: { draft: { ...own, applied_at: 'T' } } }, w, null, FACTS);
  eq('draft' in applied.patch, false);
});

Deno.test('nothing she reads carries a dash', () => {
  eq(dashless('Glue traps \u2014 no poison \u2013 safe'), 'Glue traps, no poison, safe');
  const r = settle(clips, words({ returns_reason: 'Plastic clips \u2014 ordinary goods.' }), null, FACTS);
  ok(!/[\u2012-\u2015]/.test(r.line + r.why), r.line + r.why);
});

Deno.test('cost in pence from the token counts', () => {
  const prices = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, gbpPerUsd: 0.8 };
  eq(costPence({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 2000 }, prices), 0.528);
  eq(costPence(undefined, prices), 0);
});
