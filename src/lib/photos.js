/*
 * Which photos may go up, the portal's copy of supabase/functions/_shared/photos.ts. The eBay function enforces the
 * same rule, so a card the portal calls ready is one eBay's function accepts.
 *
 * Any photo she puts in the card goes up, except another eBay seller's (such as the listing the research found).
 * eBay's catalogue photos are for eBay only. Keepr's photo check suggests and orders photos; it never blocks one.
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
  // The one photo that never goes up: another eBay seller's, such as the listing the research found.
  if (ANOTHER_SELLER.test(url)) return { url, source: 'other', ok: false, why: 'another eBay seller\'s photo' };
  // Anything else she put in the card goes up. Keepr's photo check advises; it does not hold a listing back.
  const seen = checkedPhotos(pc).find((i) => i.url === url || i.copy === url);
  return { url, source: 'shop', ok: true, note: seen && !seen.ok ? seen.reasons?.[0] ?? null : null };
}

// eBay's own image host: a photo there that is not eBay's catalogue entry is another seller's.
const ANOTHER_SELLER = /^https?:\/\/i\.ebayimg\.com\//i;

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
  // Plain product shots first: the first photo is the search tile. The maker's callouts and lifestyle shots follow.
  return checkedPhotos(pc).filter((i) => i.ok)
    .sort((x, y) => Number(Boolean(x.extra)) - Number(Boolean(y.extra)))
    .map((i) => i.copy ?? i.url);
}

// What finding photos puts in her draft: every photo that passed, plain shots first, after what she already has, up
// to eBay's twelve; and eBay's catalogue entry when she has not chosen one. A photo goes in once: one she took out
// is remembered in `photos_offered` and never comes back by itself. Null when there is nothing to add.
export function photosToAdd(row, draft) {
  const pc = freshChecks(row, draft);
  if (!pc) return null;
  const patch = {};
  const have = draft.images ?? [];
  const offered = new Set(draft.photos_offered ?? []);
  const fresh = passedPhotos(row, draft).filter((u) => !have.includes(u) && !offered.has(u));
  const room = Math.max(0, 12 - have.length);
  if (fresh.length && room) {
    const adding = fresh.slice(0, room);
    patch.images = [...have, ...adding];
    patch.photos_offered = [...offered, ...have, ...adding];
  }
  if (!draft.catalogue?.epid && pc.catalogue?.epid) patch.catalogue = { epid: pc.catalogue.epid, title: pc.catalogue.title, images: pc.catalogue.images ?? [] };
  return Object.keys(patch).length ? patch : null;
}

// How many photos a patch from photosToAdd puts in.
export const photosAdded = (patch, draft) => (patch?.images ? patch.images.length - (draft?.images ?? []).length : 0);

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
