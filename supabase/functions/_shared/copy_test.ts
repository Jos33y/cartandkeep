// The last guard on buyer copy: run with
//   deno test supabase/functions/_shared/copy_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { backstageOut } from './copy.ts';

Deno.test('doubt and backstage sentences go; the product copy stays', () => {
  const text = [
    'Beurer MG 16 Mini Massager in red, a small handheld vibration massager for general home use.',
    '',
    "What's included and what matters:",
    '',
    '- Beurer MG 16 Mini Massager, red and white colour',
    '- Compact design with rounded body',
    '- As shown in the photographs',
    '',
    'Please check the listing photographs for any printed specifications before buying. No other details of power source, battery life, or accessories are confirmed, so none are listed here.',
  ].join('\n');
  assertEquals(backstageOut(text), [
    'Beurer MG 16 Mini Massager in red, a small handheld vibration massager for general home use.',
    '',
    "What's included and what matters:",
    '',
    '- Beurer MG 16 Mini Massager, red and white colour',
    '- Compact design with rounded body',
  ].join('\n'));
});

Deno.test('a conflict line is left as it is', () => {
  assertEquals(backstageOut('CONFLICT: title says 8, the photo shows 4'), 'CONFLICT: title says 8, the photo shows 4');
});
