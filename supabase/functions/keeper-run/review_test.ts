// Keeper looks back and learns (0140, review.ts). Run with
//   deno test supabase/functions/keeper-run/review_test.ts

import { gather, lessonText, lessonsFor, review } from './review.ts';

function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const assert = (v: unknown, m = 'expected true') => { if (!v) throw new Error(m); };
type Json = Record<string, any>;

function fakeDb(tables: Record<string, Json[]>) {
  const calls: Json[] = [];
  const builder = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let upserted: Json[] | null = null;
    const q: Json = {
      select() { return q; },
      eq(k: string, v: unknown) { rows = rows.filter((r) => r[k] === v); return q; },
      in(k: string, vs: unknown[]) { rows = rows.filter((r) => vs.includes(r[k])); return q; },
      not() { rows = rows.filter((r) => r.draft?.keeper_ready); return q; },
      limit() { return q; },
      upsert(v: Json[]) { upserted = v; (tables[table] ??= []).push(...v); return q; },
      then(ok: (v: Json) => unknown) { return Promise.resolve({ data: upserted ? null : rows, error: null }).then(ok); },
    };
    return q;
  };
  return { client: { from: builder, async rpc(name: string, args: Json) { calls.push({ name, args }); return { data: 1, error: null }; } }, calls, tables };
}

const run = { id: 'R1', tenant_id: 'T1' };
const wrote = { title: 'Keeper title', description: 'Words', images: ['a'], aspects: {}, package: null, ebay_category: null };

Deno.test('what Keeper gathers: its own needs and failures, her changes, eBay\'s refusals, matches she turned down; each once', async () => {
  const tables: Record<string, Json[]> = {
    keeper_jobs: [
      { run_id: 'R1', candidate_id: 'C1', state: 'done', result: { tray: 'choose', need: ['photos'], short: ['No photos passed the check'] } },
      { run_id: 'R1', candidate_id: 'C2', state: 'done', result: { tray: 'ready' } },
      { run_id: 'R1', candidate_id: 'C2', state: 'failed', error: 'photo check: busy' },
    ],
    candidates: [
      { id: 'C1', tenant_id: 'T1', title: 'LEGO 71836', draft: { keeper_ready: { wrote }, title: 'Keeper title' }, supplier_read: { facts: { brand: 'LEGO' } } },
      { id: 'C2', tenant_id: 'T1', title: 'Minky', draft: { keeper_ready: { wrote }, title: 'Her better title Pack of 2', entry_dismissed: ['v1|5|0'] } },
    ],
    listing_jobs: [{ id: 'L1', tenant_id: 'T1', candidate_id: 'C1', state: 'failed', error: 'Item specific Brand is missing' }],
    keeper_seen: [],
  };
  const db = fakeDb(tables);
  const g = await gather(db.client, run);
  assertEquals(g.needs.length, 2);
  assertEquals(g.needs[0].brand, 'LEGO');
  assertEquals(g.changes.map((c) => [c.field, c.keeper, c.hers]), [['title', 'Keeper title', 'Her better title Pack of 2']]);
  assertEquals(g.ebay.map((e) => e.ebay_said), ['Item specific Brand is missing']);
  assertEquals(g.turnedDown.map((t) => t.listing), ['v1|5|0']);

  let asked = '';
  const learned = await review(db.client, run, async (_s, content) => {
    asked = content;
    return [{ key: 'pack in title', scope_kind: 'all', scope: '', area: 'writing', action: 'none', lesson: 'Put the pack size in the title.', source: 'her', evidence: 1, against: 0 }];
  });
  assert(asked.includes('Her better title') && asked.includes('Item specific Brand'), 'the evidence went to Claude');
  assertEquals(learned.length, 1);
  assertEquals(db.calls[0].name, 'keeper_learn');
  assertEquals(db.calls[0].args.p_run, 'R1');
  // Looked at once: the next look back does not count her change or eBay's refusal again.
  const again = await gather(db.client, run);
  assertEquals([again.changes.length, again.ebay.length, again.turnedDown.length], [0, 0, 0]);
});

Deno.test('nothing to learn from: no call to Claude, the run still marked looked at', async () => {
  const db = fakeDb({ keeper_jobs: [{ run_id: 'R1', candidate_id: 'C1', state: 'done', result: { tray: 'ready' } }], candidates: [], listing_jobs: [], keeper_seen: [] });
  let called = false;
  await review(db.client, run, async () => { called = true; return []; });
  assertEquals(called, false);
  assertEquals(db.calls[0].args.p_lessons, []);
});

