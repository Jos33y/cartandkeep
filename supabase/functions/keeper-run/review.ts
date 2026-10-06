// Keeper looks back (keeper-task-03, Joseey, 4 October: "keeper learn shouldn't be about my corrections but also its
// own"). Once a run of getting cards ready ends, Keeper gathers what happened since it last looked:
//   its own work   the cards it sent to Needs you and why, and the ones it could not finish;
//   eBay's answer  listings eBay refused after Keeper got the card ready, in eBay's words;
//   her changes    a title, description, photos, item details or parcel she changed from what Keeper wrote, and a
//                  listing Keepr matched that she turned down.
// Claude turns that into a few short lessons, each for a brand, a category or everything, counted by the cards behind
// it, and keeper_learn (0140) adds them to what Keeper knows. Each change and refusal is counted once (keeper_seen).

import { askTool } from '../_shared/claude.ts';
import { isCredit } from '../_shared/credit.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export type Ask = (system: string, content: string) => Promise<Json[]>;

export const REVIEW_SYSTEM = `You are Keeper, the assistant that gets a UK eBay and online shop seller's product cards
ready to list. You are looking back at your own recent work to learn from it. You are given:
- the cards you could not finish or sent to her ("needs"), with what was missing and your notes;
- listings eBay refused after you got the card ready, in eBay's words;
- what she changed of your work: your version and hers;
- listings you matched that she turned down;
- the lessons you already have.

Write lessons that will make your next cards better. Each lesson:
- is one short instruction in plain British English, something you can act on next time, for example
  "LEGO: photos rarely pass the check, so use eBay's catalogue photos first" or
  "Put the pack size in the title, as Pack of 2" or
  "Lunch boxes: fill Item Height and Item Width from the product size";
- is for a brand, an eBay category, or everything (scope_kind brand, category or all; scope is the brand or
  category name, empty for all);
- has an area: writing (titles and descriptions), photos, details (eBay item details), match (which eBay listing
  sells her product), parcel, or general;
- counts evidence: how many of the cards given here support it, and against: how many contradict a lesson you
  already have;
- reuses the key of a lesson you already have when it is the same lesson, so it is counted, not written twice;
- uses action catalogue_photos_first only for a brand whose photos repeatedly failed the check; otherwise none;
- source: her when it comes from her changes, ebay from eBay's refusals, keeper from your own work.

Never write a lesson from a single odd card unless it is clear; never repeat a lesson you already have in other
words; never write about prices or profit. At most 8 lessons. None at all is a fine answer when nothing teaches
anything.`;

const TOOL = {
  name: 'lessons',
  description: 'What Keeper learned from looking back.',
  input_schema: {
    type: 'object',
    properties: {
      lessons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'A short name, the same as an existing lesson\'s key when it is the same lesson.' },
            scope_kind: { type: 'string', enum: ['all', 'brand', 'category'] },
            scope: { type: 'string' },
            area: { type: 'string', enum: ['writing', 'photos', 'details', 'match', 'parcel', 'general'] },
            action: { type: 'string', enum: ['none', 'catalogue_photos_first'] },
            lesson: { type: 'string' },
            source: { type: 'string', enum: ['keeper', 'ebay', 'her'] },
            evidence: { type: 'integer' },
            against: { type: 'integer' },
          },
        },
      },
    },
  },
};

export const askLessons = (key: string): Ask => async (system, content) => {
  const { input } = await askTool(key, { system, content, maxTokens: 1500, tool: TOOL });
  return (input?.lessons ?? []) as Json[];
};

