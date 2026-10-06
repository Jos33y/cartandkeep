// Run with: deno test supabase/functions/_shared/look-size_test.ts
import { forLooking } from './look-size.ts';
function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
Deno.test('Amazon, eBay and Shopify photos are asked for at 800px; others left', () => {
  assertEquals(forLooking('https://m.media-amazon.com/images/I/71abc+XYZL._AC_SL1500_.jpg'), 'https://m.media-amazon.com/images/I/71abc+XYZL._SL800_.jpg');
  assertEquals(forLooking('https://m.media-amazon.com/images/I/61Qw2.jpg'), 'https://m.media-amazon.com/images/I/61Qw2._SL800_.jpg');
  assertEquals(forLooking('https://i.ebayimg.com/images/g/abc/s-l1600.jpg'), 'https://i.ebayimg.com/images/g/abc/s-l800.jpg');
  assertEquals(forLooking('https://shop.example/cdn/shop/files/a.jpg?v=1'), 'https://shop.example/cdn/shop/files/a.jpg?v=1&width=800');
  assertEquals(forLooking('https://www.cityplumbing.co.uk/media/x.jpg'), null);
  assertEquals(forLooking('not a url'), null);
});
