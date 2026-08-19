import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';
import { deleteProductImage } from '@lib/productImages';

/*
 * The catalogue, and what stops a product going public.
 *
 * This is a release screen rather than an editor. `enrich-store.js` already
 * classified every product's returns class and flagged the hazard suspects, and
 * wrote both into `derived_fields` instead of into the real columns. So the job
 * here is confirming or correcting a guess a script made, which is a lighter
 * action than authoring one and is exactly what the 0036 comment asks for.
 */

const SELECT = `
  id, tenant_id, slug, title, price, image_url, images, status, is_sample, stock,
  category, category_path, brand, description, source_description,
  specifications, in_the_box,
  availability, returns_class, returns_note,
  hazard, safety_data_sheet_url, biocide_reg_no,
  derived_fields, source_kind
`;

/*
 * The release guard.
 *
 * Blocking, not advisory. A product failing any of these does not go live, and
 * the reason is named on the row so the fix is obvious.
 *
 * The returns check is the one that earns its keep. `returns_class` has a
 * column default of 'standard', so every row already reads as standard whether
 * or not a person ever looked at it, and `enrich-store.js` only writes 'sealed'
 * or 'none', into `derived_fields`. That means a gift set full of bath products
 * currently presents as an ordinary 14 day return and nothing anywhere stops it
 * going live saying so. That is the wrong returns sentence again, one layer
 * down, and it is the reason this is a gate rather than a nag.
 *
 * The hazard check blocks the seven classified mixtures by name until somebody
 * reads a label. `screens.py` refuses ingestibles and cosmetics on the research
 * side and has no equivalent for chemicals, which is how they reached the seed.
 *
 * An empty description is a warning, not a block. All 78 are empty and blocking
 * on it would make this screen useless on the one weekend it is needed.
 */
export function blockers(p) {
  const out = [];

  if (!(Number(p.price) > 0)) out.push('No price');
  if (!p.image_url) out.push('No photograph');

  // Present in derived_fields means a script guessed it and nobody confirmed.
  if (p.derived_fields?.returns_class) out.push('Returns class unconfirmed');

  if (p.derived_fields?.hazard_suspect && !p.hazard) out.push('Hazard data missing');

  if (p.availability === 'out_of_stock' || p.availability === 'discontinued') {
    out.push('Marked unavailable');
  }

  // Only where she has set a count. Null is untracked and always sellable.
  if (typeof p.stock === 'number' && p.stock <= 0) out.push('None left');

  return out;
}

export function warnings(p) {
  const out = [];
  if (!p.description?.trim()) out.push('No description');
  if (!p.category_path) out.push('No category');
  if (!p.brand) out.push('No brand');
  return out;
}

export const isLive = (p) => p.status === 'live' && !p.is_sample;
export const isReady = (p) => !isLive(p) && blockers(p).length === 0;
export const isBlocked = (p) => !isLive(p) && blockers(p).length > 0;