const cut = (v: unknown, n = 400) => (v == null ? null : String(typeof v === 'string' ? v : JSON.stringify(v)).slice(0, n));
const brandOf = (c: Json) => c.supplier_read?.facts?.brand ?? c.draft?.item_facts?.brand ?? c.listing?.brand ?? null;
const categoryOf = (c: Json) => c.draft?.ebay_category?.name ?? null;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const hash = (v: unknown) => {
  let h = 0;
  for (const ch of JSON.stringify(v ?? null)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

// Fields Keeper writes, as the portal tells her changes from Keeper's work (src/lib/edits.js).
const FIELDS = ['title', 'description', 'images', 'aspects', 'package', 'ebay_category'];

/*
 * Everything Keeper has not looked at yet, for one shop: this run's needs and failures, her changes to cards Keeper got
 * ready, eBay's refusals of them, and matches she turned down. `refs` are what gets marked seen.
 */
export async function gather(client: Client, run: Json) {
  const tenant = run.tenant_id;
  const { data: jobs } = await client.from('keeper_jobs').select('candidate_id, state, result, error')
    .eq('run_id', run.id).in('state', ['done', 'failed']);
  const { data: cards } = await client.from('candidates')
    .select('id, title, draft, listing, supplier_read').eq('tenant_id', tenant).not('draft->keeper_ready', 'is', null).limit(2000);
  const { data: refused } = await client.from('listing_jobs').select('id, candidate_id, error, state')
    .eq('tenant_id', tenant).eq('state', 'failed').limit(500);
  const { data: seen } = await client.from('keeper_seen').select('ref').eq('tenant_id', tenant).limit(20000);
  const known = new Set(((seen ?? []) as Json[]).map((s) => s.ref));
  const byId = new Map(((cards ?? []) as Json[]).map((c) => [c.id, c]));
  const about = (c: Json | undefined) => ({ card: cut(c?.draft?.title || c?.title, 120), brand: brandOf(c ?? {}), category: categoryOf(c ?? {}) });

  // A card held up by credit running out says nothing about the card: left out, so nothing is learned from it.
  const needs = ((jobs ?? []) as Json[])
    .filter((j) => j.state === 'failed' || j.result?.tray === 'choose')
    .filter((j) => !isCredit(j.error) && !((j.result?.short ?? []) as string[]).some(isCredit))
    .map((j) => ({ ...about(byId.get(j.candidate_id)), needs: j.result?.need ?? [], notes: j.result?.short ?? [], failed: j.state === 'failed' ? cut(j.error, 200) : null }));

  const refs: string[] = [];
  const changes: Json[] = [];
  const turnedDown: Json[] = [];
  for (const c of (cards ?? []) as Json[]) {
    const wrote = c.draft?.keeper_ready?.wrote;
    if (wrote) {
      for (const f of FIELDS) {
        const now = c.draft?.[f] ?? null;
        if (same(now, wrote[f]) || now == null) continue;
        const ref = `change:${c.id}:${f}:${hash(now)}`;
        if (known.has(ref)) continue;
        refs.push(ref);
        changes.push({ ...about(c), field: f, keeper: cut(wrote[f]), hers: cut(now) });
      }
    }
    for (const item of (c.draft?.entry_dismissed ?? []) as string[]) {
      const ref = `dismissed:${c.id}:${item}`;
      if (known.has(ref)) continue;
      refs.push(ref);
      turnedDown.push({ ...about(c), listing: item });
    }
  }
  const ebay: Json[] = [];
  for (const j of (refused ?? []) as Json[]) {
    const c = byId.get(j.candidate_id);
    const ref = `refused:${j.id}`;
    if (!c || known.has(ref)) continue;
    refs.push(ref);
    ebay.push({ ...about(c), ebay_said: cut(j.error, 300) });
  }
  return { needs, changes, ebay, turnedDown, refs };
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'than', 'when', 'what', 'rather', 'instead', 'them', 'they', 'their', 'leave', 'leaving', 'card', 'cards', 'page', 'whole', 'only', 'which', 'where', 'into', 'over', 'such', 'about']);
const wordsOf = (t: unknown) => new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)));
// How alike two lessons read: the words they share, against the shorter one's words.
export function alike(a: string, b: string) {
  const x = wordsOf(a);
  const y = wordsOf(b);
  if (!x.size || !y.size) return 0;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / Math.min(x.size, y.size);
}

/*
 * The same lesson in other words is one lesson (4 October: three near-copies about sources disagreeing, two about
 * LEGO photos). A new lesson that reads like one Keeper has, for the same area and scope, takes that one's key, so it
 * is counted there, and stays removed if she removed it. Two alike in the same look back become one.
 */
