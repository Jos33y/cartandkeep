// Task 03: a card got ready end to end, with our functions and the database stood in. Run with
//   deno test supabase/functions/keeper-run/ready_test.ts

import { readyBatch, readyOne, type Call } from './ready.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };
type Json = Record<string, any>;

const empty = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
  || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as Json).length);

// keeper_ready_fill (0138) as the tests need it: only what is empty, photos only after hers, details and parcel merged.
function fillLike(card: Json, patch: Json) {
  if (!card.decisions?.some((d: Json) => d.action === 'approve')) return { status: 'decided' };
  if (card.ebay?.listing_id) return { status: 'live' };
  const d: Json = { ...(card.draft ?? {}) };
  const applied: string[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const have = d[k];
    if (k === 'keeper_ready') d[k] = v;
    else if (k === 'images') {
      const h = (have ?? []) as string[];
      if (empty(have) || ((v as string[]).length > h.length && h.every((x, i) => (v as string[])[i] === x))) { d[k] = v; applied.push(k); }
    } else if (k === 'photos_offered') d[k] = [...new Set([...(have ?? []), ...(v as string[])])];
    else if (k === 'aspects' || k === 'package') {
      const m: Json = { ...(have ?? {}) };
      for (const [s, x] of Object.entries(v as Json)) if (empty(m[s]) && !empty(x)) { m[s] = x; applied.push(`${k}.${s}`); }
      d[k] = m;
    } else if (k === 'supplier_auto') continue;
    else if (k === 'supplier_text') {
      if (empty(have) || have === d.supplier_auto) { d.supplier_text = v; d.supplier_auto = v; applied.push(k); }
    } else if (empty(have) && !empty(v)) { d[k] = v; applied.push(k); }
  }
  card.draft = d;
  return { status: 'ok', applied, draft: d };
}

// The database as readyOne uses it: one card and its suppliers read, job progress written, every draft write a fill.
function fakeDb(cards: Json[]) {
  const progress: Json[] = [];
  const fills: Json[] = [];
  const builder = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let patch: Json | null = null;
    const rows = () => {
      if (table === 'candidates') return cards.filter((c) => filters.every(([k, v]) => c[k] === v));
      if (table === 'candidate_sources') return cards.flatMap((c) => (c.sources ?? []).map((s: Json) => ({ ...s, candidate_id: c.id })))
        .filter((s) => filters.every(([k, v]) => s[k] === v));
      return [];
    };
    const q: Json = {
      select() { return q; },
      update(v: Json) { patch = v; return q; },
      eq(k: string, v: unknown) { filters.push([k, v]); return q; },
      async maybeSingle() { return { data: rows()[0] ? structuredClone(rows()[0]) : null, error: null }; },
      then(ok: (v: Json) => unknown) {
        if (patch && table === 'keeper_jobs') progress.push(patch.result);
        return Promise.resolve({ data: structuredClone(rows()), error: null }).then(ok);
      },
    };
    return q;
  };
  const client = {
    from: builder,
    async rpc(name: string, args: Json) {
      if (name === 'keeper_ready_move') {
        const c = cards.find((x) => x.id === args.p_candidate)!;
        if (c.draft?.entry) return { data: { status: 'chosen' }, error: null };
        c.draft = { ...(c.draft ?? {}), entry: { ...args.p_entry, via: 'keeper', new_product: args.p_other }, item_facts: args.p_facts,
          ...(args.p_other ? { before: { title: c.draft?.title ?? null }, title: '', description: '', images: [] } : {}) };
        return { data: { status: 'moved', other: args.p_other, draft: c.draft }, error: null };
      }
      if (name !== 'keeper_ready_fill') throw new Error(name);
      fills.push(args.p_patch);
      const card = cards.find((c) => c.id === args.p_candidate);
      return { data: card ? fillLike(card, args.p_patch) : { status: 'gone' }, error: null };
    },
  };
  return { client, progress, fills };
}