export function useCatalogue(tenantId) {
  const [state, setState] = useState({ status: 'loading', rows: [], error: null });

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const { data, error } = await supabase
      .from('store_products')
      .select(SELECT)
      .eq('tenant_id', tenantId)
      .order('title', { ascending: true });

    if (error) return setState({ status: 'error', rows: [], error });
    setState({ status: 'ready', rows: data ?? [], error: null });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  /*
   * Taking products live, and taking them back.
   *
   * `is_sample` clears in the same write. It is a build boundary rather than a
   * product fact, and leaving it set means the read policy hides the product
   * from the public even though its status says live, which would look like the
   * shop is broken rather than like a flag was missed.
   *
   * The guard is re-run here rather than trusted from the selection. A row can
   * change between the tick and the button, and this is the write that makes
   * something public.
   */
  const publish = useCallback(async (ids) => {
    const rows = state.rows.filter((r) => ids.includes(r.id));
    const refused = rows.filter((r) => blockers(r).length > 0);
    if (refused.length) {
      throw new Error(`${refused.length} of these cannot go live yet. Clear what is blocking them first.`);
    }

    const { error } = await supabase
      .from('store_products')
      .update({ status: 'live', is_sample: false })
      .in('id', rows.map((r) => r.id));

    if (error) throw error;
    await load();
  }, [state.rows, load]);

  const unpublish = useCallback(async (ids) => {
    const { error } = await supabase
      .from('store_products')
      .update({ status: 'draft' })
      .in('id', ids);

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Confirming a returns class.
   *
   * Writes the value to the real column and removes it from `derived_fields`,
   * which is what turns a script's guess into a decision somebody made. Once
   * that key is gone the product stops being blocked, and the change is
   * deliberately not reversible in one tap: putting a guess back would mean
   * writing a key that says nobody has checked, which is not something a
   * confirmation screen should be able to do.
   */
  const confirmReturns = useCallback(async ({ id, returnsClass, note }) => {
    const row = state.rows.find((r) => r.id === id);
    const derived = { ...(row?.derived_fields ?? {}) };
    delete derived.returns_class;

    const { error } = await supabase
      .from('store_products')
      .update({
        returns_class: returnsClass,
        returns_note: note?.trim() || null,
        derived_fields: derived,
      })
      .eq('id', id);

    if (error) throw error;
    await load();
  }, [state.rows, load]);

  /*
   * Recording the GB CLP label elements, or recording that there are none.
   *
   * Both are answers and the difference matters. `hazard` null on a product
   * nobody has looked at and `hazard` null on a product somebody confirmed is
   * not a classified mixture are the same value with opposite meanings, so
   * clearing the suspect flag is what records that a person checked.
   */
  const saveHazard = useCallback(async ({ id, hazard, sdsUrl, biocideRegNo, notHazardous }) => {
    const row = state.rows.find((r) => r.id === id);
    const derived = { ...(row?.derived_fields ?? {}) };
    delete derived.hazard_suspect;

    const { error } = await supabase
      .from('store_products')
      .update({
        hazard: notHazardous ? null : hazard,
        safety_data_sheet_url: sdsUrl?.trim() || null,
        biocide_reg_no: biocideRegNo?.trim() || null,
        derived_fields: derived,
      })
      .eq('id', id);

    if (error) throw error;
    await load();
  }, [state.rows, load]);

  /*
   * Her sentence about the product.
   *
   * Empty on all 78, and the page falls back to the supplier's text in a panel
   * labelled as theirs, which is honest and is not selling anything. This is
   * the only field on this screen that is authored rather than confirmed, and
   * it earns the exception because a warning she cannot act on is a dead end.
   *
   * Not blocking. Blocking on it would make this screen useless on the one
   * weekend it is needed, and a product with a photograph and a price and no
   * description still sells.
   */
  const saveDescription = useCallback(async ({ id, description }) => {
    const { error } = await supabase
      .from('store_products')
      .update({ description: description?.trim() || null })
      .eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * The fields she corrects rather than confirms.
   *
   * Price and title are here and nothing else, because everything else on a
   * product is either derived, confirmed elsewhere on this screen, or belongs
   * to a screen that does not exist yet. A partial editor that silently drops
   * a field is worse than one that does not offer it.
   *
   * The slug does not follow the title. A URL that changes when somebody fixes
   * a typo breaks every link anyone has shared and every page Google has
   * indexed, so it is set once when the product is created and left alone.
   */
  const saveDetails = useCallback(async ({ id, title, price }) => {
    const patch = {};
    if (typeof title === 'string' && title.trim()) patch.title = title.trim();
    if (price !== undefined && price !== null && price !== '') {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0) throw new Error('That price does not look like a number.');
      patch.price = Math.round(n * 100) / 100;
    }
    if (!Object.keys(patch).length) return;

    const { error } = await supabase.from('store_products').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Photographs.
   *
   * `image_url` is the one the card and the shelf use and `images` is the
   * gallery, so the first of the array and `image_url` have to stay the same
   * value. Keeping them in step here rather than in three call sites is the
   * whole reason this is one function.
   */
  const saveImages = useCallback(async ({ id, images }) => {
    const clean = images.filter(Boolean);
    const { error } = await supabase
      .from('store_products')
      .update({ images: clean, image_url: clean[0] ?? null })
      .eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  const removeImage = useCallback(async ({ id, url }) => {
    const row = state.rows.find((r) => r.id === id);
    const next = (row?.images ?? []).filter((u) => u !== url);

    const { error } = await supabase
      .from('store_products')
      .update({ images: next, image_url: next[0] ?? null })
      .eq('id', id);

    if (error) throw error;

    // The row is updated first. An orphaned file is untidy, a product pointing
    // at a file that is gone is a broken photograph on the shop.
    await deleteProductImage(url);
    await load();
  }, [state.rows, load]);

  /*
   * A product she has at home.
   *
   * Created draft and never sample: `is_sample` is a build boundary for rows we
   * seeded, and a product she typed in herself is a real one that simply is not
   * public yet.
   *
   * The slug retries rather than pre-checking. `unique (tenant_id, slug)` is
   * the only thing that actually knows, and a select then insert has a gap
   * between them where a second tab wins.
   */
  const create = useCallback(async ({ title, price, categoryPath }) => {
    const clean = String(title ?? '').trim();
    if (!clean) throw new Error('A title is needed.');

    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) throw new Error('A price is needed.');

    const base = slugify(clean);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = attempt === 0 ? base : `${base}-${suffix()}`;

      const { data, error } = await supabase.from('store_products').insert({
        tenant_id: tenantId,
        slug,
        title: clean,
        price: Math.round(n * 100) / 100,
        status: 'draft',
        is_sample: false,
        source_kind: 'manual',
        category_path: categoryPath || null,
        category: categoryPath ? categoryPath.split('|').pop().trim() : null,
        images: [],
      }).select('id').single();

      if (!error) { await load(); return data.id; }

      // 23505 is a unique violation, which here means the slug is taken.
      // Anything else is a real failure and retrying it would only hide it.
      if (error.code !== '23505') throw error;
    }

    throw new Error('Could not find a free web address for that title. Try changing it slightly.');
  }, [tenantId, load]);

  /*
   * How many she has.
   *
   * Empty means untracked, which is every seeded product and anything she
   * reorders, and untracked is always sellable. A number is counted down on
   * payment. The distinction is the whole feature: a shop that insists on a
   * count for a thing it can always get more of makes work for nobody's
   * benefit.
   *
   * Setting a number does not change availability by itself. Zero stock and
   * "out of stock" arrive at the same place through the checkout, and having
   * two switches that mean the same thing is how they end up disagreeing.
   */
  const saveStock = useCallback(async ({ id, stock, availability }) => {
    const patch = { availability };

    if (stock === '' || stock === null || stock === undefined) {
      patch.stock = null;
    } else {
      const n = Number(stock);
      if (!Number.isInteger(n) || n < 0) throw new Error('Stock has to be a whole number, or empty.');
      patch.stock = n;
    }

    const { error } = await supabase.from('store_products').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  /*
   * The rest of the product record.
   *
   * Category was on the add form and nowhere else, so the 78 seeded products
   * were stuck with whatever eBay's Browse call decided they were and nothing
   * could be refiled. That was a gap rather than a decision.
   *
   * `category_path` is the pipe separated eBay path and `category` is its leaf.
   * Both are written together because `groupCategories` reads the path for the
   * navigation and the card reads the leaf, and letting those two drift is how
   * a product appears under one heading and describes itself as another.
   */
  const saveRecord = useCallback(async ({ id, categoryPath, brand, specifications, inTheBox }) => {
    const patch = {};

    if (categoryPath !== undefined) {
      patch.category_path = categoryPath || null;
      patch.category = categoryPath ? categoryPath.split('|').pop().trim() : null;
    }
    if (brand !== undefined) patch.brand = brand?.trim() || null;
    if (inTheBox !== undefined) patch.in_the_box = inTheBox?.trim() || null;

    /*
     * Specifications arrive as pairs rather than as an object, because a
     * key/value editor that maps straight onto an object silently loses a row
     * the moment two keys match. Blank keys are dropped and a later duplicate
     * wins, which is what somebody correcting a typo expects.
     */
    if (specifications !== undefined) {
      const out = {};
      for (const { key, value } of specifications) {
        const k = String(key ?? '').trim();
        if (k) out[k] = String(value ?? '').trim();
      }
      patch.specifications = out;
    }

    if (!Object.keys(patch).length) return;

    const { error } = await supabase.from('store_products').update(patch).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  const counts = useMemo(() => ({
    live: state.rows.filter(isLive).length,
    ready: state.rows.filter(isReady).length,
    blocked: state.rows.filter(isBlocked).length,
    all: state.rows.length,
  }), [state.rows]);

  return {
    ...state, counts, reload: load,
    publish, unpublish, confirmReturns, saveHazard, saveDescription,
    saveDetails, saveImages, removeImage, create, saveStock, saveRecord,
  };
}

/*
 * How many products a category needs before it becomes a section.
 *
 * `groupCategories` folds anything under three into "Everything else", so
 * taking two products live in a new department produces no department. That is
 * the right rule and the reasoning is invisible, which is the only reason this
 * is surfaced: silently correct behaviour is indistinguishable from a bug.
 */
export const CATEGORY_MIN = 3;

export function categoryCounts(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (!isLive(r)) continue;
    const top = String(r.category_path ?? '').split('|')[0]?.trim();
    if (!top) continue;
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

/*
 * A web address from a title.
 *
 * Ampersands become "and" rather than disappearing, because "pots-pans" and
 * "pots-and-pans" read differently and the second is what somebody would type.
 *
 * One deliberate difference from `categorySlug` in utils/categories.js: accents
 * are stripped to their base letter first, so "Café Crème" becomes cafe-creme
 * rather than caf-cr-me. Category names come from eBay and are ASCII, so it
 * never arises there. A title she types is not, and a supplier name with an
 * accent in it producing a URL full of gaps is the sort of thing that looks
 * like the shop is broken.
 */
function slugify(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '') || 'product';
}

const suffix = () => Math.random().toString(36).slice(2, 6);
