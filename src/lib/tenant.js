import { supabase } from './supabase.js';

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'cart-and-keep';

/*
 * Palette, fees and weights live in the tenant row so a change is not a deploy.
 *
 * `store` was added by migration 0040 and was missing from this list, so
 * `loadStoreConfig` fell back to its built in defaults on every load and both
 * 0040 and 0041 were dead in the browser. Nothing looked wrong, because the
 * defaults happened to match the row. It would have broken silently the first
 * time a delivery threshold was changed in the database and the shop carried
 * on showing the old one.
 *
 * The rule this keeps breaking: a migration that adds a column ships with the
 * change to whatever reads it, and they go out together or the feature does
 * not exist.
 */
const FULL = 'id, slug, name, currency, locale, marketplace, palette, fees, scoring, research, store';

/*
 * Two read paths, and which one runs is decided by whether there is a session.
 *
 * `tenants_read` from 0001 is `has_tenant(id)`, which is right and which no
 * shopper can ever satisfy. So the direct select returned nothing, `.single()`
 * threw, and the storefront said "No shop is configured for this address" the
 * first time anybody opened it in a private window. Every load before that had
 * been a signed in one, which is why it survived two sessions of building.
 *
 * The anonymous path goes through `public_store` from 0056, which returns only
 * what a shopfront renders. It is deliberately not the same shape as the full
 * row: `fees`, `scoring` and `research` are studio work, and `selling_costs`
 * inside `store` is her ad rate and her fee assumptions. None of that belongs
 * in a stranger's network tab, and at client two none of it belongs in another
 * client's visitor's network tab either.
 *
 * `getSession` reads what is already in storage rather than calling the auth
 * server, so choosing between the two costs no round trip.
 */
let cached = null;
let cachedFull = false;

export async function loadTenant() {
  const { data: auth } = await supabase.auth.getSession();
  const signedIn = Boolean(auth?.session);

  // A cached public row is not good enough once somebody signs in, because the
  // portal reads fees and scoring off it. The reverse is fine: a full row has
  // everything the shop needs.
  if (cached && (cachedFull || !signedIn)) return cached;

  const { data, error } = signedIn
    ? await supabase.from('tenants').select(FULL).eq('slug', TENANT_SLUG).single()
    : await supabase.rpc('public_store', { p_slug: TENANT_SLUG });

  if (error) throw error;

  // The function returns null for a slug that does not exist, where the direct
  // select throws. Both are the same failure and both should say so, or the
  // caller gets undefined and reads it as still loading.
  if (!data) throw new Error(`No shop configured for slug ${TENANT_SLUG}`);

  cached = data;
  cachedFull = signedIn;
  applyPalette(data.palette);
  return data;
}

function applyPalette(palette) {
  if (!palette || typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(palette)) {
    root.style.setProperty(`--c-${name}`, value);
  }
}

/*
 * Her names for the eBay category paths.
 *
 * Cached like the tenant, because they are a handful of rows that change
 * rarely and every page rendering a navigation needs them. Loading them per
 * page would mean the header and the page under it can briefly disagree about
 * what a department is called while a second request is in flight, which is
 * the one thing a shop front must never do.
 *
 * 0064 grants select on this table to anon, so there is one path rather than
 * the two `loadTenant` needs: these are the words on the shop front, not
 * anything about the business behind it.
 */
let cachedNames = null;

export async function loadCategoryNames() {
  if (cachedNames) return cachedNames;

  const { data, error } = await supabase
    .from('store_category_names')
    .select('path, name, slug, blurb, position, hidden, aliases');

  /*
   * An empty list on failure, not a throw.
   *
   * Every consumer falls back to the eBay name when a path is not in here, so
   * a failed read is a shop that reads exactly as it did before this feature
   * existed. Failing the page instead would mean a broken table takes down a
   * navigation over a cosmetic feature.
   */
  if (error) {
    console.warn('[store] could not load category names', error);
    return [];
  }

  cachedNames = data ?? [];
  return cachedNames;
}
