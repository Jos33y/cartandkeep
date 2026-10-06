// The first reading of whether a listing is her product (match.ts). Run with
//   deno test supabase/functions/_shared/match_test.ts
import { matchScore } from './match.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test('Salus Controls and Salus, both RT310RF: the same product', () => {
  const r = matchScore(
    { title: 'Salus Controls Digital Thermostat with Radio Frequency RT310RF', brand: 'Salus Controls' },
    { title: 'Salus RT310RF Wireless Non-Programmable Thermostat & Receiver Kit, White', brand: 'Salus' },
  );
  assertEquals([r.score >= 0.85, r.rules_out], [true, false]);
});

Deno.test('the same model with no brand given on eBay: the same product', () => {
  const r = matchScore({ title: 'Salus Controls RT310RF thermostat', brand: 'Salus Controls' }, { title: 'RT310RF wireless thermostat kit' });
  assertEquals(r.score >= 0.85, true);
});

Deno.test('another maker, or another model, is still not her product', () => {
  assertEquals(matchScore({ title: 'Salus RT310RF', brand: 'Salus' }, { title: 'Honeywell RT310RF compatible', brand: 'Honeywell' }).score < 0.85, true);
  assertEquals(matchScore({ title: 'Salus RT310RF', brand: 'Salus' }, { title: 'Salus RT510RF', brand: 'Salus' }).rules_out, true);
});

Deno.test('a barcode still settles it either way', () => {
  assertEquals(matchScore({ title: 'a', gtin: '5060000000001' }, { title: 'b', gtin: '5060000000001' }).score, 1);
  assertEquals(matchScore({ title: 'Salus RT310RF', gtin: '5060000000001' }, { title: 'Salus RT310RF', gtin: '5060000000018' }).rules_out, true);
});
