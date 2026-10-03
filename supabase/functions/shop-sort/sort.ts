// The sort behind shop-sort: sections proposed as branches of Google's tree, products placed by that tree.
// Kept apart from the server so the tests drive it against a stand-in database and a stand-in Claude.
//
// What Keeper proposes is checked, never trusted: every product must end up with a place. A proposal that leaves
// branches out is sent back once with the gaps named; whatever is still out after that is added by the check
// itself, as sections of their own and marked so on the review. Nothing is dropped without being reported.
import { askTool } from '../_shared/claude.ts';
import { MODEL } from '../_shared/model.ts';

type Json = Record<string, any>;
type Branch = { id: number; path: string; products: number; cards: number; approved: number };
export type Section = { name: string; why: string; google_ids: number[]; branches: string[]; by: 'keeper' | 'check' };

// A branch with fewer products than this is not given a section by the check: the shop folds any section under
// three live products into Odds and ends anyway (CATEGORY_MIN in the portal).
export const MIN_SECTION = 3;

export const SORT_SYSTEM = `You organise the sections of a small independent UK general store's website. The owner approves your proposal before anything changes.

Each section covers one or more branches of Google's product taxonomy, given by their ids from the list of branches. A product goes to the section whose branch holds it, the deepest branch first, so a section for a narrow branch can sit beside one for its parent.

You are given:
- the owner's current sections, with what is in each now;
- every branch with products on the shop, with how many, and how many research cards are in it (cards are products the owner may add; approved ones are yes);
- titles of eBay listings coming to the shop soon.

Propose 5 to 12 sections.
- Every product on the shop needs a place. Every top-level branch with products must sit inside some section, unless it has fewer than ${MIN_SECTION} products.
- Keep a current section and its name when what is in it now still fits together. A current section is not dropped because its branch is small.
- Name each the way a shopper looks for things: Bathroom, Care and Mobility, Tools, Pets. Never Google's own label when it reads like a warehouse (Hardware, Business and Industrial). Never a season or an occasion.
- Choose the level by the depth of stock: a branch with many products and cards earns a section of its own; thin branches join a broader one.
- Give only the top of each branch: a branch covers everything inside it, so a section with Home & Garden never also names Decor or Vases. A deeper branch is named only when it has a section of its own.
- For each section, one short line on why, written to the owner as "you" and "your", in plain words.`;

export const SORT_TOOL = {
  name: 'propose_sections',
  description: 'The sections proposed for the shop, each with the Google branches it covers.',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        description: '5 to 12 sections.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'What a shopper reads. At most 40 characters.' },
            why: { type: 'string', description: 'One short line on why, to the owner as "you".' },
            google_ids: { type: 'array', items: { type: 'integer' }, description: 'Ids of the branches it covers, from the list.' },
          },
        },
      },
    },
  },
};

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const under = (path: string, branch: string) => path === branch || path.startsWith(`${branch} > `);
const levelOf = (path: string, n: number) => path.split(' > ').slice(0, n).join(' > ');
// Google's top-level names in a shopper's words, for a section the check has to name itself.
const TOP_NAMES: Record<string, string> = {
  'Animals & Pet Supplies': 'Pets', 'Arts & Entertainment': 'Arts and Hobbies', 'Baby & Toddler': 'Baby',
  'Business & Industrial': 'Work and Safety', 'Cameras & Optics': 'Cameras', 'Clothing & Accessories': 'Clothing and Accessories',
  Electronics: 'Electronics', 'Food, Beverages & Tobacco': 'Food and Drink', Furniture: 'Furniture', Hardware: 'Tools and DIY',
  'Health & Beauty': 'Health and Beauty', 'Home & Garden': 'Home and Garden', 'Luggage & Bags': 'Bags and Luggage',
  Media: 'Books and Media', 'Office Supplies': 'Office and Stationery', 'Religious & Ceremonial': 'Religious and Ceremonial',
  Software: 'Games and Software', 'Sporting Goods': 'Sport and Fitness', 'Toys & Games': 'Toys and Games',
  'Vehicles & Parts': 'Car and Vehicle',
};
const shopName = (google: string) => TOP_NAMES[google] ?? google.split(' > ').pop()!.replace(/\s*&\s*/g, ' and ');

