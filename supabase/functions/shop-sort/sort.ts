// The sort behind shop-sort. Google's tree decides the sections; Keeper only names them.
//
//   - Every top-level branch with products is a section.
//   - A branch with SPLIT or more products splits into its next level: top-level branches always may, and the
//     branches in DEEPER (Healthcare, as the research screens already go one level deeper there) may once more.
//   - A smaller sub-branch stays with its family: it joins the largest section made from the same parent, never a
//     section from another branch. Products filed on the parent itself do the same.
//   - A top-level branch with fewer than MIN_SECTION products in all is listed on the review and stays where it is.
//   - Names: each new section is offered her current name for most of its already placed products; Keeper keeps
//     it where it still fits (so her section and its address stay) and names the rest in a shopper's words. Keeper
//     cannot merge, split or drop anything; if it fails, her names and then the tree's own stand.
// The same shop always gives the same sections.
import { askTool } from '../_shared/claude.ts';
import { MODEL } from '../_shared/model.ts';

type Json = Record<string, any>;
export type Item = { id: string; path: string | null; section: string | null; title?: string };
export type Section = { name: string; why: string; google_ids: number[]; branches: string[]; by: 'tree' };
export type Draft = { node: string; branches: string[]; members: Item[] };

export const SPLIT = 20;
export const MIN_SECTION = 3;
// Branches that may split once more, for a care-led shop. Matches deepensAt in src/lib/categories.js.
export const DEEPER = ['Health & Beauty > Healthcare'];

const under = (path: string, branch: string) => path === branch || path.startsWith(`${branch} > `);
const depthOf = (path: string) => path.split(' > ').length;
const levelOf = (path: string, n: number) => path.split(' > ').slice(0, n).join(' > ');

// Google's top-level names in a shopper's words, used when neither she nor Keeper gives one.
const TOP_NAMES: Record<string, string> = {
  'Animals & Pet Supplies': 'Pets', 'Arts & Entertainment': 'Arts and Hobbies', 'Baby & Toddler': 'Baby',
  'Business & Industrial': 'Work and Safety', 'Cameras & Optics': 'Cameras', 'Clothing & Accessories': 'Clothing and Accessories',
  Electronics: 'Electronics', 'Food, Beverages & Tobacco': 'Food and Drink', Furniture: 'Furniture', Hardware: 'Tools and DIY',
  'Health & Beauty': 'Health and Beauty', 'Home & Garden': 'Home and Garden', 'Luggage & Bags': 'Bags and Luggage',
  Media: 'Books and Media', 'Office Supplies': 'Office and Stationery', 'Religious & Ceremonial': 'Religious and Ceremonial',
  Software: 'Games and Software', 'Sporting Goods': 'Sport and Fitness', 'Toys & Games': 'Toys and Games',
  'Vehicles & Parts': 'Car and Vehicle',
};
export const plainName = (google: string) => TOP_NAMES[google] ?? google.split(' > ').pop()!.replace(/\s*&\s*/g, ' and ');

// The deepest branch among the sections that holds a path, and its section's index.
export function placeOf(path: string | null, sections: Array<{ branches: string[] }>) {
  if (!path) return -1;
  let best = -1;
  let depth = 0;
  sections.forEach((s, i) => {
    for (const b of s.branches) {
      const d = depthOf(b);
      if (under(path, b) && d > depth) { best = i; depth = d; }
    }
  });
  return best;
}

// One node: a section of its own, or split into its children when it is large and may split.
function splitNode(node: string, members: Item[], may: (node: string) => boolean): Draft[] {
  if (members.length < SPLIT || !may(node)) return [{ node, branches: [node], members }];
  const d = depthOf(node);
  const kids = new Map<string, Item[]>();
  for (const m of members) if (depthOf(m.path!) > d) { const k = levelOf(m.path!, d + 1); kids.set(k, [...(kids.get(k) ?? []), m]); }
  const big = [...kids].filter(([, ms]) => ms.length >= MIN_SECTION).sort((a, b) => b[1].length - a[1].length);
  if (big.length < 2) return [{ node, branches: [node], members }];

  const drafts = big.flatMap(([kid, ms]) => splitNode(kid, ms, may));
  // The family's small sub-branches, and anything filed on the node itself, join its largest section.
  const host = drafts.reduce((a, b) => (b.members.length > a.members.length ? b : a));
  for (const [kid, ms] of kids) if (ms.length < MIN_SECTION) { host.branches.push(kid); host.members.push(...ms); }
  const onNode = members.filter((m) => depthOf(m.path!) === d);
  if (onNode.length) { host.branches.push(node); host.members.push(...onNode); }
  return drafts;
}