const NOW = Date.parse('2026-10-04T12:00:00Z');
const reading = (at: string, over: Json = {}) => ({
  asin: 'B0LAMP0001', url: 'https://www.amazon.co.uk/dp/B0LAMP0001', read_at: at, found: true,
  facts: {
    title: 'Eglo Mogano 3 ceiling light', text: 'Eglo Mogano 3. Steel, sandy.', bullets: ['Steel ceiling light'],
    details: ['Package Dimensions: 60 x 40 x 20 cm; 2.4 kg', 'Item Weight: 2 kg'], images: ['https://m.media-amazon.com/1.jpg', 'https://m.media-amazon.com/2.jpg'],
  },
  offer: { price: 30, stock: 'in' },
  ...over,
});
const card = (over: Json = {}): Json => ({
  id: 'C1', tenant_id: 'T1', title: 'Eglo Ceiling Light Mogano 3', image_url: null, decisions: [{ action: 'approve' }], ebay: null,
  draft: { supplier_url: 'https://www.amazon.co.uk/dp/B0LAMP0001' }, supplier_read: reading('2026-10-01T07:00:00Z'), photo_checks: null,
  margin: {}, listing: null, sources: [{ id: 'S1', url: 'https://www.amazon.co.uk/dp/B0LAMP0001', unit_cost: 30 }],
  ...over,
});

// Our functions as readyOne calls them, each answering as given and writing what the real one writes.
function fakeCalls(cards: Json[], answers: Partial<Record<string, (body: Json, headers: Json) => Json>> = {}) {
  const calls: Array<{ fn: string; body: Json; headers: Json }> = [];
  const call: Call = async (fn, body, headers = {}) => {
    calls.push({ fn, body, headers });
    const c = cards.find((x) => x.id === body.candidate_id || body.candidate_ids?.includes(x.id))!;
    const own = answers[fn];
    if (own) return own(body, headers);
    if (fn === 'supplier-read') { c.supplier_read = reading('2026-10-04T11:59:00Z'); return { read: 1 }; }
    if (fn === 'photo-check') {
      c.photo_checks = {
        version: 2, product: null, page: null, images: [], catalogue: null,
        others: [{ url: body.supplied?.url ?? 'x', sent: Boolean(body.supplied), ok: true, images: [
          { url: 'https://m.media-amazon.com/1.jpg', copy: 'https://store/listing-images/shop/1.jpg', ok: true },
          { url: 'https://m.media-amazon.com/2.jpg', copy: 'https://store/listing-images/shop/2.jpg', ok: true, extra: true },
        ] }],
      };
      return { photo_checks: c.photo_checks };
    }
    if (fn === 'ebay-compose') return body.kind === 'title' ? { titles: ['Eglo Mogano 3 Ceiling Light Steel Sandy 3 Bulb', 'Second'] } : { description: 'A three light ceiling fitting.' };
    // Keepr agrees the listing the card prices from is her product, unless a test says otherwise.
    if (fn === 'ebay-match') return { already: true, auto: 0.95, best: { entry: { item_id: 'v1|1|0', sure: 0.99 } } };
    if (fn === 'ebay-list') return { dry: true, category: { id: '20697', name: 'Ceiling Lights', source: 'suggested' }, filled: { Brand: 'Eglo', Type: 'Ceiling Light' }, missing: [{ name: 'Brand' }, { name: 'Type' }] };
    return { error: `no ${fn}` };
  };
  return { call, calls };
}

const deps = (call: Call, clock: () => number = () => NOW) => ({ call, secret: async () => 'SECRET', now: clock });

