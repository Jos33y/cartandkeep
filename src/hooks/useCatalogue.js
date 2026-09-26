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
  category, category_path, section, brand, description, source_description,
  specifications, in_the_box,
  landed_cost, postage_cost, cost_note, cost_updated_at,
  availability, returns_class, returns_note,
  hazard, safety_data_sheet_url, biocide_reg_no,
  derived_fields, source_kind, archived_at, archived_reason,
  store_variants ( id, label, price, stock, availability, sku, gtin, image_url, position )
`;

// An empty box is null, never zero: empty price follows the product, empty count never runs out.
export function money(v, what) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${what} has to be a number, or empty.`);
  return Math.round(n * 100) / 100;
}

// Stock is a count of things, so 2.5 of a bed sheet is a typo rather than a
// quantity, and it is caught here rather than by the column refusing it later.
export function whole(v, what) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} has to be a whole number, or empty.`);
  return n;
}

// Decisions Keeper needs from her, answered or not. A saved record wins over a fresh draft.
// Legacy checks (a list she only had to read) become one-option questions, answered when she read them.
function fromLegacy(items, readAt) {
  return items.map((q, i) => ({
    id: `legacy-${i}`, question: q, options: ['Noted'], detail: null, answer: readAt ? 'Noted' : null,
  }));
}

export function checksFor(p) {
  const stored = p.derived_fields?.checks;
  const draft = p.derived_fields?.draft;
  let decide = [];
  let done = [];

  if (stored?.decide || stored?.done) {
    decide = stored.decide ?? [];
    done = stored.done ?? [];
  } else if (stored?.items?.length) {
    decide = fromLegacy(stored.items, stored.read_at);
  } else if (draft?.version !== 2 && draft?.flags?.length) {
    decide = fromLegacy(draft.flags, null);
  }

  // A fresh pass adds its questions; one already answered under the same id keeps its answer.
  if (draft?.version === 2 && !draft.applied_at) {
    const have = new Set(decide.map((d) => d.id));
    decide = [...decide, ...(draft.decide ?? []).filter((d) => !have.has(d.id)).map((d) => ({ ...d, answer: null }))];
    done = [...new Set([...done, ...(draft.done ?? [])])];
  }

  return decide.length || done.length ? { decide, done } : null;
}

export const openDecisions = (p) => (checksFor(p)?.decide ?? []).filter((d) => !d.answer).length;
export const checksUnread = (p) => openDecisions(p) > 0;

// What is missing from a product, apart from questions for her. Anything here keeps it off the shop.
export function missing(p) {
  const out = [];

  if (!(Number(p.price) > 0)) out.push('No price');
  if (!p.image_url) out.push('No photograph');

  // Present in derived_fields means a script guessed it and nobody confirmed.
  if (p.derived_fields?.returns_class) out.push('Returns class unconfirmed');

  if (p.derived_fields?.hazard_suspect && !p.hazard) out.push('Hazard data missing');

  if (p.availability === 'out_of_stock' || p.availability === 'discontinued') {
    out.push('Marked unavailable');
  }

  /*
   * Stock, from wherever it is actually counted.
   *
   * A product with variants sells through them, so its own `stock` column is
   * the fallback for products that have none and says nothing about a bed sheet
   * whose only remaining size is the king. Without this a product could go live
   * with every size sold out, because the product row itself still read as
   * untracked.
   */
  const variants = p.store_variants ?? p.variants ?? [];

  if (variants.length) {
    const sellable = variants.filter((v) =>
      v.availability !== 'out_of_stock'
      && v.availability !== 'discontinued'
      && !(typeof v.stock === 'number' && v.stock <= 0));
    if (sellable.length === 0) out.push('Every option is out');
  } else if (typeof p.stock === 'number' && p.stock <= 0) {
    // Only where she has set a count. Null is untracked and always sellable.
    out.push('None left');
  }

  return out;
}

// The release guard: what is missing, then any question still open.
export function blockers(p) {
  const open = openDecisions(p);
  return open ? [...missing(p), `${open} to decide`] : missing(p);
}

export function warnings(p) {
  const out = [];
  /*
   * A drafted row says so on the ledger line.
   *
   * Both states are still "no description saved", so this stays a warning. What
   * changes is that one of them has a next action sitting in it. Without this
   * the only way to find the rows a batch drafted was to open every row in the
   * selection again, which is the work the batch was supposed to remove.
   */
  if (!p.description?.trim()) {
    out.push(p.derived_fields?.draft ? 'Draft ready to read' : 'No description');
  }
  if (!p.category_path) out.push('No category');
  if (!p.brand) out.push('No brand');
  return out;
}

export const isLive = (p) => p.status === 'live' && !p.is_sample;

/*
 * Archived is finished business, not work in progress.
 *
 * A draft is something she is still working on and belongs in her queue. An
 * archived product was on sale and is not coming back, so it should not appear
 * in Ready or Blocked at all: a list of things to fix that includes things she
 * has deliberately stopped stocking is a list that grows and never empties.
 */
export const isArchived = (p) => p.status === 'archived';
export const isReady = (p) => !isLive(p) && !isArchived(p) && blockers(p).length === 0;
// Only a question stands between it and the shop: a tap, not a problem.
export const isNeedsYou = (p) => !isLive(p) && !isArchived(p) && missing(p).length === 0 && openDecisions(p) > 0;
export const isBlocked = (p) => !isLive(p) && !isArchived(p) && missing(p).length > 0;

/*
 * Margin, computed in the browser from the same rates the view uses.
 *
 * Duplicated deliberately rather than read from `store_product_margin`. The row
 * has to show what a margin becomes as she types a cost, and a view cannot
 * answer that until the value is saved. The view stays the source of truth for
 * every screen that reports rather than edits, and the shape below is checked
 * against it in the tests.
 *
 * eBay's percentage covers managed payments, so no separate payment fee is
 * applied there. The store sells through Stripe, so the store rate is the
 * Stripe rate.
 */
export function marginFor({ price, landedCost, postageCost, fees }) {
  const p = Number(price);
  const cost = landedCost === null || landedCost === undefined || landedCost === ''
    ? null : Number(landedCost);

  if (cost === null || !Number.isFinite(cost) || !(p > 0)) return null;

  const post = Number(postageCost) || 0;
  const rate = (key, pct, fixed) => ({
    pct: Number(fees?.[key]?.pct ?? pct),
    fixed: Number(fees?.[key]?.fixed ?? fixed),
  });

  const channels = {
    store: rate('store', 0.015, 0.20),
    ebay: rate('ebay', 0.128, 0.30),
    tiktok: rate('tiktok', 0.065, 0),
  };

  const out = {};
  for (const [name, r] of Object.entries(channels)) {
    const fee = Math.round((p * r.pct + r.fixed) * 100) / 100;
    const net = Math.round((p - fee - cost - post) * 100) / 100;
    out[name] = { fee, net, pct: Math.round((net / p) * 1000) / 10 };
  }
  return out;
}

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

    /*
     * One named, the rest counted.
     *
     * This counted them and stopped, which sent her looking. Then it named two
     * in full, which ran to two lines in the bar because her feed titles run
     * past seventy characters, and the "and 2 more" was doing more work than
     * the names were. One is enough to point at the list, and every blocked row
     * already carries its own reason on its own line.
     */
    if (refused.length) {
      const [first] = refused;
      const name = String(first.title).length > 44
        ? `${String(first.title).slice(0, 44).trimEnd()}...`
        : first.title;
      const why = blockers(first).join(', ').toLowerCase();
      const rest = refused.length - 1;

      throw new Error(rest
        ? `${refused.length} cannot go live yet. ${name}: ${why}, and ${rest} more.`
        : `Cannot go live yet. ${name}: ${why}.`);
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
  const create = useCallback(async ({ title, price, categoryPath, section }) => {
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
        section: section || null,
        images: [],
        stock: NEW_LISTING_STOCK,
      }).select('id').single();

      if (!error) { await load(); return data.id; }

      // 23505 is a unique violation, which here means the slug is taken.
      // Anything else is a real failure and retrying it would only hide it.
      if (error.code !== '23505') throw error;
    }

    throw new Error('Could not find a free web address for that title. Try changing it slightly.');
  }, [tenantId, load]);

  // The whole sheet in one write. With goLive the release guard runs on the saved values, in the same write.
  const saveSheet = useCallback(async ({ id, patch, goLive = false }) => {
    const row = state.rows.find((r) => r.id === id);
    if (!row) throw new Error('That product is no longer in the list. Reload and try again.');
    const next = { ...patch };

    if (goLive) {
      const stops = blockers({ ...row, ...next });
      if (stops.length) throw new Error(`Saved values still stop it going live: ${stops.join(', ').toLowerCase()}.`);
      next.status = 'live';
      next.is_sample = false;
    }

    const { error } = await supabase.from('store_products').update(next).eq('id', id);
    if (error) throw error;
    await load();
  }, [state.rows, load]);

  /*
   * Adding one.
   *
   * `tenant_id` is written here rather than defaulted in the database, because
   * 0058 scopes the write policy on `has_tenant(tenant_id)` and a row with a
   * null tenant would be refused by the policy that is meant to protect it.
   *
   * An empty price means the product price applies and an empty count means it
   * never runs out. Both are nulls on purpose: copying the product price into
   * every variant is how one of them goes stale the first time she changes it.
   */
  const addVariant = useCallback(async ({ productId, tenantId: t, label, price, stock }) => {
    const name = String(label ?? '').trim();
    if (!name) throw new Error('Give it a name, like Size 5 or King.');

    const { error } = await supabase.from('store_variants').insert({
      tenant_id: t,
      product_id: productId,
      label: name,
      price: money(price, 'Price'),
      stock: whole(stock, 'Count'),
      // Appended rather than inserted. She reorders by dragging later if it
      // ever matters; until then the order she typed them in is the order she
      // thinks about them in.
      position: null,
    });

    if (error) {
      throw new Error(error.code === '23505'
        ? `There is already a ${name} on this product.`
        : error.message ?? 'That did not save.');
    }
    await load();
  }, [load]);

  const saveVariant = useCallback(async ({ id, price, stock, availability }) => {
    const { error } = await supabase.from('store_variants').update({
      price: money(price, 'Price'),
      stock: whole(stock, 'Count'),
      availability,
    }).eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Removing one, two ways.
   *
   * A variant that has ever been ordered is discontinued rather than deleted.
   * 0058 sets `order_items.variant_id` to null on delete, so deleting one would
   * leave old invoices holding a label with nothing behind it, and the shop
   * would lose the ability to answer which size a customer received. One that
   * has never sold is deleted outright, because keeping a typo forever is not
   * a record of anything.
   */
  const removeVariant = useCallback(async ({ id }) => {
    const { count, error: cErr } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('variant_id', id);

    if (cErr) throw cErr;

    const { error } = count
      ? await supabase.from('store_variants')
        .update({ availability: 'discontinued', stock: 0 }).eq('id', id)
      : await supabase.from('store_variants').delete().eq('id', id);

    if (error) throw error;
    await load();
    return count ? 'discontinued' : 'deleted';
  }, [load]);

  /*
   * Out of the shop for good.
   *
   * A status rather than a delete. `order_items` copies the title and the price
   * so an invoice survives an edit, but an order still points at the product
   * row, and a shop that stopped stocking something still has to say what it
   * was when somebody asks about an order from March.
   *
   * The reason is stored because "the supplier stopped making it" and "it never
   * sold" are different facts, and the second one is research she paid for.
   */
  const archive = useCallback(async ({ id, reason }) => {
    const { error } = await supabase.from('store_products').update({
      status: 'archived',
      archived_at: new Date().toISOString(),
      archived_reason: String(reason ?? '').trim() || null,
    }).eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Back into the queue, not back on sale.
   *
   * It returns as a draft and goes through the release guard again, because
   * whatever was true of it when it was archived may not be now: a price, a
   * returns class or a hazard field could all have changed underneath it.
   */
  const unarchive = useCallback(async ({ id }) => {
    const { error } = await supabase.from('store_products').update({
      status: 'draft',
      archived_at: null,
      archived_reason: null,
    }).eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  const counts = useMemo(() => ({
    live: state.rows.filter(isLive).length,
    ready: state.rows.filter(isReady).length,
    needs: state.rows.filter(isNeedsYou).length,
    blocked: state.rows.filter(isBlocked).length,
    all: state.rows.length,
    archived: state.rows.filter(isArchived).length,
  }), [state.rows]);

  return {
    ...state, counts, reload: load,
    publish, unpublish, saveSheet, saveImages, removeImage, create,
    addVariant, saveVariant, removeVariant,
    archive, unarchive,
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

// Every new listing starts with this many on the shop unless she changes it.
export const NEW_LISTING_STOCK = 5;

export function categoryCounts(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (!isLive(r)) continue;
    const top = r.section || String(r.category_path ?? '').split('|')[0]?.trim();
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
