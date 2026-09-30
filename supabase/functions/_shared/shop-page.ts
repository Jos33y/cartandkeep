// A shop's product page, read once into the card's `listing`: the facts her copy is written from, never copy that
// goes up. Shared so every function reads a page the same way.

type Json = Record<string, any>;

// Which way of reading a page made a card's listing. 2 reads the whole photo gallery (30 September 2026); a listing
// read before that is read again when its photos are checked.
export const READER = 2;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export const plain = (html: unknown) => String(html ?? '')
  .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const bullets = (d: string) => d.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()).filter(Boolean);

// A shop's own name in the brand field would put another retailer's name in her title.
const squash = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function brandOf(brand: unknown, url: string) {
  const host = squash(new URL(url).hostname.replace(/^www\./, '').split('.')[0]);
  const b = squash(brand);
  return b && host && (b === host || host.includes(b) || b.includes(host)) ? null : (brand as string) || null;
}

// A barcode as printed, digits only, 8 to 14 long; anything else is not one.
const barcode = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 14 ? d : null;
};

/*
 * The page a card was costed from. eBay cards keep it on the shelf they were priced against; shop cards, found on
 * Google, keep it on the page their cost came from. Before 1 October only the first was read, so a shop card had
 * no page and nothing to write from.
 */
export function pageUrlOf(c: Json): string | null {
  const m = c.margin ?? {};
  // Her supplier's page, when she chose it for the listing: the product she will actually send.
  for (const u of [c.draft?.page, m.shelf?.url, m.cost_from?.url]) {
    if (typeof u === 'string' && /^https?:\/\//.test(u)) return u;
  }
  return null;
}

export type Fetcher = (url: string, accept: string) => Promise<string | null>;

export const fetchText: Fetcher = async (url, accept) => {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'en-GB,en;q=0.9', accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  return res.ok ? await res.text() : null;
};

// Shopify's own feed first, which is exact (and carries the barcode); a page's structured data otherwise.
export async function readShopPage(url: string, get: Fetcher = fetchText): Promise<Json | null> {
  const clean = url.split('?')[0].split('#')[0].replace(/\/$/, '');
  let read: Json | null = null;

  if (/\/products\//.test(clean)) {
    const body = await get(`${clean}.json`, 'application/json').catch(() => null);
    let p: Json | null = null;
    try { p = body ? JSON.parse(body)?.product ?? null : null; } catch { p = null; }
    if (p) {
      const description = plain(p.body_html);
      const v = p.variants?.[0] ?? {};
      read = {
        title: p.title,
        brand: p.vendor || null,
        images: (p.images ?? []).map((i: { src?: string }) => i.src).filter(Boolean),
        description,
        features: bullets(description),
        shop_category: p.product_type || null,
        product_code: v.sku || null,
        gtin: barcode(v.barcode),
        in_stock: v.available ?? null,
      };
    }
  }

  if (!read) {
    const html = await get(url, 'text/html').catch(() => null);
    if (!html) return null;
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .flatMap((m) => { try { const j = JSON.parse(m[1]); return Array.isArray(j) ? j : j['@graph'] ?? [j]; } catch { return []; } });
    const p = blocks.find((b) => ([] as unknown[]).concat(b['@type']).includes('Product'));
    if (!p) return null;
    const crumbs = blocks.find((b) => ([] as unknown[]).concat(b['@type']).includes('BreadcrumbList'));
    const description = plain(p.description);
    const offer = ([] as Json[]).concat(p.offers ?? [])[0] ?? {};
    const main = ([] as unknown[]).concat(p.image ?? []).map((i) => (typeof i === 'string' ? i : (i as { url?: string })?.url)).filter(Boolean) as string[];
    read = {
      title: p.name,
      brand: typeof p.brand === 'string' ? p.brand : p.brand?.name ?? null,
      // Structured data usually names only the main photo; the gallery is in the page.
      images: galleryOf(html, url, main),
      description,
      features: bullets(description),
      shop_category: crumbs?.itemListElement?.map((e: { name?: string; item?: { name?: string } }) => e.name ?? e.item?.name)
        .filter(Boolean).slice(-2, -1)[0] ?? null,
      product_code: p.sku ?? p.mpn ?? null,
      gtin: barcode(p.gtin13 ?? p.gtin ?? p.gtin14 ?? p.gtin12 ?? p.gtin8 ?? offer.gtin13 ?? offer.gtin),
    };
  }

  return { ...read, brand: brandOf(read.brand, url), summary: null, unit_price: null, source_url: url, read_at: new Date().toISOString(), reader: READER };
}

const IMAGE = /\.(jpe?g|png|webp)(\?|$)/i;
const NOT_PRODUCT = /(logo|icon|sprite|badge|payment|paypal|klarna|visa|mastercard|flag|trustpilot|banner|placeholder|loader|spinner|avatar|social|facebook|twitter|instagram|youtube|pixel|blank|swatch|rating|star)/i;

// Every photo of the product the page shows, main first: its structured data, then zoom and large-image links,
// then images from the same folder as the main one or a product media folder. Sizes of one photo count once.
export function galleryOf(html: string, pageUrl: string, main: string[] = []) {
  const abs = (u: string) => { try { return new URL(u.replace(/&amp;/g, '&'), pageUrl).toString(); } catch { return null; } };
  const found: string[] = [...main];
  const attr = /(?:data-(?:zoom-image|zoom|large(?:-image)?|full(?:-image)?|image|src|original|lazy)|content|href|src|srcset)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(attr)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u && IMAGE.test(u)) found.push(u);
    }
  }
  const folder = (u: string) => { try { return new URL(u).pathname.replace(/\/cache\/[^/]+/, '').replace(/[^/]+$/, ''); } catch { return ''; } };
  const mainFolders = new Set(main.map((u) => abs(u)).filter(Boolean).map((u) => folder(u!)));
  // One photo in several sizes counts once: the name without the size parts and the query.
  const key = (u: string) => { try { return new URL(u).pathname.split('/').pop()!.replace(/[-_]?(\d{2,4}x\d{2,4}|small|medium|large|thumb(nail)?|zoom)(?=\.)/gi, '').toLowerCase(); } catch { return u; } };
  const out = new Map<string, string>();
  for (const raw of found) {
    const u = abs(raw);
    if (!u || NOT_PRODUCT.test(u)) continue;
    const path = new URL(u).pathname;
    const product = mainFolders.has(folder(u)) || /\/(catalog\/product|products?|media\/product|images\/product|product[-_]?images?)\//i.test(path) || main.includes(raw);
    if (!product) continue;
    const k = key(u);
    // The bigger copy wins: a zoom or large link over a thumbnail of the same photo.
    if (!out.has(k) || /zoom|large|full|original/i.test(raw)) out.set(k, u);
  }
  return [...out.values()].slice(0, 8);
}

// The model is asked for a JSON array. A sentence around it, or a fence, should not lose four good titles.
export function parseTitles(text: string): string[] | null {
  const t = text.replace(/```json|```/g, '').trim();
  const candidates = [t, t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
    } catch { /* the next form */ }
  }
  return null;
}
