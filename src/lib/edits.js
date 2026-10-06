/*
 * What on a card's draft is hers: what she typed, chose or changed, as against what Keeper or a reading filled in.
 * The Edited tab and the row's Edited mark count only hers (Joseey, 4 October). Keeper writes its own note on the card
 * (draft.keeper_ready, with `wrote`: what the fields held when it finished), and Keeper's approval from Amazon says
 * what it filled (draft.keeper_filled), so a field still holding Keeper's value is Keeper's.
 */

// Fields Keeper writes when it gets a card ready.
const KEEPERS = ['title', 'description', 'images', 'aspects', 'package', 'ebay_category', 'catalogue'];
// Kept by the portal and Keeper for their own use, never typed by her.
const AUTO = new Set(['keeper_ready', 'keeper_filled', 'supplier_auto', 'photos_offered', 'parcel_from', 'entry_suggestion', 'item_facts', 'before']);

const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)
  || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function hersOf(d = {}) {
  const wrote = d?.keeper_ready?.wrote ?? null;
  const byKeeper = Boolean(d?.keeper_ready);
  return Object.keys(d ?? {}).filter((k) => {
    const v = d[k];
    if (empty(v) || AUTO.has(k)) return false;
    // The supplier box: hers once it differs from what the last reading put there.
    if (k === 'supplier_text') return v !== d.supplier_auto;
    if (k === 'supplier_url') return d.keeper_filled?.supplier_url !== v && !(d.supplier_auto && d.supplier_text === d.supplier_auto);
    // The listing the card prices from: hers when she chose it, not when Keepr matched it.
    if (k === 'entry') return v.by === 'her';
    if (KEEPERS.includes(k)) {
      if (wrote) return !same(v, wrote[k]);
      // Keeper's approval put a packed weight in an empty parcel.
      if (k === 'package' && d.keeper_filled?.weight_kg != null && same(v, { weight_kg: d.keeper_filled.weight_kg })) return false;
      // Got ready by Keeper before it kept what it wrote (4 October): taken as Keeper's.
      return !byKeeper;
    }
    // Her price, her uploads, a listing she turned down, a page she chose.
    return true;
  });
}

export const hasHerEdits = (d) => hersOf(d).length > 0;

// What Keeper wrote, kept with its note so her later changes can be told from its work.
export const KEEPER_FIELDS = KEEPERS;
