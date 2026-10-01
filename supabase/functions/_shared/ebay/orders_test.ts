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

import { cancelReasonOf, faultOf, reasonText, refundedAtOf } from './orders.ts';

Deno.test('why it came back, in her words, and whose doing it was', () => {
  assertEquals([reasonText('ARRIVED_DAMAGED'), reasonText('NO_LONGER_NEED_ITEM'), reasonText('SOMETHING_NEW'), reasonText(null)],
    ['Arrived damaged', 'No longer needed', 'Something new', null]);
  assertEquals([faultOf('DEFECTIVE_ITEM'), faultOf('ITEM_NOT_RECEIVED'), faultOf('OUT_OF_STOCK'), faultOf('OTHER', 'SELLER'), faultOf('FOUND_BETTER_PRICE'), faultOf(null), faultOf('ORDERED_WRONG_ITEM'), faultOf('WRONG_ITEM')],
    ['product', 'product', 'her', 'her', 'buyer', null, 'buyer', 'product']);
});

Deno.test('a cancellation brings its reason; the last refund dates it', () => {
  assertEquals(cancelReasonOf({ cancelStatus: { cancelRequests: [{ cancelReason: 'OUT_OF_STOCK', cancelInitiator: 'SELLER' }] } }), { code: 'OUT_OF_STOCK', by: 'SELLER' });
  assertEquals(cancelReasonOf({}), { code: null, by: null });
  assertEquals(refundedAtOf({ paymentSummary: { refunds: [{ refundDate: '2026-08-12T10:00:00Z' }, { refundDate: '2026-08-20T10:00:00Z' }, { refundDate: '2026-09-01T10:00:00Z', refundStatus: 'PENDING' }] } }), '2026-08-20T10:00:00Z');
});
