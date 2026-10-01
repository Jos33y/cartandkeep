// Other UK shops for the same product: run with
//   deno test --allow-env supabase/functions/_shared/other-shops_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { findPages, pagesFrom, samePage } from './other-shops.ts';

Deno.test('the pages kept: real addresses, no marketplace, no shop already used, one page a shop, four at most', () => {
  const out = pagesFrom({ pages: [
    { url: 'https://www.boots.com/p/1', shop: 'Boots', why: 'barcode' },
    { url: 'https://www.amazon.co.uk/dp/B0', shop: 'Amazon', why: '' },
    { url: 'https://www.boots.com/p/2', shop: 'Boots', why: '' },
    { url: 'https://www.essentialaids.com/x', shop: 'Essential Aids', why: '' },
    { url: 'not a url', shop: 'x', why: '' },
    { url: 'https://www.argos.co.uk/product/9', shop: 'Argos', why: '' },
  ] }, ['https://essentialaids.com/y']);
  assertEquals(out.map((p) => p.url), ['https://www.boots.com/p/1', 'https://www.argos.co.uk/product/9']);
});

Deno.test('the same product: a barcode settles it; otherwise brand, model or nearly all of the name, and the pack', () => {
  assertEquals(samePage({ title: 'Anything', gtin: '4211125649019' }, { title: 'Else', gtin: '4211125649019' }).ok, true);
  assertEquals(samePage({ title: 'Beurer MG 16 Mini Massager', brand: 'Beurer' }, { title: 'Beurer MG16 Mini Massage Gun', brand: 'Beurer' }).ok, true);
  assertEquals(samePage({ title: 'Ariel All in One Pods 40 Washes', brand: 'Ariel' }, { title: 'Ariel All-in-One Pods Original 40 Washes' }).ok, true);
  assertEquals(samePage({ title: 'Ariel All in One Pods 40 Washes', brand: 'Ariel' }, { title: 'Ariel All in One Pods 60 Washes' }).ok, false);
  assertEquals(samePage({ title: 'Ariel All in One Pods 40 Washes', brand: 'Ariel' }, { title: 'Ariel All in One Pods' }).ok, false);
  assertEquals(samePage({ title: 'Kinetik Blood Pressure Monitor', brand: 'Kinetik' }, { title: 'Omron Blood Pressure Monitor', brand: 'Omron' }).ok, false);
});

Deno.test('the search: web search and the pages tool together, sent back once when it pauses', async () => {
  const sent: any[] = [];
  const replies = [
    { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search' }], usage: { server_tool_use: { web_search_requests: 2 } } },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'pages', input: { pages: [{ url: 'https://www.boots.com/p/1', shop: 'Boots', why: 'Same barcode' }] } }], usage: { server_tool_use: { web_search_requests: 1 } } },
  ];
  const real = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify(replies.shift()), { status: 200 });
  }) as typeof fetch;
  try {
    const out = await findPages('k', { title: 'Beurer MG 16', brand: 'Beurer', gtin: '4211125649019', used: [] });
    assertEquals([out.pages.length, out.searches], [1, 3]);
    assertEquals([sent[0].tools[0].type, sent[0].tools[0].blocked_domains.includes('amazon.co.uk'), sent[0].tools[1].strict, sent[0].tool_choice.type], ['web_search_20250305', true, true, 'auto']);
    assertEquals(sent[1].messages.length, 2);
  } finally {
    globalThis.fetch = real;
  }
});
