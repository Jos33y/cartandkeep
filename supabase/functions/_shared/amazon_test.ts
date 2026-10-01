// Her Amazon supplier's page as Apify reads it: run with
//   deno test --allow-env --allow-read supabase/functions/_shared/amazon_test.ts
// The fixture is a real run on her SHAVINGFUN massage gun (1 October 2026), with the buyers' reviews taken out.

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };
import { asinOf, fromAxesso, isAmazon, isAmazonUk, pageFor, riskOf, runAxesso, stockOf } from './amazon.ts';

const [gun] = JSON.parse(await Deno.readTextFile(new URL('./fixtures/axesso-shavingfun.json', import.meta.url)));

Deno.test('ASINs come out of every address shape', () => {
  assertEquals(asinOf('https://www.amazon.co.uk/SHAVINGFUN-Massage-Percussion-Massager-Charging/dp/B0BDLDML22'), 'B0BDLDML22');
  assertEquals(asinOf('https://www.amazon.co.uk/dp/B0BDLDML22?psc=1'), 'B0BDLDML22');
  assertEquals(asinOf('https://www.amazon.co.uk/gp/product/b0bdldml22/ref=x'), 'B0BDLDML22');
  assertEquals(asinOf('https://www.amazon.co.uk/gp/aw/d/B0BDLDML22'), 'B0BDLDML22');
  assertEquals(asinOf('https://www.amazon.co.uk/s?k=massage+gun'), null);
  assertEquals(pageFor('B0BDLDML22'), 'https://www.amazon.co.uk/dp/B0BDLDML22?psc=1');
  assert(isAmazon('https://www.amazon.com/dp/B0BDLDML22'));
  assert(!isAmazonUk('https://www.amazon.com/dp/B0BDLDML22'));
  assert(isAmazonUk('https://amazon.co.uk/dp/B0BDLDML22'));
  assert(!isAmazon('https://www.boots.com/x'));
});

Deno.test('stock reads into five words', () => {
  assertEquals(stockOf('In stock'), 'in');
  assertEquals(stockOf('Only 3 left in stock.'), 'low');
  assertEquals(stockOf('Only 1 left in stock (more on the way).'), 'low');
  assertEquals(stockOf('Currently unavailable. We don\'t know when or if this item will be back in stock.'), 'out');
  assertEquals(stockOf('Temporarily out of stock. Order now and we\'ll deliver when available.'), 'slow');
  assertEquals(stockOf('Usually dispatched within 1 to 2 months'), 'slow');
  assertEquals(stockOf('Usually dispatched within 3 to 4 days'), 'in');
  assertEquals(stockOf(''), 'unknown');
  assertEquals(stockOf('In stock', false), 'out');
});

Deno.test('her massage gun: the facts', () => {
  const r = fromAxesso(gun, '2026-10-01T06:25:00Z');
  assertEquals(r.asin, 'B0BDLDML22');
  assert(r.found);
  const f = r.facts!;
  assertEquals(f.brand, 'SHAVINGFUN');
  assertEquals(f.model, 'BX-720');
  assertEquals(f.barcode, '734730596013');
  assertEquals(f.variant, [{ kind: 'colour', value: 'Black', asin: 'B0BDLDML22' }]);
  assertEquals(f.images.length, 9);
  assert(f.images.every((u) => u.includes('_AC_SL1500_')));
  // A bare number with no unit is not a fact; Amazon's furniture is not either.
  assert(!f.details.some((d) => d.startsWith('Charging Time')));
  assert(!f.details.some((d) => /Best Sellers|Customer Reviews|^ASIN/.test(d)));
  // The model is said three times on Amazon; once here, at the head of the text.
  assertEquals(f.details.filter((d) => d.includes('BX-720')).length, 0);
  assert(!f.details.some((d) => /^(Brand Name|Colour|Benefits):/.test(d)));
  assert(f.text.includes('Colour: Black'));
  assertEquals(f.details.filter((d) => /weight/i.test(d)).length, 1);
  assert(f.details.includes('Item Weight: 500 Grams'));
  assert(f.details.includes('Number of Packs: 1'));
  // Brackets and capitals gone, the seller's words kept.
  assert(f.bullets[0].startsWith('Perfect Design: The deep tissue'));
  assert(f.bullets[2].startsWith('Mini size & easy to carry: The portable'));
  assert(f.text.startsWith('SHAVINGFUN Mini Massage Gun'));
  assert(f.text.includes('Barcode: 734730596013'));
  assert(f.text.indexOf("Product details (Amazon's table)") < f.text.indexOf("The seller's bullet points"));
  assert(!/[\u2013\u2014]/.test(f.text));
});

Deno.test('her massage gun: the offer is a deal', () => {
  const o = fromAxesso(gun).offer;
  assertEquals(o.price, 15.28);
  assertEquals(o.was, 17.98);
  assertEquals(o.deal, true);
  assertEquals(o.shipping, 0);
  assertEquals(o.stock, 'in');
  assertEquals(o.sold_by, 'ZYFJD');
  assertEquals(o.fulfilled_by, 'Amazon');
});

