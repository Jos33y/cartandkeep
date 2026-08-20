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
  landed_cost, postage_cost, cost_note, cost_updated_at,
  availability, returns_class, returns_note,
  hazard, safety_data_sheet_url, biocide_reg_no,
  derived_fields, source_kind,
  store_variants ( id, label, price, stock, availability, sku, gtin, image_url, position )
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
/*
 * An empty box is a null, not a zero.
 *
 * The difference carries meaning in both directions here. An empty variant
 * price means the product price applies; a zero would mean she gives it away.
 * An empty count means it never runs out; a zero means it has.
 *
 * Lifted out of `saveCost`, where it was a local, so the cost fields and the
 * variant fields cannot drift into two rules about what an empty box means.
 */
function money(v, what) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${what} has to be a number, or empty.`);
  return Math.round(n * 100) / 100;
}

// Stock is a count of things, so 2.5 of a bed sheet is a typo rather than a
// quantity, and it is caught here rather than by the column refusing it later.
function whole(v, what) {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} has to be a whole number, or empty.`);
  return n;
}

/*
 * What the model found wrong, and whether anybody has looked at it.
 *
 * Flags live in two places and this is the only thing that should know it.
 * A fresh draft carries them inside `draft`. Once she has either acknowledged
 * them or discarded the draft they are copied to `checks`, so they survive the
 * draft going away. Without that, discarding would be a way to clear the gate
 * without reading anything, which is the opposite of what the gate is for.
 *
 * `checks` wins when both exist, because it is the record of a decision and
 * `draft` is only a suggestion.
 */
export function checksFor(p) {
  const stored = p.derived_fields?.checks;
  if (stored?.items?.length) return stored;

  const fresh = p.derived_fields?.draft?.flags;
  if (fresh?.length) return { items: fresh, read_at: null };

  return null;
}

export const checksUnread = (p) => {
  const c = checksFor(p);
  return Boolean(c && !c.read_at);
};

