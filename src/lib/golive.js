import { SHOP_NAME_LIST, channelsOf, shopName } from './assess.js';
import { freshChecks, isHers, noShopPhotos, pageOf, passedPhotos, sourceOf } from './photos.js';
import { listingOf, swappedTo } from './product';

/*
 * What stands between an approved card and going live, per channel. One place, so the row, the checklist, the
 * buttons and the bulk queue later all read the same answer.
 *
 * Two kinds of check. A hard one blocks the button: the listing would break a rule (a photo Keepr has not passed,
 * another eBay seller's photo, the shop's wording) or cannot go up (no title, no parcel, a loss). A soft one does
 * not block, but the card is not Ready until it passes: over the market, under the profit target, pack not
 * confirmed. She can list over the market on purpose; she cannot list with a photo that failed the check.
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
  evri10: { length_cm: 60, width_cm: 45, height_cm: 30, label: 'Evri to 10kg' },
  evri15: { length_cm: 60, width_cm: 45, height_cm: 30, label: 'Evri to 15kg' },
};

// Where a price sits in the shelf product's own eBay market, once she chose to list it as it is. In the market up to
// the upper quartile of what the same product asks; over that, by how much. Null without that market.
export function ownMarket(price, draft = {}) {
  const m = draft.as_shelf ? draft.market : null;
  if (!m?.median || price == null) return null;
  const ref = Math.max(m.p75 ?? m.median, m.median);
  return { median: m.median, ref, n: m.n, inMarket: price <= ref + 0.005, over: Math.round((price - ref) * 100) / 100 };
}

// The parcel that goes up: what she set, over the band's suggestion. Without the band's label.
export function parcelOf(a, draft = {}) {
  const { label, ...band } = parcelFor(a) ?? {};
  return { ...band, ...(draft.package ?? {}) };
}

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
  // Once the listing is written from her supplier's page, only that page's barcode is this product's. Moved to
  // another product's eBay listing, the barcode eBay holds for it counts too.
  const swapped = swappedTo(row);
  const moved = Boolean(row.draft?.page) || Boolean(swapped);
  const page = row.draft?.page && l.source_url === row.draft.page ? [l.gtin, l.ean] : [];
  const from = moved ? [...page, swapped ? row.draft?.item_facts?.gtin : null] : [m.shelf?.gtin, m.cost_from?.gtin, m.gtin, l.gtin, l.ean];
  for (const v of from) {
    const g = validGtin(v);
    if (g) return g;
  }
  return null;
}

/*
 * The checks for one channel. `draft` is her saved edits; `a` is assess() on the card with those edits.
 * Each item: key, ok, hard, text (what is true now), fix (what to do), and `to` (the part of the card that fixes it).
 */
