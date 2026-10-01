// Keepr's returns and label check: run with
//   deno test --allow-env supabase/functions/_shared/shop-rules_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { derivedPatch, rulesFacts, tidyRules } from './shop-rules.ts';

Deno.test('a standard return is confirmed as it lands; sealed waits for her', () => {
  const std = tidyRules({ returns_class: 'standard', returns_reason: 'A saucepan.', chemical: false, chemical_reason: 'Cookware.', biocide: false, label: {} }, 'T');
  assertEquals(derivedPatch(std), { rules: std.rules, returns_class: null });
  const sealed = tidyRules({ returns_class: 'sealed', returns_reason: 'Applied to the skin.', chemical: false, biocide: false, label: {} }, 'T');
  assertEquals(derivedPatch(sealed).returns_class, 'sealed');
  assertEquals('returns_class' in derivedPatch(sealed, { returns_by: 'her' }), false);
  assertEquals(tidyRules({ returns_class: 'maybe' }).returns, 'standard');
});

Deno.test('a chemical is flagged with only the label elements that carry their codes', () => {
  const t = tidyRules({
    returns_class: 'standard', chemical: true, biocide: true, chemical_reason: 'A drain unblocker.',
    label: { signal: 'Danger', h: ['H314 Causes severe skin burns and eye damage.', 'Causes burns', 'H290 May be corrosive to metals.', 'H314 causes severe skin burns and eye damage.'],
      p: ['P280 Wear protective gloves.', 'P301+P330+P331 IF SWALLOWED: rinse mouth.', 'Keep away'], pictograms: ['ghs05', 'GHS10', 'skull'], hse_number: 'HSE 12345', read_from: 'the shop page' },
  }, 'T');
  assertEquals(t.hazard_draft, {
    signal: 'Danger', h: ['H314 Causes severe skin burns and eye damage.', 'H290 May be corrosive to metals.'],
    p: ['P280 Wear protective gloves.', 'P301+P330+P331 IF SWALLOWED: rinse mouth.'], pictograms: ['GHS05'], biocide_reg_no: 'HSE 12345', read_from: 'the shop page',
  });
  assertEquals(derivedPatch(t).hazard_suspect, true);
  assertEquals('hazard_suspect' in derivedPatch(t, { hazard_checked: true }), false);
});

Deno.test('a chemical with no readable label is flagged with nothing filled, never a guess', () => {
  const t = tidyRules({ returns_class: 'standard', chemical: true, biocide: false, label: { signal: 'none', h: ['Irritant'] } }, 'T');
  assertEquals([t.hazard_draft, derivedPatch(t).hazard_suspect], [null, true]);
});

Deno.test('the facts: the draft, then the card\'s shop page and eBay facts, internal details left out', () => {
  const f = rulesFacts({ title: 'Mr Muscle Drain Gel', specifications: { Volume: '500ml', _source: 'x' } }, { description: 'Contains sodium hydroxide.' }, { aspects: { Type: 'Drain cleaner' } });
  assertEquals(f, 'Title: Mr Muscle Drain Gel\nDetails: Volume: 500ml\nShop page description: Contains sodium hydroxide.\nItem details eBay holds: Type: Drain cleaner');
});