export function buildSections(items: Item[]) {
  const tops = new Map<string, Item[]>();
  for (const it of items) if (it.path) { const t = levelOf(it.path, 1); tops.set(t, [...(tops.get(t) ?? []), it]); }
  const may = (node: string) => depthOf(node) === 1 || DEEPER.includes(node);
  const drafts: Draft[] = [];
  const left: Array<{ path: string; products: number }> = [];
  for (const [top, ms] of [...tops].sort((a, b) => b[1].length - a[1].length)) {
    if (ms.length < MIN_SECTION) { left.push({ path: top, products: ms.length }); continue; }
    drafts.push(...splitNode(top, ms, may));
  }
  return { drafts, left };
}

/*
 * Her current section for each new section: the one holding most of its products that are already placed (products
 * with no section yet say nothing). Each of her sections is offered once, to the new section holding most of its
 * products, so Home and garden is offered to where most of its products went, not to every part of the home.
 */
export function candidatesFor(drafts: Draft[], currentName: Map<string, string>) {
  const pairs: Array<{ i: number; path: string; n: number }> = [];
  drafts.forEach((d, i) => {
    const tally = new Map<string, number>();
    for (const m of d.members) if (m.section && currentName.has(m.section)) tally.set(m.section, (tally.get(m.section) ?? 0) + 1);
    for (const [path, n] of tally) pairs.push({ i, path, n });
  });
  pairs.sort((a, b) => b.n - a.n || drafts[b.i].members.length - drafts[a.i].members.length || a.path.localeCompare(b.path));
  const out: Array<string | null> = new Array(drafts.length).fill(null);
  const taken = new Set<string>();
  for (const p of pairs) {
    if (out[p.i] !== null || taken.has(p.path)) continue;
    out[p.i] = currentName.get(p.path)!;
    taken.add(p.path);
  }
  return out;
}

/*
 * Names, in order: Keeper's answer, which keeps her current name wherever it still fits (and so her section and its
 * address); her current name if Keeper gave none; the tree's own in plain words. A name once.
 */
export function nameSections(drafts: Draft[], candidates: Array<string | null>, keeper: string[] | null) {
  const used = new Set<string>();
  const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 40).replace(/\s*&\s*/g, ' and ');
  return drafts.map((d, i) => {
    const hers = candidates[i];
    const said = clean(keeper?.[i]);
    // Keeper keeping her name, in any case or spacing, is her name exactly: that is what keeps her section.
    const first = hers && said.toLowerCase() === hers.toLowerCase() ? hers : said;
    for (const n of [first, hers, plainName(d.node), `${plainName(levelOf(d.node, 1))}: ${plainName(d.node)}`]) {
      if (n && !used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; }
    }
    const n = `${plainName(d.node)} ${i + 1}`;
    used.add(n.toLowerCase());
    return n;
  });
}

export const NAME_SYSTEM = `You name the sections of a small independent UK general store's website. The sections are already decided from Google's product categories; you only give each one a name.

For each section you are given the Google category it is built on, how many products it has, a few of them, and, where there is one, the owner's current section name for most of these products.

- Keep the current name, exactly as written, whenever it still describes what is in the section. Changing a name changes the page's address, so keep it unless it would mislead a shopper: "Music and audio" for phones and chargers misleads; "Pet Essentials" for pet food and grooming does not.
- Otherwise name it the way a shopper looks for things, in at most three words: Beauty, Pets, Food and Drink, Mobility Aids, Lighting. Never Google's label when it reads like a warehouse (Hardware, Business and Industrial, Household Supplies). Never a season or an occasion.
- No two names the same. Answer with one name per section, in the order given.`;

export const NAME_TOOL = {
  name: 'name_sections',
  description: 'One name per section, in the order given.',
  input_schema: {
    type: 'object',
    properties: { names: { type: 'array', items: { type: 'string' }, description: 'One name per section, in order. At most 40 characters each.' } },
  },
};

