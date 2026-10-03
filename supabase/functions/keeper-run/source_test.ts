// Task 02, pass 1: one batch end to end, with Amazon and the database stood in. Run with
//   deno test supabase/functions/keeper-run/source_test.ts

import { fromAxesso } from '../_shared/amazon.ts';
import { sourceBatch } from './source.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };
type Json = Record<string, any>;

// The database as the batch uses it: candidates read, job phases written, one rpc for each approval.
function fakeDb(cards: Json[], approve: (args: Json) => Json = () => ({ status: 'approved', source_id: 'S1' })) {
  const calls: Json[] = [];
  const phases: string[] = [];
  const notes: Json[] = [];
  const client = {
    from(table: string) {
      return {
        select() { return { in: async (_c: string, ids: string[]) => ({ data: cards.filter((c) => ids.includes(c.id)), error: null }) }; },
        update(v: Json) { return { in: async () => { if (table === 'keeper_jobs') phases.push(v.result.phase); return { error: null }; } }; },
        async insert(v: Json) { notes.push({ table, ...v }); return { error: null }; },
      };
    },
    async rpc(name: string, args: Json) { calls.push({ name, args }); return { data: approve(args), error: null }; },
  };
  return { client, calls, phases, notes };
}

const item = (asin: string, over: Json = {}) => ({
  statusCode: 200, statusMessage: 'FOUND', asin, title: 'Nutella Hazelnut Spread 400g', price: 3.46,
  productDetails: [{ name: 'EAN', value: '3017620422003' }], warehouseAvailability: 'In stock', soldBy: 'Amazon', fulfilledBy: 'Amazon', ...over,
});

// Amazon as the batch uses it: a search that finds what it is given, and a reader that reads what it is given.
function fakeAmazon(found: Record<string, Array<string | Json>>, pages: Record<string, Json>, perCode: Record<string, number> = {}) {
  const searched: string[][] = [];
  const opened: string[][] = [];
  return {
    searched, opened,
    search: (async (codes: string[]) => {
      searched.push(codes);
      return {
        found: new Map(codes.filter((c) => found[c]).map((c) => [c, found[c].map((x, i) => (typeof x === 'string' ? { asin: x, title: null, position: i } : { ...x, position: i }))])),
        perCode: new Map(codes.map((c) => [c, perCode[c] ?? (found[c]?.length ?? 0)])),
        results: 0,
      };
    }) as any,
    read: (async (urls: string[]) => {
      opened.push(urls);
      const reads = new Map();
      const failed: string[] = [];
      for (const u of urls) {
        const asin = /dp\/([A-Z0-9]{10})/.exec(u)![1];
        if (pages[asin]) reads.set(asin, fromAxesso(pages[asin])); else failed.push(asin);
      }
      return { reads, failed };
    }) as any,
  };
}

const job = (id: string, candidate: string, attempts = 1) => ({ id, candidate_id: candidate, attempts });
const card = (id: string, over: Json = {}) => ({ id, title: 'Nutella Hazelnut Chocolate Spread 400g Jar', image_url: null, margin: { gtin: '3017620422003' }, listing: null, decisions: null, ...over });

Deno.test('a match is approved through keeper_source_approve, with its supplier, reading and reason', async () => {
  const db = fakeDb([card('C1')]);
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, { B00NUTELLA: item('B00NUTELLA') });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out, JSON.stringify(out));
  if ('state' in out) {
    assertEquals(out.result.tray, 'ready');
    assertEquals(out.result.line, 'Same barcode on Amazon, £3.46, sold by Amazon, in stock.');
    assertEquals(out.result.url, 'https://www.amazon.co.uk/dp/B00NUTELLA');
  }
  assertEquals(db.calls.length, 1);
  const a = db.calls[0].args;
  assertEquals([db.calls[0].name, a.p_candidate, a.p_source.asin, a.p_source.cost, a.p_read.asin, a.p_read.costed],
    ['keeper_source_approve', 'C1', 'B00NUTELLA', 3.46, 'B00NUTELLA', 3.46]);
  // The card is filled from the reading: the facts, the link, and no weight since this page gives none.
  assert(/Nutella Hazelnut Spread 400g/.test(a.p_fill.supplier_text), a.p_fill.supplier_text);
  assertEquals([a.p_fill.supplier_url, a.p_fill.weight_kg], ['https://www.amazon.co.uk/dp/B00NUTELLA?psc=1', null]);
  assertEquals(db.phases, ['search', 'read', 'decide']);
  // One result and one page read: about 1p.
  assertEquals(out.cost, 0.86);
});

