// Run with: deno test supabase/functions/_shared/read_every_test.ts
import { STEADY_DAYS, WATCH_DAYS, readDue, readEvery } from './amazon.ts';

function assertEquals(a: unknown, b: unknown, what = '') {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const now = Date.parse('2026-10-07T06:00:00Z');
const steady = { found: true, read_at: '2026-10-06T06:00:00Z', offer: { price: 10, stock: 'in', sold_by: 'Amazon', fulfilled_by: 'Amazon' }, before: { price: 10 } };

Deno.test('steady listings wait three days; anything to watch is daily', () => {
  assertEquals(readEvery(steady, now), STEADY_DAYS, 'steady');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, stock: 'unknown' } }, now), STEADY_DAYS, 'stock not shown');
  assertEquals(readEvery(null, now), WATCH_DAYS, 'never read');
  assertEquals(readEvery({ ...steady, error: 'x' }, now), WATCH_DAYS, 'failed');
  assertEquals(readEvery({ ...steady, found: false }, now), WATCH_DAYS, 'page gone');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, stock: 'low' } }, now), WATCH_DAYS, 'low');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, price: null, others: { price: 9 } } }, now), WATCH_DAYS, 'no main offer');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, deal: true } }, now), WATCH_DAYS, 'deal');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, sold_by: 'TOP SAVER', fulfilled_by: 'TOP SAVER' } }, now), WATCH_DAYS, 'not Amazon');
  assertEquals(readEvery({ ...steady, offer: { ...steady.offer, sold_by: 'TOP SAVER', fulfilled_by: 'Amazon' } }, now), STEADY_DAYS, 'sent by Amazon');
  assertEquals(readEvery({ ...steady, cost_change: { at: '2026-10-03T06:00:00Z' } }, now), WATCH_DAYS, 'cost moved this week');
  assertEquals(readEvery({ ...steady, cost_change: { at: '2026-09-20T06:00:00Z' } }, now), STEADY_DAYS, 'cost moved long ago');
  assertEquals(readEvery({ ...steady, before: { price: 9 } }, now), WATCH_DAYS, 'price moved last read');
});

Deno.test('due by UK days', () => {
  assertEquals(readDue(steady, now), false, 'steady read yesterday');
  assertEquals(readDue({ ...steady, read_at: '2026-10-04T06:00:00Z' }, now), true, 'steady read three days ago');
  assertEquals(readDue({ ...steady, read_at: '2026-10-05T23:30:00Z' }, now), false, 'just after midnight UK on the 6th is one day');
  assertEquals(readDue({ ...steady, offer: { ...steady.offer, stock: 'low' } }, now), true, 'watched read yesterday');
  assertEquals(readDue({ ...steady, read_at: '2026-10-04T06:00:00Z', tried_at: '2026-10-06T06:00:00Z' }, now), false, 'a try counts');
  assertEquals(readDue(null, now), true, 'never read');
});
