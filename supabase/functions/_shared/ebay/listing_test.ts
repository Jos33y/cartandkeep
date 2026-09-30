// The listing rules with eBay mocked: run with
//   deno test --allow-env supabase/functions/_shared/ebay/listing_test.ts

// jsr is not reachable from here, so the two asserts are local.
function assert(v: unknown, msg = 'assertion failed'): asserts v { if (!v) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { validGtin, gtinOf, prepare, publish, mergeAspects, skuOf } from './listing.ts';

Deno.env.set('EBAY_CLIENT_ID', 'x'); Deno.env.set('EBAY_CLIENT_SECRET', 'y');

const calls: Array<{ url: string; method: string; body: any }> = [];
function mockFetch(routes: Record<string, (url: string, init: RequestInit) => [number, any]>) {
  calls.length = 0;
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : null });
    for (const [k, fn] of Object.entries(routes)) {
      if (url.includes(k)) { const [status, body] = fn(url, init); return new Response(body == null ? null : JSON.stringify(body), { status }); }
    }
    return new Response(JSON.stringify({ errors: [{ message: `unmocked ${url}` }] }), { status: 500 });
  }) as typeof fetch;
}

const EAN = '4006381333931';
const baseRoutes = {
  get_category_suggestions: () => [200, { categorySuggestions: [{ category: { categoryId: '999', categoryName: 'Suggested Cat' } }] }],
  get_item_aspects_for_category: () => [200, { aspects: [
    { localizedAspectName: 'Brand', aspectConstraint: { aspectRequired: true } },
    { localizedAspectName: 'Type', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY' }, aspectValues: [{ localizedValue: 'Gel' }, { localizedValue: 'Cream' }] },
    { localizedAspectName: 'Colour', aspectConstraint: { aspectRequired: false } },
  ] }],
  'product_summary/search': () => [200, { productSummaries: [{ epid: '123456', title: 'Cat title', image: { imageUrl: 'https://i.ebayimg.com/cat1.jpg' }, additionalImages: [{ imageUrl: 'https://i.ebayimg.com/cat2.jpg' }], aspects: [{ localizedName: 'Type', localizedValues: ['Cream'] }] }] }],
} as Record<string, any>;
const tokens = { user: 'U', app: async () => 'A' };

const card = (x: any = {}) => ({
  id: 'abcd-1234-efgh-5678-ijkl', title: 'Flexitol heel balm', image_url: 'https://i.ebayimg.com/competitor.jpg',
  margin: { sale_price: 12.36, shelf: { gtin: EAN } },
  listing: { title: 'Flexitol Heel Balm 40g', description: 'Buy Flexitol at Home Bargains', images: ['https://hb.example/shop1.jpg'], brand: 'Flexitol' },
  draft: {}, ebay: null, ebay_category_id: 111, ebay_category_path: 'Health & Beauty > Foot Care > Creams',
  ...x,
});

Deno.test('barcodes: check digit and shape', () => {
  assertEquals(validGtin(EAN), EAN);
  assertEquals(validGtin('4006381333932'), null);
  assertEquals(validGtin('HB-12345'), null);
  assertEquals(gtinOf(card()), EAN);
});

Deno.test('a bare card cannot go up, and nothing falls back to the shop', async () => {
  mockFetch({ ...baseRoutes, 'product_summary/search': () => [404, { errors: [{ message: 'none' }] }] });
  const p = await prepare(card(), {}, tokens);
  const text = p.problems.join(' ');
  assert(text.includes('No title of hers'));
  assert(text.includes('No description of hers'));
  assert(text.includes('No photos of hers'));
  assert(text.includes('No parcel weight'));
  assertEquals(p.title, '');
  assertEquals(p.images, []);
});

Deno.test('the shop\'s photos and the competitor\'s photo are refused; the shop\'s wording is refused', async () => {
  mockFetch(baseRoutes);
  const p = await prepare(card({ draft: { title: 'Flexitol Heel Balm 40g', description: 'Buy Flexitol at Home Bargains', images: ['https://hb.example/shop1.jpg', 'https://i.ebayimg.com/competitor.jpg'], package: { weight_kg: 0.1 }, aspects: { Type: 'Cream' } } }), {}, tokens);
  const text = p.problems.join(' ');
  assert(text.includes("2 of the photos are the shop's or another seller's"), text);
  assert(text.includes("the shop's own wording"), text);
});

Deno.test('her card: category from the card, eBay\'s guess reported when it differs, required details enforced', async () => {
  mockFetch(baseRoutes);
  const ok = card({ draft: { title: 'Flexitol Heel Balm 40g Rich Moisturising', description: 'For dry heels.', images: ['https://store.example/her1.jpg'], package: { weight_kg: 0.1 } } });
  let p = await prepare(ok, {}, tokens);
  assertEquals(p.category, { id: '111', name: 'Creams', source: 'card' });
  assertEquals(p.suggested?.id, '999');
  assert(p.categoryDiffers);
  assertEquals(p.missing.map((a) => a.name), ['Type']);
  assert(p.problems.some((x) => x.includes('eBay needs Type')));
  // Brand is filled from the listing facts, so it is never missing.
  assertEquals(p.aspects.Brand, ['Flexitol']);
  p = await prepare({ ...ok, draft: { ...ok.draft, aspects: { type: 'Cream' } } }, {}, tokens);
  assertEquals(p.missing.length, 0);
  assertEquals(p.problems, []);
  assertEquals(p.imageSource, 'hers');
});

Deno.test('the catalogue: chosen with no photos of hers, its photos, ePID and details go up', async () => {
  mockFetch(baseRoutes);
  const c = card({ draft: { title: 'Flexitol Heel Balm 40g', description: 'For dry heels.', package: { weight_kg: 0.1 } } });
  const p = await prepare(c, { use_catalogue: true }, tokens);
  assertEquals(p.imageSource, 'catalogue');
  assertEquals(p.images, ['https://i.ebayimg.com/cat1.jpg', 'https://i.ebayimg.com/cat2.jpg']);
  assertEquals(p.aspects.Type, ['Cream']);
  assertEquals(p.problems, []);
  // Tried with her token first.
  assert(calls.find((x) => x.url.includes('product_summary'))!.url.includes(EAN));
});

Deno.test('the catalogue falls back to the app token when hers is refused, and says so when both are', async () => {
  let n = 0;
  mockFetch({ ...baseRoutes, 'product_summary/search': () => (++n === 1 ? [403, { errors: [{ message: 'Insufficient scope' }] }] : [200, { productSummaries: [{ epid: '9', image: { imageUrl: 'https://i.ebayimg.com/c.jpg' } }] }]) });
  const c = card({ draft: { title: 'T', description: 'D', package: { weight_kg: 0.1 }, aspects: { Type: 'Cream' } } });
  let p = await prepare(c, { use_catalogue: true }, tokens);
  assertEquals(p.catalogue?.epid, '9');
  mockFetch({ ...baseRoutes, 'product_summary/search': () => [403, { errors: [{ message: 'Insufficient scope' }] }] });
  p = await prepare(c, { use_catalogue: true }, tokens);
  assertEquals(p.catalogue, null);
  assert(p.catalogueError?.includes('Insufficient scope'));
  assert(p.problems.some((x) => x.includes('No photos of hers')));
});

Deno.test('publish: inventory item with barcode and details, a new offer in the card\'s category, then publish', async () => {
  mockFetch({
    ...baseRoutes,
    '/inventory_item/': () => [204, null],
    '/offer?sku=': () => [404, { errors: [{ message: 'none' }] }],
    '/offer/OFF1/publish': () => [200, { listingId: '555' }],
    '/sell/inventory/v1/offer': () => [201, { offerId: 'OFF1' }],
  });
  const c = card({ draft: { title: 'Flexitol Heel Balm 40g', description: 'For dry heels.\n\n- Rich\n- Fast', images: ['https://store.example/her1.jpg'], package: { weight_kg: 0.1, length_cm: 35, width_cm: 25, height_cm: 2.5 }, aspects: { Type: 'Cream' } } });
  const p = await prepare(c, { price: 12.36, quantity: 5 }, tokens);
  const s = { fulfillment: 'F', payment: 'P', return: 'R', location: 'L' };
  const rec = await publish(c, p, s, 'U');
  const item = calls.find((x) => x.url.includes('/inventory_item/') && x.method === 'PUT')!;
  assertEquals(item.url.endsWith(skuOf(c.id)), true);
  assertEquals(item.body.product.ean, [EAN]);
  assertEquals(item.body.product.imageUrls, ['https://store.example/her1.jpg']);
  assertEquals(item.body.product.aspects.Type, ['Cream']);
  assert(item.body.product.description.includes('<ul><li>Rich</li><li>Fast</li></ul>'));
  assertEquals(item.body.packageWeightAndSize.weight.value, 0.1);
  const offer = calls.find((x) => x.url.endsWith('/sell/inventory/v1/offer') && x.method === 'POST')!;
  assertEquals(offer.body.categoryId, '111');
  assertEquals(offer.body.pricingSummary.price.value, '12.36');
  assertEquals(offer.body.availableQuantity, 5);
  assertEquals(rec.listing_id, '555');
  assertEquals(rec.images_from, 'hers');
  assert(rec.published_at);
});

Deno.test('publish refuses a card with problems, without calling eBay', async () => {
  mockFetch(baseRoutes);
  const c = card();
  const p = await prepare(c, {}, tokens);
  calls.length = 0;
  let threw = false;
  try { await publish(c, p, {}, 'U'); } catch (e) { threw = true; assertEquals((e as any).status, 400); }
  assert(threw);
  assertEquals(calls.length, 0);
});

Deno.test('revising a listing that went up before the rule keeps its copy, so a price change is not held back', async () => {
  mockFetch(baseRoutes);
  const c = card({ ebay: { listing_id: '1', offer_id: 'O', category_id: '111' } });
  const p = await prepare(c, { price: 13 }, tokens, { revising: true });
  assertEquals(p.legacy, true);
  assertEquals(p.problems, []);
  assertEquals(p.title, 'Flexitol Heel Balm 40g');
});

Deno.test('her values win over the catalogue\'s, keys matched without case', () => {
  assertEquals(mergeAspects({ Brand: 'A', Type: 'Gel' }, { type: 'Cream' }), { Brand: ['A'], Type: ['Cream'] });
});