Deno.test('a rehearsal writes nothing', async () => {
  const db = fakeDb([card('C1')]);
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, { B00NUTELLA: item('B00NUTELLA') });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: true }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.tray === 'ready' && out.result.rehearsal);
  assertEquals(db.calls.length, 0);
});

Deno.test('not found, or another pack: left, with what was found noted on the card; another seller: sourced', async () => {
  const db = fakeDb([
    card('C1', { tenant_id: 'T1' }),
    card('C2', { tenant_id: 'T1', margin: { gtin: '5449000000996' }, title: 'Coca-Cola Classic 330ml can' }),
    card('C3', { tenant_id: 'T1', margin: { gtin: '734730596013' }, title: 'SHAVINGFUN Mini Massage Gun' }),
  ]);
  const amazon = fakeAmazon(
    { '3017620422003': ['B00PACK003'], '734730596013': ['B0BDLDML22'] },
    {
      B00PACK003: item('B00PACK003', { title: 'Nutella Hazelnut Spread 400g (Pack of 3)' }),
      B0BDLDML22: item('B0BDLDML22', { title: 'SHAVINGFUN Mini Massage Gun', price: 17.98, productDetails: [{ name: 'UPC', value: '734730596013' }], soldBy: 'ZYFJD', fulfilledBy: 'ZYFJD' }),
    },
  );
  const outs = await sourceBatch(db.client, [job('J1', 'C1'), job('J2', 'C2'), job('J3', 'C3')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assertEquals(outs.map((o) => 'state' in o ? [o.result.tray, o.result.line] : o.error), [
    ['choose', 'Another pack on Amazon.'],
    ['choose', 'Not found on Amazon by its barcode.'],
    ['ready', 'Same barcode on Amazon, £17.98, sold by ZYFJD, in stock.'],
  ]);
  // The seller is saved with the supplier, for Approved.
  assertEquals(db.calls.length, 1);
  assertEquals(db.calls[0].args.p_source.raw.sold_by, 'ZYFJD');
  // What was found is noted on the two cards left, with the Amazon link where there is one; the reading is kept.
  assertEquals(db.notes.map((n) => [n.table, n.candidate_id, n.tenant_id]), [['candidate_notes', 'C1', 'T1'], ['candidate_notes', 'C2', 'T1']]);
  assert(/Another pack on Amazon\..*amazon\.co\.uk\/dp\/B00PACK003/.test(db.notes[0].body), db.notes[0].body);
  assert(/not found by its barcode 5449000000996/.test(db.notes[1].body), db.notes[1].body);
  const left = outs[0];
  assert('state' in left && left.result.read?.asin === 'B00PACK003', 'the reading is kept on the job');
  // One search for all three, one read for the two found.
  assertEquals(amazon.searched.length, 1);
  assertEquals(amazon.opened.length, 1);
});

Deno.test('a rehearsal notes nothing on the cards', async () => {
  const db = fakeDb([card('C2', { tenant_id: 'T1', margin: { gtin: '5449000000996' } })]);
  const amazon = fakeAmazon({}, {});
  await sourceBatch(db.client, [job('J2', 'C2')], { rehearsal: true }, { token: 'T', search: amazon.search, read: amazon.read });
  assertEquals(db.notes.length, 0);
});

Deno.test('two results: the title picks the product, and only that page is read', async () => {
  const db = fakeDb([card('C1')]);
  const amazon = fakeAmazon({ '3017620422003': [{ asin: 'B00PACK003', title: 'Nutella 400g (Pack of 3)' }, { asin: 'B00NUTELLA', title: 'Nutella Hazelnut Spread 400g' }] }, {
    B00PACK003: item('B00PACK003', { title: 'Nutella 400g (Pack of 3)' }), B00NUTELLA: item('B00NUTELLA'),
  });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.asin === 'B00NUTELLA' && out.result.tray === 'ready', JSON.stringify(out));
  assertEquals(amazon.opened[0], ['https://www.amazon.co.uk/dp/B00NUTELLA?psc=1']);
});

Deno.test('two results and no title matching: left, nothing read', async () => {
  const db = fakeDb([card('C1', { title: 'Lego 21357' })]);
  const amazon = fakeAmazon({ '3017620422003': [{ asin: 'A1', title: 'LEGO Ideas 21350' }, { asin: 'B1', title: 'Desk lamp' }] }, {});
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.tray === 'choose' && out.result.line === 'More than one result, and no title matches.', JSON.stringify(out));
  assertEquals(amazon.opened.length, 0);
});

