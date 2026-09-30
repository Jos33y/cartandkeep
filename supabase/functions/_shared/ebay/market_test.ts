// A product's own eBay market: run with
//   deno test --allow-env supabase/functions/_shared/ebay/market_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { marketFor, mustCarry, searchQuery, spread } from './market.ts';

Deno.test('the search words: the name without its variant or notes', () => {
  assertEquals(searchQuery('Beurer MG 16 Mini Massager - Red'), 'Beurer MG 16 Mini Massager');
  assertEquals(searchQuery('Kinetik Wellbeing Blood Pressure Monitor (WBP1)'), 'Kinetik Wellbeing Blood Pressure Monitor');
});

Deno.test('what a listing must carry: the brand and the model code, however it is spaced', () => {
  assertEquals(mustCarry('Beurer MG 16 Mini Massager', 'Beurer'), ['beurer', 'mg16']);
  assertEquals(mustCarry('Kinetik WBP1 monitor', null), ['kinetik', 'wbp1']);
});

Deno.test('the spread: quartiles of what buyers pay, postage in', () => {
  assertEquals(spread([10, 20, 30, 40, 50]), { n: 5, low: 10, p25: 20, median: 30, p75: 40, high: 50 });
  assertEquals(spread([]).median, null);
});

Deno.test('only the same product counts: a massage gun on the same search is left out', async () => {
  Deno.env.set('EBAY_CLIENT_ID', 'x'); Deno.env.set('EBAY_CLIENT_SECRET', 'y');
  globalThis.fetch = (async (url: string) => {
    if (!String(url).includes('item_summary/search')) return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({ itemSummaries: [
      { title: 'Beurer MG16 Mini Massager Red', price: { value: '14.99' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '0.00' } }], itemWebUrl: 'https://ebay.test/1' },
      { title: 'Beurer MG 16 mini massager green', price: { value: '15.50' }, shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '2.49' } }] },
      { title: 'Homedics NOVO Mini Massage Gun', price: { value: '32.73' } },
      { title: 'Beurer MG 21 massager', price: { value: '24.00' } },
    ] }), { status: 200 });
  }) as typeof fetch;
  const m = await marketFor('Beurer MG 16 Mini Massager - Red', 'A', { brand: 'Beurer' });
  assertEquals(m?.n, 2);
  assertEquals(m?.listings.map((x) => x.total), [14.99, 17.99]);
  assertEquals(m?.median, 16.49);
});
