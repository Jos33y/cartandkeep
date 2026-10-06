// The price change (0141, price-change). Run with
//   deno test supabase/functions/price-change/index_test.ts

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
import { changeEbay, changeShop, offerAnswer, priceOf, reviseXml, tradingAnswer } from './price.ts';

Deno.test('priceOf rounds and refuses under 99p', () => {
  assertEquals(priceOf('24.987'), 24.99);
  assertEquals(priceOf(0.5), null);
  assertEquals(priceOf('abc'), null);
});

Deno.test('reviseXml sends the item number and the price only', () => {
  const x = reviseXml('3189-4239-8301', 24.9);
  assertEquals(x.includes('<ItemID>318942398301</ItemID>'), true);
  assertEquals(x.includes('<StartPrice currencyID="GBP">24.90</StartPrice>'), true);
  assertEquals(/Quantity|Title|Description/.test(x), false);
});

Deno.test('tradingAnswer reads success, warning and failure', () => {
  assertEquals(tradingAnswer('<Ack>Success</Ack>', true), null);
  assertEquals(tradingAnswer('<Ack>Warning</Ack>', true), null);
  assertEquals(tradingAnswer('<Ack>Failure</Ack><Errors><LongMessage>Variation listing needs a SKU.</LongMessage></Errors>', true), 'Variation listing needs a SKU.');
});

Deno.test('offerAnswer reads the bulk answer', () => {
  assertEquals(offerAnswer({ responses: [{ statusCode: 200 }] }), null);
  assertEquals(offerAnswer({ responses: [{ statusCode: 400, errors: [{ message: 'Bad price.' }] }] }), 'Bad price.');
  assertEquals(offerAnswer({}), 'eBay gave no answer for the offer');
});

Deno.test('a listing from Cart & Keep goes by its offer, a Seller Hub one by item number', async () => {
  const sent: string[] = [];
  const deps = {
    access: async () => 'tok',
    // deno-lint-ignore no-explicit-any
    call: (async (path: string, _a: string, init: any) => { sent.push(`call ${path} ${init.body}`); return { responses: [{ statusCode: 200 }] }; }) as any,
    // deno-lint-ignore no-explicit-any
    fetch: (async (_u: string, init: any) => { sent.push(`fetch ${init.headers['X-EBAY-API-CALL-NAME']}`); return new Response('<Ack>Success</Ack>'); }) as any,
  };
  const a = await changeEbay('111', 20, { ebay: { offer_id: 'O1' } }, deps);
  const b = await changeEbay('222', 21, null, deps);
  assertEquals([a, b], [{ route: 'inventory', error: null }, { route: 'trading', error: null }]);
  assertEquals(sent[0].includes('bulk_update_price_quantity') && sent[0].includes('"offerId":"O1"') && sent[0].includes('"value":"20.00"'), true);
  assertEquals(sent[0].includes('availableQuantity'), false);
  assertEquals(sent[1], 'fetch ReviseInventoryStatus');
});

function fakeClient(product: Record<string, unknown> | null, variants = 0) {
  const updates: unknown[] = [];
  const q = (table: string) => {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    Object.assign(self, {
      select: chain, eq: chain, not: chain,
      update: (v: unknown) => { updates.push([table, v]); return self; },
      maybeSingle: async () => ({ data: product, error: null }),
      then: (r: (v: unknown) => void) => r(table === 'store_variants' ? { count: variants } : { error: null }),
    });
    return self;
  };
  return { client: { from: q }, updates };
}

Deno.test('the shop price changes, and a was-price under it is left for her', async () => {
  const ok = fakeClient({ id: 'p', price: 30, compare_at: null }, 2);
  assertEquals(await changeShop(ok.client, 't', 'p', 25), { error: null, old: 30, options: 2 });
  assertEquals(ok.updates, [['store_products', { price: 25 }]]);
  const was = fakeClient({ id: 'p', price: 20, compare_at: 24 });
  const r = await changeShop(was.client, 't', 'p', 26);
  assertEquals(r.error?.startsWith('Its was-price is £24.00'), true);
  assertEquals(was.updates.length, 0);
  assertEquals((await changeShop(fakeClient(null).client, 't', 'p', 10)).error, 'That product is not on your shop.');
});
