import { supabase } from './supabase';

export const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'cart-and-keep';

let cached = null;

// Palette, fees and weights live in the tenant row so a change is not a deploy.
export async function loadTenant() {
  if (cached) return cached;

  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name, currency, locale, marketplace, palette, fees, scoring, research')
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
