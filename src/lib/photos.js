/*
 * Which photos may go up, the portal's copy of supabase/functions/_shared/photos.ts. The eBay function enforces the
 * same rule, so a card the portal calls ready is one eBay's function accepts.
 *
 * A photo goes up when it is hers (she uploaded it), the shop's and Keepr passed it, or eBay's catalogue photo for
 * the barcode (eBay only). Anything else is refused, including the eBay seller's photo the research found.
 */

import { listingOf, productKey, swappedTo } from './product.js';

// Her folder holds her uploads and, under shop/, our copies of shop photos Keepr passed. Only the first are hers.
export const isHers = (url, draft = {}) =>
  (draft.uploads ?? []).includes(url)
  || (/\/storage\/v1\/object\/public\/listing-images\//.test(url) && !/\/shop\/[^/]+$/.test(url));

export function sourceOf(url, row, draft, channel = 'ebay') {
  if (isHers(url, draft)) return { url, source: 'hers', ok: true };
  // A check made for another product (before the card moved to another listing) passes nothing for this one.
  const pc = (row.photo_checks?.product ?? null) === productKey(row, draft) ? row.photo_checks ?? {} : {};
  if ((pc.catalogue?.images ?? []).includes(url) || (draft.catalogue?.images ?? []).includes(url)) {
    return channel === 'ebay'
      ? { url, source: 'catalogue', ok: true }
      : { url, source: 'catalogue', ok: false, why: 'eBay\'s catalogue photos are for eBay only' };
  }
  const seen = checkedPhotos(pc).find((i) => i.url === url || i.copy === url);
  if (seen) {
    if (pc.brand_rule) return { url, source: 'shop', ok: false, why: `${pc.brand} photos come from eBay's catalogue or yours, not the shop's` };
    return seen.ok ? { url, source: 'shop', ok: true } : { url, source: 'shop', ok: false, why: seen.reasons?.[0] ?? 'failed the photo check' };
  }
  if ((listingOf(row, draft)?.images ?? []).includes(url)) return { url, source: 'shop', ok: false, why: 'not checked yet' };
  return { url, source: 'other', ok: false, why: 'not yours, not checked, and not from the catalogue' };
}

// Every photo Keepr checked for this product: the first shop's, then those of other UK shops matched to it.
export const checkedPhotos = (pc) => [
  ...(pc?.images ?? []),
  ...(pc?.others ?? []).filter((o) => o.ok).flatMap((o) => o.images ?? []),
];

// The photos Keepr passed, the first shop's first, as our own copies where the check made one. None when the brand
// is on the list.
export function passedPhotos(row, draft = row.draft ?? {}) {
  const pc = freshChecks(row, draft);
  if (!pc || pc.brand_rule) return [];
  return checkedPhotos(pc).filter((i) => i.ok).map((i) => i.copy ?? i.url);
}

// What finding photos puts in her draft, never over what she already has: the checked shop photos when she has
// none, and eBay's catalogue entry when she has not chosen one. Null when there is nothing to add.
export function photosToAdd(row, draft) {
  const pc = freshChecks(row, draft);
  if (!pc) return null;
  const patch = {};
  const passed = passedPhotos(row, draft);
  if (!(draft.images ?? []).length && passed.length) patch.images = passed.slice(0, 8);
  if (!draft.catalogue?.epid && pc.catalogue?.epid) patch.catalogue = { epid: pc.catalogue.epid, title: pc.catalogue.title, images: pc.catalogue.images ?? [] };
  return Object.keys(patch).length ? patch : null;
}

// Why the shop's photos cannot help, in one line, once they have been checked.
export function noShopPhotos(row, draft = row.draft ?? {}) {
  const pc = freshChecks(row, draft);
  if (!pc) return null;
  if (pc.brand_rule) return `${pc.brand} uses eBay's catalogue or your own photos, not the shop's`;
  const all = checkedPhotos(pc);
  const wider = (pc.others ?? []).filter((o) => o.ok).length;
  if (!all.length) {
    if (wider) return 'Neither the shop nor the other shops found had photos to check';
    // No page at all (a supplier that cannot be read, such as Amazon) is not a page with no photos.
    if (!pc.page) {
      return pc.others_for
        ? 'No supplier page to take photos from, and no other UK shop sells it. Save the photos from where you buy it and add them'
        : 'No supplier page to take photos from. Save the photos from where you buy it and add them';
    }
    return pc.others_for ? 'The shop page had no photos to check, and no other UK shop was a certain match' : 'The shop page had no photos to check';
  }
  if (passedPhotos(row, draft).length) return null;
  const top = new Map();
  for (const i of all) { const r = i.reasons?.[0]; if (r) top.set(r, (top.get(r) ?? 0) + 1); }
  const [reason] = [...top.entries()].sort((p, q) => q[1] - p[1])[0] ?? [];
  const lead = wider
    ? `None of the ${all.length} photos from the shop and ${wider} other ${wider === 1 ? 'shop' : 'shops'} passed`
    : all.length === 1 ? 'The shop\'s one photo did not pass' : `None of the shop's ${all.length} photos passed`;
  return `${lead}${reason ? `: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}` : ''}`;
}

// A photo check from before the whole gallery was read (version 2) is looked at again rather than reused.
export const PHOTO_CHECK_VERSION = 2;
// The page the listing is written from: her supplier's once she chose it, else the one the card was costed from.
// Moved to another product's listing, only her supplier's page describes it.
export const pageOf = (row, draft = row.draft ?? {}) => (swappedTo(row, draft)
  ? draft.page ?? null
  : draft.page ?? row.margin?.shelf?.url ?? row.margin?.cost_from?.url ?? null);
export const freshChecks = (row, draft = row.draft ?? {}) => {
  const pc = row.photo_checks;
  if (!pc || (pc.version ?? 1) < PHOTO_CHECK_VERSION) return null;
  // A check of the product the card was before it moved to another listing is not this product's.
  if ((pc.product ?? null) !== productKey(row, draft)) return null;
  // A check of another page (before she chose her supplier's) is not this listing's.
  if (pc.page && pageOf(row, draft) && pc.page !== pageOf(row, draft)) return null;
  return pc;
};
