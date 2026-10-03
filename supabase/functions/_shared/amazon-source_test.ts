// Task 02, pass 1: the rules that decide whether Keeper approves a candidate from Amazon. Run with
//   deno test supabase/functions/_shared/amazon-source_test.ts

import { barcodesOf, costFollow, fromAxesso } from './amazon.ts';
import { amazonWeight, candidateGtin, codesOn, fillOf, multipackOf, notNew, packedKg, variantConflict, weightKg, judge, keeperGtin, packDoubt, pence, pickResult, runSearch, sameCode, sentByAmazon, titleMatch } from './amazon-source.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };

// An Axesso product page, as small as the reader needs.
const page = (over: Record<string, unknown> = {}) => fromAxesso({
  statusCode: 200, statusMessage: 'FOUND', asin: 'B00NUTELLA', title: 'Nutella Hazelnut Spread 400g', price: 3.46,
  productDetails: [{ name: 'EAN', value: '3017620422003' }, { name: 'Brand', value: 'Nutella' }],
  warehouseAvailability: 'In stock', soldBy: 'Amazon', fulfilledBy: 'Amazon', imageUrlList: ['https://m.media-amazon.com/x.jpg'],
  ...over,
}, '2026-10-03T12:00:00.000Z');
const nutella = { title: 'Nutella Hazelnut Chocolate Spread 400g Jar' };

Deno.test('the barcode rule matches keeper_gtin in SQL (0133)', () => {
  assertEquals(keeperGtin('3017620422003'), '3017620422003');
  assertEquals(keeperGtin('10279904244'), '010279904244');
  assertEquals(keeperGtin('116044608'), '000116044608');
  assertEquals(keeperGtin('96385074'), '96385074');
  assertEquals(keeperGtin('5012345678901'), null);
  assertEquals(keeperGtin('Does not apply'), null);
  assertEquals(keeperGtin(' 30176 20422003 '), '3017620422003');
  assertEquals(candidateGtin({ margin: { shelf: { gtin: 'bad' }, gtin: '3017620422003' } }), '3017620422003');
  assertEquals(candidateGtin({ margin: {}, listing: { ean: '734730596013' } }), '734730596013');
  assertEquals(candidateGtin({ margin: { gtin: 'Does not apply' } }), null);
});

Deno.test('a UPC and its EAN with a leading 0 are the same code', () => {
  assert(sameCode('734730596013', '0734730596013'));
  assert(sameCode('010279904244', '10279904244'));
  assert(!sameCode('3017620422003', '3017620422010'));
  assert(!sameCode('', ''));
});

Deno.test('every barcode on the page is kept, even two on one line', () => {
  const item = { productDetails: [{ name: 'EAN', value: '5012345678900, 5012345678917' }, { name: 'Item weight', value: '400 g' }] };
  assertEquals(barcodesOf(item), ['5012345678900', '5012345678917']);
  // The details table drops a bare number, so the codes are kept apart for the match.
  assertEquals(codesOn(page()), ['3017620422003']);
});

Deno.test('the same barcode, sold by Amazon, in stock: approved at the price', () => {
  const v = judge(nutella, '3017620422003', page());
  assert(v.ok, JSON.stringify(v));
  if (v.ok) {
    assertEquals(v.cost, 3.46);
    assertEquals(v.line, 'Same barcode on Amazon, £3.46, sold by Amazon, in stock.');
  }
});

Deno.test('a 12-digit UPC on the card matches its 13-digit EAN on Amazon', () => {
  const v = judge({ title: 'SHAVINGFUN Mini Massage Gun' }, '734730596013',
    page({ asin: 'B0BDLDML22', title: 'SHAVINGFUN Mini Massage Gun 6 Speeds with 4 Heads', productDetails: [{ name: 'EAN', value: '0734730596013' }], soldBy: 'ZYFJD', fulfilledBy: 'Amazon' }));
  assert(v.ok, JSON.stringify(v));
});

Deno.test('on a deal the cost is the deal price: what she pays for an order today', () => {
  const v = judge(nutella, '3017620422003', page({ price: 2.99, retailPrice: 3.46 }));
  assert(v.ok && v.cost === 2.99, JSON.stringify(v));
  if (v.ok) assert(/on a deal \(usually £3.46\)/.test(v.why), v.why);
});