// The deepest branch among the sections that holds a path, and its section's index.
export function placeOf(path: string | null, sections: Array<{ branches: string[] }>) {
  if (!path) return -1;
  let best = -1;
  let depth = 0;
  sections.forEach((s, i) => {
    for (const b of s.branches) {
      const d = b.split(' > ').length;
      if (under(path, b) && d > depth) { best = i; depth = d; }
    }
  });
  return best;
}

/*
 * Keeper's answer made safe: names cleaned and once each, only branches that were offered, each branch in one
 * section, only the top of each branch. Every section or branch taken out is reported with the reason.
 */
export function readProposal(input: Json, offered: Map<number, string>) {
  const used = new Set<number>();
  const sections: Section[] = [];
  const dropped: Array<{ name: string; why: string }> = [];
  for (const s of (input?.sections ?? []) as Json[]) {
    const name = clip(s?.name, 40).replace(/\s*&\s*/g, ' and ');
    if (!name) { dropped.push({ name: '(no name)', why: 'it had no name' }); continue; }
    if (sections.some((x) => x.name.toLowerCase() === name.toLowerCase())) { dropped.push({ name, why: 'the same name twice' }); continue; }
    const raw = ((s?.google_ids ?? []) as unknown[]).map(Number);
    const unknown = raw.filter((id) => !offered.has(id));
    const taken = raw.filter((id) => offered.has(id) && used.has(id));
    const asked = raw.filter((id, i) => offered.has(id) && !used.has(id) && raw.indexOf(id) === i);
    const gids = asked.filter((id) => !asked.some((other) => other !== id && under(offered.get(id)!, offered.get(other)!)));
    if (!gids.length) {
      dropped.push({ name, why: unknown.length ? `its categories were not on the list (${unknown.join(', ')})` : taken.length ? 'its categories were already in another section' : 'it named no category' });
      continue;
    }
    gids.forEach((id) => used.add(id));
    sections.push({ name, why: clip(s?.why, 160), google_ids: gids, branches: gids.map((id) => offered.get(id)!), by: 'keeper' });
  }
  return { sections, dropped };
}

// Products no section places, grouped by their top-level branch, largest first.
export function gapsOf(products: Array<{ id: string; path: string | null }>, sections: Section[]) {
  const out = new Map<string, string[]>();
  for (const p of products) {
    if (!p.path || placeOf(p.path, sections) >= 0) continue;
    const top = levelOf(p.path, 1);
    out.set(top, [...(out.get(top) ?? []), p.id]);
  }
  return [...out].map(([path, ids]) => ({ path, ids })).sort((a, b) => b.ids.length - a.ids.length);
}

/*
 * What Keeper still left out, given a place by rule: a top-level branch already partly in a section joins the
 * section holding most of its products; one in no section becomes a section of its own, named after the current
 * section most of its products sit in, or after Google's branch in a shopper's words. Under MIN_SECTION products
 * it is listed instead, never hidden.
 */
