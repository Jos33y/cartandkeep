/*
 * Reading one shop product page: its name, price with VAT, stock, brand, barcode and photo.
 * Shared by check-picks (store picks) and fill-costs (eBay cards seen at shops with no price on file).
 *
 * VAT: a cost is what she pays, so it carries VAT. Trade shops show prices without it by default, so their
 * figure gains 20%, as does any page whose structured data says VAT is not included.
 */

export const decode = (s) => String(s ?? '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// Shops whose pages price without VAT. Add a host here when a shop is found doing it.
export const EX_VAT_HOSTS = /(^|\.)(cpc\.farnell\.com|uk\.farnell\.com|farnell\.com|rs-online\.com|cef\.co\.uk|tlc-direct\.co\.uk)$/i;
export const VAT = 1.2;

const ogImage = (html) => decode(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? '');
// Where a page keeps its price when its structured data has none: meta tags, itemprop, then Magento's
// data-price-amount (Harts of Stur) and a "price" field in the page's own data (Studio).
const metaPrice = (html) => (
  html.match(/<meta[^>]+(?:property|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([\d.,]+)/i)?.[1]
  ?? html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)/i)?.[1]
  ?? html.match(/data-price-type=["']finalPrice["'][^>]*data-price-amount=["']([\d.]+)/i)?.[1]
  ?? html.match(/data-price-amount=["']([\d.]+)["'][^>]*data-price-type=["']finalPrice/i)?.[1]
  ?? html.match(/"(?:price|salePrice|currentPrice)"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?\s*,\s*"(?:currency|priceCurrency|currencyCode)"\s*:\s*"GBP"/i)?.[1]
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
  return { name: decode(og ?? title ?? ''), price: metaPrice(html), exVat: false, stock: '', brand: '', gtin: metaGtin(html), image: ogImage(html) };
}

// The price she would pay, VAT in. Null when the page gives none.
export function paidPrice(page, url) {
  const n = Number(String(page?.price ?? '').replace(/[^\d.]/g, ''));
  if (!(n > 0)) return null;
  let host = '';
  try { host = new URL(url).hostname; } catch { /* no host, no VAT rule */ }
  const addVat = page.exVat || EX_VAT_HOSTS.test(host);
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
