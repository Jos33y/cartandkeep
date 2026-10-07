// Her Amazon supplier's page, read by Apify's Amazon reader (axesso_data/amazon-product-details-scraper), because
// Amazon refuses to be read by our own functions. One run reads many pages, so a batch is one call.
//
// What comes back is split three ways and kept apart:
//   facts  what the product is, written as the supplier text her listing is written from first;
//   offer  what it costs her today and whether it is in stock, for the daily check;
//   risk   what Amazon's buyers complain about, for her eyes only, never for customer copy.
// Pure apart from runAxesso, so the tests hold the reading.

type Json = Record<string, any>;

export const ACTOR = 'axesso_data~amazon-product-details-scraper';
// Results are read back in batches; a batch this size finishes well inside a function's time.
export const BATCH = 20;

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
export const isAmazon = (url: unknown) => /(^|\.)amazon\.[a-z.]+$/.test(hostOf(String(url ?? '')));
export const isAmazonUk = (url: unknown) => hostOf(String(url ?? '')) === 'amazon.co.uk';

// The product's ASIN from any of Amazon's address shapes: /dp/, /gp/product/, /gp/aw/d/, ?asin=.
export function asinOf(url: unknown) {
  const s = String(url ?? '');
  const m = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?=[/?#]|$)/i.exec(s) ?? /[?&]asin=([A-Z0-9]{10})\b/i.exec(s);
  return m ? m[1].toUpperCase() : null;
}

// One address per product, so two links to the same page are read once. psc=1 asks for the exact variant.
export const pageFor = (asin: string) => `https://www.amazon.co.uk/dp/${asin}?psc=1`;

const r2 = (v: number) => Math.round(v * 100) / 100;
const money = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? r2(n) : null;
};
const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Sellers dress bullets in lenticular brackets and capitals ("【6 Adjustable Speeds】:", "MINI SIZE:"). The words stay
// theirs; the dressing goes, so the writing reads it as facts, not shouting.
const plainBullet = (b: unknown) => clip(b, 600).replace(/[【\[]\s*([^】\]]+?)\s*[】\]]\s*:?\s*/g, '$1: ').replace(/^([A-Z0-9 &'\-/]{4,60}):\s*/, (_, h) => `${h.charAt(0)}${h.slice(1).toLowerCase()}: `);

/*
 * Stock in five words the portal can act on, with Amazon's own wording kept beside it.
 *   in    in stock with nothing said about running low
 *   low   "Only 3 left in stock"
 *   slow  in stock later: "Usually dispatched within 1 to 2 months", "Temporarily out of stock" with an order taken
 *   out   "Currently unavailable", or no page at all
 *   unknown  nothing readable came back
 */
export function stockOf(text: unknown, found = true) {
  const t = String(text ?? '').toLowerCase();
  if (!found) return 'out';
  if (/currently unavailable|out of stock(?!.*order now)|no longer available|not available/.test(t) && !/temporarily/.test(t)) return 'out';
  if (/only \d+ left|few left|low stock/.test(t)) return 'low';
  if (/temporarily|dispatched within \d+ (to \d+ )?(weeks?|months?)|usually (ships|dispatched) within \d+ (to \d+ )?(weeks?|months?)|pre-?order|available to ship in/.test(t)) return 'slow';
  if (/in stock|usually dispatched within \d+ (to \d+ )?days?|dispatched within 24 hours/.test(t)) return 'in';
  return 'unknown';
}

// Lines that are Amazon's furniture, not facts about the product.
const NOT_FACTS = /^(benefits|asin|customer reviews|best sellers rank|date first available|is discontinued by manufacturer|manufacturer reference|department|item model number)$/i;
// A detail whose value is a bare number only means something when it is a count.
const COUNTED = /(count|number of|pieces|pack|quantity|units|wattage|voltage)/i;

function detailsOf(item: Json, already: Array<string | null> = []) {
  const out = new Map<string, string>();
  // What the head of the text already says (brand, model, colour) is not said again in the table.
  const said = new Set<string>(already.filter(Boolean).map((v) => String(v).toLowerCase()));
  for (const d of [...(item.productDetails ?? []), ...(item.productSpecification ?? []), ...(item.aboutProduct ?? [])] as Json[]) {
    const k = clip(d?.name, 60);
    const v = clip(d?.value, 200);
    if (!k || !v || NOT_FACTS.test(k)) continue;
    if (/^\d+(\.\d+)?$/.test(v) && !COUNTED.test(k)) continue;
    // aboutProduct repeats productDetails under shorter names, and the model comes three times; the first wording wins.
    if (said.has(v.toLowerCase()) && !COUNTED.test(k)) continue;
    if (out.has(k.toLowerCase())) continue;
    out.set(k.toLowerCase(), `${k}: ${v}`);
    said.add(v.toLowerCase());
  }
  return [...out.values()].slice(0, 30);
}

const detail = (item: Json, re: RegExp) => clip(((item.productDetails ?? []) as Json[]).find((d) => re.test(String(d?.name ?? '')))?.value, 80) || null;

export function barcodeOf(item: Json) {
  const v = detail(item, /^(upc|ean|gtin|isbn-13|barcode)$/i);
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 14 ? d : null;
}

// Every barcode the page shows, wherever Amazon puts it: one line can hold two ("5012345678900, 5012345678917"), and
// the details table drops bare numbers (detailsOf), so they are kept here for task 02's barcode match.
export function barcodesOf(item: Json): string[] {
  const out = new Set<string>();
  for (const d of [...(item.productDetails ?? []), ...(item.productSpecification ?? []), ...(item.aboutProduct ?? [])] as Json[]) {
    if (!/\b(upc|ean|gtin|isbn-13|barcode)\b/i.test(String(d?.name ?? ''))) continue;
    for (const code of String(d?.value ?? '').match(/\d{8,14}/g) ?? []) out.add(code);
  }
  return [...out];
}

const brandOf = (item: Json) => clip(item.brandFormatted, 60)
  || clip(String(item.manufacturer ?? '').replace(/^(visit the|brand:)\s*/i, '').replace(/\s*store$/i, ''), 60)
  || detail(item, /^brand( name)?$/i);

/*
 * What Amazon's buyers say goes wrong, from Amazon's own review summary: the topics where at least four in ten of
 * five or more mentions are negative, worst first, with one buyer's words. For her, before she lists it; never copy.
 */
export function riskOf(item: Json) {
  const concerns = ((item.reviewInsights?.featureAspects ?? []) as Json[])
    .map((a) => {
      const mentions = Number(a.featureMentionCount) || 0;
      const negative = Number(a.featureMentionNegativeCount) || 0;
      const quote = ((a.reviewSnippets ?? []) as Json[]).map((s) => clip(s.text, 160).replace(/^"|"$/g, '').replace(/^\.\.\.|\.\.\.$/g, '').trim())
        .find((s) => s.length > 12) ?? null;
      return { topic: clip(a.name, 40), mentions, negative, quote, bad: a.sentiment === 'NEGATIVE' };
    })
    .filter((a) => a.topic && a.mentions >= 5 && (a.bad || a.negative / a.mentions >= 0.4))
    .sort((a, b) => b.negative / b.mentions - a.negative / a.mentions)
    .slice(0, 3)
    .map(({ bad: _bad, ...a }) => a);
  const rating = Number(String(item.productRating ?? '').replace(/ out of.*$/, '')) || null;
  const reviews = Number(item.countReview) || null;
  return rating || reviews || concerns.length ? { rating, reviews, concerns } : null;
}

// The colour or size this page is for, when the product comes in more than one.
function variantOf(item: Json) {
  const picked = ((item.variations ?? []) as Json[]).flatMap((v) => ((v.values ?? []) as Json[])
    .filter((x) => x.selected).map((x) => ({ kind: String(v.variationName ?? '').replace(/_name$/, '').replace(/_/g, ' ').replace(/^color$/, 'colour'), value: clip(x.value, 60), asin: x.asin ?? null })));
  return picked.length ? picked : null;
}

/*
 * With no price on the page's main offer (no Buy Box: "See All Buying Options", the Salus on 4 October), what else the
 * reader said about prices and sellers, kept as it came: the other sellers' price may be in it, and it is read before
 * anything is built on it. Plain values only, the selected variation's own, at most 1,500 characters.
 */
export function priceFieldsOf(item: Json): Json | null {
  const out: Json = {};
  for (const [k, v] of Object.entries(item ?? {})) {
    if (!/price|offer|buy.?box|seller|sold|availab|lowest|minimum|deal|shipping|prime|fulfil/i.test(k)) continue;
    if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? clip(v, 160) : v;
    else out[k] = clip(JSON.stringify(v), 400);
  }
  const chosen = ((item?.variations ?? []) as Json[]).flatMap((v) => ((v.values ?? []) as Json[]).filter((x) => x.selected));
  if (chosen.length) out.variation_selected = clip(JSON.stringify(chosen), 400);
  const text = JSON.stringify(out);
  return Object.keys(out).length ? (text.length > 1500 ? { cut: text.slice(0, 1500) } : out) : null;
}

/* One Axesso result as the card keeps it. */
export function fromAxesso(item: Json, at = new Date().toISOString()) {
  const asin = String(item.asin ?? asinOf(item.url) ?? '').toUpperCase() || null;
  const found = Number(item.statusCode) === 200 && /found/i.test(String(item.statusMessage ?? 'FOUND'));
  if (!found) {
    return { asin, url: asin ? pageFor(asin) : clip(item.url, 300), read_at: at, found: false, facts: null, risk: null,
      offer: { price: null, was: null, deal: false, shipping: null, stock: 'out', stock_text: clip(item.statusMessage, 120) || 'Page not found', sold_by: null, fulfilled_by: null, prime: false } };
  }
  const title = clip(item.title, 300);
  const brand = brandOf(item);
  const model = detail(item, /^(model number|model name|manufacturer part number|part number)$/i);
  const barcode = barcodeOf(item);
  const barcodes = barcodesOf(item);
  const bullets = ((item.features ?? []) as unknown[]).map(plainBullet).filter(Boolean).slice(0, 10);
  const variant = variantOf(item);
  const details = detailsOf(item, [brand, model, ...(variant ?? []).map((v) => v.value)]);
  const description = clip(item.productDescription, 2000) || null;
  const images = [...new Set(((item.imageUrlList ?? []) as unknown[]).map(String).filter((u) => /^https:\/\//.test(u)))].slice(0, 9);
  const price = money(item.price);
  const was = money(item.retailPrice);
  // The supplier text the listing is written from. Details first: it is Amazon's table, the steadier record.
  const text = [
    title,
    brand && `Brand: ${brand}`,
    model && `Model: ${model}`,
    barcode && `Barcode: ${barcode}`,
    variant?.map((v) => `${v.kind.charAt(0).toUpperCase()}${v.kind.slice(1)}: ${v.value}`).join('\n'),
    details.length ? `Product details (Amazon's table):\n${details.join('\n')}` : null,
    bullets.length ? `The seller's bullet points:\n${bullets.map((b) => `- ${b}`).join('\n')}` : null,
    description && `The seller's description: ${description}`,
  ].filter(Boolean).join('\n').slice(0, 6000);

  return {
    asin,
    url: asin ? pageFor(asin) : clip(item.url, 300),
    read_at: at,
    found: true,
    facts: { title, brand, model, barcode, barcodes, variant, bullets, details, description, images, text },
    offer: {
      price,
      // The struck-through price when it is higher: what she pays once the deal ends.
      was: was && price && was > price ? was : null,
      deal: Boolean(item.deal) || Boolean(was && price && was > price),
      shipping: item.shippingPrice == null ? null : money(item.shippingPrice) ?? 0,
      stock: stockOf(item.warehouseAvailability),
      stock_text: clip(item.warehouseAvailability, 120) || null,
      sold_by: clip(item.soldBy, 80) || null,
      fulfilled_by: clip(item.fulfilledBy, 80) || null,
      prime: Boolean(item.prime),
      // No price on the main offer: what the reader did say, to learn where the other sellers' price is.
      ...(price == null ? { seen: priceFieldsOf(item) } : {}),
    },
    risk: riskOf(item),
  };
}

export type Read = ReturnType<typeof fromAxesso>;

// The page in the shape the Send to Cart & Keep button sends, so the photo check takes it the same way.
export const asSent = (r: Read) => (r.facts ? {
  url: r.url, shop: 'amazon.co.uk', title: r.facts.title, brand: r.facts.brand, bullets: r.facts.bullets,
  details: r.facts.details, images: r.facts.images, text: r.facts.text,
} : null);

/*
 * A page with no main price (no Buy Box: "No featured offers available") still has sellers under "See all buying
 * options". Those are read by Axesso's offers reader, only for such pages, and the best one stands in as the price
 * (Joseey, 5 October: LEGO City F1, Firehawk, Luceco). Which one:
 *   - new only; used never;
 *   - a seller rated under 80% positive is never her supplier (Semantic UK, 66%); one with no rating counts only when
 *     Amazon sends it;
 *   - the cheapest, with postage; but one Amazon sends wins when it is within 10% of that, for Prime delivery and
 *     fewer late dispatches.
 * None good enough: no price, and the cheapest refused is kept as `others` so the card can say why.
 */
export const OFFERS_ACTOR = 'axesso_data~amazon-product-offers-scraper';
export const SELLER_FLOOR = 80;
export const AMAZON_MARGIN = 0.1;

const sentByAmazon = (o: Json) => /amazon/i.test(String(o.fulfilledBy ?? '')) || /^amazon/i.test(String(o.sellerName ?? ''));

export function bestOffer(items: Json[]) {
  const offers = (items ?? [])
    .filter((o) => /^new/i.test(String(o.condition ?? '')) && money(o.price) != null)
    .map((o) => {
      const price = money(o.price)!;
      const shipping = money(o.shippingPrice) ?? 0;
      const pct = o.sellerRatingPercentage == null || o.sellerRatingPercentage === '' ? null : Number(o.sellerRatingPercentage);
      const amazon = sentByAmazon(o);
      return {
        price, shipping, total: r2(price + shipping), amazon, pct: Number.isFinite(pct) ? pct : null,
        seller: clip(o.sellerName, 80) || null, sent_by: amazon ? 'Amazon' : clip(o.fulfilledBy, 80) || clip(o.sellerName, 80) || null,
        prime: Boolean(o.prime), delivery: clip([].concat(o.shippingDescription ?? []).join(' '), 160) || null,
      };
    })
    .sort((a, b) => a.total - b.total);
  const ok = offers.filter((o) => (o.pct == null ? o.amazon : o.pct >= SELLER_FLOOR));
  const cheapest = ok[0] ?? null;
  const viaAmazon = ok.find((o) => o.amazon) ?? null;
  const pick = viaAmazon && cheapest && viaAmazon.total <= r2(cheapest.total * (1 + AMAZON_MARGIN)) ? viaAmazon : cheapest;
  return { pick, refused: pick ? null : offers[0] ?? null, count: offers.length };
}

// The reading with its price from the best other seller, or with why there is none.
export function withOffer(r: Read, items: Json[]): Read {
  const { pick, refused, count } = bestOffer(items);
  if (!pick) {
    return refused ? ({ ...r, offer: { ...r.offer, others: { price: refused.total, seller: refused.seller, pct: refused.pct, count } } }) as Read : r;
  }
  const stock = pick.delivery ? stockOf(pick.delivery) : 'unknown';
  return {
    ...r,
    offer: {
      ...r.offer,
      price: pick.price,
      was: r.offer.was && r.offer.was > pick.price ? r.offer.was : null,
      deal: false,
      shipping: pick.shipping,
      stock: stock === 'unknown' || stock === 'out' ? 'in' : stock,
      stock_text: pick.delivery,
      sold_by: pick.seller,
      fulfilled_by: pick.sent_by,
      prime: pick.prime,
      // Read from the sellers' list, not the main offer: the card says whose price it is and how they are rated.
      from_offers: { count, seller_pct: pick.pct },
    },
  } as Read;
}

// The sellers' list for the pages that came back with no price. A failure leaves those readings as they were.
export async function readOffers(asins: string[], token: string, { timeoutSecs = 120, fetcher = fetch } = {}) {
  const out = new Map<string, Json[]>();
  for (let i = 0; i < asins.length; i += BATCH) {
    const batch = asins.slice(i, i + BATCH);
    try {
      const res = await fetcher(`https://api.apify.com/v2/acts/${OFFERS_ACTOR}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: batch.map((asin) => ({ asin, domainCode: 'co.uk', startPage: 1 })) }),
        signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
      });
      if (!res.ok) { console.error('[apify offers]', res.status, (await res.text().catch(() => '')).slice(0, 300)); continue; }
      const items = (await res.json().catch(() => [])) as Json[];
      for (const it of Array.isArray(items) ? items : []) {
        const a = String(it.asin ?? '').toUpperCase();
        if (!batch.includes(a) || Number(it.statusCode ?? 200) !== 200) continue;
        out.set(a, [...(out.get(a) ?? []), it]);
      }
    } catch (e) {
      console.error('[apify offers]', e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

/*
 * Read pages through Apify, in batches, and match each answer back to its ASIN. The token goes in the header, never
 * in the address, so it stays out of any log of the request.
 */
export async function runAxesso(urls: string[], token: string, { timeoutSecs = 120, fetcher = fetch, offers = true } = {}) {
  const wanted = [...new Set(urls.map((u) => asinOf(u)).filter(Boolean) as string[])];
  const out = new Map<string, Read>();
  const failed: string[] = [];
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const res = await fetcher(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ urls: batch.map(pageFor) }),
      signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
    });
    if (!res.ok) {
      const why = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) throw new Error('Apify refused the token. Check APIFY_TOKEN in the function secrets.');
      if (res.status === 402) throw new Error('The Apify account is out of credit.');
      console.error('[apify]', res.status, why.slice(0, 300));
      failed.push(...batch);
      continue;
    }
    const items = (await res.json().catch(() => [])) as Json[];
    const at = new Date().toISOString();
    for (const item of Array.isArray(items) ? items : []) {
      const r = fromAxesso(item, at);
      const key = r.asin ?? asinOf(item.url);
      if (key && batch.includes(key) && !out.has(key)) out.set(key, r);
    }
    for (const a of batch) if (!out.has(a)) failed.push(a);
  }
  // No main price: the other sellers, read in one more call for those pages only.
  const priceless = [...out.values()].filter((r) => r.found && r.offer.price == null && r.asin).map((r) => r.asin!) as string[];
  if (priceless.length && offers) {
    const lists = await readOffers(priceless, token, { timeoutSecs, fetcher });
    for (const a of priceless) if (lists.has(a)) out.set(a, withOffer(out.get(a)!, lists.get(a)!));
  }
  return { reads: out, failed };
}

/*
 * Which Amazon page a card is checked against. The page she sent or chose for the card first; otherwise her
 * cheapest Amazon supplier. Only amazon.co.uk: another Amazon prices in another currency and ships from abroad.
 * `costed` is that supplier's landed cost (goods and its postage), what the card's keep was worked out from.
 */
export function supplierPageOf(c: Json, sources: Json[] = []) {
  const amazon = sources.filter((s) => isAmazon(s.url) && asinOf(s.url));
  const chosen = isAmazon(c.draft?.supplier_url) ? String(c.draft.supplier_url) : null;
  const uk = amazon.filter((s) => isAmazonUk(s.url))
    .sort((a, b) => Number(a.landed_unit_cost ?? a.unit_cost ?? 1e9) - Number(b.landed_unit_cost ?? b.unit_cost ?? 1e9));
  const url = chosen ?? uk[0]?.url ?? amazon[0]?.url ?? null;
  if (!url) return { reason: 'no_amazon' as const };
  if (!isAmazonUk(url)) return { reason: 'not_uk' as const, url };
  const asin = asinOf(url);
  if (!asin) return { reason: 'no_asin' as const, url };
  const source = amazon.find((s) => asinOf(s.url) === asin) ?? null;
  // What a unit costs her from this supplier with its postage, the same figure the card's keep is worked out from.
  const raw = source?.landed_unit_cost ?? source?.unit_cost;
  const costed = raw != null ? Number(raw) : null;
  return { url: pageFor(asin), asin, source_id: source?.id ?? null, costed: Number.isFinite(costed) ? costed : null };
}

// The card's new reading, with the offer before it kept beside it when it is the same product, and the last time her
// cost followed Amazon kept until it moves again.
export function nextRead(prev: Json | null, r: Read, page: { source_id: string | null; costed: number | null }) {
  const same = prev?.asin === r.asin && prev?.offer;
  return {
    ...r,
    source_id: page.source_id,
    costed: page.costed,
    before: same ? { ...prev.offer, read_at: prev.read_at } : null,
    cost_change: prev?.asin === r.asin ? prev?.cost_change ?? null : null,
    // What Keeper asked her to check when it sourced the card (task 02), kept until the page changes.
    keeper_warnings: prev?.asin === r.asin ? prev?.keeper_warnings ?? null : null,
    // The price she was last emailed about (supplier-read), so a cost she set below Amazon's is told once per price.
    told: prev?.asin === r.asin ? prev?.told ?? null : null,
    tried_at: r.read_at,
    error: null,
  };
}

const near = (a: unknown, b: unknown) => a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.015;

// What one unit's goods cost by this reading: the price shown today, deal or not, since that is what she pays for an
// order that comes in now (Joseph, 3 October; replaces "a deal price is not a cost"). When a deal ends the next read
// moves the cost up and says so. Postage apart.
export function goodsOf(offer: Json | null | undefined): number | null {
  if (!offer || offer.price == null) return null;
  return Number(offer.price);
}

/*
 * Her supplier's cost, moved to Amazon's price: from, to and the postage, or null to leave it. It follows when:
 *   the page was found with a price, and the supplier is one of her two Amazon routes:
 *     dropship  Amazon sends to her buyer, and its postage follows too;
 *     stock     she buys on Prime and sends it herself (task 02): free delivery to her and no freight or duty, so
 *               the goods are the whole cost; her postage to the buyer is counted per sale, so postage is left;
 *     stock with freight or duty is an import, not an Amazon price, and is never moved;
 *   she has not set the cost herself (cost_by 'her');
 *   the cost already came from Amazon: marked so, empty, or equal to a price Amazon showed in this reading or the
 *   last one. A cost that matches no Amazon price is one she typed (a trade or Business price), and is hers.
 * Nothing moves when it already matches.
 */
export function costFollow(prev: Json | null, r: Read, source: Json | null) {
  if (!source || !r?.found) return null;
  const route = source.fulfilment ?? 'dropship';
  // Freight on her route from a cost Amazon set is another seller's delivery to her (task 02), and follows the page.
  // Freight or duty on a cost she set is an import, never an Amazon price.
  const imported = source.cost_by !== 'amazon' && (Number(source.inbound_freight_per_unit ?? 0) > 0 || Number(source.duty_pct ?? 0) > 0);
  if (route !== 'dropship' && (route !== 'stock' || imported)) return null;
  const to = goodsOf(r.offer);
  if (to == null || source.cost_by === 'her') return null;
  const now = source.price_at_moq ?? source.unit_cost;
  const seen = [prev?.offer?.price, prev?.offer?.was, r.offer.price, r.offer.was];
  const follows = source.cost_by === 'amazon' || now == null || seen.some((p) => near(p, now));
  if (!follows) return null;
  const shipping = route === 'stock'
    ? (source.supplier_shipping ?? null)
    : r.offer.shipping == null ? (source.supplier_shipping ?? null) : Number(r.offer.shipping);
  // On her route: nothing when Amazon sends it (Prime), else the seller's delivery charge when the page shows one.
  const byAmazon = /amazon/i.test(String(r.offer.fulfilled_by ?? '')) || /^amazon/i.test(String(r.offer.sold_by ?? ''));
  const freight = route === 'stock' && source.cost_by === 'amazon'
    ? (byAmazon || !(Number(r.offer.shipping) > 0) ? null : Number(r.offer.shipping))
    : (source.inbound_freight_per_unit ?? null);
  if (near(now, to) && near(source.supplier_shipping ?? 0, shipping ?? 0) && near(source.inbound_freight_per_unit ?? 0, freight ?? 0)) return null;
  return {
    from: now == null ? null : Number(now),
    to,
    shipping,
    freight,
    // A deal that has ended since the last reading is named, so the warning can say so.
    why: prev?.offer?.deal && !r.offer.deal && to > Number(now ?? 0) ? 'deal_ended' as const : 'price' as const,
  };
}

// A reading that did not come back: the last good one stays, marked as tried, so the daily run moves on.
export function failedRead(prev: Json | null, page: { url: string; asin: string }, error: string, at = new Date().toISOString()) {
  return prev?.asin === page.asin ? { ...prev, tried_at: at, error } : { asin: page.asin, url: page.url, tried_at: at, error, found: null, facts: null, offer: null, risk: null };
}

// London's date, so "read today" turns over at midnight here, not in UTC.
export const londonDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : null);

/*
 * How often the morning check reads a live listing's supplier, in days (Joseey, 7 October: $6 of $10 of Apify gone in
 * days). Daily while there is something to watch: a price or stock that may move, a seller other than Amazon, no main
 * offer (which also costs a second read of the sellers' list), a deal that can end, a cost that moved this week, a
 * reading that failed. Every third day once it is steady: in stock, sent by Amazon, the price as before.
 */
export const WATCH_DAYS = 1;
export const STEADY_DAYS = 3;
const WEEK = 7 * 24 * 3600 * 1000;

export function readEvery(r: Json | null | undefined, now = Date.now()): number {
  if (!r || r.error || r.found === false || !r.offer) return WATCH_DAYS;
  const o = r.offer;
  if (o.price == null || o.from_offers || o.others) return WATCH_DAYS;
  if (['low', 'out', 'slow'].includes(o.stock)) return WATCH_DAYS;
  if (o.deal) return WATCH_DAYS;
  const byAmazon = /amazon/i.test(String(o.fulfilled_by ?? '')) || /^amazon/i.test(String(o.sold_by ?? ''));
  if (o.sold_by && !byAmazon) return WATCH_DAYS;
  if (r.cost_change?.at && now - Date.parse(r.cost_change.at) < WEEK) return WATCH_DAYS;
  if (r.before?.price != null && Math.abs(Number(o.price) - Number(r.before.price)) > 0.01) return WATCH_DAYS;
  return STEADY_DAYS;
}

// Whole UK days between two times: a read at 11pm and one at 7am the next morning are a day apart.
const dayNumber = (iso: string) => {
  const [d, m, y] = String(londonDay(iso)).split('/').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

// Due this morning: never read, or its days are up.
export function readDue(r: Json | null | undefined, now = Date.now()): boolean {
  const last = r?.tried_at ?? r?.read_at ?? null;
  if (!last) return true;
  return dayNumber(new Date(now).toISOString()) - dayNumber(last) >= readEvery(r, now);
}