export function blockers(p) {
  const out = [];

  if (!(Number(p.price) > 0)) out.push('No price');
  if (!p.image_url) out.push('No photograph');

  // Present in derived_fields means a script guessed it and nobody confirmed.
  if (p.derived_fields?.returns_class) out.push('Returns class unconfirmed');

  if (p.derived_fields?.hazard_suspect && !p.hazard) out.push('Hazard data missing');

  /*
   * Unread contradictions block release.
   *
   * A pack of stickers went live carrying Type: Foam. The draft had flagged it
   * against the photograph, the flag was sitting on the row, and nothing stood
   * between reading it and taking the product live.
   *
   * She is not required to fix them, only to have seen them. Some cannot be
   * fixed at all: a supplier text saying China beside a specification saying
   * United Kingdom is a contradiction nobody here can resolve, and a gate she
   * cannot clear is a gate she learns to click past.
   */
  if (checksUnread(p)) {
    const n = checksFor(p).items.length;
    out.push(`${n} thing${n === 1 ? '' : 's'} to check`);
  }

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
export const isReady = (p) => !isLive(p) && blockers(p).length === 0;
export const isBlocked = (p) => !isLive(p) && blockers(p).length > 0;

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
  const saveRecord = useCallback(async ({
    id, categoryPath, brand, specifications, keepSpecs, inTheBox,
  }) => {
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
      /*
       * The rows the editor hid go back in first.
       *
       * Her eBay policy ids are kept out of the Details panel because they are
       * her account's plumbing rather than facts about the goods, and this is
       * the write that would otherwise delete them. Hers are spread second, so
       * a key she edited wins over a hidden copy of the same key.
       */
      const out = { ...(keepSpecs ?? {}) };
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

  /*
   * What it costs her.
   *
   * The one number this platform has never held, and four month one
   * commitments depend on it: margin per channel, net profit, category profit
   * and loss, and the alert when something goes negative. None of them were
   * unstarted so much as unstartable.
   *
   * Empty is null rather than zero, and every margin figure is null with it. A
   * margin computed without a cost is not a cautious estimate, it is an
   * invented number, and there is no version of this screen where showing one
   * is better than showing nothing.
   */
  const saveCost = useCallback(async ({ id, landedCost, postageCost, note }) => {
    const landed = money(landedCost, 'Cost');

    const { error } = await supabase.from('store_products').update({
      landed_cost: landed,
      postage_cost: money(postageCost, 'Postage'),
      cost_note: note?.trim() || null,
      // Stamped only when there is a figure. A date against an empty cost says
      // somebody checked when nobody did.
      cost_updated_at: landed === null ? null : new Date().toISOString(),
    }).eq('id', id);

    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Asking the model for a draft, and throwing one away.
   *
   * The call goes to the `draft` edge function rather than to Anthropic
   * directly, because the key cannot live in a browser. The function reads the
   * product row itself under her own session rather than trusting fields sent
   * from here, for the same reason the checkout reads prices from the database.
   *
   * It writes into `derived_fields.draft` and never into `description` or
   * `title`, so a reload shows the draft again and nothing has been published.
   */
  const draftCopy = useCallback(async (id) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) throw new Error('Signed out. Sign in and try again.');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? `The draft did not come back (${res.status}).`);

    await load();
    return body.draft;
  }, [load]);

  /*
   * Drafting a run of them.
   *
   * Sequential, not parallel. Seventy eight requests fired at once is a rate
   * limit and a bill arriving together, and worse, one rejection takes the
   * whole batch with it. One at a time means a failure costs that product and
   * nothing else, and the ones already done are already saved.
   *
   * Reported as it goes rather than at the end, because this is minutes rather
   * than seconds, and a button that says nothing for four minutes is a button
   * somebody presses again.
   *
   * One reload at the end rather than one per product. Reloading after each
   * would be seventy eight full reads of the whole catalogue.
   */
  const draftMany = useCallback(async (ids, onProgress) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) throw new Error('Signed out. Sign in and try again.');

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft`;
    const failures = [];
    let done = 0;

    for (const id of ids) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Failed (${res.status})`);
        }
      } catch (e) {
        // Named by title rather than by id, because an id tells her nothing
        // about which product to go and look at.
        const row = state.rows.find((r) => r.id === id);
        failures.push(`${row?.title ?? id}: ${e?.message ?? 'failed'}`);
      }
      done += 1;
      onProgress?.(done, ids.length);
    }

    await load();
    return failures;
  }, [state.rows, load]);

  /*
   * Discarding, which removes the key rather than blanking it.
   *
   * A draft left as an empty object is a draft the panel has to reason about.
   * The `-` operator takes the key out, and the returns and hazard flags beside
   * it are untouched because this rewrites the whole object from the row that
   * was just read rather than from a stale copy.
   */
  const discardDraft = useCallback(async (id) => {
    const row = state.rows.find((r) => r.id === id);
    const derived = { ...(row?.derived_fields ?? {}) };
    const flags = derived.draft?.flags ?? [];
    delete derived.draft;

    /*
     * The flags outlive the draft they came in with.
     *
     * Throwing the prose away is a judgement about writing. What the model
     * found wrong with the record is a separate finding and it is still true
     * afterwards, so discarding must not be a way to clear the gate. Only
     * copied when there is nothing already recorded, or discarding twice would
     * wipe an acknowledgement.
     */
    if (flags.length && !derived.checks) {
      derived.checks = { items: flags, read_at: null };
    }

    const { error } = await supabase
      .from('store_products')
      .update({ derived_fields: derived })
      .eq('id', id);

    if (error) throw error;
    await load();
  }, [state.rows, load]);

  /*
   * Marking the checks as read.
   *
   * Records who and when rather than a boolean, because this is the evidence
   * that somebody looked at a contradiction before a product went on sale, and
   * a true tells you nothing about when it became true.
   */
  const acknowledgeChecks = useCallback(async (id) => {
    const row = state.rows.find((r) => r.id === id);
    const found = checksFor(row ?? {});
    if (!found) return;

    const derived = { ...(row?.derived_fields ?? {}) };
    derived.checks = { items: found.items, read_at: new Date().toISOString() };

    const { error } = await supabase
      .from('store_products')
      .update({ derived_fields: derived })
      .eq('id', id);

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

  const counts = useMemo(() => ({
    live: state.rows.filter(isLive).length,
    ready: state.rows.filter(isReady).length,
    blocked: state.rows.filter(isBlocked).length,
    all: state.rows.length,
  }), [state.rows]);

  return {
    ...state, counts, reload: load,
    publish, unpublish, confirmReturns, saveHazard, saveDescription,
    saveDetails, saveImages, removeImage, create, saveStock, saveRecord, saveCost,
    draftCopy, draftMany, discardDraft, acknowledgeChecks,
    addVariant, saveVariant, removeVariant,
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