export function mergeAlike(lessons: Json[], have: Json[], at = 0.5) {
  const out: Json[] = [];
  for (const l of lessons) {
    const same = (h: Json) => h.area === l.area && (h.scope_kind ?? 'all') === (l.scope_kind ?? 'all')
      && String(h.scope ?? '').toLowerCase() === String(l.scope ?? '').toLowerCase();
    const known = have.find((h) => h.key === l.key)
      ?? have.filter(same).map((h) => ({ h, s: alike(h.lesson, l.lesson) })).filter((x) => x.s >= at).sort((p, q) => q.s - p.s)[0]?.h;
    const twin = out.find((o) => same(o) && (o.key === (known?.key ?? l.key) || alike(o.lesson, l.lesson) >= at));
    if (twin) { twin.evidence = Number(twin.evidence ?? 1) + Number(l.evidence ?? 1); twin.against = Number(twin.against ?? 0) + Number(l.against ?? 0); continue; }
    out.push(known ? { ...l, key: known.key } : l);
  }
  return out;
}

// Look back on a finished run: learn, count, and mark everything looked at as seen. Returns the lessons written.
export async function review(client: Client, run: Json, ask: Ask) {
  const g = await gather(client, run);
  const nothing = !g.needs.length && !g.changes.length && !g.ebay.length && !g.turnedDown.length;
  let lessons: Json[] = [];
  if (!nothing) {
    const { data: have } = await client.from('keeper_lessons').select('key, scope_kind, scope, area, lesson, evidence, against, removed_at')
      .eq('tenant_id', run.tenant_id).limit(200);
    const existing = ((have ?? []) as Json[]).map((l) => ({
      key: l.key, scope: `${l.scope_kind}${l.scope ? `: ${l.scope}` : ''}`, area: l.area, lesson: l.lesson,
      evidence: l.evidence, against: l.against, removed_by_her: Boolean(l.removed_at),
    }));
    const content = JSON.stringify({ needs: g.needs, ebay_refused: g.ebay, her_changes: g.changes, matches_turned_down: g.turnedDown, lessons_you_have: existing }, null, 1);
    lessons = mergeAlike((await ask(REVIEW_SYSTEM, content.slice(0, 60000))).slice(0, 8), (have ?? []) as Json[]);
  }
  const { error } = await client.rpc('keeper_learn', { p_tenant: run.tenant_id, p_run: run.id, p_lessons: lessons });
  if (error) throw new Error(error.message);
  if (g.refs.length) {
    const rows = g.refs.map((ref) => ({ tenant_id: run.tenant_id, ref }));
    for (let i = 0; i < rows.length; i += 500) await client.from('keeper_seen').upsert(rows.slice(i, i + 500), { ignoreDuplicates: true });
  }
  return lessons;
}

/*
 * The lessons in use for one card: for everything, for its brand, or for its eBay category. As lesson_in_use (0140):
 * on two cards or more, more often for than against, not removed.
 */
export function lessonsFor(all: Json[], c: Json) {
  const brand = String(brandOf(c) ?? '').toLowerCase();
  const cat = String(categoryOf(c) ?? c.margin?.category ?? '').toLowerCase();
  const fits = all.filter((l) => !l.removed_at && l.evidence >= 2 && l.evidence > l.against).filter((l) => {
    const s = String(l.scope ?? '').toLowerCase();
    if (l.scope_kind === 'brand') return Boolean(brand && s && (brand.includes(s) || s.includes(brand)));
    if (l.scope_kind === 'category') return Boolean(cat && s && (cat.includes(s) || s.includes(cat)));
    return true;
  });
  /*
   * The same lesson in other words is sent once (6 October: two LEGO photo lessons and three about sources
   * disagreeing went to Claude on every card). The best proven of each set is kept; nothing is changed in her list.
   */
  const kept: Json[] = [];
  for (const l of [...fits].sort((p, q) => Number(q.evidence ?? 0) - Number(q.against ?? 0) - (Number(p.evidence ?? 0) - Number(p.against ?? 0)))) {
    if (!kept.some((k) => k.area === l.area && alike(k.lesson, l.lesson) >= 0.5)) kept.push(l);
  }
  return fits.filter((l) => kept.includes(l));
}

// The lessons as the writing and the item details read them: a short list in plain words.
export const lessonText = (ls: Json[], areas: string[]) => ls.filter((l) => areas.includes(l.area))
  .map((l) => `- ${l.lesson}`).join('\n') || null;
