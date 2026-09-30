// What goes to eBay for one card, and putting it there. Shared by ebay-list (one card, from the portal) and
// ebay-queue (many, on a schedule), so a card cannot be listed one way by hand and another in bulk.
//
// The rule it enforces: her title and her description, never the shop's. Photos are hers, eBay's own catalogue
// for the barcode, or the shop's once Keepr has passed them (_shared/photos.ts); never another eBay seller's.

import { photoSource, sourceOf } from '../photos.ts';

export const EBAY = 'https://api.ebay.com';
export const MARKETPLACE = 'EBAY_GB';
// eBay's category tree for the UK site.
export const TREE_ID = '3';
// Her selling limit (30 September 2026): items a month, no money limit. settings.monthly_limit overrides it.
export const MONTHLY_LIMIT = 300;
// How many a day the queue lists at most, so a new account does not go from none to hundreds overnight.
export const DAILY_PACE = 20;

type Json = Record<string, any>;

export const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set on this function`);
  return v;
};

const basic = () => btoa(`${env('EBAY_CLIENT_ID')}:${env('EBAY_CLIENT_SECRET')}`);

export async function token(form: Record<string, string>) {
  const res = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic()}` },
    body: new URLSearchParams(form).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error_description ?? `eBay returned ${res.status}`);
  return body;
}

export const userToken = async (refresh: string) =>
  (await token({ grant_type: 'refresh_token', refresh_token: refresh })).access_token as string;

export const appToken = async (scope = 'https://api.ebay.com/oauth/api_scope') =>
  (await token({ grant_type: 'client_credentials', scope })).access_token as string;

// The useful detail is in errors[], not in the top-level message.
export function readError(status: number, body: Json) {
  const errors = (body?.errors ?? []) as Json[];
  if (!errors.length) return body?.message ?? `eBay returned ${status}`;
  return errors
    .map((e) => {
      const params = ((e.parameters ?? []) as Array<{ name: string; value: string }>)
        .map((p) => `${p.name}: ${p.value}`)
        .join(', ');
      return [e.message, e.longMessage, params].filter(Boolean).join(' ');
    })
    .join(' | ');
}