Deno.test('another barcode on the page is left; a page with no barcode is the search\'s match (LEGO)', () => {
  const other = judge(nutella, '3017620422003', page({ productDetails: [{ name: 'EAN', value: '3017620425035' }] }));
  assert(!other.ok && /another barcode/.test(other.line), JSON.stringify(other));
  const lego = judge({ title: 'Lego 77260' }, '5702017583921', page({
    asin: 'B0FPXF65PH', title: 'LEGO Speed Champions The Fast and The Furious Toyota Supra MK4-77260', price: 16.09,
    productDetails: [{ name: 'Brand', value: 'LEGO' }], soldBy: 'Amazon', fulfilledBy: 'Amazon',
  }));
  assert(lego.ok, JSON.stringify(lego));
  if (lego.ok) {
    assert(/search for 5702017583921 found it/.test(lego.why), lego.why);
    assertEquals(lego.line, 'Found by its barcode on Amazon, £16.09, sold by Amazon, in stock.');
  }
});

Deno.test('one result is the product; more than one, the title picks it', () => {
  assertEquals(pickResult('Lego 42676', [{ asin: 'B0FPXGQ1DK', title: 'Something else entirely', position: 0 }]), { asin: 'B0FPXGQ1DK', via: 'only' });
  // LEGO's model number is in the card's title: the result carrying it is the product.
  assertEquals(pickResult('Lego 43249', [
    { asin: 'B0OTHERSET', title: 'LEGO Disney Stitch keyring', position: 0 },
    { asin: 'B0CFVZG5TR', title: 'LEGO | Disney Stitch Toy - Play & Display Figure - 43249', position: 1 },
  ]), { asin: 'B0CFVZG5TR', via: 'title' });
  // Words, when the card has no model number: the best match wins, a pack of three does not.
  assertEquals(pickResult('Nutella Hazelnut Chocolate Spread 400g Jar', [
    { asin: 'B00PACK003', title: 'Nutella 400g (Pack of 3)', position: 0 },
    { asin: 'B00NUTELLA', title: 'Nutella Hazelnut Spread 400g', position: 1 },
  ]), { asin: 'B00NUTELLA', via: 'title' });
  // None matching: left for the full check.
  const none = pickResult('Lego 21357', [{ asin: 'A', title: 'LEGO Ideas 21350', position: 0 }, { asin: 'B', title: 'Desk lamp', position: 1 }]);
  assertEquals(none.asin, null);
  assertEquals(pickResult('Lego 21357', []).asin, null);
  assertEquals(titleMatch('Lego 77260', 'LEGO Speed Champions Toyota Supra MK4-77260'), 1);
});

Deno.test('another pack on the page rules it out', () => {
  const three = judge(nutella, '3017620422003', page({ title: 'Nutella Hazelnut Spread 400g (Pack of 3)' }));
  assert(!three.ok && three.line === 'Another pack on Amazon.', JSON.stringify(three));
  const six = judge({ title: 'Coca-Cola Classic 330ml can' }, '5449000000996',
    page({ title: 'Coca-Cola Original Taste 24 x 330ml', productDetails: [{ name: 'EAN', value: '5449000000996' }] }));
  assert(!six.ok, JSON.stringify(six));
  // Number of Items alone is a warning, not a rule-out (Amazon fills it loosely).
  const items = judge(nutella, '3017620422003', page({ productDetails: [{ name: 'EAN', value: '3017620422003' }, { name: 'Number of Items', value: '4' }] }));
  assert(items.ok && /Amazon lists 4 items/.test(items.warnings.join(' ')), JSON.stringify(items));
  const kilo = packDoubt('Nutella 400g', page({ title: 'Nutella Hazelnut Spread 1kg' }));
  assert(kilo && /1000g/.test(kilo), String(kilo));
  // The same pack on both sides is no doubt.
  assertEquals(packDoubt('Nutella 400g (Pack of 3)', page({ title: 'Nutella Hazelnut Spread 400g, Pack of 3' })), null);
  // Unit count is a size on Amazon, not a pack.
  assertEquals(packDoubt('Nutella 400g', page({ productDetails: [{ name: 'Unit count', value: '400.0 Gram' }] })), null);
});

Deno.test('the right product is sourced whatever its stock: the stock is saved for Approved', () => {
  const out = judge(nutella, '3017620422003', page({ warehouseAvailability: 'Currently unavailable.', price: null }));
  assert(out.ok && out.cost === null && out.status === 'unavailable', JSON.stringify(out));
  if (out.ok) assertEquals(out.line, 'Same barcode on Amazon, no price now, sold by Amazon, out of stock.');
  const slow = judge(nutella, '3017620422003', page({ warehouseAvailability: 'Usually dispatched within 1 to 2 months' }));
  assert(slow.ok && slow.status === 'quoted' && /slow to dispatch/.test(slow.line), JSON.stringify(slow));
  assert(judge(nutella, '3017620422003', page({ warehouseAvailability: 'Only 2 left in stock.' })).ok);
});

