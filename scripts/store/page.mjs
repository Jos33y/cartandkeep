/*
 * Reading one shop product page: its name, price with VAT, stock, brand, barcode and photo.
 * Shared by check-picks (store picks) and fill-costs (eBay cards seen at shops with no price on file).
 *
 * VAT: a cost is what she pays, so it carries VAT. Trade shops show prices without it by default, so their
 * figure gains 20%, as does any page whose structured data says VAT is not included.
 */

export const decode = (s) => String(s ?? '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// Shops whose pages price without VAT. Add a host here when a shop is found doing it (Medisave: shelf £7.99, page £9.59 inc VAT).
export const EX_VAT_HOSTS = /(^|\.)(cpc\.farnell\.com|uk\.farnell\.com|farnell\.com|rs-online\.com|cef\.co\.uk|tlc-direct\.co\.uk|medisave\.co\.uk)$/i;
export const VAT = 1.2;
/*
 * Care shops that show the disability VAT-relief price by default: the figure on the page and in the shop's feed
 * has no VAT, and she pays VAT buying for resale. Complete Care Shop's Blue Badge wallet reads "Now £12.66" with
 * "Eligible for VAT relief" selected; the full price £15.83 is £18.99 less VAT. Check a shop with vat-check.mjs
 * before adding it.
 */
// Checked with vat-check.mjs on 30 September: Manage at Home ("£190.83 with VAT Relief, £229"), Miller Care ("Price
// Shown Already Excludes VAT") and Ability Superstore (shelf £19.99, page "£23.99 including VAT") do the same. On a
// product not eligible for relief the shop's price already has VAT, so adding it over-costs that product: the safe side.
export const VAT_RELIEF_HOSTS = /(^|\.)(completecareshop\.co\.uk|manageathome\.co\.uk|millercare\.[a-z.]+|abilitysuperstore\.[a-z.]+)$/i;
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };
// A shelf or page price as she would pay it: VAT added for trade and VAT-relief shops.
export function withVat(price, url) {
  const n = Number(price);
  if (!(n > 0)) return null;
  const h = hostOf(url);
  const add = EX_VAT_HOSTS.test(h) || VAT_RELIEF_HOSTS.test(h);
  return { price: Math.round(n * (add ? VAT : 1) * 100) / 100, vatAdded: add };
}

const ogImage = (html) => decode(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? '');
// Where a page keeps its price when its structured data has none: meta tags, itemprop, then Magento's
// data-price-amount (Harts of Stur) and a "price" field in the page's own data (Studio).
const metaPrice = (html) => (
  html.match(/<meta[^>]+(?:property|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([\d.,]+)/i)?.[1]
  ?? html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)/i)?.[1]
  ?? html.match(/data-price-type=["']finalPrice["'][^>]*data-price-amount=["']([\d.]+)/i)?.[1]
  ?? html.match(/data-price-amount=["']([\d.]+)["'][^>]*data-price-type=["']finalPrice/i)?.[1]
  ?? html.match(/"(?:price|salePrice|currentPrice)"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?\s*,\s*"(?:currency|priceCurrency|currencyCode)"\s*:\s*"GBP"/i)?.[1]
  // The Entertainer: no Product data at all, the price sits on the price block ("data-pricePDP="50.0"").
  ?? html.match(/data-pricePDP=["']([\d.]+)/i)?.[1]
  // Studio: the analytics "detail" block names the product being viewed ("detail":{...,"products":[{...,"price":"22.99"}).
  // Only the detail block, never a list of other products on the page.
  ?? html.match(/"detail"\s*:\s*\{\s*"actionField"\s*:\s*\{[^}]*\}\s*,\s*"products"\s*:\s*\[\s*\{[^\]]*?"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)/i)?.[1]
  ?? ''
).replace(/,/g, '');

// A barcode kept outside the structured data: itemprop or meta gtin tags, or a "gtin13"/"ean" field in the page's own data.
const metaGtin = (html) => String(
  html.match(/itemprop=["']gtin(?:13|12|14|8)?["'][^>]*content=["'](\d{8,14})/i)?.[1]
  ?? html.match(/content=["'](\d{8,14})["'][^>]*itemprop=["']gtin(?:13|12|14|8)?["']/i)?.[1]
  ?? html.match(/<meta[^>]+(?:property|name)=["'](?:product:)?(?:gtin13|gtin|ean)["'][^>]+content=["'](\d{8,14})/i)?.[1]
  ?? html.match(/"(?:gtin13|gtin|ean|barcode)"\s*:\s*"(\d{8,14})"/i)?.[1]
  ?? '',
);

// Stock outside the structured data: The Entertainer marks the product data-productavailable="true|false".
const metaStock = (html) => {
  const m = html.match(/data-productavailable=["'](true|false)["']/i)?.[1];
  return m == null ? '' : m.toLowerCase() === 'true' ? 'InStock' : 'OutOfStock';
};

// The product as the page states it: structured data first, then meta tags and the page title.
export function readPage(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const nodes = [data].flat().flatMap((d) => (d?.['@graph'] ? d['@graph'] : [d]));
    const p = nodes.find((n) => [n?.['@type']].flat().includes('Product'));
    if (!p) continue;
    const offer = [p.offers].flat()[0] ?? {};
    const img = [p.image].flat()[0];
    const spec = [offer.priceSpecification].flat()[0] ?? {};
    return {
      name: decode(p.name),
      price: offer.price || offer.lowPrice || spec.price || metaPrice(html),
      exVat: spec.valueAddedTaxIncluded === false || spec.valueAddedTaxIncluded === 'false',
      stock: String(offer.availability ?? '').replace(/.*\//, ''),
      brand: decode(typeof p.brand === 'string' ? p.brand : p.brand?.name ?? ''),
      gtin: String(p.gtin13 ?? p.gtin ?? p.gtin12 ?? p.gtin14 ?? p.gtin8 ?? offer.gtin13 ?? offer.gtin ?? '').replace(/\D/g, '') || metaGtin(html),
      image: decode(typeof img === 'string' ? img : img?.url ?? '') || ogImage(html),
    };
  }
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  const title = html.match(/<title[^>]*>([^<]+)/i)?.[1];
  // A <title> carries the shop's name after a bar ("Catan 6th Edition Game | The Entertainer"); og:title does not.
  return { name: decode(og ?? String(title ?? '').replace(/\s+\|\s+[^|]+$/, '')), price: metaPrice(html), exVat: false, stock: metaStock(html), brand: '', gtin: metaGtin(html), image: ogImage(html) };
}

// The price she would pay, VAT in. Null when the page gives none.
export function paidPrice(page, url) {
  const n = Number(String(page?.price ?? '').replace(/[^\d.]/g, ''));
  if (!(n > 0)) return null;
  let host = '';
  try { host = new URL(url).hostname; } catch { /* no host, no VAT rule */ }
  const addVat = page.exVat || EX_VAT_HOSTS.test(host) || VAT_RELIEF_HOSTS.test(host);
  return { price: Math.round(n * (addVat ? VAT : 1) * 100) / 100, vatAdded: addVat };
}

// One polite fetch. A block (403, 429, 503) is reported so the caller stops asking that shop.
export async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CartAndKeepResearch/1.0', 'Accept-Language': 'en-GB' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if ([403, 429, 503].includes(res.status)) return { blocked: res.status };
    if (!res.ok) return { gone: res.status };
    return { page: readPage(await res.text()) };
  } catch (e) {
    return { failed: e.name };
  }
}
