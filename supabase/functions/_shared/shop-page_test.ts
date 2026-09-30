// Reading a shop page into the card's facts: run with
//   deno test supabase/functions/_shared/shop-page_test.ts

// jsr is not reachable from here, so the two asserts are local.
function assert(v: unknown, msg = 'assertion failed'): asserts v { if (!v) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { pageUrlOf, parseTitles, readShopPage, type Fetcher } from './shop-page.ts';

const MEDISAVE = 'https://www.medisave.co.uk/products/kinetik-wellbeing-fully-automatic-blood-pressure-monitor';

// Shaped like Shopify's product feed, as Medisave serves it.
const shopify = {
  product: {
    title: 'Kinetik Wellbeing Fully Automatic Blood Pressure Monitor',
    vendor: 'Kinetik Wellbeing',
    product_type: 'Digital Blood Pressure Monitors',
    body_html: '<p>Accurate, comfortable and fast.</p><ul><li>Measuring Accuracy - Within +/-3mmHg.</li><li>Quick release cuff fits upper arms from 22-42cm.</li></ul>',
    images: [{ src: 'https://cdn.shopify.com/a.jpg' }, { src: 'https://cdn.shopify.com/b.jpg' }],
    variants: [{ sku: 'WBP1', barcode: '5016870223499', available: true }],
  },
};

const pages = (routes: Record<string, string | null>): Fetcher => async (url) => {
  for (const [k, v] of Object.entries(routes)) if (url.includes(k)) return v;
  return null;
};

Deno.test('a shop card reads the page its cost came from', () => {
  assertEquals(pageUrlOf({ margin: { cost_from: { shop: 'medisave', url: MEDISAVE } } }), MEDISAVE);
  // An eBay card keeps its shelf first.
  assertEquals(pageUrlOf({ margin: { shelf: { url: 'https://shop.test/a' }, cost_from: { url: 'https://shop.test/b' } } }), 'https://shop.test/a');
  assertEquals(pageUrlOf({ margin: { cost_from: { url: 'not a link' } } }), null);
  assertEquals(pageUrlOf({}), null);
});

Deno.test('Shopify feed: facts, barcode, model code, and the query string dropped', async () => {
  let asked = '';
  const get: Fetcher = async (url) => { asked = url; return JSON.stringify(shopify); };
  const r = await readShopPage(`${MEDISAVE}?variant=1#top`, get);
  assert(r);
  assertEquals(asked, `${MEDISAVE}.json`);
  assertEquals(r.title, 'Kinetik Wellbeing Fully Automatic Blood Pressure Monitor');
  assertEquals(r.brand, 'Kinetik Wellbeing');
  assertEquals(r.gtin, '5016870223499');
  assertEquals(r.product_code, 'WBP1');
  assertEquals(r.shop_category, 'Digital Blood Pressure Monitors');
  assertEquals(r.features, ['Measuring Accuracy - Within +/-3mmHg.', 'Quick release cuff fits upper arms from 22-42cm.']);
  assertEquals(r.images.length, 2);
});

Deno.test('the shop\'s own name is never taken as the brand', async () => {
  const own = { product: { ...shopify.product, vendor: 'Medisave' } };
  const r = await readShopPage(MEDISAVE, async () => JSON.stringify(own));
  assertEquals(r?.brand, null);
});

Deno.test('a barcode that is not one is dropped', async () => {
  const bad = { product: { ...shopify.product, variants: [{ sku: 'X', barcode: 'N/A' }] } };
  const r = await readShopPage(MEDISAVE, async () => JSON.stringify(bad));
  assertEquals(r?.gtin, null);
});

Deno.test('no feed: the page\'s structured data, with its barcode', async () => {
  const html = `<html><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Product', name: 'Salter Scale', brand: { name: 'Salter' }, gtin13: '4006381333931', sku: 'S1', description: '<p>Weighs to 5kg</p>', image: ['https://x.test/1.jpg'] },
    { '@type': 'BreadcrumbList', itemListElement: [{ name: 'Home' }, { name: 'Kitchen' }, { name: 'Salter Scale' }] },
  ] })}</script></html>`;
  const r = await readShopPage('https://argos.test/product/123', pages({ 'argos.test/product/123': html }));
  assertEquals(r?.gtin, '4006381333931');
  assertEquals(r?.brand, 'Salter');
  assertEquals(r?.shop_category, 'Kitchen');
});

Deno.test('a broken feed falls back to the page, and nothing at all is null', async () => {
  const r = await readShopPage(MEDISAVE, pages({ '.json': '<html>not json</html>' }));
  assertEquals(r, null);
});

Deno.test('titles survive a sentence or a fence around the list', () => {
  assertEquals(parseTitles('["A", "B"]'), ['A', 'B']);
  assertEquals(parseTitles('```json\n["A","B"]\n```'), ['A', 'B']);
  assertEquals(parseTitles('Here are four titles:\n["A", "B", 3, " C "]\nHope these help.'), ['A', 'B', 'C']);
  assertEquals(parseTitles('I need more information about the product.'), null);
  // A wrapper object still gives its list.
  assertEquals(parseTitles('{"titles": ["A"]}'), ['A']);
});

Deno.test('a page\'s gallery, not just the main photo: sizes counted once, logos and badges left out', async () => {
  const html = `<html><head><meta property="og:image" content="https://shop.test/media/catalog/product/b/e/beurer-mg16.jpg">
  <script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Beurer MG 16', brand: 'Beurer', image: 'https://shop.test/media/catalog/product/b/e/beurer-mg16.jpg', description: 'Mini massager' })}</script></head>
  <body><img src="/static/logo.png"><img src="/media/wysiwyg/trustpilot-stars.png">
  <a data-zoom-image="https://shop.test/media/catalog/product/b/e/beurer-mg16-side.jpg"><img src="https://shop.test/media/catalog/product/cache/abc123/b/e/beurer-mg16-side.jpg"></a>
  <img data-src="/media/catalog/product/b/e/beurer-mg16-green.jpg?v=2" srcset="/media/catalog/product/b/e/beurer-mg16-green-300x300.jpg 300w, /media/catalog/product/b/e/beurer-mg16-green.jpg 800w">
  <img src="/media/catalog/product/cache/abc123/b/e/beurer-mg16.jpg"><img src="https://cdn.payments.test/visa.png"></body></html>`;
  const r = await readShopPage('https://shop.test/beurer-mg-16', pages({ 'shop.test/beurer-mg-16': html }));
  assertEquals(r?.images, [
    'https://shop.test/media/catalog/product/b/e/beurer-mg16.jpg',
    'https://shop.test/media/catalog/product/b/e/beurer-mg16-side.jpg',
    'https://shop.test/media/catalog/product/b/e/beurer-mg16-green.jpg?v=2',
  ]);
});

Deno.test('her supplier\'s page, once she chose it, is the page the listing is written from', () => {
  assertEquals(pageUrlOf({ draft: { page: 'https://supplier.test/gun' }, margin: { shelf: { url: 'https://shop.test/a' } } }), 'https://supplier.test/gun');
});
