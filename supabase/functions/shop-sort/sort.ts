// The sort behind shop-sort: sections proposed as branches of Google's tree, products placed by that tree.
// Kept apart from the server so the tests drive it against a stand-in database and a stand-in Claude.
import { askTool } from '../_shared/claude.ts';
import { MODEL } from '../_shared/model.ts';

type Json = Record<string, any>;

export const SORT_SYSTEM = `You organise the sections of a small independent UK general store's website. The owner approves your proposal before anything changes.

Each section covers one or more branches of Google's product taxonomy, given by their ids from the list of branches. A product goes to the section whose branch holds it, the deepest branch first, so a section for a narrow branch can sit beside one for its parent.

You are given her current sections with the branches they cover; every branch with products on her shop, with how many, and how many research cards she has in it (cards are products she may add; approved ones she has said yes to); and titles of her eBay listings coming to the shop soon.

Propose 5 to 9 sections.
- Name each the way a shopper looks for things: Bathroom, Care and Mobility, Tools. Never Google's own label when it reads like a warehouse (Hardware, Business and Industrial). Never a season or an occasion.
- Keep a current section's name when it still fits.
- Choose the level by the depth of stock: a branch with many products and cards earns a section of its own; thin branches join a broader one.
- Every branch with products on the shop should sit inside some section.
- Give each section the ids of the branches it covers, and one short line on why, in plain words.`;

export const SORT_TOOL = {
  name: 'propose_sections',
  description: 'The sections proposed for the shop, each with the Google branches it covers.',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        description: '5 to 9 sections.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'What a shopper reads. At most 40 characters.' },
            why: { type: 'string', description: 'One short line on why, in plain words.' },
            google_ids: { type: 'array', items: { type: 'integer' }, description: 'Ids of the branches it covers, from the list.' },
          },
        },
      },
    },
  },
};

const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const under = (path: string, branch: string) => path === branch || path.startsWith(`${branch} > `);

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
  const branches = (mix ?? []) as Array<{ id: number; path: string; products: number; cards: number; approved: number }>;
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
  const want = new Set<number>([
    ...((names ?? []) as Json[]).flatMap((n) => (n.google_ids ?? []).map(Number)),
    ...list.map((p) => Number(p.google_category_id)).filter(Boolean),
  ].filter((id) => !pathOf.has(id)));
  const ids = [...want];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from('google_categories').select('id, path').in('id', ids.slice(i, i + 200));
    for (const g of (data ?? []) as Json[]) pathOf.set(Number(g.id), String(g.path));
  }

  const facts = {
    current_sections: ((names ?? []) as Json[]).map((n) => ({ name: n.name, branches: (n.google_ids ?? []).map((id: number) => pathOf.get(Number(id))).filter(Boolean) })),
    branches: branches.map((b) => `${b.id} - ${b.path}: ${b.products} on the shop, ${b.cards} cards${b.approved ? ` (${b.approved} approved)` : ''}`).join('\n'),
    coming_from_ebay: coming,
  };
  const { input, payload } = await askTool(key, { system: SORT_SYSTEM, content: JSON.stringify(facts), maxTokens: 4000, tool: SORT_TOOL });

  // Only offered branches, each in one section; a name once.
  const offered = new Set(branches.map((b) => Number(b.id)));
  const used = new Set<number>();
  const sections: Array<{ name: string; why: string; google_ids: number[]; branches: string[] }> = [];
  for (const s of (input?.sections ?? []) as Json[]) {
    const name = clip(s?.name, 40).replace(/\s*&\s*/g, ' and ');
    if (!name || sections.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
    const gids = ((s?.google_ids ?? []) as unknown[]).map(Number).filter((id) => offered.has(id) && !used.has(id));
    if (!gids.length) continue;
    gids.forEach((id) => used.add(id));
    sections.push({ name, why: clip(s?.why, 120), google_ids: gids, branches: gids.map((id) => pathOf.get(id)!) });
  }
  if (!sections.length) throw new Error('The sort proposed no sections. Try again.');

  // Placed by the tree, never by the model: a product with only a default category stays where it is.
  const placements: Array<{ id: string; section: string }> = [];
  let unplaced = 0;
  for (const p of list) {
    const path = p.google_category_source === 'default' ? null : pathOf.get(Number(p.google_category_id)) ?? null;
    const i = placeOf(path, sections);
    if (i < 0) { unplaced += 1; continue; }
    placements.push({ id: String(p.id), section: sections[i].name });
  }
  return { sections, placements, coming: coming.length, unplaced, model: String(payload.model ?? MODEL) };
}