Deno.test('a card with nothing: read again (3 days old), photos, words, category and details, the parcel, ready', async () => {
  const cards = [card()];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1', run_id: 'R1' }, deps(f.call));
  assert('state' in out && out.state === 'done', JSON.stringify(out));
  const r = (out as Json).result;
  assertEquals(r.tray, 'ready');
  assertEquals(f.calls.map((c) => c.fn), ['supplier-read', 'ebay-match', 'photo-check', 'ebay-compose', 'ebay-compose', 'ebay-list']);
  assertEquals(f.calls[0].headers['x-scheduler-secret'], 'SECRET');
  assert(f.calls[2].body.supplied?.images?.length === 2, 'her Amazon gallery is what is checked');
  const d = cards[0].draft;
  assertEquals(d.title, 'Eglo Mogano 3 Ceiling Light Steel Sandy 3 Bulb');
  assertEquals(d.images, ['https://store/listing-images/shop/1.jpg', 'https://store/listing-images/shop/2.jpg']);
  assertEquals(d.ebay_category.id, '20697');
  assertEquals(d.aspects, { Brand: 'Eglo', Type: 'Ceiling Light' });
  assertEquals(d.package, { length_cm: 60, width_cm: 40, height_cm: 20, weight_kg: 2.4 });
  assertEquals(d.parcel_from, "From Amazon's package: 60 x 40 x 20cm, 2.4kg");
  assertEquals(d.supplier_text, 'Eglo Mogano 3. Steel, sandy.');
  assertEquals(d.keeper_ready.need, []);
  assert(r.line.startsWith("Keeper added Amazon's product details, 2 photos, a title, the description, the eBay category (Ceiling Lights), 2 item details, the parcel from"), r.line);
  assert(Math.abs((out as Json).cost - (0.12 + 1 + 2 + 0.6 + 0.9 + 0.8)) < 1e-9, `cost ${(out as Json).cost}`);
});

Deno.test('her own words, photos and parcel are kept; a fresh reading is not paid for again', async () => {
  const cards = [card({
    supplier_read: reading('2026-10-04T08:00:00Z'),
    draft: { title: 'Her title', description: 'Her words', images: ['https://store/listing-images/mine.jpg'], package: { length_cm: 45, width_cm: 35, height_cm: 16 }, supplier_text: 'She typed', supplier_auto: 'older' },
  })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(f.calls.map((c) => c.fn), ['ebay-match', 'ebay-list']);
  const d = cards[0].draft;
  assertEquals([d.title, d.description, d.images.length, d.supplier_text], ['Her title', 'Her words', 1, 'She typed']);
  assertEquals(d.package, { length_cm: 45, width_cm: 35, height_cm: 16, weight_kg: 2.4 });
  assertEquals((out as Json).result.tray, 'ready');
});

Deno.test('Apify refusing: the saved reading is used and said, the card still finished', async () => {
  const cards = [card()];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, { 'supplier-read': () => ({ error: 'Apify refused the token' }) });
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  const r = (out as Json).result;
  assertEquals(r.tray, 'ready');
  assert(r.short.includes('Amazon not read: Apify refused the token'), JSON.stringify(r.short));
  assert(r.short.includes('Amazon could not be read today, so the reading from 1 Oct was used'), JSON.stringify(r.short));
});

Deno.test('a slow call keeps its place: the next call carries on from the photos, without reading Amazon again', async () => {
  const cards = [card()];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  let t = NOW;
  const clock = () => t;
  const slow: Call = async (fn, body, headers) => { const o = await f.call(fn, body, headers); t += 50_000; return o; };
  const first = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(slow, clock));
  assert('again' in first, JSON.stringify(first));
  assertEquals((first as Json).result.progress.step, 1);
  const second = await readyOne(db.client, { id: 'J1', candidate_id: 'C1', result: (first as Json).result }, deps(slow, clock));
  assert('again' in second, 'one step a call while each takes 50 seconds');
  assertEquals(f.calls.map((c) => c.fn), ['supplier-read', 'ebay-match']);
});

Deno.test('no title from the writing: needs her, and says why', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, {
    'ebay-compose': (b) => (b.kind === 'title' ? { conflict: 'title says 3 bulbs, the box shows 5' } : { description: 'Words.' }),
  });
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  const r = (out as Json).result;
  assertEquals(r.tray, 'choose');
  assertEquals(r.need, ['a title', "eBay's category"]);
  assert(r.short.includes('No title: the sources disagree, title says 3 bulbs, the box shows 5'), JSON.stringify(r.short));
  assert(r.short.includes("eBay's category waits for a title"), JSON.stringify(r.short));
});

Deno.test('live on eBay or no longer approved: left as it is, nothing called', async () => {
  const cards = [card({ id: 'C1', ebay: { listing_id: '9' } }), card({ id: 'C2', decisions: [] })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const outs = await readyBatch(db.client, [{ id: 'J1', candidate_id: 'C1' }, { id: 'J2', candidate_id: 'C2' }], deps(f.call));
  assertEquals(outs.map((o) => (o as Json).result.tray), ['skipped', 'skipped']);
  assertEquals(f.calls.length, 0);
});

Deno.test('the photo check failing outright is an error, kept at its step for the next try', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, { 'photo-check': () => ({ error: 'Anthropic is busy' }) });
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assert('error' in out, JSON.stringify(out));
  assertEquals((out as Json).error, 'photos: photo check: Anthropic is busy');
  assertEquals(db.progress.at(-1)!.progress.step, 2);
});