Deno.test('the right product is sourced whoever sells it: another seller and its delivery are saved', () => {
  assert(sentByAmazon({ sold_by: 'ZYFJD', fulfilled_by: 'Amazon' }));
  assert(sentByAmazon({ sold_by: 'Amazon.co.uk', fulfilled_by: null }));
  assert(!sentByAmazon({ sold_by: 'Bargain Grocer', fulfilled_by: 'Bargain Grocer', prime: true }));
  // Doctor Doom, 3 October: sold and sent by Planszowski, dispatched in 7 to 8 days.
  const doom = judge({ title: 'Lego 76345' }, '5702017589626', page({
    asin: 'B0DOOM', title: 'LEGO Marvel Doctor Doom Bust 76345', price: 41.81, retailPrice: 44.99, shippingPrice: 3.99,
    productDetails: [{ name: 'Brand', value: 'LEGO' }], soldBy: 'Planszowski-co-uk', fulfilledBy: 'Planszowski-co-uk',
    warehouseAvailability: 'Usually dispatched within 7 to 8 days',
  }));
  assert(doom.ok, JSON.stringify(doom));
  if (doom.ok) {
    assertEquals([doom.cost, doom.delivery, doom.status], [41.81, 3.99, 'quoted']);
    assertEquals(doom.line, 'Found by its barcode on Amazon, £41.81, sold by Planszowski-co-uk, £3.99 delivery, in stock.');
    // The reader counts dispatch within days as in stock; weeks or months as slow.
  }
  // Sent by Amazon for another seller: no delivery charge to her.
  const fba = judge(nutella, '3017620422003', page({ soldBy: 'ZYFJD', fulfilledBy: 'Amazon', shippingPrice: 2 }));
  assert(fba.ok && fba.delivery === null && /sent by Amazon for ZYFJD/.test(fba.line), JSON.stringify(fba));
});

Deno.test('a page that is gone is not approved', () => {
  assert(!judge(nutella, '3017620422003', fromAxesso({ statusCode: 404, statusMessage: 'NOT_FOUND', asin: 'B00NUTELLA' })).ok);
});

Deno.test('what a lookup costs, in pence', () => {
  // One result found and two pages read: 1 cent plus 0.3 cents, at 75p to the dollar.
  assertEquals(pence(1, 2), 0.98);
  assertEquals(pence(0, 0), 0);
  // A full page of 40 results and no read: 40 cents, 30p.
  assertEquals(pence(40, 0), 30);
});

Deno.test('the search: one run for many barcodes, sponsored left out, every result counted', async () => {
  let sent: any = null;
  let auth = '';
  const fetcher = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    auth = String((init.headers as Record<string, string>).authorization);
    return new Response(JSON.stringify([
      { keyword: '3017620422003', asin: 'B00SPONSOR', sponsored: true, searchResultPosition: 0 },
      { keyword: '3017620422003', asin: 'b00nutella', sponsored: false, searchResultPosition: 1, productDescription: 'Nutella 400g', price: 3.46 },
      { keyword: '5449000000996', statusMessage: 'FOUND', resultCount: 0 },
    ]), { status: 200 });
  }) as unknown as typeof fetch;
  const { found, perCode, results } = await runSearch(['3017620422003', '5449000000996'], 'TOKEN', { fetcher });
  assertEquals(sent.input.map((x: any) => [x.keyword, x.domainCode, x.maxPages, x.sortBy]), [
    ['3017620422003', 'co.uk', 1, 'relevanceblender'], ['5449000000996', 'co.uk', 1, 'relevanceblender']]);
  assertEquals(auth, 'Bearer TOKEN');
  assertEquals(found.get('3017620422003')!.map((x) => x.asin), ['B00NUTELLA']);
  assertEquals(found.get('5449000000996'), undefined);
  assertEquals(perCode.get('3017620422003'), 2);
  assertEquals(results, 2);
});

Deno.test('the search says when Apify is out of credit', async () => {
  const fetcher = (async () => new Response('', { status: 402 })) as unknown as typeof fetch;
  let said = '';
  try { await runSearch(['3017620422003'], 'T', { fetcher }); } catch (e) { said = (e as Error).message; }
  assertEquals(said, 'The Apify account is out of credit.');
});

