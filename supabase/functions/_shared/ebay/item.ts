// One eBay listing read in full through the Browse API: what it sells at, how fast, by whom, and the facts eBay
// holds for it. The figures become the card's reference listing; the facts become what her copy is written from.
// The listing's wording and photos are another seller's and never go up.

import { call } from './listing.ts';

type Json = Record<string, any>;

// The research's proof rule (scripts/lib/cost.js): a seller under 1,000 feedback selling it, at least a week old,
// with two sales once it is a month old and one a month after that.
export const MAX_FEEDBACK = 1000;
export const MIN_AGE_DAYS = 7;
export function soldNeeded(ageDays: number | null) {
  if (ageDays == null) return 2;
  if (ageDays < 30) return 1;
  return Math.max(2, Math.ceil(ageDays / 30));
}
export function proofOf({ feedback, sold, ageDays }: { feedback: number | null; sold: number | null; ageDays: number | null }) {
  return feedback != null && feedback <= MAX_FEEDBACK && sold != null && ageDays != null
    && ageDays >= MIN_AGE_DAYS && sold >= soldNeeded(ageDays);
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const plain = (html: unknown) => String(html ?? '').replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export const legacyId = (id: unknown) => {
  const s = String(id ?? '');
  return s.split('|')[1] ?? s.replace(/\D/g, '');
};

// The Browse answer as the card keeps it. `now` is passed so the age is testable.
export function fromBrowse(it: Json, now = Date.now()) {
  const price = Number(it.price?.value ?? 0);
  const ship = (it.shippingOptions ?? [])[0];
  const postage = ship && ship.shippingCostType !== 'CALCULATED' ? Number(ship.shippingCost?.value ?? 0) : 0;
  const created = it.itemCreationDate ? Date.parse(it.itemCreationDate) : NaN;
  const ageDays = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 86400000)) : null;
  const avail = (it.estimatedAvailabilities ?? [])[0] ?? {};
  const sold = avail.estimatedSoldQuantity != null ? Number(avail.estimatedSoldQuantity) : null;
  const feedback = it.seller?.feedbackScore != null ? Number(it.seller.feedbackScore) : null;
  const perDay = sold != null && ageDays ? Math.round((sold / ageDays) * 1000) / 1000 : null;
  const id = legacyId(it.legacyItemId ?? it.itemId);
  const aspects: Record<string, string> = {};
  for (const a of (it.localizedAspects ?? []) as Json[]) {
    if (a?.name && a?.value && Object.keys(aspects).length < 30) aspects[String(a.name)] = String(a.value).slice(0, 120);
  }
  const gtin = String(it.gtin ?? '').replace(/\D/g, '') || null;

  return {
    entry: {
      item_id: it.itemId ?? `v1|${id}|0`,
      title: String(it.title ?? ''),
      // Postage in, the way the market chart reads every listing.
      price: r2(price + postage),
      sold_lifetime: sold,
      age_days: ageDays,
      per_day: perDay,
      seller_feedback: feedback,
      proved: proofOf({ feedback, sold, ageDays }),
      ceiling: MAX_FEEDBACK,
      url: it.itemWebUrl ?? `https://www.ebay.co.uk/itm/${id}`,
      image_url: it.image?.imageUrl ?? null,
    },
    facts: {
      title: String(it.title ?? ''),
      brand: it.brand ?? aspects.Brand ?? null,
      mpn: it.mpn ?? aspects.MPN ?? null,
      gtin: gtin && gtin.length >= 8 && gtin.length <= 14 ? gtin : null,
      epid: it.epid ?? null,
      category: it.categoryPath ?? null,
      category_id: it.categoryId ?? null,
      aspects,
      // Facts to write from, cut short: a description is another seller's wording and only its facts are used.
      description: plain(it.shortDescription ?? it.description ?? '').slice(0, 1500) || null,
    },
  };
}

// Read one listing by its id as the research or the search gave it ("v1|123|0", or the number alone).
export async function readItem(itemId: string, app: string, now = Date.now()) {
  const id = String(itemId);
  const path = id.includes('|')
    ? `/buy/browse/v1/item/${encodeURIComponent(id)}`
    : `/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId(id))}`;
  return fromBrowse(await call(path, app), now);
}
