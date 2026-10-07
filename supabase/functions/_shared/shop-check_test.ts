// Run with: deno test supabase/functions/_shared/shop-check_test.ts
import { CHECK_TOOL, googlePath } from './shop-check.ts';
import { strictSchema } from './claude.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test('googlePath tidies the path and needs two levels', () => {
  assertEquals(googlePath('Health & Beauty>  Health Care >Biometric Monitors'), 'Health & Beauty > Health Care > Biometric Monitors');
  assertEquals(googlePath('Home & Garden'), null);
  assertEquals(googlePath(''), null);
  assertEquals(googlePath(null), null);
  assertEquals(googlePath(' > Toys & Games >  '), null);
});

Deno.test('the check asks for the Google category, and stays within strict tool limits', () => {
  const s = strictSchema(CHECK_TOOL.input_schema);
  assertEquals(s.required.includes('google_category'), true);
  assertEquals(Object.keys(s.properties).length <= 24, true);
});