export function fillGaps(
  products: Array<{ id: string; path: string | null; section: string | null }>,
  sections: Section[],
  idOf: Map<string, number>,
  currentName: Map<string, string>,
) {
  const out = sections.map((s) => ({ ...s, google_ids: [...s.google_ids], branches: [...s.branches] }));
  const left: Array<{ path: string; products: number }> = [];
  for (const gap of gapsOf(products, out)) {
    const top = gap.path;
    const topId = idOf.get(top);
    const inTop = products.filter((p) => p.path && levelOf(p.path, 1) === top);
    // Part of this branch is already in a section: the rest of it joins that section.
    const share = new Map<number, number>();
    for (const p of inTop) { const i = placeOf(p.path, out); if (i >= 0) share.set(i, (share.get(i) ?? 0) + 1); }
    const host = [...share].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (host !== undefined && topId !== undefined) {
      out[host].google_ids.push(topId);
      out[host].branches.push(top);
      continue;
    }
    // A section of its own: her current name for most of these products, if she has one not already used.
    const tally = new Map<string, number>();
    for (const p of inTop) if (p.section && currentName.has(p.section)) tally.set(p.section, (tally.get(p.section) ?? 0) + 1);
    // Hers only when it already holds at least half of them: phone chargers do not become "Music and audio".
    const hers = [...tally].filter(([, k]) => k * 2 >= gap.ids.length).sort((a, b) => b[1] - a[1]).map(([path]) => currentName.get(path)!)[0];
    // Her section already rebuilt by the check (toys after arts, both in Kids and family): this joins it.
    const rebuilt = hers ? out.findIndex((s) => s.by === 'check' && s.name.toLowerCase() === hers.toLowerCase()) : -1;
    if (rebuilt >= 0 && topId !== undefined) {
      out[rebuilt].google_ids.push(topId);
      out[rebuilt].branches.push(top);
      out[rebuilt].why = `Left out of the answer, so the check kept your ${hers} section for them.`;
      continue;
    }
    // Too few for a section of its own: listed on the review, never hidden.
    if (gap.ids.length < MIN_SECTION || topId === undefined) { left.push({ path: top, products: gap.ids.length }); continue; }
    let name = hers && !out.some((s) => s.name.toLowerCase() === hers.toLowerCase()) ? hers : shopName(top);
    if (out.some((s) => s.name.toLowerCase() === name.toLowerCase())) name = shopName(top);
    out.push({
      name, google_ids: [topId], branches: [top], by: 'check',
      why: name === hers
        ? `Left out of the answer, so the check kept your ${hers} section for them.`
        : `${gap.ids.length} products left out of the answer, so the check gave them a section of their own.`,
    });
  }
  return { sections: out, left };
}

const factsFor = (current: Json[], branches: Branch[], coming: string[]) => ({
  current_sections: current,
  branches: branches.map((b) => `${b.id} - ${b.path}: ${b.products} on the shop, ${b.cards} cards${b.approved ? ` (${b.approved} approved)` : ''}`).join('\n'),
  coming_from_ebay: coming,
});