Deno.test('her massage gun: reliability is the risk', () => {
  const risk = riskOf(gun)!;
  assertEquals(risk.rating, 4.3);
  assertEquals(risk.reviews, 1165);
  assertEquals(risk.concerns[0].topic, 'Reliability');
  assertEquals(risk.concerns[0].negative, 9);
  assertEquals(risk.concerns[0].mentions, 12);
  assert(risk.concerns[0].quote!.length > 12);
  // Weight is mixed at 3 of 9: under four in ten, so not a concern.
  assert(!risk.concerns.some((c) => c.topic === 'Weight'));
});

Deno.test('a page that is gone reads as out of stock', () => {
  const r = fromAxesso({ statusCode: 404, statusMessage: 'NOT_FOUND', url: 'https://www.amazon.co.uk/dp/B000000000' });
  assertEquals(r.found, false);
  assertEquals(r.offer.stock, 'out');
  assertEquals(r.facts, null);
});

Deno.test('a run is batched, the token stays in the header, answers match back by ASIN', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const asked = JSON.parse(String(init.body)).urls as string[];
    // Apify returns them in its own order, and one comes back missing.
    const items = asked.slice(1).reverse().map((u) => ({ ...gun, asin: asinOf(u), url: u }));
    return new Response(JSON.stringify(items), { status: 200 });
  }) as unknown as typeof fetch;
  const urls = Array.from({ length: 23 }, (_, i) => `https://www.amazon.co.uk/dp/B0BDLDML${String(i).padStart(2, '0')}`);
  const { reads, failed } = await runAxesso([...urls, urls[0]], 'secret-token', { fetcher });
  assertEquals(calls.length, 2);
  assert(calls.every((c) => !c.url.includes('secret-token')));
  assertEquals((calls[0].init.headers as Record<string, string>).authorization, 'Bearer secret-token');
  assertEquals(reads.size, 21);
  assertEquals(failed, ['B0BDLDML00', 'B0BDLDML20']);
  assertEquals(reads.get('B0BDLDML05')!.asin, 'B0BDLDML05');
});

Deno.test('a refused token says so', async () => {
  const fetcher = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
  let said = '';
  try { await runAxesso(['https://www.amazon.co.uk/dp/B0BDLDML22'], 't', { fetcher }); } catch (e) { said = (e as Error).message; }
  assert(said.includes('APIFY_TOKEN'));
});

Deno.test('the page a card is checked against', async () => {
  const { supplierPageOf, nextRead, failedRead, londonDay } = await import('./amazon.ts');
  const sources = [
    { id: 's1', url: 'https://www.amazon.co.uk/x/dp/B0BDLDML22', unit_cost: 15.28, landed_unit_cost: 15.28 },
    { id: 's2', url: 'https://www.amazon.co.uk/dp/B000000002', unit_cost: 12, landed_unit_cost: 12 },
    { id: 's3', url: 'https://www.boots.com/x', unit_cost: 9, landed_unit_cost: 9 },
  ];
  // Cheapest Amazon UK supplier when she has not chosen one.
  assertEquals(supplierPageOf({ draft: {} }, sources), { url: 'https://www.amazon.co.uk/dp/B000000002?psc=1', asin: 'B000000002', source_id: 's2', costed: 12 });
  // The page she sent wins, and is costed from the supplier with the same ASIN.
  assertEquals(supplierPageOf({ draft: { supplier_url: 'https://www.amazon.co.uk/dp/B0BDLDML22' } }, sources).source_id, 's1');
  assertEquals(supplierPageOf({ draft: { supplier_url: 'https://www.amazon.com/dp/B0BDLDML22' } }, sources).reason, 'not_uk');
  assertEquals(supplierPageOf({ draft: {} }, [sources[2]]).reason, 'no_amazon');

  const first = nextRead(null, fromAxesso(gun, '2026-10-01T06:00:00Z'), { source_id: 's1', costed: 15.28 });
  assertEquals(first.before, null);
  const second = nextRead(first, { ...fromAxesso(gun, '2026-10-02T06:00:00Z'), offer: { ...first.offer, price: 17.98, deal: false, was: null } }, { source_id: 's1', costed: 15.28 });
  assertEquals([second.before!.price, second.before!.read_at, second.offer.price], [15.28, '2026-10-01T06:00:00Z', 17.98]);
  const failed = failedRead(second, { url: second.url, asin: 'B0BDLDML22' }, 'timed out', '2026-10-03T06:00:00Z');
  assertEquals([failed.offer.price, failed.error, failed.tried_at], [17.98, 'timed out', '2026-10-03T06:00:00Z']);
  // Ten past midnight in summer is the next day in London, the same day in UTC.
  assertEquals(londonDay('2026-07-01T23:10:00Z'), '02/07/2026');
});