Deno.test('her cost follows Amazon on the route she sends herself, postage left as hers', () => {
  const r = page({ price: 17.98, shippingPrice: 4.99 });
  const stock = { fulfilment: 'stock', cost_by: 'amazon', unit_cost: 15.28, price_at_moq: 15.28, supplier_shipping: null };
  const f = costFollow(null, r, stock);
  assertEquals(f && [f.from, f.to, f.shipping], [15.28, 17.98, null]);
  // An import (freight or duty) is not an Amazon price.
  assertEquals(costFollow(null, r, { ...stock, cost_by: null, unit_cost: 9.5, price_at_moq: 9.5, inbound_freight_per_unit: 1.2 }), null);
  // Her own cost is never moved.
  assertEquals(costFollow(null, r, { ...stock, cost_by: 'her' }), null);
  // Another seller's delivery to her follows on her route; Amazon sending it clears it.
  const seller = page({ price: 41.81, shippingPrice: 3.99, soldBy: 'Planszowski-co-uk', fulfilledBy: 'Planszowski-co-uk' });
  const kept = costFollow(null, seller, { ...stock, unit_cost: 41.81, price_at_moq: 41.81, inbound_freight_per_unit: null });
  assertEquals(kept && [kept.to, kept.freight], [41.81, 3.99]);
  const cleared = costFollow(null, page({ price: 41.81, soldBy: 'Amazon', fulfilledBy: 'Amazon' }), { ...stock, unit_cost: 41.81, price_at_moq: 41.81, inbound_freight_per_unit: 3.99 });
  assertEquals(cleared && [cleared.to, cleared.freight], [41.81, null]);
  // Dropship as before: the postage follows too.
  const d = costFollow(null, r, { ...stock, fulfilment: 'dropship' });
  assertEquals(d && [d.to, d.shipping], [17.98, 4.99]);
  // Already at the price: nothing moves.
  assertEquals(costFollow(null, page({ price: 17.98 }), { ...stock, unit_cost: 17.98, price_at_moq: 17.98 }), null);
});

Deno.test('a deal: the cost is the deal price, and its end moves the cost and is named', () => {
  // The Peace Lily: £35.99 against an RRP of £54.99. Costed at the RRP before 3 October; the next read corrects it.
  const lily = page({ price: 35.99, retailPrice: 54.99 });
  const stock = { fulfilment: 'stock', cost_by: 'amazon', unit_cost: 54.99, price_at_moq: 54.99, supplier_shipping: null };
  const down = costFollow(null, lily, stock);
  assertEquals(down && [down.from, down.to, down.why], [54.99, 35.99, 'price']);
  // The deal ends: back to £54.99, and the change says why.
  const prev = { asin: 'B00NUTELLA', offer: lily.offer };
  const up = costFollow(prev, page({ price: 54.99 }), { ...stock, unit_cost: 35.99, price_at_moq: 35.99 });
  assertEquals(up && [up.from, up.to, up.why], [35.99, 54.99, 'deal_ended']);
});

Deno.test('the card is filled from the reading: facts, link, the weight packed (as the portal does)', () => {
  const r = page({ productDetails: [{ name: 'EAN', value: '3017620422003' }, { name: 'Item Weight', value: '820 g' }] });
  assertEquals(amazonWeight(r), 0.82);
  // 820g packed: 15% more is 943g, rounded up to the next 50g.
  assertEquals(packedKg(0.82), 0.95);
  // A small item gets at least 50g more: 100g becomes 150g.
  assertEquals(packedKg(0.1), 0.15);
  assertEquals([weightKg('1.2 kilograms'), weightKg('2 lbs'), weightKg('about nothing')], [1.2, 0.907, null]);
  const f = fillOf(r);
  assertEquals([f.supplier_url, f.weight_kg], ['https://www.amazon.co.uk/dp/B00NUTELLA?psc=1', 0.95]);
  assert(/Brand: Nutella|Nutella Hazelnut Spread 400g/.test(String(f.supplier_text)), String(f.supplier_text));
});

