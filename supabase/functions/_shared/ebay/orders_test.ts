// What an eBay order counts for: run with
//   deno test --allow-env supabase/functions/_shared/ebay/orders_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { lineGross, refundedOf, statusOf } from './orders.ts';

const order = (refunds: Array<[string, string?]>, total = '27.99', cancel: string | null = null) => ({
  pricingSummary: { total: { value: total } },
  paymentSummary: { refunds: refunds.map(([v, s]) => ({ amount: { value: v }, refundStatus: s ?? 'REFUNDED' })) },
  ...(cancel ? { cancelStatus: { cancelState: cancel } } : {}),
});

Deno.test('a part refund stays a sale; a full refund does not; a cancellation never does', () => {
  assertEquals(statusOf(order([])), 'paid');
  assertEquals(statusOf(order([['2.99']])), 'paid');
  assertEquals(statusOf(order([['27.99']])), 'refunded');
  assertEquals(statusOf(order([['20.00'], ['7.99']])), 'refunded');
  assertEquals(statusOf(order([], '27.99', 'CANCELED')), 'cancelled');
  assertEquals(statusOf(order([], '27.99', 'CANCEL_REQUESTED')), 'paid');
});

Deno.test('only money that went back counts', () => {
  assertEquals(refundedOf(order([['5.00', 'PENDING'], ['2.00', 'FAILED'], ['1.50']])), 1.5);
  assertEquals(statusOf(order([['27.99', 'PENDING']])), 'paid');
});

Deno.test('a part refund comes off each line in proportion', () => {
  const o = order([['6.00']], '30.00');
  assertEquals([lineGross(o, 20, 30), lineGross(o, 10, 30)], [16, 8]);
  assertEquals(lineGross(order([]), 12.5, 12.5), 12.5);
});
