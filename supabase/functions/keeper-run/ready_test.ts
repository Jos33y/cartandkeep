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
  assertEquals(f.calls.map((c) => c.fn), ['supplier-read', 'photo-check', 'ebay-compose', 'ebay-compose', 'ebay-list']);
  assertEquals(f.calls[0].headers['x-scheduler-secret'], 'SECRET');
  assert(f.calls[1].body.supplied?.images?.length === 2, 'her Amazon gallery is what is checked');
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
  assert(Math.abs((out as Json).cost - (0.12 + 2 + 0.6 + 0.9 + 0.8)) < 1e-9, `cost ${(out as Json).cost}`);
});

Deno.test('her own words, photos and parcel are kept; a fresh reading is not paid for again', async () => {
  const cards = [card({
    supplier_read: reading('2026-10-04T08:00:00Z'),
    draft: { title: 'Her title', description: 'Her words', images: ['https://store/listing-images/mine.jpg'], package: { length_cm: 45, width_cm: 35, height_cm: 16 }, supplier_text: 'She typed', supplier_auto: 'older' },
  })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(f.calls.map((c) => c.fn), ['ebay-list']);
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
  assertEquals(f.calls.map((c) => c.fn), ['supplier-read', 'photo-check']);
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
  assertEquals(db.progress.at(-1)!.progress.step, 1);
});

Deno.test('a card with no Amazon supplier: written from the shop page, no read paid for', async () => {
  const cards = [card({ draft: {}, supplier_read: null, sources: [{ id: 'S1', url: 'https://www.bm.co.uk/x', unit_cost: 5 }] })];
  const db = fakeDb(cards);
  const f = fakeCalls(cards);
  const out = await readyOne(db.client, { id: 'J1', candidate_id: 'C1' }, deps(f.call));
  assertEquals(f.calls.map((c) => c.fn), ['photo-check', 'ebay-compose', 'ebay-compose', 'ebay-list']);
  assertEquals(f.calls[0].body.supplied, undefined);
  assertEquals(cards[0].draft.package, undefined);
  assertEquals((out as Json).result.tray, 'ready');
});