Deno.test('a LEGO set: one result, no barcode on its page, sent by Amazon: approved', async () => {
  const db = fakeDb([card('C1', { title: 'Lego 77260', margin: { gtin: '5702017583921' } })]);
  const amazon = fakeAmazon({ '5702017583921': ['B0FPXF65PH'] }, {
    B0FPXF65PH: item('B0FPXF65PH', { title: 'LEGO Speed Champions Toyota Supra MK4-77260', price: 16.09, productDetails: [{ name: 'Brand', value: 'LEGO' }] }),
  });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.tray === 'ready' && out.result.price === 16.09, JSON.stringify(out));
  assertEquals(db.calls.length, 1);
});

Deno.test('a card decided meanwhile is left as it is', async () => {
  const db = fakeDb([card('C1', { decisions: { action: 'reject' } })]);
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, { B00NUTELLA: item('B00NUTELLA') });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.tray === 'skipped');
  assertEquals(db.calls.length, 0);
});

Deno.test('decided between the read and the write: the database says so, and it is skipped', async () => {
  const db = fakeDb([card('C1')], () => ({ status: 'decided' }));
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, { B00NUTELLA: item('B00NUTELLA') });
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('state' in out && out.result.tray === 'skipped');
});

Deno.test('a page Amazon did not return is tried again, not judged', async () => {
  const db = fakeDb([card('C1')]);
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, {});
  const [out] = await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assert('error' in out, JSON.stringify(out));
});

Deno.test('the search failing fails the batch, so every job is tried again', async () => {
  const db = fakeDb([card('C1'), card('C2')]);
  const search = (async () => { throw new Error('The Apify account is out of credit.'); }) as any;
  const outs = await sourceBatch(db.client, [job('J1', 'C1'), job('J2', 'C2')], { rehearsal: false }, { token: 'T', search });
  assertEquals(outs.map((o) => 'error' in o ? o.error : null), ['The Apify account is out of credit.', 'The Apify account is out of credit.']);
});

Deno.test('two candidates with one barcode: searched once, paid once', async () => {
  const db = fakeDb([card('C1'), card('C2')]);
  const amazon = fakeAmazon({ '3017620422003': ['B00NUTELLA'] }, { B00NUTELLA: item('B00NUTELLA') });
  const outs = await sourceBatch(db.client, [job('J1', 'C1'), job('J2', 'C2')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assertEquals(amazon.searched[0], ['3017620422003']);
  // One search and one page read for the two: paid on the first card only.
  assertEquals(outs.map((o) => o.cost), [0.86, 0]);
});

Deno.test('a UPC stored without its zeros is searched as the real barcode', async () => {
  const db = fakeDb([card('C1', { margin: { gtin: '10279904244' } })]);
  const amazon = fakeAmazon({}, {});
  await sourceBatch(db.client, [job('J1', 'C1')], { rehearsal: false }, { token: 'T', search: amazon.search, read: amazon.read });
  assertEquals(amazon.searched[0], ['010279904244']);
});
