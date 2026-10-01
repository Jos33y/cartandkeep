import { supabase } from './supabase.js';

/*
 * Google's product taxonomy as the Candidates screen reads it. Cards store category ids; names are for display and
 * come from google_categories only for the ids in use, a hundred at a time, kept for the session. Which level a
 * filter shows, Healthcare's extra depth and the unplaced chips are decided here and nowhere else.
 */

// The top categories marked for her in categories-2026-09-29.md, the only ones "Move to" offers. Tenant research
// config before client two.
export const HER_TOPS = [536, 632, 469, 1, 1239, 922, 222, 988, 537, 111, 888];

// Health & Beauty > Health Care filters one level deeper.
const HEALTH = 469;
const HEALTHCARE = 491;

export const UNSORTED = 'unsorted';
export const NEEDS = 'needs';

export const HOW_SET = {
  manual: 'you set this',
  ebay: 'from the eBay listing',
  ai: 'from the title',
  google_export: "Google's top category only",
  default: 'placed in Home & Garden for you to move',
};

const cache = new Map();

export async function loadCategories(ids, deeper = true) {
  const want = [...new Set(ids.filter((id) => id != null && !cache.has(id)))];
  for (let i = 0; i < want.length; i += 100) {
    const { data, error } = await supabase
      .from('google_categories')
      .select('id, path, name, depth, top_id, level2_id, level3_id')
      .in('id', want.slice(i, i + 100));
    if (error) throw error;
    for (const g of data ?? []) cache.set(g.id, g);
  }
  // Healthcare's filter names its third level, so the third levels of the cards' own categories are read too.
  if (deeper) {
    const third = ids.map((id) => cache.get(id)?.level3_id).filter((id) => id != null && !cache.has(id));
    if (third.length) await loadCategories(third, false);
  }
  return new Map(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)]));
}

export const categoryName = (id) => cache.get(id)?.name ?? null;
export const categoryPath = (id) => cache.get(id)?.path ?? null;

// Where a card sits inside its tab: the level two filter, Healthcare's third level, or one of the two unplaced chips.
export function placeOf(card) {
  if (card.category_source === 'default') return { l2: NEEDS, l3: null };
  if (card.category_level2_id == null) return { l2: UNSORTED, l3: null };
  const l3 = card.category_top_id === HEALTH && card.category_level2_id === HEALTHCARE
    ? cache.get(card.category_id)?.level3_id ?? null
    : null;
  return { l2: card.category_level2_id, l3 };
}

export const deepensAt = (l2) => l2 === HEALTHCARE;

// Search for "Move to": paths under her tabs, closest names first.
export async function searchCategories(text) {
  const q = text.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('google_categories')
    .select('id, path, name, depth, top_id, level2_id, level3_id')
    .in('top_id', HER_TOPS)
    .ilike('path', `%${q.replace(/[%_]/g, '')}%`)
    .order('depth')
    .limit(25);
  if (error) throw error;
  for (const g of data ?? []) cache.set(g.id, g);
  return data ?? [];
}

// A tab stored by an older build held a batch label; only a number or "all" is a tab now.
export function storedTab(value) {
  if (value === 'all') return 'all';
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 'all';
}