// Titles from the 3 October runs and the ones likely to come next. Only real multipacks are ruled out.
const pageTitled = (title: string, over: Record<string, unknown> = {}) => page({ title, ...over });
Deno.test('packs: what is inside one product is never a pack; a named multipack is', () => {
  const cases: Array<[string, string, boolean]> = [
    ['Lego 77260', 'LEGO Speed Champions Toyota Supra MK4 77260, Building Kit, 292 Pieces', false],
    ['Stanley socket set', 'STANLEY 1/4 and 1/2 Inch Socket Set, 108 Pcs', false],
    ['Fairy Platinum dishwasher tablets', 'Fairy Platinum Plus Dishwasher Tablets, 75 Tablets', false],
    ['Dettol spray', 'Dettol Antibacterial Surface Spray 500ml with 2 x 500ml Refills', false],
    ['Pedigree Dentastix', 'Pedigree Dentastix Daily Dental Chews, 28 Sticks', false],
    ['Dryzone Mould Remover Prevention Kit', 'Dryzone Mould Remover and Prevention Kit (3 x 450ml spray)', false],
    ['Shavingfun massage gun', 'SHAVINGFUN Mini Massage Gun, 6 Speeds, 4 Heads', false],
    ['Nutella 400g', 'Nutella Hazelnut Spread, 400g (Pack of 3)', true],
    ['Wet Forget Mould Lichen Algae Remover', 'Wet & Forget Moss Mould Lichen & Algae Remover 2 x 2L', true],
    ['Coca-Cola Classic 330ml can', 'Coca-Cola Original Taste 24 x 330ml', true],
    ['Red Bull 250ml', 'Red Bull Energy Drink 250ml x 12', true],
    ['Andrex toilet tissue', 'Andrex Classic Clean Toilet Tissue, 9 Pack', true],
    ['Fairy liquid', 'Fairy Original Washing Up Liquid, Twin Pack', true],
    ['Pedigree Dentastix 7 sticks', 'Pedigree Dentastix Daily Dental Chews, 28 Sticks', true],
    ['Nutella 400g (Pack of 3)', 'Nutella Hazelnut Spread 400g, Pack of 3', false],
    ['Nutella 400g', 'Nutella Hazelnut Spread 1kg', true],
  ];
  for (const [card, amazon, out] of cases) {
    const said = packDoubt(card, pageTitled(amazon));
    assert(Boolean(said) === out, `${card} vs ${amazon}: ${said ?? 'passes'}`);
  }
  assertEquals(multipackOf('Andrex 9 Pack')?.n, 9);
  assertEquals(multipackOf('Kit (3 x 450ml spray)'), null);
});

Deno.test('a renewed or used listing is ruled out: she sells new', () => {
  const r = pageTitled('Philips Hue Bridge (Renewed)');
  assert(notNew(r));
  const v = judge({ title: 'Philips Hue Bridge' }, '3017620422003', r);
  assert(!v.ok && v.line === 'Not new on Amazon.', JSON.stringify(v));
  assert(!notNew(pageTitled('Philips Hue Bridge, New Edition')));
});

Deno.test('a bundle, or a price far over the research, is approved with a warning for Approved', () => {
  const bundle = judge(nutella, '3017620422003', pageTitled('Nutella Hazelnut Spread 400g + Free Spoon'));
  assert(bundle.ok && /a bundle/.test(bundle.warnings.join(' ')) && /One thing to check/.test(bundle.line), JSON.stringify(bundle));
  const dear = judge({ title: 'Nutella 400g', margin: { shelf: { price: 3.2 } } }, '3017620422003', pageTitled('Nutella Hazelnut Spread 400g', { price: 9.6 }));
  assert(dear.ok && /3\.0 times the £3\.20/.test(dear.warnings.join(' ')), JSON.stringify(dear));
  const fair = judge({ title: 'Nutella 400g', margin: { shelf: { price: 3.2 } } }, '3017620422003', pageTitled('Nutella Hazelnut Spread 400g', { price: 3.46 }));
  assert(fair.ok && fair.warnings.length === 0, JSON.stringify(fair));
});

Deno.test('more than one result: another colour, size or weight is another variant', () => {
  assertEquals(variantConflict('Minky Reflex Mop Black', 'Minky Reflex Mop, White'), 'white on Amazon, black on this card');
  assertEquals(variantConflict('Silentnight electric blanket double', 'Silentnight Electric Blanket, King'), 'king on Amazon, double on this card');
  assertEquals(variantConflict('Nutella 400g', 'Nutella Hazelnut Spread 750g'), '750 on Amazon, 400 on this card');
  assertEquals(variantConflict('Minky Reflex Mop', 'Minky Reflex Mop, White'), null);
  assertEquals(pickResult('Minky Reflex Mop Black', [
    { asin: 'WHITE', title: 'Minky Reflex Mop White', position: 0 },
    { asin: 'BLACK', title: 'Minky Reflex Mop Black', position: 1 },
  ]), { asin: 'BLACK', via: 'title' });
});

Deno.test('no seller shown is said so, not "another seller"', () => {
  const v = judge(nutella, '3017620422003', page({ soldBy: null, fulfilledBy: null, price: null, warehouseAvailability: null }));
  assert(v.ok && /no price now, no seller shown, stock not shown/.test(v.line), JSON.stringify(v));
});