// An eBay error keeps its status, so the queue can tell a refusal (never retried) from a hiccup (tried again).
export class EbayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function call(path: string, access: string, init: RequestInit = {}) {
  const res = await fetch(`${EBAY}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${access}`,
      'content-type': 'application/json',
      'content-language': 'en-GB',
      // The runtime's own default is not one eBay accepts.
      'accept-language': 'en-GB',
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new EbayError(readError(res.status, body), res.status);
  return body;
}

const escape = (s: string) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// eBay renders descriptions as HTML, so plain line breaks would collapse.
export function toHtml(text: string) {
  if (/<\/?(p|ul|li|br|div)\b/i.test(text)) return text;
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^[-•*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escape(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(escape).join('<br>')}</p>`;
    })
    .join('');
}

// A barcode worth sending: 8, 12, 13 or 14 digits with a correct check digit. A shop's own product code is not one.
export function validGtin(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s/g, '');
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return null;
  const digits = s.split('').map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check ? s : null;
}

// Where a card carries a barcode: the shelf the import matched, a store card's shop page, or the page read.
export function gtinOf(c: Json): string | null {
  const m = c.margin ?? {};
  const l = c.listing ?? {};
  // Once the listing is written from her supplier's page, only that page's barcode is this product's.
  const moved = Boolean(c.draft?.page);
  const from = moved ? (l.source_url === c.draft.page ? [l.gtin, l.ean] : []) : [m.shelf?.gtin, m.cost_from?.gtin, m.gtin, l.gtin, l.ean];
  for (const v of from) {
    const g = validGtin(v);
    if (g) return g;
  }
  return null;
}

// The category the proving listing sat in, from the research. The last part of its path is its name.
export function cardCategory(c: Json) {
  const id = c.ebay_category_id ? String(c.ebay_category_id) : null;
  if (!id) return null;
  const path = String(c.ebay_category_path ?? '');
  const name = path.split(/\s*[>|/]\s*/).filter(Boolean).at(-1) ?? null;
  return { id, name };
}

export async function suggestCategory(title: string, app: string) {
  const out = await call(
    `/commerce/taxonomy/v1/category_tree/${TREE_ID}/get_category_suggestions?q=${encodeURIComponent(title)}`,
    app,
  );
  const cat = out?.categorySuggestions?.[0]?.category ?? null;
  return cat?.categoryId ? { id: String(cat.categoryId), name: cat.categoryName ?? null } : null;
}

export type Aspect = { name: string; required: boolean; mode: string; values: string[]; recommended?: boolean };

// The item details a category asks for. Required ones decide whether eBay takes the listing at all.
export async function aspectsFor(categoryId: string, app: string): Promise<Aspect[]> {
  const out = await call(
    `/commerce/taxonomy/v1/category_tree/${TREE_ID}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
    app,
  );
  return ((out?.aspects ?? []) as Json[]).map((a) => ({
    name: a.localizedAspectName,
    required: Boolean(a.aspectConstraint?.aspectRequired),
    recommended: a.aspectConstraint?.aspectUsage === 'RECOMMENDED',
    mode: a.aspectConstraint?.aspectMode ?? 'FREE_TEXT',
    values: ((a.aspectValues ?? []) as Json[]).map((v) => v.localizedValue).slice(0, 200),
  }));
}

export type Catalogue = { epid: string; title: string; images: string[]; aspects: Record<string, string[]>; brand?: string; mpn?: string };

// eBay's catalogue entry for a barcode. Tried with her token first, then the app's, because which grant the
// catalogue accepts is what the first test listing settles. Null when eBay has no entry.
export async function catalogueFor(gtin: string, tokens: { user?: string; app?: () => Promise<string> }): Promise<Catalogue | null> {
  const path = `/commerce/catalog/v1_beta/product_summary/search?gtin=${encodeURIComponent(gtin)}&limit=3`;
  let out: Json | null = null;
  let last: unknown = null;
  const tries: Array<() => Promise<string>> = [];
  if (tokens.user) tries.push(async () => tokens.user as string);
  if (tokens.app) tries.push(tokens.app);
  for (const get of tries) {
    try {
      out = await call(path, await get());
      break;
    } catch (e) {
      last = e;
      // No entry is an answer, not a failure of the token.
      if (e instanceof EbayError && e.status === 404) return null;
    }
  }
  if (!out) throw last ?? new Error('The catalogue could not be read.');
  const p = (out.productSummaries ?? [])[0];
  if (!p?.epid) return null;
  const images = [p.image?.imageUrl, ...((p.additionalImages ?? []) as Json[]).map((i) => i.imageUrl)].filter(Boolean);
  const aspects: Record<string, string[]> = {};
  for (const a of (p.aspects ?? []) as Json[]) {
    if (a.localizedName && (a.localizedValues ?? []).length) aspects[a.localizedName] = a.localizedValues;
  }
  return { epid: String(p.epid), title: p.title ?? '', images, aspects, brand: p.brand, mpn: p.mpn };
}

const norm = (s: string) => s.trim().toLowerCase();

// Her values win over the catalogue's, the catalogue's over the defaults.
export function mergeAspects(...layers: Array<Record<string, unknown> | null | undefined>) {
  const out: Record<string, string[]> = {};
  const keyOf: Record<string, string> = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer ?? {})) {
      const vals = (Array.isArray(v) ? v : [v]).map((x) => String(x ?? '').trim()).filter(Boolean);
      if (!vals.length) continue;
      const key = keyOf[norm(k)] ?? k;
      keyOf[norm(k)] = key;
      out[key] = vals;
    }
  }
  return out;
}

export type Request = {
  price?: number; quantity?: number; title?: string; description?: string; images?: string[];
  package?: Json; aspects?: Record<string, unknown>; use_catalogue?: boolean; category_id?: string;
};

export type Preview = {
  sku: string; title: string; price: number; quantity: number; images: string[]; imageSource: 'hers' | 'shop' | 'catalogue' | 'mixed' | 'none';
  description: string; category: { id: string; name: string | null; source: 'chosen' | 'card' | 'ebay' } | null;
  suggested: { id: string; name: string | null } | null; categoryDiffers: boolean;
  gtin: string | null; catalogue: Catalogue | null; catalogueError: string | null;
  required: Aspect[]; missing: Aspect[]; recommended: Aspect[]; aspects: Record<string, string[]>; box: Json | null;
  problems: string[];
  legacy: boolean;
};

// Stable across relists, so a second publish replaces rather than duplicates.
export const skuOf = (id: string) => `CK-${String(id).replace(/-/g, '').slice(0, 16).toUpperCase()}`;