export async function sortShop(db: Json, tenantId: string, key: string) {
  const [{ data: names }, { data: products }, { data: latest }] = await Promise.all([
    db.from('store_category_names').select('path, name, google_ids').eq('tenant_id', tenantId).eq('own', true),
    db.from('store_products').select('id, title, section, source_ref, google_category_id, google_category_source')
      .eq('tenant_id', tenantId).neq('status', 'archived').eq('is_sample', false).limit(2000),
    db.from('ebay_traffic').select('window_start, window_end').eq('tenant_id', tenantId)
      .order('window_end', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const list = (products ?? []) as Json[];
  if (!list.length) throw new Error('There are no products to sort yet.');

  const ids = [...new Set(list.map((p) => Number(p.google_category_id)).filter(Boolean))];
  const pathOf = new Map<number, string>();
  const idOf = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('google_categories').select('id, path').in('id', ids.slice(i, i + 200));
    for (const g of (data ?? []) as Json[]) pathOf.set(Number(g.id), String(g.path));
  }

  // A product with only the default category has no place by the tree: it stays where it is.
  const items: Item[] = list.map((p) => ({
    id: String(p.id), title: String(p.title ?? ''), section: p.section ? String(p.section) : null,
    path: p.google_category_source === 'default' ? null : pathOf.get(Number(p.google_category_id)) ?? null,
  }));
  if (!items.some((i) => i.path)) throw new Error('No product has a Google category yet. Run the category fill first.');

  const { drafts, left } = buildSections(items);
  // Every branch a section names, as an id.
  const want = [...new Set(drafts.flatMap((d) => d.branches))];
  for (let i = 0; i < want.length; i += 100) {
    const { data } = await db.from('google_categories').select('id, path').in('path', want.slice(i, i + 100));
    for (const g of (data ?? []) as Json[]) idOf.set(String(g.path), Number(g.id));
  }
  const missing = want.filter((p) => !idOf.has(p));
  if (missing.length) throw new Error(`Not in google_categories: ${missing.join(', ')}`);

  const currentName = new Map(((names ?? []) as Json[]).map((n) => [String(n.path), String(n.name)]));
  const candidates = candidatesFor(drafts, currentName);
  let keeper: string[] | null = null;
  let model = MODEL;
  try {
    const content = JSON.stringify(drafts.map((d, i) => ({
      n: i + 1, category: d.node, products: d.members.length,
      examples: d.members.slice(0, 6).map((m) => m.title?.slice(0, 70)),
      ...(candidates[i] ? { current_name: candidates[i] } : {}),
    })));
    const { input, payload } = await askTool(key, { system: NAME_SYSTEM, content, maxTokens: 1500, tool: NAME_TOOL });
    keeper = Array.isArray(input?.names) ? input.names.map(String) : null;
    model = String(payload?.model ?? MODEL);
    console.log('[shop-sort] names', JSON.stringify(keeper));
  } catch (e) {
    // Naming is the only part Keeper does; the tree's own names stand in if it fails.
    console.error('[shop-sort] naming failed', e instanceof Error ? e.message : String(e));
  }
  const named = nameSections(drafts, candidates, keeper);

  const sections: Section[] = drafts.map((d, i) => ({
    name: named[i], why: '', by: 'tree', branches: d.branches, google_ids: d.branches.map((b) => idOf.get(b)!),
  }));
  const placements: Array<{ id: string; section: string }> = [];
  for (const it of items) {
    const i = placeOf(it.path, sections);
    if (i >= 0) placements.push({ id: it.id, section: sections[i].name });
  }

  let coming = 0;
  if (latest) {
    const onShop = new Set(list.map((p) => String(p.source_ref ?? '')));
    const { data: traffic } = await db.from('ebay_traffic').select('listing_id')
      .eq('tenant_id', tenantId).eq('window_start', latest.window_start).eq('window_end', latest.window_end)
      .not('listing_id', 'is', null).limit(400);
    coming = ((traffic ?? []) as Json[]).filter((t) => !onShop.has(String(t.listing_id))).length;
  }

  return {
    sections, placements, total: items.length, unplaced: items.length - placements.length, left,
    dropped: [], asked: 1, coming, model, rule: { split: SPLIT, min: MIN_SECTION, deeper: DEEPER },
  };
}