export function checksFor(channel, a, row, draft) {
  const l = row.listing ?? {};
  const brand = l.brand ?? null;
  const shelfShop = shopName(a.m?.shelf?.shop ?? a.m?.cost_from?.shop) ?? null;
  const images = draft.images ?? [];
  const title = (draft.title ?? '').trim();
  const description = (draft.description ?? '').trim();
  const copied = description && l.description && description.replace(/\s+/g, ' ') === String(l.description).trim().replace(/\s+/g, ' ');
  const shopInText = namesShop(`${title}\n${description}`, { brand, also: [shelfShop] });
  const p = a.position;
  const out = [];

  // Photos she may use on this channel: hers, the shop's that Keepr passed, eBay's catalogue on eBay only.
  const photosFor = (channel) => {
    const judged = images.map((u) => sourceOf(u, row, draft, channel));
    const bad = judged.filter((j) => !j.ok);
    if (bad.length) {
      const why = [...new Set(bad.map((b) => b.why))].join('; ');
      return { ok: false, text: `${bad.length === 1 ? 'A photo' : `${bad.length} photos`} cannot go up: ${why}`, fix: 'Take it out' };
    }
    if (channel === 'ebay' && draft.catalogue?.epid && !images.some((u) => isHers(u, draft))) {
      return { ok: true, text: 'eBay\'s catalogue photos' };
    }
    if (images.length) {
      const shop = judged.filter((j) => j.source === 'shop').length;
      const hers = judged.length - shop;
      const parts = [hers && `${hers} yours`, shop && `${shop} from the shop, checked`].filter(Boolean).join(', ');
      return { ok: true, text: `${images.length} ${images.length === 1 ? 'photo' : 'photos'}: ${parts}` };
    }
    // None yet: find them if nobody has looked, use what passed, or say why the shop's cannot help.
    const usable = passedPhotos(row, draft);
    if (!freshChecks(row, draft) && ((listingOf(row, draft)?.images ?? []).length || pageOf(row, draft) || gtinOf({ ...row, draft })
      || (swappedTo(row, draft) && draft.item_facts?.epid))) {
      return { ok: false, text: 'No photos yet', fix: 'Find photos', find: true };
    }
    if (usable.length) return { ok: false, text: `${usable.length} checked ${usable.length === 1 ? 'photo' : 'photos'} from the shop to use`, fix: `Use ${usable.length === 1 ? 'it' : 'them'}`, find: true };
    if (channel === 'ebay' && freshChecks(row, draft)?.catalogue?.epid) return { ok: false, text: 'eBay\'s catalogue has photos', fix: 'Use them', find: true };
    return { ok: false, text: noShopPhotos(row, draft) ?? 'No photos yet', fix: 'Add photos' };
  };
  const words = !description
    ? { ok: false, text: 'No description yet', fix: 'Write the description', write: true }
    : copied
      ? { ok: false, text: 'Still the shop\'s wording', fix: 'Write the description', write: true }
      : shopInText
        ? { ok: false, text: `Names ${shopInText}`, fix: 'Take the name out' }
        : { ok: true, text: 'Your description' };

  if (channel === 'ebay') {
    // Listed as the shelf product itself: judged against its own market, not the one that proved the card.
    const own = ownMarket(a.price, draft);
    out.push(own
      ? (own.inMarket
        ? { key: 'price', hard: false, ok: true, text: `In its own market, median £${own.median.toFixed(2)} of ${own.n}`, to: 'price' }
        : { key: 'price', hard: false, ok: false, text: `£${own.over.toFixed(2)} over its own market at £${own.ref.toFixed(2)}`, fix: 'Match the market', match: own.median, to: 'price' })
      : p && !p.inMarket
        ? { key: 'price', hard: false, ok: false, text: `£${p.over.toFixed(2)} over the market at £${p.ref.toFixed(2)}`, fix: 'Match the market', match: p.ref, to: 'price' }
        : { key: 'price', hard: false, ok: Boolean(p), text: p ? 'In the market' : 'No market price', to: 'price' });
    out.push(a.keep == null
      ? { key: 'profit', hard: true, ok: false, text: 'No cost, so nothing to keep', fix: 'Add a supplier', to: 'buy' }
      : a.keep < 0
        ? { key: 'profit', hard: true, ok: false, text: `Loses £${Math.abs(a.keep).toFixed(2)} a sale`, fix: 'Raise the price', to: 'price' }
        : a.target != null && a.keep < a.target
          ? { key: 'profit', hard: false, ok: false, text: `Keeps £${a.keep.toFixed(2)}, under your £${a.target.toFixed(2)}`, fix: 'Find it cheaper', to: 'buy' }
          : { key: 'profit', hard: false, ok: true, text: `Keeps £${a.keep.toFixed(2)}`, to: 'price' });
    if (!a.store && a.moved) {
      const by = a.moved.by === 'keepr' ? `Keepr matched it${a.moved.sure != null ? `, ${Math.round(a.moved.sure * 100)}% sure` : ''}` : 'You matched it';
      out.push({ key: 'pack', hard: false, ok: true, text: `${by} to the eBay listing it prices from`, to: 'pack' });
    } else if (!a.store && draft.as_shelf) {
      out.push({ key: 'pack', hard: false, ok: true, text: 'Listed as the shelf product itself, priced from its own market', to: 'pack' });
    } else if (!a.store) {
      const packOk = a.costConfirmed && !a.packCheck;
      out.push({ key: 'pack', hard: false, ok: packOk, text: packOk ? 'Pack confirmed' : a.packCheck ? `Pack not confirmed, ${a.ratio} times the shelf price` : 'Pack not confirmed', fix: 'Compare', to: 'pack' });
    }
    out.push(!title
      ? { key: 'title', hard: true, ok: false, text: 'No title yet', fix: 'Write a title', to: 'listing' }
      : title.length > 80
        ? { key: 'title', hard: true, ok: false, text: `Title is ${title.length} characters, over 80`, fix: 'Shorten it', to: 'listing' }
        : { key: 'title', hard: true, ok: true, text: `Title, ${title.length} of 80`, to: 'listing' });
    out.push({ key: 'photos', hard: true, ...photosFor('ebay'), to: 'listing' });
    out.push({ key: 'words', hard: true, ...words, to: 'listing' });
    // The eBay category and the item details it needs, once eBay's check has settled them on her draft.
    const cat = draft.ebay_category;
    const have = new Set(Object.entries(draft.aspects ?? {}).filter(([, v]) => v && String(v).trim()).map(([k]) => k.toLowerCase()));
    const lacking = (cat?.required ?? []).filter((n) => !have.has(n.toLowerCase()));
    out.push(!cat
      ? { key: 'details', hard: false, ok: false, text: 'Category and item details not checked with eBay yet', fix: 'Check with eBay', ebaycheck: true, to: 'listing' }
      : lacking.length
        ? { key: 'details', hard: true, ok: false, text: `eBay needs ${lacking.join(', ')} for ${cat.name ?? 'this category'}`, fix: 'Fill them', ebaycheck: true, to: 'listing' }
        : { key: 'details', hard: false, ok: true, text: `${cat.name ?? `Category #${cat.id}`}${have.size ? `, ${have.size} item ${have.size === 1 ? 'detail' : 'details'}` : ''}`, to: 'listing' });
    // The parcel as she set it, else from the card's postage band. A weight is only needed when her eBay postage is
    // calculated by weight, which the eBay function checks against her policy; flat and free postage go without.
    const box = parcelOf(a, draft);
    const size = box.length_cm && box.width_cm && box.height_cm ? `${box.length_cm} x ${box.width_cm} x ${box.height_cm}cm` : null;
    const from = draft.package ? '' : ', from the postage band';
    out.push(Number(box.weight_kg) > 0
      ? { key: 'parcel', hard: false, ok: true, text: `Parcel ${box.weight_kg}kg${size ? `, ${size}` : ''}${from}`, to: 'parcel' }
      : size
        ? { key: 'parcel', hard: false, ok: true, text: `Parcel ${size}${from}, no weight: fine for flat or free postage`, to: 'parcel' }
        : { key: 'parcel', hard: false, ok: false, text: 'No parcel size or weight', fix: 'Set the parcel', to: 'parcel' });
  } else {
    out.push({ key: 'photos', hard: true, ...photosFor('shop'), to: 'listing' });
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
  // The same product approved twice holds both channels: two identical listings break eBay's rules, and two drafts
  // of one product on her shop is one too many.
  const dupe = row.duplicate_of
    ? [{ key: 'dupe', hard: true, ok: false, text: `Approved twice: also "${row.duplicate_of.title}"`, fix: 'Show both', dupe: true }]
    : [];
  const checks = Object.fromEntries(ch.left.map((c) => [c, [...dupe, ...checksFor(c, views[c], row, draft)]]));
  const can = Object.fromEntries(ch.left.map((c) => [c, checks[c].every((x) => !x.hard || x.ok)]));
  // Ready to go live on a channel: every check on it met. The card is Ready when at least one channel is, so a card
  // her shop can take now is not held back by eBay, and the other way round. `complete` is every channel left.
  const readyOn = ch.left.filter((c) => checks[c].every((x) => x.ok));
  const ready = readyOn.length > 0;
  const complete = ch.left.length > 0 && readyOn.length === ch.left.length;
  // The first thing to do, blocking ones first, for the row.
  const all = ch.left.flatMap((c) => checks[c].map((x) => ({ ...x, channel: c })));
  const firstOpen = all.find((x) => !x.ok && x.hard) ?? all.find((x) => !x.ok) ?? null;
  const open = [...new Map(all.filter((x) => !x.ok).map((x) => [x.key + x.text, x])).values()];
  return { ...ch, checks, can, ready, readyOn, complete, first: firstOpen, open };
}
