import { parcelOf, viewsOf } from './golive.js';

/*
 * What goes to eBay and to her shop, and which cards may go. One place, so a card listed on its own and a card
 * listed with forty others are sent the same fields and held by the same rules.
 */

export const slugify = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

// She buys after each sale, and the shop caps how many one order can take.
export const startQuantity = (row) => Math.min(5, row.listing?.max_qty ?? 5);

// What goes to eBay, from her saved draft, at the eBay price. The queue keeps this as it was when she chose it, so
// what she checked is what goes up.
export function ebayRequest(whole, draft, { quantity, categoryId } = {}) {
  const e = viewsOf(whole).ebay;
  return {
    price: e.price,
    quantity,
    package: parcelOf(e, draft),
    title: draft.title,
    description: draft.description,
    images: draft.images,
    aspects: draft.aspects,
    use_catalogue: Boolean(draft.catalogue?.epid),
    // Her choice, else the category eBay's check settled on for this card.
    ...((categoryId ?? draft.ebay_category?.id) ? { category_id: categoryId ?? draft.ebay_category.id } : {}),
  };
}

// A shop draft: her copy and her photos only. The checklist has already refused the shop's.
export function shopProduct(row, whole, draft) {
  return {
    slug: `${slugify(whole.title)}-${String(row.id).slice(0, 6)}`,
    title: draft.title ?? whole.title,
    description: draft.description ?? null,
    price: whole.price,
    image_url: (draft.images ?? [])[0] ?? null,
    images: draft.images ?? [],
    brand: whole.l?.brand ?? row.listing?.brand ?? null,
    category: whole.l?.shop_category ?? null,
    postage_band: whole.store ? whole.m.postage_band?.key ?? null : whole.m.headroom_band ?? null,
    landed_cost: whole.goods,
    postage_cost: whole.postage,
    cost_note: whole.best ? `${whole.store ? 'Price' : 'Shelf price'} at ${whole.best.supplier}` : null,
    cost_updated_at: new Date().toISOString(),
    source_ref: row.id,
  };
}

export const jobOpen = (job) => job?.state === 'queued' || job?.state === 'working';

// Every check on one channel met, soft ones included.
export const readyFor = (gl, channel) => gl.left.includes(channel) && gl.checks[channel].every((x) => x.ok);

/*
 * Whether one card can go to one channel in a bulk action, and if not, the reason in her words. Only hard checks
 * hold a card back: a soft one is hers to weigh, and she ticked it.
 */
export function eligibility({ gl, a }, channel, job) {
  if (!gl.wants.includes(channel)) return { ok: false, why: channel === 'ebay' ? 'Not meant for eBay' : 'Not meant for your shop' };
  if (!gl.left.includes(channel)) return { ok: false, why: channel === 'ebay' ? 'Already on eBay' : 'Already on your shop' };
  // One channel at a time: a card eBay is working on waits for it, whichever way she asks.
  if (jobOpen(job)) return { ok: false, why: channel === 'ebay' ? 'Already in the queue' : 'eBay is listing it first' };
  if (channel === 'shop' && a.goods == null) return { ok: false, why: 'No cost yet' };
  const block = gl.checks[channel].find((x) => x.hard && !x.ok);
  if (block) return { ok: false, why: block.text };
  return { ok: true, soft: gl.checks[channel].filter((x) => !x.ok).map((x) => x.text) };
}

// Reasons counted, most common first: "No parcel weight yet (12), Already in the queue (2)".
export function reasons(list) {
  const n = new Map();
  for (const x of list) n.set(x.why, (n.get(x.why) ?? 0) + 1);
  return [...n.entries()].sort((p, q) => q[1] - p[1]).map(([why, count]) => ({ why, count }));
}

/*
 * When the last of `count` new listings should go up, at `daily` a day, with `ahead` already waiting and
 * `todayLeft` slots still open today. A date, not a promise: eBay may refuse some, and the queue runs each minute.
 */
export function lastDay(count, { daily, todayLeft, ahead = 0 }, now = new Date()) {
  if (!count || !daily) return null;
  const total = ahead + count;
  if (total <= todayLeft) return now;
  const days = Math.ceil((total - todayLeft) / daily);
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

// What eBay's check settled on for a card, kept on her draft: the category, the details it needs, and Keepr's values
// for them, never over a value she set. From a dry run's answer.
export function fromEbayCheck(dry, draft = {}) {
  if (!dry?.category) return null;
  const aspects = { ...(dry.filled ?? {}) };
  for (const [k, v] of Object.entries(draft.aspects ?? {})) if (v) aspects[k] = v;
  return {
    // The details eBay said were still missing: the function fills Brand, MPN and the catalogue's own itself.
    ebay_category: { id: dry.category.id, name: dry.category.name ?? null, source: dry.category.source, required: (dry.missing ?? []).map((a) => a.name) },
    aspects,
  };
}