Deno.test('a card with no Amazon supplier: written from the shop page, no read paid for', async () => {
  const cards = [card({ draft: {}, supplier_read: null, sources: [{ id: 'S1', url: 'https://www.bm.co.uk/x', unit_cost: 5 }] })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(f.calls.map((c) => c.fn), ['ebay-match', 'photo-check', 'ebay-compose', 'ebay-compose', 'ebay-list']);
  assertEquals(f.calls[1].body.supplied, undefined);
  assertEquals(cards[0].draft.package, undefined);
  assertEquals((out as Json).result.tray, 'ready');
});

Deno.test('a card for her shop only: no eBay step, ready once it has photos and words', async () => {
  const cards = [card({ margin: { channel: 'store' }, recommended_channels: ['store'], supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(f.calls.map((c) => c.fn), ['photo-check', 'ebay-compose', 'ebay-compose']);
  const r = (out as Json).result;
  assertEquals([r.tray, r.channel, r.need], ['ready', 'shop', []]);
  assert(r.line.endsWith('Ready to add to your shop.'), r.line);
  assertEquals(cards[0].draft.package.weight_kg, 2.4);
});

Deno.test('a store card the import also recommended for eBay gets eBay\'s step', async () => {
  const cards = [card({ margin: { channel: 'store' }, recommended_channels: ['store', 'ebay'], supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assert(f.calls.some((c) => c.fn === 'ebay-list'), 'eBay step ran');
});

Deno.test('Keeper writes in its own mode, asks once more on an empty title, and a different product needs her', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  let titleAsks = 0;
  const f = fakeCalls(cards, {
    'ebay-compose': (b) => {
      assertEquals(b.keeper, true);
      if (b.kind === 'title') { titleAsks += 1; return titleAsks === 1 ? { titles: [] } : { titles: ['Chappie Chicken Dog Food 15kg'], different: 'Amazon sells Chicken, the card says Beef' }; }
      return { description: 'Dry dog food.' };
    },
  });
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  const r = (out as Json).result;
  assertEquals(titleAsks, 2);
  assertEquals(cards[0].draft.title, 'Chappie Chicken Dog Food 15kg');
  assertEquals(r.tray, 'choose');
  assertEquals(r.need, ['a check: Amazon sells Chicken, the card says Beef']);
});

Deno.test('a brand once skipped is checked again; none passing on an eBay card takes eBay\'s catalogue photos', async () => {
  const cards = [card({
    supplier_read: reading('2026-10-04T08:00:00Z'),
    photo_checks: { version: 2, product: null, brand_rule: 'catalogue_only', images: [], others: [{ url: 'https://www.amazon.co.uk/dp/B0LAMP0001', sent: true, ok: true, images: [] }] },
  })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, {
    'photo-check': (b) => {
      cards[0].photo_checks = { version: 2, product: null, images: [], others: [], catalogue: { epid: 'E1', title: 'LEGO 71836', images: ['https://i.ebayimg.com/cat/1.jpg', 'https://i.ebayimg.com/cat/2.jpg'] } };
      return { photo_checks: cards[0].photo_checks, asked: b };
    },
  });
  await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assert(f.calls[1].fn === 'photo-check' && f.calls[1].body.supplied, 'checked again from her Amazon page');
  assertEquals(cards[0].draft.images, ['https://i.ebayimg.com/cat/1.jpg', 'https://i.ebayimg.com/cat/2.jpg']);
  assertEquals(cards[0].draft.catalogue.epid, 'E1');
});

Deno.test('eBay asking for the item\'s height and width: filled from Amazon\'s product size', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z', { facts: { ...reading('x').facts, details: ['Product Dimensions: 25 x 18 x 30 cm; 450 g'] } }) })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, {
    'ebay-list': () => ({ category: { id: '1', name: 'Lunchboxes' }, filled: { Brand: 'Black+Blum' }, missing: [{ name: 'Brand' }, { name: 'Item Height' }, { name: 'Item Width' }] }),
  });
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(cards[0].draft.aspects, { Brand: 'Black+Blum', 'Item Height': '30 cm', 'Item Width': '18 cm' });
  assertEquals((out as Json).result.tray, 'ready');
});

Deno.test('the size read in any units: separate Depth, Width and Height lines and pounds give the parcel and eBay\'s details', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z', { facts: { ...reading('x').facts, details: ['Product Depth: 13.3 Centimetres', 'Product Width: 5.4 Centimetres', 'Product Height: 13.3 Centimetres', 'Item Weight: 0.44 Pounds'] } }) })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, {
    'ebay-list': () => ({ category: { id: '1', name: 'Smoke & Gas Detectors' }, filled: {}, missing: [{ name: 'Item Height' }, { name: 'Item Weight' }] }),
  });
  const read: Json[] = [];
  const size = async (r: Json) => {
    read.push(r);
    return { product: { length_cm: 13.3, width_cm: 5.4, height_cm: 13.3, weight_kg: 0.2 }, package: null, product_weight_kg: 0.2, package_weight_kg: null, note: 'separate lines; 0.44 lb' };
  };
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, { ...deps(f.call), size });
  assertEquals(read.length, 1);
  assertEquals(cards[0].draft.package, { length_cm: 16, width_cm: 16, height_cm: 8, weight_kg: 0.25 });
  assertEquals(cards[0].draft.parcel_from, "From Amazon's product size: 16 x 16 x 8cm (2cm added each way), 250g packed");
  assertEquals(cards[0].draft.aspects, { 'Item Height': '13.3 cm', 'Item Weight': '200 g' });
  assertEquals((out as Json).result.progress, undefined);
});