// Whether her postage policy prices by weight: true for calculated, false for flat or free, null when unknown.
export async function needsWeight(policyId: unknown, access: string): Promise<boolean | null> {
  if (!policyId || !access) return null;
  try {
    const p = await call(`/sell/account/v1/fulfillment_policy/${policyId}`, access);
    return ((p.shippingOptions ?? []) as Json[]).some((o) => o.costType === 'CALCULATED');
  } catch {
    return null;
  }
}

// The condition IDs a category takes. 1000 is New.
export async function conditionsFor(categoryId: string, app: string): Promise<string[] | null> {
  const r = await call(`/sell/metadata/v1/marketplace/${MARKETPLACE}/get_item_condition_policies?filter=categoryIds:%7B${encodeURIComponent(categoryId)}%7D`, app);
  const policy = (r.itemConditionPolicies ?? [])[0];
  return policy ? ((policy.itemConditions ?? []) as Json[]).map((x) => String(x.conditionId)) : null;
}

// Another of her cards already live on eBay as the same product: the same barcode, or the same title. Two identical
// listings break eBay's duplicate listing rule.
export async function duplicateOf(client: any, tenantId: string, c: Json): Promise<Json | null> {
  const live = () => client.from('candidates').select('id, title, ebay').eq('tenant_id', tenantId)
    .neq('id', c.id).not('ebay->>listing_id', 'is', null).limit(1);
  const gtin = gtinOf(c);
  if (gtin) {
    const { data } = await live().eq('ebay->>gtin', gtin);
    if (data?.[0]) return data[0];
  }
  const { data } = await live().eq('title', c.title);
  return data?.[0] ?? null;
}

/*
 * Everything that would go to eBay, and anything that stops it. Nothing is written. The draft is hers; the request
 * can override it; the shop's `listing` is read for facts (brand, MPN), never for the title or words. Its photos go
 * up only once Keepr has passed them.
 */
