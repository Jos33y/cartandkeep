// Is an eBay listing the product she sends: run with
//   deno test --allow-env supabase/functions/_shared/match_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };

import { matchScore, modelsIn, packOf } from './match.ts';
import { itemFactsOf, listingOf, productKey, swappedTo } from './product.ts';
import { fromBrowse, proofOf, soldNeeded } from './ebay/item.ts';
import { settle, titleFromUrl } from './same-product.ts';
import { pageUrlOf } from './shop-page.ts';

Deno.test('a shared barcode settles it; two barcodes rule it out', () => {
  assertEquals(matchScore({ title: 'A', gtin: '04211125649019' }, { title: 'B', gtin: '4211125649019' }).score, 1);
  const r = matchScore({ title: 'Beurer MG 16', gtin: '4211125649019' }, { title: 'Beurer MG 16', gtin: '5012345678900' });
  assertEquals([r.score, r.rules_out], [0, true]);
});

Deno.test('model numbers: the same one however spaced, another one rules it out', () => {
  assert(modelsIn('Beurer MG 16 Mini Massager').includes('mg16'));
  assertEquals(modelsIn('Ariel Pods 40 washes 500ml'), []);
  assert(matchScore({ title: 'Beurer MG16 massager', brand: 'Beurer' }, { title: 'Beurer MG 16 Mini Massage Gun' }).score >= 0.85);
  assert(matchScore({ title: 'Beurer MG 16 massager' }, { title: 'Beurer MG 99 massager' }).rules_out);
});

Deno.test('packs: two stated counts that differ rule it out', () => {
  assertEquals(packOf('Dentastix 21 sticks'), { kind: 'count', n: 21 });
  assert(matchScore({ title: 'Ariel Pods 40 washes' }, { title: 'Ariel Pods 60 washes' }).rules_out);
});

Deno.test('another brand reads low; words alone read as words', () => {
  assert(matchScore({ title: 'Kinetik blood pressure monitor', brand: 'Kinetik' }, { title: 'Omron blood pressure monitor', brand: 'Omron' }).score < 0.3);
  assert(matchScore({ title: 'Kinetik Wellbeing blood pressure monitor' }, { title: 'Kinetik Wellbeing Upper Arm Blood Pressure Monitor' }).score > 0.6);
});

Deno.test('the proof rule matches the research: under 1,000 feedback, a week old, enough sales for its age', () => {
  assertEquals([soldNeeded(null), soldNeeded(10), soldNeeded(60), soldNeeded(200)], [2, 1, 2, 7]);
  assert(proofOf({ feedback: 120, sold: 3, ageDays: 60 }));
  assert(!proofOf({ feedback: 5000, sold: 300, ageDays: 60 }));
  assert(!proofOf({ feedback: 120, sold: 1, ageDays: 3 }));
});

Deno.test('a Browse item becomes a reference listing and facts, postage in, never its photos as the card\'s', () => {
  const now = Date.parse('2026-10-01T00:00:00Z');
  const r = fromBrowse({
    itemId: 'v1|286001|0', legacyItemId: '286001', title: 'Renpho Mini Massage Gun', price: { value: '24.99' },
    shippingOptions: [{ shippingCostType: 'FIXED', shippingCost: { value: '0.00' } }],
    itemCreationDate: '2026-08-02T00:00:00Z', estimatedAvailabilities: [{ estimatedSoldQuantity: 9 }],
    seller: { feedbackScore: 310 }, brand: 'Renpho', mpn: 'RF-GM001', gtin: '0810036520123', epid: '9001',
    categoryPath: 'Health & Beauty|Massage|Massage Guns', categoryId: '36447', itemWebUrl: 'https://www.ebay.co.uk/itm/286001',
    image: { imageUrl: 'https://i.ebayimg.com/x.jpg' }, localizedAspects: [{ name: 'Type', value: 'Massage Gun' }],
    shortDescription: '<p>Six heads.</p>',
  }, now);
  assertEquals(r.entry.price, 24.99);
  assertEquals([r.entry.age_days, r.entry.sold_lifetime, r.entry.per_day, r.entry.proved], [60, 9, 0.15, true]);
  assertEquals([r.facts.brand, r.facts.mpn, r.facts.gtin, r.facts.category_id, r.facts.aspects.Type, r.facts.description], ['Renpho', 'RF-GM001', '0810036520123', '36447', 'Massage Gun', 'Six heads.']);
});

Deno.test('Keepr\'s verdicts: a fact that rules a listing out caps it, a shared barcode is certain', () => {
  const read = (id: string, title: string, gtin: string | null = null) => ({ entry: { item_id: id, title, proved: true, per_day: 0.1 }, facts: { gtin, brand: null } });
  const out = settle({ title: 'Renpho mini massage gun 6 heads', gtin: '0810036520123' }, [
    read('a', 'Renpho mini massage gun', '0810036520123'),
    read('b', 'Renpho mini massage gun 2 pack'),
    read('c', 'Renpho massage gun', '5000000000000'),
  ], [{ item_id: 'a', sure: 70, why: 'x' }, { item_id: 'b', sure: 97, why: 'y' }, { item_id: 'c', sure: 99, why: 'z' }]);
  assertEquals(out.map((x) => [x.entry.item_id, x.sure]), [['b', 0.97], ['a', 1], ['c', 0.4]].sort((p, q) => (q[1] as number) - (p[1] as number)));
});

Deno.test('a product name from its web address when the page cannot be read', () => {
  assertEquals(titleFromUrl('https://www.amazon.co.uk/RENPHO-Massage-Gun-Mini-Portable/dp/B0B1234567?ref=x'), 'RENPHO Massage Gun Mini Portable');
  assertEquals(titleFromUrl('https://shop.test/p/12345'), null);
});

Deno.test('after a move to another product, the old shelf is not this product', () => {
  const c = {
    margin: { shelf: { url: 'https://old.test/beurer' } },
    listing: { title: 'Beurer MG 16', source_url: 'https://old.test/beurer' },
    draft: { entry: { item_id: 'v1|9|0', new_product: true, title: 'Renpho' }, item_facts: { gtin: '1' } },
  };
  assertEquals([Boolean(swappedTo(c)), productKey(c), listingOf(c), itemFactsOf(c)?.gtin, pageUrlOf(c)], [true, 'v1|9|0', null, '1', null]);
  const same = { ...c, draft: { entry: { item_id: 'v1|9|0', new_product: false } } };
  assertEquals([swappedTo(same), listingOf(same)?.title, pageUrlOf(same)], [null, 'Beurer MG 16', 'https://old.test/beurer']);
  const paged = { ...c, draft: { ...c.draft, page: 'https://new.test/renpho' }, listing: { title: 'Renpho', source_url: 'https://new.test/renpho' } };
  assertEquals([listingOf(paged)?.title, pageUrlOf(paged)], ['Renpho', 'https://new.test/renpho']);
});

import { cleanAspects } from './ebay/item.ts';

Deno.test('another seller\'s item details: a measurement needs a unit that fits it, unit pricing goes', () => {
  assertEquals(cleanAspects({
    'Item Width': '16', 'Item Length': '5 cm', 'Item Height': '1800ma', 'Unit Type': 'kg', 'Item Weight': '450 g',
    Type: 'Massage Gun', Brand: 'Unbranded', 'Battery Capacity': '1800mAh', Size: 'Mini', 'Number of Speeds': '6',
  }), { 'Item Length': '5 cm', 'Item Weight': '450 g', Type: 'Massage Gun', 'Battery Capacity': '1800mAh', Size: 'Mini', 'Number of Speeds': '6' });
});
