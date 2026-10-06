// The price-change email (supplier-read, notify). Run with
//   deno test supabase/functions/supplier-read/alert_test.ts
function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
import { priceAlert } from './alert.ts';
import { price } from '../_shared/email/templates/price.ts';
import { shopFrom } from '../_shared/email/context.ts';

const live = { title: 'Card', draft: { title: 'Shaving foam' }, ebay: { listing_id: '318900000001', price: 24.99 } };
const read = { offer: { price: 17.98, shipping: 0 } };

Deno.test('followed cost that moved is told, by landed cost', () => {
  const a = priceAlert(live, { landed_unit_cost: 15.99 }, { landed_unit_cost: 17.98 }, { why: 'price' }, read, 15.99, null);
  assertEquals(a, { title: 'Shaving foam', listing_id: '318900000001', from: 15.99, to: 17.98, price: 24.99, why: 'moved', deal_ended: false });
});

Deno.test('not live, or nothing changed, is not told', () => {
  assertEquals(priceAlert({ ...live, ebay: null }, { landed_unit_cost: 1 }, { landed_unit_cost: 2 }, { why: 'price' }, read, 1, null), null);
  assertEquals(priceAlert(live, { landed_unit_cost: 17.98 }, { landed_unit_cost: 17.98 }, { why: 'price' }, read, 17.98, null), null);
  assertEquals(priceAlert(live, null, null, null, read, 17.98, null), null);
});

Deno.test('her own cost under Amazon is told once per price', () => {
  const a = priceAlert(live, null, null, null, read, 15, null);
  assertEquals(a?.why, 'dearer');
  assertEquals(a?.to, 17.98);
  assertEquals(priceAlert(live, null, null, null, read, 15, { price: 17.98 }), null);
  assertEquals(priceAlert(live, null, null, null, { offer: { price: 18.5 } }, 15, { price: 17.98 })?.to, 18.5);
});

Deno.test('the email links each listing to Change price and has no dashes', () => {
  const m = price([
    { title: 'Shaving foam', listing_id: '318900000001', from: 15.99, to: 17.98, price: 24.99, why: 'moved' },
    { title: 'Cheaper thing', listing_id: '318900000002', from: 9, to: 8, price: 14, why: 'moved' },
  ], shopFrom({}, 'https://portal.cartandkeep.com'));
  assertEquals(m.subject, '2 live listings changed cost');
  assertEquals(m.html.includes('https://portal.cartandkeep.com/listings?find=318900000001&amp;price=1'), true);
  assertEquals(/[\u2013\u2014]/.test(m.text + m.subject), false);
  assertEquals(m.html.indexOf('Shaving foam') < m.html.indexOf('Cheaper thing'), true);
});