export async function prepare(
  c: Json, req: Request, tokens: { user: string; app: () => Promise<string> },
  { revising = false, settings = null as Json | null } = {},
): Promise<Preview> {
  const d = c.draft ?? {};
  const l = c.listing ?? {};
  const problems: string[] = [];

  // A listing already live that went up before this rule is revised with what it went up with, so a price change
  // is not held back; the portal asks her to replace the copy. A new listing never falls back.
  const legacy = revising && !d.title && !d.description && !d.images;
  const title = String(req.title ?? d.title ?? (legacy ? l.title ?? c.title : '') ?? '').trim();
  const words = String(req.description ?? d.description ?? (legacy ? [l.summary, l.description].filter(Boolean).join('\n\n') : '') ?? '').trim();
  const mine = ((req.images ?? d.images ?? (legacy ? l.images : null) ?? []) as string[]).filter(Boolean);
  const sell = Number(req.price ?? d.price ?? c.margin?.sale_price ?? 0);
  const quantity = Math.max(1, Math.min(99, Number(req.quantity ?? d.quantity ?? 1)));
  const box = req.package ?? d.package ?? null;

  if (!title) problems.push('No title of hers. Write one on the card.');
  if (title.length > 80) problems.push(`The title is ${title.length} characters; eBay takes 80.`);
  if (!words) problems.push('No description of hers. Write one on the card.');
  if (!legacy && words && l.description && words.replace(/\s+/g, ' ') === String(l.description).trim().replace(/\s+/g, ' ')) {
    problems.push('The description is the shop\'s own wording.');
  }
  if (!(sell > 0)) problems.push('No price to list at.');
  // eBay needs the weight only when her postage policy works the cost out from it. Flat and free postage do not.
  if (!revising && !(Number(box?.weight_kg) > 0) && await needsWeight(settings?.fulfillment, tokens.user) === true) {
    problems.push('No parcel weight: your eBay postage policy works the cost out by weight.');
  }

  // Only photos that may go up: hers, the shop's that Keepr passed, or eBay's catalogue. The eBay seller's photo the
  // research found never does. A listing live from before this rule keeps what it went up with.
  const judged = mine.map((u) => sourceOf(u, c, 'ebay'));
  const refused = legacy ? [] : judged.filter((j) => !j.ok);
  if (refused.length) {
    const why = [...new Set(refused.map((r) => ('why' in r ? r.why : '')))].filter(Boolean).join('; ');
    problems.push(refused.length === 1 ? `A photo cannot go up: ${why}.` : `${refused.length} photos cannot go up: ${why}.`);
  }
  const hers = judged.filter((j) => j.source === 'hers');

  const gtin = gtinOf(c);
  let catalogue: Catalogue | null = null;
  let catalogueError: string | null = null;
  const wantsCatalogue = req.use_catalogue ?? Boolean(d.catalogue?.epid);
  if (gtin && (wantsCatalogue || !mine.length)) {
    try {
      catalogue = await catalogueFor(gtin, { user: tokens.user, app: () => tokens.app() });
    } catch (e) {
      catalogueError = e instanceof Error ? e.message : String(e);
    }
  }
  // Her own photos first; then eBay's catalogue, which eBay itself supplies; then the shop's that passed.
  const useCatalogue = Boolean(wantsCatalogue && catalogue && !hers.length);
  const images = (useCatalogue ? catalogue!.images : mine).slice(0, 12);
  const imageSource: Preview['imageSource'] = !images.length ? 'none'
    : useCatalogue ? 'catalogue'
      : legacy ? 'shop'
        : photoSource(judged) as Preview['imageSource'];
  if (!images.length) problems.push(catalogue ? 'No photos yet. eBay\'s catalogue has this product; Find photos on the card uses it.' : 'No photos yet: her own, or the shop\'s once Keepr has checked them.');

  // The category: one she chose, else the one the proving listing sat in, else eBay's first guess from her title.
  const app = await tokens.app();
  const suggested = title ? await suggestCategory(title, app).catch(() => null) : null;
  const card = cardCategory(c);
  const category = req.category_id
    ? { id: String(req.category_id), name: req.category_id === suggested?.id ? suggested.name : req.category_id === card?.id ? card.name : null, source: 'chosen' as const }
    : card ? { ...card, source: 'card' as const }
      : suggested ? { ...suggested, source: 'ebay' as const } : null;
  if (!category) problems.push('No category: the card has none and eBay could not suggest one from the title.');

  // Everything goes up as New. A category that does not take New is caught here, not at publish.
  if (category && !revising) {
    const allowed = await conditionsFor(category.id, app).catch(() => null);
    if (allowed?.length && !allowed.includes('1000')) {
      problems.push(`eBay does not take New in ${category.name ?? `category #${category.id}`}. Choose another category.`);
    }
  }

  const brand = catalogue?.brand ?? l.brand ?? null;
  const mpn = catalogue?.mpn ?? l.mpn ?? null;
  const aspects = mergeAspects(
    { Brand: brand ?? 'Unbranded', MPN: mpn ?? 'Does not apply' },
    useCatalogue ? catalogue!.aspects : null,
    d.aspects,
    req.aspects,
  );

  let all: Aspect[] = [];
  if (category) all = await aspectsFor(category.id, app).catch(() => []);
  const required = all.filter((a) => a.required);
  const have = new Set(Object.keys(aspects).map(norm));
  const missing = required.filter((a) => !have.has(norm(a.name)));
  // The details eBay recommends for this category and the listing does not have yet: they help it be found.
  const recommended = all.filter((a) => !a.required && a.recommended && !have.has(norm(a.name))).slice(0, 10);
  // A revision keeps the category it went up in, and eBay took it then; the details are asked for, not required.
  if (missing.length && !revising) problems.push(`eBay needs ${missing.map((a) => a.name).join(', ')} for this category.`);

  return {
    sku: skuOf(c.id), title, price: sell, quantity, images, imageSource,
    description: toHtml(words || title), category, suggested,
    categoryDiffers: Boolean(category && suggested && category.id !== suggested.id),
    gtin, catalogue, catalogueError, required, missing, recommended, aspects, box, problems,
    legacy,
  };
}

// The parcel in eBay's shape: the weight when there is one, the size when all three sides are there.
// The parcel in eBay's shape, only when there is a weight to give: flat and free postage need nothing, and a
// size on its own tells eBay nothing it prices by. No package type: eBay's UK site refuses MAILING_BOX
// (error 216305, 30 September 2026) and takes the parcel without one.
export function packageOf(box: Json | null) {
  if (!(Number(box?.weight_kg) > 0)) return null;
  return {
    weight: { value: Number(box.weight_kg), unit: 'KILOGRAM' },
    ...(Number(box.length_cm) > 0 && Number(box.width_cm) > 0 && Number(box.height_cm) > 0
      ? { dimensions: { length: Number(box.length_cm), width: Number(box.width_cm), height: Number(box.height_cm), unit: 'CENTIMETER' } }
      : {}),
  };
}

/*
 * Puts a prepared card on eBay: inventory item, offer, publish. `update` revises a live listing in place from the
 * card's current copy and keeps the category it went up in. Returns the record saved on candidates.ebay.
 */
export async function publish(c: Json, p: Preview, s: Json, access: string, { update = false } = {}) {
  if (p.problems.length) throw new EbayError(p.problems.join(' '), 400);
  const category = update && c.ebay?.category_id
    ? { id: String(c.ebay.category_id), name: c.ebay.category_name ?? null }
    : p.category!;

  await call(`/sell/inventory/v1/inventory_item/${p.sku}`, access, {
    method: 'PUT',
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity: p.quantity } },
      condition: 'NEW',
      ...(packageOf(p.box) ? { packageWeightAndSize: packageOf(p.box) } : {}),
      product: {
        title: p.title,
        description: p.description,
        imageUrls: p.images,
        brand: p.aspects.Brand?.[0] ?? 'Unbranded',
        mpn: p.aspects.MPN?.[0] ?? 'Does not apply',
        aspects: p.aspects,
        ...(p.gtin ? { ean: [p.gtin] } : {}),
        ...(p.imageSource === 'catalogue' && p.catalogue ? { epid: p.catalogue.epid } : {}),
      },
    }),
  });

  const offerBody = {
    sku: p.sku,
    marketplaceId: MARKETPLACE,
    format: 'FIXED_PRICE',
    availableQuantity: p.quantity,
    categoryId: category.id,
    listingDescription: p.description,
    pricingSummary: { price: { value: p.price.toFixed(2), currency: 'GBP' } },
    listingPolicies: { fulfillmentPolicyId: s.fulfillment, paymentPolicyId: s.payment, returnPolicyId: s.return },
    merchantLocationKey: s.location,
  };

  // A failed publish leaves the offer behind, and creating it twice is refused.
  const existing = await call(`/sell/inventory/v1/offer?sku=${encodeURIComponent(p.sku)}&marketplace_id=${MARKETPLACE}`, access)
    .catch(() => null);
  let offerId = existing?.offers?.[0]?.offerId ?? null;
  if (offerId) {
    await call(`/sell/inventory/v1/offer/${offerId}`, access, { method: 'PUT', body: JSON.stringify(offerBody) });
  } else {
    offerId = (await call('/sell/inventory/v1/offer', access, { method: 'POST', body: JSON.stringify(offerBody) })).offerId;
  }

  // Updating a published offer revises the live listing in place.
  const published = update
    ? { listingId: c.ebay.listing_id }
    : await call(`/sell/inventory/v1/offer/${offerId}/publish`, access, { method: 'POST' });

  return {
    ...(update ? c.ebay : {}),
    sku: p.sku,
    offer_id: offerId,
    listing_id: published.listingId,
    category_id: category.id,
    category_name: category.name,
    price: p.price,
    quantity: p.quantity,
    images_from: p.imageSource,
    ...(p.gtin ? { gtin: p.gtin } : {}),
    ...(p.imageSource === 'catalogue' && p.catalogue ? { epid: p.catalogue.epid } : {}),
    ...(p.box ? { package: p.box } : {}),
    ...(update ? { revised_at: new Date().toISOString() } : { published_at: new Date().toISOString() }),
  };
}

