// The photo rules: run with
//   deno test supabase/functions/_shared/photos_test.ts

function assert(v: unknown, msg = 'assertion failed'): asserts v { if (!v) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { brandRuleFor, imageSize, judge, parseSeen, photoSource, smaller, sourceOf, toBase64 } from './photos.ts';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

Deno.test('image sizes from the first bytes', () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(1200), ...be32(800), 8, 2);
  assertEquals(imageSize(png), { type: 'image/png', width: 1200, height: 800 });
  // JPEG: an APP0 segment to skip, then SOF0 with height 600, width 450.
  const jpg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0x02, 0x58, 0x01, 0xc2, 3, 0, 0, 0);
  assertEquals(imageSize(jpg), { type: 'image/jpeg', height: 600, width: 450 });
  const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02, 0);
  assertEquals(imageSize(gif), { type: 'image/gif', width: 800, height: 600 });
  const w = 1599; const h = 999;
  const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0,
    w & 255, (w >> 8) & 255, (w >> 16) & 255, h & 255, (h >> 8) & 255, (h >> 16) & 255, 0, 0);
  assertEquals(imageSize(webp), { type: 'image/webp', width: 1600, height: 1000 });
  assertEquals(imageSize(bytes(1, 2, 3, 4, 5)), null);
});

Deno.test('the verdict: a clean product shot passes; each problem is named in her words', () => {
  const clean = { shop_mark: false, watermark: false, promo: false, overlay: false, background: 'plain', shows: 'product', pack: 'matches' };
  assertEquals(judge(clean, { width: 1000, height: 1000 }, 'medisave.co.uk'), { ok: true, reasons: [] });
  assertEquals(judge({ ...clean, pack: 'unclear' }, { width: 1000, height: 1000 }, null).ok, true);
  const bad = judge({ ...clean, shop_mark: true, promo: true, overlay: true, background: 'scene', pack: 'differs', note: '4 pack, card is 12' }, { width: 400, height: 300 }, 'medisave.co.uk');
  assertEquals(bad.ok, false);
  assertEquals(bad.reasons, [
    'Too small for eBay, 400 x 300',
    "Shop's name or logo on it",
    'A price, an offer or ratings laid over it',
    'A different pack or product: 4 pack, card is 12',
  ]);
  assertEquals(judge(null, { width: 900, height: 900 }, null), { ok: false, reasons: ['Could not be checked'] });
});

Deno.test('the maker\'s callouts, a lifestyle shot or a diagram pass, but only as extras after the first photo', () => {
  const clean = { shop_mark: false, watermark: false, promo: false, overlay: false, background: 'plain', shows: 'product', pack: 'matches' };
  assertEquals(judge({ ...clean, overlay: true }, { width: 1500, height: 1500 }, 'amazon.co.uk'), { ok: true, reasons: [], extra: true, notes: ["The maker's text on it"] });
  assertEquals(judge({ ...clean, overlay: true, background: 'scene' }, null, null).notes, ["The maker's text on it", 'A lifestyle shot']);
  assertEquals(judge({ ...clean, shows: 'other' }, null, null), { ok: true, reasons: [], extra: true, notes: ['A chart or diagram'] });
  // Selling text or another shop's name is never used, however good the photo.
  assertEquals(judge({ ...clean, overlay: true, promo: true }, null, null).ok, false);
  assertEquals(judge({ ...clean, shop_mark: true, background: 'scene' }, null, null).ok, false);
});

Deno.test('brands on the list match as words, not inside other words', () => {
  const rules = [{ brand: 'Lego', rule: 'catalogue_only' }, { brand: 'Apple', rule: 'catalogue_only' }];
  assertEquals(brandRuleFor(rules, 'LEGO', 'Lego 21277 Batman')?.brand, 'Lego');
  assertEquals(brandRuleFor(rules, null, 'Lego Technic set')?.brand, 'Lego');
  assertEquals(brandRuleFor(rules, 'Kinetik', 'Pineapple slicer'), null);
  assertEquals(brandRuleFor(rules, 'Kinetik', 'Legoland bag'), null);
});

Deno.test('where a photo comes from, per channel', () => {
  const c = {
    image_url: 'https://i.ebayimg.com/seller.jpg',
    listing: { images: ['https://shop.test/a.jpg', 'https://shop.test/b.jpg'] },
    draft: { uploads: ['https://her.test/1.jpg'], catalogue: { epid: '9', images: ['https://i.ebayimg.com/cat.jpg'] } },
    photo_checks: { brand: 'Kinetik', brand_rule: null, images: [{ url: 'https://shop.test/a.jpg', ok: true }, { url: 'https://shop.test/b.jpg', ok: false, reasons: ['Watermarked'] }] },
  };
  assertEquals(sourceOf('https://her.test/1.jpg', c), { url: 'https://her.test/1.jpg', source: 'hers', ok: true });
  assertEquals(sourceOf('https://shop.test/a.jpg', c, 'shop').ok, true);
  // Keepr's check advises; a photo it flagged still goes up if she put it in the card.
  assertEquals(sourceOf('https://shop.test/b.jpg', c), { url: 'https://shop.test/b.jpg', source: 'shop', ok: true });
  assertEquals(sourceOf('https://supplier.test/unchecked.jpg', c).ok, true);
  assertEquals(sourceOf('https://i.ebayimg.com/cat.jpg', c, 'ebay').ok, true);
  assertEquals(sourceOf('https://i.ebayimg.com/cat.jpg', c, 'shop').ok, false);
  // The eBay seller the research found: never.
  assertEquals(sourceOf('https://i.ebayimg.com/seller.jpg', c).ok, false);
  assertEquals(photoSource([{ source: 'shop' }, { source: 'shop' }]), 'shop');
  assertEquals(photoSource([{ source: 'hers' }, { source: 'shop' }]), 'mixed');
});

Deno.test('the model\'s answer survives a fence; a Shopify photo can be asked for smaller', () => {
  assertEquals(parseSeen('```json\n[{"n":1}]\n```'), [{ n: 1 }]);
  assertEquals(parseSeen('Here you go: [{"n":1}] done'), [{ n: 1 }]);
  assertEquals(parseSeen('no'), null);
  assertEquals(smaller('https://www.medisave.co.uk/cdn/shop/files/a.jpg?v=1'), 'https://www.medisave.co.uk/cdn/shop/files/a.jpg?v=1&width=1600');
  assertEquals(smaller('https://www.argos.co.uk/i/a.jpg'), null);
  assertEquals(toBase64(new TextEncoder().encode('hello')), 'aGVsbG8=');
});

Deno.test('our copy of a passed shop photo counts as the shop\'s, not hers', () => {
  const copy = 'https://x.supabase.co/storage/v1/object/public/listing-images/t1/c1/shop/1.jpg';
  const mine = 'https://x.supabase.co/storage/v1/object/public/listing-images/t1/c1/1727712000000.jpg';
  const c = { draft: {}, photo_checks: { brand_rule: null, images: [{ url: 'https://shop.test/a.jpg', copy, ok: true }] } };
  assertEquals(sourceOf(copy, c), { url: copy, source: 'shop', ok: true });
  assertEquals(sourceOf(mine, c).source, 'hers');
});
