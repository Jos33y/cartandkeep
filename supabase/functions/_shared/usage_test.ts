// Run with: deno test supabase/functions/_shared/usage_test.ts
import { metered, note, pence, tallied } from './usage.ts';
function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

Deno.test('her 4 October: 6.15M in and 0.25M out is about $22, in pence at 0.75', () => {
  assertEquals(Math.round(pence({ input: 6_148_080, output: 254_284, cache_write: 0, cache_read: 0 }) / 100), 17);
});

Deno.test('each card counts only its own replies, side by side', async () => {
  const [[, a], [, b]] = await Promise.all([
    tallied(async () => { note({ input_tokens: 100, output_tokens: 10 }); await new Promise((r) => setTimeout(r, 5)); note({ input_tokens: 50 }); }),
    tallied(async () => { await new Promise((r) => setTimeout(r, 1)); note({ input_tokens: 7, cache_read_input_tokens: 3 }); }),
  ]);
  assertEquals([a.input, a.output, b.input, b.cache_read], [150, 10, 7, 3]);
});

Deno.test('a function hands its use back in a header, and nothing when it used none', async () => {
  const used = await metered(async () => { note({ input_tokens: 1200, output_tokens: 80 }); return new Response('{}'); })(new Request('http://x'));
  assertEquals(JSON.parse(used.headers.get('x-claude-usage')!).input, 1200);
  const none = await metered(async () => new Response('{}'))(new Request('http://x'));
  assertEquals(none.headers.get('x-claude-usage'), null);
});

Deno.test('each call is priced at its own model: Haiku a third of Sonnet here', async () => {
  const u = { input_tokens: 1_000_000, output_tokens: 0 };
  const [, sonnet] = await tallied(async () => { note(u, 'claude-sonnet-5-5'); });
  const [, haiku] = await tallied(async () => { note(u, 'claude-haiku-4-5-20251001'); });
  if (Math.abs((sonnet.usd ?? 0) - 3) > 1e-9 || Math.abs((haiku.usd ?? 0) - 1) > 1e-9) throw new Error(JSON.stringify({ sonnet, haiku }));
  if (Math.abs(pence(haiku, 0.75) - 75) > 1e-6) throw new Error(String(pence(haiku, 0.75)));
});