Deno.test('the lessons for a card: in use only, for everything, its brand or its category', () => {
  const all = [
    { key: 'a', scope_kind: 'all', scope: '', area: 'writing', lesson: 'Pack size in the title.', evidence: 3, against: 0 },
    { key: 'b', scope_kind: 'brand', scope: 'LEGO', area: 'photos', action: 'catalogue_photos_first', lesson: 'LEGO: catalogue photos first.', evidence: 2, against: 0 },
    { key: 'c', scope_kind: 'category', scope: 'Lunchboxes', area: 'details', lesson: 'Fill Item Height.', evidence: 2, against: 0 },
    { key: 'd', scope_kind: 'all', scope: '', area: 'writing', lesson: 'Seen once.', evidence: 1, against: 0 },
    { key: 'e', scope_kind: 'all', scope: '', area: 'writing', lesson: 'Disputed.', evidence: 2, against: 3 },
    { key: 'f', scope_kind: 'all', scope: '', area: 'writing', lesson: 'Removed.', evidence: 9, against: 0, removed_at: 'x' },
  ];
  const lego = { supplier_read: { facts: { brand: 'LEGO' } }, draft: {} };
  assertEquals(lessonsFor(all, lego).map((l) => l.key), ['a', 'b']);
  assertEquals(lessonsFor(all, { draft: { ebay_category: { name: 'Lunchboxes' } } }).map((l) => l.key), ['a', 'c']);
  assertEquals(lessonText(lessonsFor(all, lego), ['writing', 'general']), '- Pack size in the title.');
});

Deno.test('the same lesson in other words is counted on the one Keeper has, and two alike become one', async () => {
  const { mergeAlike, alike } = await import('./review.ts');
  const have = [{ key: 'disagree-pack', area: 'writing', scope_kind: 'all', scope: '', lesson: 'When the supplier page, shop page and pack disagree on a fact (size, age range, contents count, flavour, finish), take the pack\'s wording as the one to trust where the photos show it, and leave out the disputed detail rather than leaving the whole title or description blank.' },
    { key: 'lego-photos', area: 'photos', scope_kind: 'brand', scope: 'LEGO', lesson: 'LEGO: photos rarely pass the check, so use eBay\'s catalogue photos first.', removed_at: '2026-10-04' }];
  const fresh = [
    { key: 'conflict-flag', area: 'writing', scope_kind: 'all', scope: '', evidence: 3, lesson: 'When the supplier page, shop page and pack disagree on a fact (size, area covered, colour or part code, count, battery type), write the description around what the pack in the photos shows and flag the conflict for her rather than leaving the title and description blank.' },
    { key: 'lego-branded', area: 'photos', scope_kind: 'brand', scope: 'lego', evidence: 2, lesson: 'LEGO and LEGO-branded products: photos rarely pass the check, so use eBay\'s catalogue photos first.' },
    { key: 'type-fill', area: 'details', scope_kind: 'all', scope: '', evidence: 2, lesson: 'When eBay\'s Type is missing, fill it from the product name.' },
    { key: 'type-again', area: 'details', scope_kind: 'all', scope: '', evidence: 1, lesson: 'Fill eBay\'s Type from the product name when it is missing.' },
  ];
  const out = mergeAlike(fresh, have);
  assertEquals(out.map((l: Json) => l.key), ['disagree-pack', 'lego-photos', 'type-fill']);
  assertEquals(out[2].evidence, 3);
  assert(alike('Put the pack size in the title', 'Lunch boxes: fill Item Height from the product size') < 0.5, 'unlike lessons stay apart');
});

Deno.test('the same lesson in other words is sent once, the best proven kept', () => {
  const ls = [
    { key: 'x', area: 'photos', scope_kind: 'brand', scope: 'LEGO', lesson: 'LEGO: photos rarely pass the check, so use eBay\'s catalogue photos first.', evidence: 6, against: 0 },
    { key: 'y', area: 'photos', scope_kind: 'brand', scope: 'LEGO', lesson: 'LEGO and LEGO-branded products: photos rarely pass the check, so use eBay\'s catalogue photos first.', evidence: 3, against: 0 },
    { key: 'z', area: 'writing', scope_kind: 'all', scope: null, lesson: 'If no title comes back, build one from the brand and product name.', evidence: 6, against: 0 },
  ];
  const lego = { draft: { brand: 'LEGO' }, listing: { brand: 'LEGO' } };
  assertEquals(lessonsFor(ls, lego).map((l) => l.key), ['x', 'z']);
});
