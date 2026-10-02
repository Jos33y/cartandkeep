import { supabase } from '@lib/supabase';

// Browsing talks to the database one page at a time. Every call here returns only live products that are not samples, whoever is signed in.

export const PAGE_SIZE = 48;
export const SORTS = ['featured', 'price-asc', 'price-desc', 'newest', 'name', 'relevance'];

const clean = (list) => (Array.isArray(list) && list.length ? list : null);
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// The one translation from a filter object to the database's arguments, shared by pages and counts so they can never disagree.
export function filterArgs(tenantId, f = {}) {
  return {
    p_tenant: tenantId,
    p_keys: clean(f.keys),
    p_q: typeof f.q === 'string' && f.q.trim() ? f.q.trim() : null,
    p_min: num(f.min),
    p_max: num(f.max),
    p_brands: clean(f.brands),
    p_in_stock: Boolean(f.inStock),
    p_dispatch_max: num(f.dispatchMax),
    // An unknown dispatch time leaves on the next dispatch day, which utils/delivery.js treats as zero days.
    p_dispatch_default: 0,
    // Google's category inside a section (0129): only with one section, never across the whole shop.
    p_subs: Array.isArray(f.keys) && f.keys.length === 1 ? clean(f.subs) : null,
  };
}

// A card: what a product row needs to become a card, with sizes summarised rather than listed.
export function toCard(row) {
  return {
    ...row,
    price: Number(row.price),
    compare_at: row.compare_at == null ? null : Number(row.compare_at),
    priceFrom: Number(row.price_from),
    priceTo: Number(row.price_to),
    variantCount: row.variant_count ?? 0,
    images: [row.image_url, row.image_2].filter(Boolean),
  };
}

export async function fetchPage(tenantId, filters, { offset = 0, limit = PAGE_SIZE, signal } = {}) {
  const sort = SORTS.includes(filters?.sort) ? filters.sort : 'featured';
  let call = supabase.rpc('store_browse', { ...filterArgs(tenantId, filters), p_sort: sort, p_limit: limit, p_offset: offset });
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) throw error;
  const rows = data ?? [];
  // An empty page still has a total: zero, measured. Only a failed call is unknown, and that throws above.
  return { items: rows.map(toCard), total: rows.length ? Number(rows[0].total) : (offset === 0 ? 0 : null) };
}

export async function fetchFacets(tenantId, filters, { signal } = {}) {
  let call = supabase.rpc('store_facets', filterArgs(tenantId, filters));
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) throw error;
  return data;
}

export async function fetchGroupCounts(tenantId) {
  const { data, error } = await supabase.rpc('store_groups', { p_tenant: tenantId });
  if (error) throw error;
  return (data ?? []).map((g) => ({
    key: g.group_key,
    count: Number(g.products),
    priceMin: Number(g.price_min),
    priceMax: Number(g.price_max),
    images: g.images ?? [],
  }));
}

// One product with everything its page shows, by address. Live and not a sample, as a customer would see it.
// Where an old address went: the live product's address now, or null (store_slug_moves, 0126).
export async function fetchMovedSlug(tenantId, slug) {
  const { data, error } = await supabase.rpc('store_slug_now', { p_tenant: tenantId, p_slug: slug });
  if (error) return null;
  return typeof data === 'string' && data ? data : null;
}

export async function fetchProduct(tenantId, slug) {
  const { data, error } = await supabase
    .from('store_products')
    .select(`
      id, slug, title, description, price, compare_at,
      image_url, images, category, category_path, section, google_sub, postage_band,
      status, is_sample, position,
      brand, condition, source_description, specifications, highlights,
      in_the_box, gtin, mpn, availability, stock, dispatch_days,
      returns_class, returns_note,
      hazard, safety_data_sheet_url, energy_class, energy_label_url,
      compare_at_from, sale_ends,
      store_variants ( id, label, price, stock, availability, sku, gtin, image_url, position )
    `)
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .eq('status', 'live')
    .eq('is_sample', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const CARD_COLUMNS = 'id, slug, title, price, compare_at, image_url, image_2, brand, section, category_path, group_key, availability, buyable, stock, dispatch_days, position, variant_count, price_from, price_to';

// Cards for a list of ids, such as saved products, in the order given. Only live, non-sample products come back, so anything missing has gone.
export async function fetchCardsByIds(tenantId, ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from('store_cards')
    .select(CARD_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('status', 'live')
    .eq('is_sample', false)
    .in('id', ids.slice(0, 200));
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