// The first of this month and of today, UK time, as ISO strings for counting what went up.
export function periodStarts(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return { month: `${parts.year}-${parts.month}-01`, day: `${parts.year}-${parts.month}-${parts.day}` };
}

// How many she has listed from here this month and today, against her limits.
export async function allowance(client: any, tenantId: string, s: Json) {
  const { month, day } = periodStarts();
  const count = async (from: string) => {
    const { count: n, error } = await client
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('ebay->>published_at', from);
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const [monthUsed, dayUsed] = await Promise.all([count(month), count(day)]);
  const monthly = Number(s.monthly_limit ?? MONTHLY_LIMIT);
  const daily = Number(s.daily_pace ?? DAILY_PACE);
  return { monthly, daily, monthUsed, dayUsed, left: Math.max(0, Math.min(monthly - monthUsed, daily - dayUsed)), monthLeft: Math.max(0, monthly - monthUsed) };
}

export const CANDIDATE_FIELDS = 'id, title, image_url, margin, listing, draft, ebay, external_ref, ebay_category_id, ebay_category_path, photo_checks';

// Her policies, as chosen on the settings screen. Named when any is missing, because eBay refuses without them.
export function policiesMissing(s: Json) {
  return [
    !s.fulfillment && 'a postage policy',
    !s.payment && 'a payment policy',
    !s.return && 'a returns policy',
    !s.location && 'a dispatch location',
  ].filter(Boolean) as string[];
}