export async function sortShop(db: Json, tenantId: string, key: string) {
  const [{ data: names }, { data: mix, error: mErr }, { data: products }, { data: latest }] = await Promise.all([
    db.from('store_category_names').select('path, name, google_ids').eq('tenant_id', tenantId).eq('own', true),
    db.rpc('google_mix', { p_tenant: tenantId }),
    db.from('store_products').select('id, title, section, source_ref, google_category_id, google_category_source')
      .eq('tenant_id', tenantId).neq('status', 'archived').eq('is_sample', false).limit(2000),
    db.from('ebay_traffic').select('window_start, window_end').eq('tenant_id', tenantId)
      .order('window_end', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (mErr) throw new Error(mErr.message);
  const list = (products ?? []) as Json[];
  if (!list.length) throw new Error('There are no products to sort yet.');
  const branches = (mix ?? []) as Branch[];
  if (!branches.some((b) => b.products > 0)) throw new Error('No product has a Google category yet. Run the category fill first.');

  let coming: string[] = [];
  if (latest) {
    const onShop = new Set(list.map((p) => String(p.source_ref ?? '')));
    const { data: traffic } = await db.from('ebay_traffic').select('listing_id, title')
      .eq('tenant_id', tenantId).eq('window_start', latest.window_start).eq('window_end', latest.window_end)
      .not('listing_id', 'is', null).limit(400);
    coming = ((traffic ?? []) as Json[]).filter((t) => !onShop.has(String(t.listing_id)) && t.title).map((t) => String(t.title)).slice(0, 250);
  }

  // Paths for every id the sections or the products use.
  const pathOf = new Map(branches.map((b) => [Number(b.id), b.path]));
  const want = [...new Set<number>([
    ...((names ?? []) as Json[]).flatMap((n) => (n.google_ids ?? []).map(Number)),
    ...list.map((p) => Number(p.google_category_id)).filter(Boolean),
  ])].filter((id) => !pathOf.has(id));
  for (let i = 0; i < want.length; i += 200) {
    const { data } = await db.from('google_categories').select('id, path').in('id', want.slice(i, i + 200));
    for (const g of (data ?? []) as Json[]) pathOf.set(Number(g.id), String(g.path));
  }
  const offered = new Map(branches.map((b) => [Number(b.id), b.path]));
  const idOf = new Map(branches.map((b) => [b.path, Number(b.id)]));

  // A product with only the default category has no place by the tree: it stays where it is.
  const items = list.map((p) => ({
    id: String(p.id),
    section: p.section ? String(p.section) : null,
    path: p.google_category_source === 'default' ? null : pathOf.get(Number(p.google_category_id)) ?? null,
  }));

  // Her sections as they are now, with what is in them, so Keeper can keep what fits.
  const currentName = new Map(((names ?? []) as Json[]).map((n) => [String(n.path), String(n.name)]));
  const current = ((names ?? []) as Json[]).map((n) => {
    const holds = new Map<string, number>();
    for (const p of items) if (p.section === n.path && p.path) holds.set(levelOf(p.path, 2), (holds.get(levelOf(p.path, 2)) ?? 0) + 1);
    return {
      name: n.name,
      covers: (n.google_ids ?? []).map((id: number) => pathOf.get(Number(id))).filter(Boolean),
      holds_now: [...holds].sort((a, b) => b[1] - a[1]).map(([path, k]) => `${path}: ${k}`),
    };
  });

  const facts = factsFor(current, branches, coming);
  const first = await askTool(key, { system: SORT_SYSTEM, content: JSON.stringify(facts), maxTokens: 6000, tool: SORT_TOOL });
  let read = readProposal(first.input, offered);
  let asked = 1;
  console.log('[shop-sort] first', JSON.stringify({ sections: first.input?.sections ?? null, stop: first.payload?.stop_reason }));

  // Gaps named and asked once more; the better of the two answers is kept.
  const gaps = gapsOf(items, read.sections).filter((g) => g.ids.length >= MIN_SECTION);
  let payload = first.payload;
  if (gaps.length) {
    const again = `Your answer left these top-level branches with products in no section:\n${gaps.map((g) => `${idOf.get(g.path) ?? '?'} - ${g.path}: ${g.ids.length} products`).join('\n')}\n\nYour answer was:\n${JSON.stringify(first.input?.sections ?? [])}\n\nAnswer again with the complete list of sections, keeping what was right and giving every one of these a place.`;
    const second = await askTool(key, { system: SORT_SYSTEM, content: `${JSON.stringify(facts)}\n\n${again}`, maxTokens: 6000, tool: SORT_TOOL });
    const reread = readProposal(second.input, offered);
    console.log('[shop-sort] second', JSON.stringify({ sections: second.input?.sections ?? null, stop: second.payload?.stop_reason }));
    const placedBy = (s: Section[]) => items.filter((p) => placeOf(p.path, s) >= 0).length;
    if (placedBy(reread.sections) >= placedBy(read.sections)) { read = reread; payload = second.payload; }
    asked = 2;
  }
  if (!read.sections.length) throw new Error('The sort proposed no sections. Try again.');

  const filled = fillGaps(items, read.sections, idOf, currentName);
  const placements: Array<{ id: string; section: string }> = [];
  for (const p of items) {
    const i = placeOf(p.path, filled.sections);
    if (i >= 0) placements.push({ id: p.id, section: filled.sections[i].name });
  }
  return {
    sections: filled.sections,
    placements,
    total: items.length,
    unplaced: items.length - placements.length,
    left: filled.left,
    dropped: read.dropped,
    asked,
    coming: coming.length,
    model: String(payload?.model ?? MODEL),
  };
}
