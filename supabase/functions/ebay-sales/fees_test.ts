// Real fees on each sale line (0151, ebay-sales). Run with
//   deno test supabase/functions/ebay-sales/fees_test.ts

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
import { feesByOrder, isAdFee } from '../_shared/ebay/finances.ts';
import { lineFees, placeItemCharges } from './fees.ts';

const gbp = (v: number) => ({ value: String(v), currency: 'GBP' });

Deno.test('ad fees are told apart from selling fees', () => {
  assertEquals([isAdFee('AD_FEE'), isAdFee('FINAL_VALUE_FEE'), isAdFee('PROMOTED_LISTINGS_FEE')], [true, false, true]);
});

Deno.test('a private sale with nothing charged books as nothing, not an estimate', () => {
  const { orders } = feesByOrder([{ transactionType: 'SALE', orderId: 'O1', orderLineItems: [{ lineItemId: 'L1', marketplaceFees: [] }] }]);
  const f = lineFees(orders.get('O1')!, 'L1', 1);
  assertEquals([f.selling, f.ad], [0, 0]);
});

Deno.test('line fees, order charges shared by line, refunds credited', () => {
  const { orders } = feesByOrder([
    { transactionType: 'SALE', orderId: 'O1', orderLineItems: [
      { lineItemId: 'L1', marketplaceFees: [{ feeType: 'AD_FEE', amount: gbp(1.2) }] },
      { lineItemId: 'L2', marketplaceFees: [{ feeType: 'FINAL_VALUE_FEE', amount: gbp(2) }, { feeType: 'FINAL_VALUE_FEE_FIXED_PER_ORDER', amount: gbp(0.3) }] },
    ] },
    { transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', amount: gbp(4), references: [{ referenceId: 'O1', referenceType: 'ORDER_ID' }] },
    { transactionType: 'REFUND', orderId: 'O1', orderLineItems: [{ lineItemId: 'L2', marketplaceFees: [{ feeType: 'FINAL_VALUE_FEE', amount: gbp(2) }] }] },
  ]);
  const o = orders.get('O1')!;
  assertEquals(lineFees(o, 'L1', 0.25), { selling: 0, ad: 2.2, detail: { AD_FEE: 2.2 } });
  assertEquals(lineFees(o, 'L2', 0.75), { selling: 0.3, ad: 3, detail: { FINAL_VALUE_FEE: 0, FINAL_VALUE_FEE_FIXED_PER_ORDER: 0.3, AD_FEE: 3 } });
});

Deno.test('a charge naming only the item goes on its latest sale before it', () => {
  const { items } = feesByOrder([
    { transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', amount: gbp(4.39), transactionDate: '2026-10-05T10:00:00Z', references: [{ referenceId: '555', referenceType: 'ITEM_ID' }] },
    { transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', amount: gbp(1), transactionDate: '2026-10-05T10:00:00Z', references: [{ referenceId: '999', referenceType: 'ITEM_ID' }] },
    { transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'INSERTION_FEE', amount: gbp(0.35) },
  ]);
  const rows = [
    { listing_id: '555', sold_at: '2026-10-01T09:00:00Z', fees: 0, ad_fees: 0, fee_detail: {}, fees_estimated: false },
    { listing_id: '555', sold_at: '2026-10-04T09:00:00Z', fees: 0, ad_fees: 0, fee_detail: {}, fees_estimated: false },
    { listing_id: '555', sold_at: '2026-10-06T09:00:00Z', fees: 0, ad_fees: 0, fee_detail: {}, fees_estimated: false },
  ];
  const left = placeItemCharges(rows, items);
  assertEquals(left, 1);
  assertEquals(rows.map((r) => r.ad_fees), [0, 4.39, 0]);
});
