/*
 * Which photos may go up, the portal's copy of supabase/functions/_shared/photos.ts. The eBay function enforces the
 * same rule, so a card the portal calls ready is one eBay's function accepts.
 *
 * A photo goes up when it is hers (she uploaded it), the shop's and Keepr passed it, or eBay's catalogue photo for
 * the barcode (eBay only). Anything else is refused, including the eBay seller's photo the research found.
 */

// Her folder holds her uploads and, under shop/, our copies of shop photos Keepr passed. Only the first are hers.
export const isHers = (url, draft = {}) =>
  (draft.uploads ?? []).includes(url)
  || (/\/storage\/v1\/object\/public\/listing-images\//.test(url) && !/\/shop\/[^/]+$/.test(url));

export function sourceOf(url, row, draft, channel = 'ebay') {
  if (isHers(url, draft)) return { url, source: 'hers', ok: true };
  const pc = row.photo_checks ?? {};
  if ((pc.catalogue?.images ?? []).includes(url) || (draft.catalogue?.images ?? []).includes(url)) {
    return channel === 'ebay'
      ? { url, source: 'catalogue', ok: true }
      : { url, source: 'catalogue', ok: false, why: 'eBay\'s catalogue photos are for eBay only' };
  }
  const seen = (pc.images ?? []).find((i) => i.url === url || i.copy === url);
  if (seen) {
    if (pc.brand_rule) return { url, source: 'shop', ok: false, why: `${pc.brand} photos come from eBay's catalogue or yours, not the shop's` };
    return seen.ok ? { url, source: 'shop', ok: true } : { url, source: 'shop', ok: false, why: seen.reasons?.[0] ?? 'failed the photo check' };
  }
  if ((row.listing?.images ?? []).includes(url)) return { url, source: 'shop', ok: false, why: 'not checked yet' };
  return { url, source: 'other', ok: false, why: 'not yours, not checked, and not from the catalogue' };
}

// The shop's photos Keepr passed, in the page's order, as our own copies where the check made one. None when the
// brand is on the list.
export function passedPhotos(row) {
  const pc = row.photo_checks;
  if (!pc || pc.brand_rule) return [];
  return (pc.images ?? []).filter((i) => i.ok).map((i) => i.copy ?? i.url);
}

// What finding photos puts in her draft, never over what she already has: the checked shop photos when she has
// none, and eBay's catalogue entry when she has not chosen one. Null when there is nothing to add.
export function photosToAdd(row, draft) {
  const pc = row.photo_checks;
  if (!pc) return null;
  const patch = {};
  const passed = passedPhotos(row);
  if (!(draft.images ?? []).length && passed.length) patch.images = passed.slice(0, 8);
  if (!draft.catalogue?.epid && pc.catalogue?.epid) patch.catalogue = { epid: pc.catalogue.epid, title: pc.catalogue.title, images: pc.catalogue.images ?? [] };
  return Object.keys(patch).length ? patch : null;
}

// Why the shop's photos cannot help, in one line, once they have been checked.
export function noShopPhotos(row) {
  const pc = row.photo_checks;
  if (!pc) return null;
  if (pc.brand_rule) return `${pc.brand} uses eBay's catalogue or your own photos, not the shop's`;
  if (!(pc.images ?? []).length) return 'The shop page had no photos to check';
  if (passedPhotos(row).length) return null;
  const top = new Map();
  for (const i of pc.images) { const r = i.reasons?.[0]; if (r) top.set(r, (top.get(r) ?? 0) + 1); }
  const [reason] = [...top.entries()].sort((p, q) => q[1] - p[1])[0] ?? [];
  const lead = pc.images.length === 1 ? 'The shop\'s one photo did not pass' : `None of the shop's ${pc.images.length} photos passed`;
  return `${lead}${reason ? `: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : ''}`;
}
