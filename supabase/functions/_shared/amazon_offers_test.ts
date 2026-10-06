// The sellers' list for pages with no main price (amazon.ts bestOffer, withOffer, runAxesso). Run with
//   deno test supabase/functions/_shared/amazon_offers_test.ts
import { bestOffer, runAxesso, withOffer, fromAxesso } from './amazon.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const o = (price: number, sellerName: string, pct: number | null, fulfilledBy = sellerName, condition = 'New', shippingPrice = 0) =>
  ({ statusCode: 200, asin: 'B0LEGO0001', condition, price, shippingPrice, sellerName, fulfilledBy, sellerRatingPercentage: pct, prime: false, shippingDescription: ['FREE delivery Saturday, 10 October'] });

Deno.test('a seller under 80% is never the supplier (Firehawk, Semantic UK 66%)', () => {
  const b = bestOffer([o(21.99, 'Semantic UK', 66)]);
  assertEquals(b.pick, null);
  assertEquals(b.refused?.seller, 'Semantic UK');
});

Deno.test('used is ignored; cheapest good seller wins', () => {
  const b = bestOffer([o(10, 'Cheapo', 95, 'Cheapo', 'Used - Good'), o(25, 'A', 90), o(23, 'B', 85, 'B', 'New', 1.5)]);
  assertEquals(b.pick?.seller, 'B');
  assertEquals(b.pick?.total, 24.5);
});

Deno.test('sent by Amazon wins within 10% (LEGO City F1)', () => {
  const near = bestOffer([o(27.0, 'Merchant', 95), o(27.99, 'Everest Limit', 100, 'Amazon')]);
  assertEquals(near.pick?.seller, 'Everest Limit');
  assertEquals(near.pick?.sent_by, 'Amazon');
  const far = bestOffer([o(20, 'Merchant', 95), o(27.99, 'Everest Limit', 100, 'Amazon')]);
  assertEquals(far.pick?.seller, 'Merchant');
});

Deno.test('no rating counts only when Amazon sends it', () => {
  assertEquals(bestOffer([o(9, 'New Shop', null)]).pick, null);
  assertEquals(bestOffer([o(9, 'New Shop', null, 'Amazon')]).pick?.seller, 'New Shop');
});

Deno.test('the reading takes the pick, marked as from the sellers list', () => {
  const r = fromAxesso({ statusCode: 200, statusMessage: 'FOUND', asin: 'B0LEGO0001', title: 'LEGO City F1', price: 0, retailPrice: 39.99, warehouseAvailability: '' });
  const w = withOffer(r, [o(27.99, 'Everest Limit', 100, 'Amazon')]);
  assertEquals([w.offer.price, w.offer.sold_by, w.offer.fulfilled_by, w.offer.stock, (w.offer as any).from_offers], [27.99, 'Everest Limit', 'Amazon', 'in', { count: 1, seller_pct: 100 }]);
  const none = withOffer(r, [o(21.99, 'Semantic UK', 66)]);
  assertEquals([none.offer.price, (none.offer as any).others?.pct], [null, 66]);
});

Deno.test('runAxesso asks the sellers list only for pages with no price', async () => {
  const calls: string[] = [];
  const fetcher = (url: string, init: any) => {
    calls.push(url);
    const body = JSON.parse(init.body);
    if (url.includes('offers')) {
      assertEquals(body.input, [{ asin: 'B0LEGO0001', domainCode: 'co.uk', startPage: 1 }]);
      return Promise.resolve(new Response(JSON.stringify([o(27.99, 'Everest Limit', 100, 'Amazon')])));
    }
    return Promise.resolve(new Response(JSON.stringify([
      { statusCode: 200, statusMessage: 'FOUND', asin: 'B0LEGO0001', title: 'LEGO', price: 0, url: 'https://www.amazon.co.uk/dp/B0LEGO0001' },
      { statusCode: 200, statusMessage: 'FOUND', asin: 'B0PRICED01', title: 'Priced', price: 12.99, url: 'https://www.amazon.co.uk/dp/B0PRICED01' },
    ])));
  };
  const { reads } = await runAxesso(['https://www.amazon.co.uk/dp/B0LEGO0001', 'https://www.amazon.co.uk/dp/B0PRICED01'], 't', { fetcher: fetcher as any });
  assertEquals(calls.length, 2);
  assertEquals(reads.get('B0LEGO0001')?.offer.price, 27.99);
  assertEquals(reads.get('B0PRICED01')?.offer.price, 12.99);
});
