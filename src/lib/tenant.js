import { supabase } from './supabase';

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'cart-and-keep';

let cached = null;

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
export async function loadTenant() {
  if (cached) return cached;

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, currency, locale, marketplace, palette, fees, scoring, research, store')
    .eq('slug', TENANT_SLUG)
    .single();

  if (error) throw error;
  cached = data;
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
