// Her supplier's cost following Amazon's price: run with
//   deno test --allow-env supabase/functions/_shared/amazon_cost_test.ts
import { costFollow, goodsOf, nextRead, supplierPageOf } from './amazon.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const reading = (offer: Record<string, unknown>, found = true) => ({
  asin: 'B0BDLDML22', url: 'https://www.amazon.co.uk/dp/B0BDLDML22?psc=1', read_at: '2026-10-03T06:00:00Z', found, facts: null, risk: null,
  offer: { price: null, was: null, deal: false, shipping: 0, stock: 'in', stock_text: 'In stock', sold_by: 'ZYFJD', fulfilled_by: 'Amazon', prime: true, ...offer },
  // deno-lint-ignore no-explicit-any
}) as any;
const src = (x: Record<string, unknown> = {}) => ({ id: 's1', fulfilment: 'dropship', unit_cost: 15.28, price_at_moq: 15.28, supplier_shipping: 0, cost_by: null, ...x });

Deno.test('a deal price is not a cost', () => {
  assertEquals(goodsOf({ price: 15.28, was: 17.98, deal: true }), 17.98);
  assertEquals(goodsOf({ price: 17.98, was: null, deal: false }), 17.98);
  assertEquals(goodsOf({ price: null }), null);
});

Deno.test('SHAVINGFUN: costed at the deal price, the deal ended, the cost follows', () => {
  const prev = { asin: 'B0BDLDML22', offer: { price: 15.28, was: 17.98, deal: true } };
  assertEquals(costFollow(prev, reading({ price: 17.98 }), src()), { from: 15.28, to: 17.98, shipping: 0, why: 'price' });
});

Deno.test('still on the deal: the cost is the price after it', () => {
  assertEquals(costFollow(null, reading({ price: 15.28, was: 17.98, deal: true }), src()), { from: 15.28, to: 17.98, shipping: 0, why: 'deal' });
});

Deno.test('down in price, no deal: the cost follows down', () => {
  const prev = { offer: { price: 17.98 } };
  assertEquals(costFollow(prev, reading({ price: 16.49 }), src({ unit_cost: 17.98, price_at_moq: 17.98, cost_by: 'amazon' }))?.to, 16.49);
});

Deno.test('a cost she typed is hers', () => {
  // Set by her in the portal.
  assertEquals(costFollow(null, reading({ price: 17.98 }), src({ cost_by: 'her' })), null);
  // A Business or trade price that matches no Amazon price seen.
  const prev = { offer: { price: 17.98 } };
  assertEquals(costFollow(prev, reading({ price: 18.49 }), src({ unit_cost: 14.10, price_at_moq: 14.10 })), null);
});

Deno.test('nothing to move, or nothing to move from', () => {
  assertEquals(costFollow(null, reading({ price: 15.28 }), src()), null);
  assertEquals(costFollow(null, reading({ price: 15.28 }, false), src()), null);
  assertEquals(costFollow(null, reading({ price: 20 }), null), null);
  assertEquals(costFollow(null, reading({ price: 20 }), src({ fulfilment: 'stock' })), null);
  // No cost yet: Amazon's price is the first one.
  assertEquals(costFollow(null, reading({ price: 9.99 }), src({ unit_cost: null, price_at_moq: null }))?.to, 9.99);
});

Deno.test('postage moves with it, and an unshown postage keeps hers', () => {
  assertEquals(costFollow(null, reading({ price: 15.28, shipping: 3.99 }), src())?.shipping, 3.99);
  assertEquals(costFollow({ offer: { price: 15.28 } }, reading({ price: 16, shipping: null }), src({ supplier_shipping: 1.5 }))?.shipping, 1.5);
});

Deno.test('costed is the landed cost, and a move is kept on later readings', () => {
  assertEquals(supplierPageOf({ draft: {} }, [{ id: 's1', url: 'https://www.amazon.co.uk/dp/B0BDLDML22', unit_cost: 15, landed_unit_cost: 17.5 }]).costed, 17.5);
  const moved = { asin: 'B0BDLDML22', read_at: 'x', offer: { price: 17.98 }, cost_change: { from: 15.28, to: 17.98, at: 'x', why: 'price' } };
  assertEquals(nextRead(moved, reading({ price: 17.98 }), { source_id: 's1', costed: 17.98 }).cost_change?.to, 17.98);
  assertEquals(nextRead({ ...moved, asin: 'OTHER' }, reading({ price: 17.98 }), { source_id: 's1', costed: 17.98 }).cost_change, null);
});