Deno.test('the size reader failing: the pattern reader is used instead', async () => {
  const cards = [card({ supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, { ...deps(f.call), size: async () => { throw new Error('busy'); } });
  assertEquals(cards[0].draft.package, { length_cm: 60, width_cm: 40, height_cm: 20, weight_kg: 2.4 });
});

Deno.test('Keepr matches: sure enough, the card moves to the listing that sells her product; less sure, it is suggested', async () => {
  const cards = [card({ id: 'C1', supplier_read: reading('2026-10-04T08:00:00Z') }), card({ id: 'C2', supplier_read: reading('2026-10-04T08:00:00Z') })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards, {
    'ebay-match': (b) => ({ auto: 0.95, already: false, market: { median: 32.6 },
      best: { entry: { item_id: 'v1|7|0', title: 'FireAngel SCB10-R 10 Year Battery Combined', price: 32.6, sure: b.candidate_id === 'C1' ? 0.97 : 0.8 }, facts: { brand: 'FireAngel' }, new_product: false } }),
  });
  const [one, two] = await readyBatch(db.client, [{ id: 'J1', candidate_id: 'C1' }, { id: 'J2', candidate_id: 'C2' }], deps(f.call));
  assertEquals(cards[0].draft.entry.item_id, 'v1|7|0');
  assert((one as Json).result.done.some((x: string) => x.startsWith('the eBay listing that sells your product')), JSON.stringify((one as Json).result.done));
  assertEquals(cards[1].draft.entry, undefined);
  assertEquals(cards[1].draft.entry_suggestion.entry.item_id, 'v1|7|0');
  assert((two as Json).result.short.some((x: string) => x.startsWith('Keepr suggests the eBay listing')), 'suggested');
});

Deno.test('a shop card or one whose listing she chose is not matched', async () => {
  const cards = [card({ id: 'C1', margin: { channel: 'store' }, supplier_read: reading('2026-10-04T08:00:00Z') }), card({ id: 'C2', supplier_read: reading('2026-10-04T08:00:00Z'), draft: { supplier_url: 'https://www.amazon.co.uk/dp/B0LAMP0001', entry: { item_id: 'v1|9|0' } } })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  await readyBatch(db.client, [{ id: 'J1', candidate_id: 'C1' }, { id: 'J2', candidate_id: 'C2' }], deps(f.call));
  assertEquals(f.calls.filter((c) => c.fn === 'ebay-match').length, 0);
});
