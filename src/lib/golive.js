import { SHOP_NAME_LIST, channelsOf, shopName } from './assess.js';

/*
 * What stands between an approved card and going live, per channel. One place, so the row, the checklist, the
 * buttons and the bulk queue later all read the same answer.
 *
 * Two kinds of check. A hard one blocks the button: the listing would break a rule (the shop's photos or wording)
 * or cannot go up (no title, no parcel, a loss). A soft one does not block, but the card is not Ready until it
 * passes: over the market, under the profit target, pack not confirmed. She can list over the market on purpose;
 * she cannot list with another shop's photos.
 */

// Retailers a listing must never name, beyond the shops on file. A shop that is also the product's own brand
// (Minky on a Minky cover) is allowed, and so is a common word that happens to be a shop's name.
const RETAILERS = ['Argos', 'Amazon', 'Tesco', 'Asda', 'Boots', 'Superdrug', 'Dunelm', 'Screwfix', 'Robert Dyas',
  'Wilko', 'Morrisons', "Sainsbury's", 'Zooplus', 'Lloyds Pharmacy', 'The Range', 'Home Bargains', 'B&M'];
const COMMON = new Set(['Studio']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The first shop a piece of her copy names, or null.
export function namesShop(text, { brand = null, also = [] } = {}) {
  if (!text) return null;
  const own = String(brand ?? '').trim().toLowerCase();
  const names = [...new Set([...SHOP_NAME_LIST, ...RETAILERS, ...also.filter(Boolean)])]
    .filter((n) => n && !COMMON.has(n) && n.toLowerCase() !== own);
  for (const n of names) {
    if (new RegExp(`(^|[^A-Za-z])${escapeRe(n)}([^A-Za-z]|$)`, 'i').test(text)) return n;
  }
  return null;
}

// The channels a card is meant for, in her words, and where each one stands.
export function channelStates(row) {
  const wants = channelsOf(row).map((c) => (c === 'store' ? 'shop' : 'ebay'));
  const product = (row.store_products ?? [])[0] ?? null;
  const state = {
    ebay: row.ebay?.listing_id ? 'live' : 'todo',
    shop: product ? (product.status === 'live' ? 'onSale' : product.status === 'archived' ? 'archived' : 'draft') : 'todo',
  };
  return {
    wants,
    state,
    left: wants.filter((c) => state[c] === 'todo'),
    started: wants.filter((c) => state[c] !== 'todo'),
  };
}

export const STATE_WORD = {
  ebay: { todo: 'To list', live: 'Live' },
  shop: { todo: 'To add', draft: 'Draft', onSale: 'On sale', archived: 'Archived' },
};

// Royal Mail's large letter is 35.3 x 25 x 2.5cm; a small parcel 45 x 35 x 16cm. A band that only caps weight
// at kilos gives no honest weight to suggest, so it suggests the size and asks for the weight.
const PARCELS = {
  letter100: { weight_kg: 0.1, length_cm: 35, width_cm: 25, height_cm: 2.5, label: 'large letter to 100g' },
  letter250: { weight_kg: 0.25, length_cm: 35, width_cm: 25, height_cm: 2.5, label: 'large letter to 250g' },
  letter500: { weight_kg: 0.5, length_cm: 35, width_cm: 25, height_cm: 2.5, label: 'large letter to 500g' },
  parcel: { weight_kg: 2, length_cm: 45, width_cm: 35, height_cm: 16, label: 'small parcel to 2kg' },
  'rm-small': { weight_kg: 2, length_cm: 45, width_cm: 35, height_cm: 16, label: 'small parcel to 2kg' },
  rmMedium: { length_cm: 61, width_cm: 46, height_cm: 46, label: 'medium parcel' },
  'rm-medium-10': { length_cm: 61, width_cm: 46, height_cm: 46, label: 'medium parcel to 10kg' },
  'rm-medium-20': { length_cm: 61, width_cm: 46, height_cm: 46, label: 'medium parcel to 20kg' },
  evri5: { length_cm: 45, width_cm: 35, height_cm: 16, label: 'Evri to 5kg' },
};

// A parcel to start from, from the band the card was costed on. A weight read off the shop page beats the band's cap.
export function parcelFor(a) {
  const key = a.store ? a.m?.postage_band?.key : a.m?.headroom_band ?? a.m?.band;
  const base = PARCELS[key] ?? null;
  const grams = a.store ? a.m?.postage_band?.grams : null;
  if (!base && !grams) return null;
  const out = { ...(base ?? {}) };
  if (grams > 0) out.weight_kg = Math.round(grams) / 1000;
  return out;
}

// A barcode worth matching in eBay's catalogue: 8, 12, 13 or 14 digits with a correct check digit. The same test
// the eBay function runs, so the button only shows where the function can use it.
export function validGtin(v) {
  const s = String(v ?? '').replace(/\s/g, '');
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return null;
  const digits = s.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? s : null;
}
export function gtinOf(row) {
  const m = row.margin ?? {};
  const l = row.listing ?? {};
  for (const v of [m.shelf?.gtin, m.cost_from?.gtin, m.gtin, l.gtin, l.ean]) {
    const g = validGtin(v);
    if (g) return g;
  }
  return null;
}

const shopImagesOf = (row) => new Set([...(row.listing?.images ?? []), row.image_url].filter(Boolean));

/*
 * The checks for one channel. `draft` is her saved edits; `a` is assess() on the card with those edits.
 * Each item: key, ok, hard, text (what is true now), fix (what to do), and `to` (the part of the card that fixes it).
 */
export function checksFor(channel, a, row, draft) {
  const l = row.listing ?? {};
  const brand = l.brand ?? null;
  const shelfShop = shopName(a.m?.shelf?.shop ?? a.m?.cost_from?.shop) ?? null;
  const shopSet = shopImagesOf(row);
  const images = draft.images ?? [];
  const theirs = images.filter((u) => shopSet.has(u));
  const title = (draft.title ?? '').trim();
  const description = (draft.description ?? '').trim();
  const copied = description && l.description && description.replace(/\s+/g, ' ') === String(l.description).trim().replace(/\s+/g, ' ');
  const shopInText = namesShop(`${title}\n${description}`, { brand, also: [shelfShop] });
  const p = a.position;
  const out = [];

  const photos = !images.length
    ? { ok: false, text: 'No photos of yours yet', fix: 'Add photos' }
    : theirs.length
      ? { ok: false, text: `${theirs.length === images.length ? 'Photos are' : `${theirs.length} ${theirs.length === 1 ? 'photo is' : 'photos are'}`} the shop's or another seller's`, fix: 'Swap for your own' }
      : { ok: true, text: `${images.length} ${images.length === 1 ? 'photo' : 'photos'}, yours` };
  const words = !description
    ? { ok: false, text: 'No description yet', fix: 'Write the description', write: true }
    : copied
      ? { ok: false, text: 'Still the shop\'s wording', fix: 'Write the description', write: true }
      : shopInText
        ? { ok: false, text: `Names ${shopInText}`, fix: 'Take the name out' }
        : { ok: true, text: 'Your description' };

  if (channel === 'ebay') {
    out.push(p && !p.inMarket
      ? { key: 'price', hard: false, ok: false, text: `£${p.over.toFixed(2)} over the market at £${p.ref.toFixed(2)}`, fix: 'Match the market', to: 'price' }
      : { key: 'price', hard: false, ok: Boolean(p), text: p ? 'In the market' : 'No market price', to: 'price' });
    out.push(a.keep == null
      ? { key: 'profit', hard: true, ok: false, text: 'No cost, so nothing to keep', fix: 'Add a supplier', to: 'buy' }
      : a.keep < 0
        ? { key: 'profit', hard: true, ok: false, text: `Loses £${Math.abs(a.keep).toFixed(2)} a sale`, fix: 'Raise the price', to: 'price' }
        : a.target != null && a.keep < a.target
          ? { key: 'profit', hard: false, ok: false, text: `Keeps £${a.keep.toFixed(2)}, under your £${a.target.toFixed(2)}`, fix: 'Find it cheaper', to: 'buy' }
          : { key: 'profit', hard: false, ok: true, text: `Keeps £${a.keep.toFixed(2)}`, to: 'price' });
    if (!a.store) {
      const packOk = a.costConfirmed && !a.packCheck;
      out.push({ key: 'pack', hard: false, ok: packOk, text: packOk ? 'Pack confirmed' : a.packCheck ? `Pack not confirmed, ${a.ratio} times the shelf price` : 'Pack not confirmed', fix: 'Compare', to: 'pack' });
    }
    out.push(!title
      ? { key: 'title', hard: true, ok: false, text: 'No title yet', fix: 'Write a title', to: 'listing' }
      : title.length > 80
        ? { key: 'title', hard: true, ok: false, text: `Title is ${title.length} characters, over 80`, fix: 'Shorten it', to: 'listing' }
        : { key: 'title', hard: true, ok: true, text: `Title, ${title.length} of 80`, to: 'listing' });
    // eBay's own catalogue photos stand in for hers on eBay, never on her shop.
    const cat = draft.catalogue?.epid && !images.length;
    out.push(cat
      ? { key: 'photos', hard: true, ok: true, text: 'eBay\'s catalogue photos', to: 'listing' }
      : { key: 'photos', hard: true, ...photos, ...(!photos.ok && !theirs.length && gtinOf(row) ? { fix: 'Try eBay\'s catalogue', catalogue: true } : {}), to: 'listing' });
    out.push({ key: 'words', hard: true, ...words, to: 'listing' });
    const box = draft.package ?? {};
    out.push(Number(box.weight_kg) > 0
      ? { key: 'parcel', hard: true, ok: true, text: `Parcel ${box.weight_kg}kg${box.length_cm ? `, ${box.length_cm} x ${box.width_cm} x ${box.height_cm}cm` : ''}`, to: 'parcel' }
      : { key: 'parcel', hard: true, ok: false, text: 'No parcel weight yet', fix: 'Set the parcel', to: 'parcel' });
  } else {
    out.push({ key: 'photos', hard: true, ...photos, to: 'listing' });
    out.push({ key: 'words', hard: true, ...words, to: 'listing' });
    const price = a.price;
    out.push(price == null
      ? { key: 'price', hard: true, ok: false, text: 'No price yet', fix: 'Set a price', to: 'price' }
      : a.keep != null && a.keep < 0
        ? { key: 'price', hard: true, ok: false, text: `Loses £${Math.abs(a.keep).toFixed(2)} a sale`, fix: 'Raise the price', to: 'price' }
        : a.floor != null && price < a.floor
          ? { key: 'price', hard: false, ok: false, text: `Under your floor of £${a.floor.toFixed(2)}`, fix: 'Raise the price', to: 'price' }
          : { key: 'price', hard: false, ok: true, text: `Priced at £${price.toFixed(2)}`, to: 'price' });
  }
  return out;
}

// The figures each channel is judged on: a shop card's own for the shop, its eBay reading for eBay when the gate
// passed it there; an eBay card's for both.
export const viewsOf = (a) => ({ shop: a, ebay: a.store ? a.ebay ?? a : a });

// Where a card stands overall: what can be pressed, and whether it is Ready. `views` from viewsOf().
export function goLive(views, row, draft) {
  const ch = channelStates(row);
  const checks = Object.fromEntries(ch.left.map((c) => [c, checksFor(c, views[c], row, draft)]));
  const can = Object.fromEntries(ch.left.map((c) => [c, checks[c].every((x) => !x.hard || x.ok)]));
  const ready = ch.left.length > 0 && ch.left.every((c) => checks[c].every((x) => x.ok));
  // The first thing to do, blocking ones first, for the row.
  const all = ch.left.flatMap((c) => checks[c].map((x) => ({ ...x, channel: c })));
  const firstOpen = all.find((x) => !x.ok && x.hard) ?? all.find((x) => !x.ok) ?? null;
  const open = [...new Map(all.filter((x) => !x.ok).map((x) => [x.key + x.text, x])).values()];
  return { ...ch, checks, can, ready, first: firstOpen, open };
}
