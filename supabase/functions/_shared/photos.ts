// Which photos may go up, and Keepr's check of a shop's photos. Pure rules here, so the portal's copy in
// src/lib/photos.js, the eBay function and the check itself agree, and the tests can hold them to it.
//
// A photo goes up when it is one of three things:
//   hers:      she uploaded it (her folder in listing-images, or listed in draft.uploads);
//   shop:      a photo from the shop's page that Keepr passed on this card, or our copy of it;
//   catalogue: eBay's own catalogue photo for the card's barcode, on eBay only.
// Anything else is refused, including the eBay seller's photo the research found: copying another eBay seller's
// photos is what gets listings reported.

type Json = Record<string, any>;

// eBay's rule: at least 500 pixels on the longest side.
export const MIN_SIDE = 500;
// Anthropic takes images up to 5MB; base64 adds a third.
export const MAX_BYTES = 3_700_000;
// Enough to reach past the hero shot, not every angle.
export const MAX_PHOTOS = 8;

// Her folder holds her uploads and, under shop/, the copies of shop photos Keepr passed. Only the first are hers.
export const isHers = (url: string, draft: Json = {}) =>
  (draft.uploads ?? []).includes(url)
  || (/\/storage\/v1\/object\/public\/listing-images\//.test(url) && !/\/shop\/[^/]+$/.test(url));

// Where each photo in a list comes from, and whether it may go up on this channel.
export function sourceOf(url: string, c: Json, channel: 'ebay' | 'shop' = 'ebay') {
  const d = c.draft ?? {};
  if (isHers(url, d)) return { url, source: 'hers', ok: true } as const;
  const pc = c.photo_checks ?? {};
  if ((pc.catalogue?.images ?? []).includes(url) || (d.catalogue?.images ?? []).includes(url)) {
    return channel === 'ebay'
      ? { url, source: 'catalogue', ok: true } as const
      : { url, source: 'catalogue', ok: false, why: 'eBay\'s catalogue photos are for eBay only' } as const;
  }
  const seen = (pc.images ?? []).find((i: Json) => i.url === url || i.copy === url);
  if (seen) {
    if (pc.brand_rule) return { url, source: 'shop', ok: false, why: `${pc.brand} photos come from eBay's catalogue or yours, not the shop's` } as const;
    return seen.ok
      ? { url, source: 'shop', ok: true } as const
      : { url, source: 'shop', ok: false, why: (seen.reasons ?? [])[0] ?? 'failed the photo check' } as const;
  }
  const shops = new Set([...(c.listing?.images ?? [])]);
  if (shops.has(url)) return { url, source: 'shop', ok: false, why: 'not checked yet' } as const;
  return { url, source: 'other', ok: false, why: 'not hers, not checked, and not from the catalogue' } as const;
}

// One word for what went up, for counting later: which sources hold up, brand by brand.
export function photoSource(sources: Array<{ source: string }>) {
  const kinds = [...new Set(sources.map((s) => s.source))];
  return kinds.length === 0 ? 'none' : kinds.length === 1 ? kinds[0] : 'mixed';
}

// The brand on a rule, when the card's brand or title names it as a word.
export function brandRuleFor(rules: Array<{ brand: string; rule: string }>, brand: unknown, title: unknown) {
  const text = `${brand ?? ''} ${title ?? ''}`.toLowerCase();
  for (const r of rules) {
    const b = r.brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${b}([^a-z0-9]|$)`).test(text)) return r;
  }
  return null;
}

// Width and height from the first bytes of a JPEG, PNG, GIF or WebP, without an image library.
export function imageSize(b: Uint8Array): { width: number; height: number; type: string } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { type: 'image/png', width: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, height: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
  }
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { type: 'image/gif', width: le16(6), height: le16(8) };
  }
  if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === 'VP8 ') return { type: 'image/webp', width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8X') return { type: 'image/webp', width: le24(24) + 1, height: le24(27) + 1 };
    return null;
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      // Start-of-frame markers carry the size; the rest are skipped by their length.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'image/jpeg', height: u16(i + 5), width: u16(i + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + u16(i + 2);
    }
  }
  return null;
}

// What Keepr is asked, per photo. The pass rule is applied here, not left to the model.
export const PHOTO_SYSTEM = `You check product photos from a UK shop's product page before a reseller uses them on
eBay and on her own shop. Look at each photo and report what you see. Do not judge whether to use it.

For each photo, report:
- shop_mark: the shop's name, logo or any retailer's branding is visible anywhere, including corners and the
  packaging background. The product's own brand on its own packaging is NOT a shop mark.
- watermark: any watermark, semi-transparent text or pattern laid over the image.
- overlay: text or badges laid over the photo that are not printed on the product: prices, "offer", "bestseller",
  "new", stars, icons, arrows, feature callouts.
- background: "plain" for a product shot on a plain or white background, "scene" for a styled or lifestyle scene,
  a room, a person, or a hand.
- shows: "product" if the product or its packaging is the subject, "other" if it is a chart, a size guide, a
  diagram, a certificate, or something else.
- pack: compare against the expected product. "matches" if what is shown is consistent with it, "differs" if the
  photo shows a different size, count, pack, colour, model or product, "unclear" if you cannot tell.
- note: at most 12 words on what decided anything you flagged. Empty if nothing was flagged.

Reply with JSON only, no preamble and no markdown fence: an array with one object per photo, in order, each
{"n": 1, "shop_mark": false, "watermark": false, "overlay": false, "background": "plain", "shows": "product",
"pack": "matches", "note": ""}.`;

export type Seen = {
  n?: number; shop_mark?: boolean; watermark?: boolean; overlay?: boolean;
  background?: string; shows?: string; pack?: string; note?: string;
};

// Pass or fail, with her reasons in plain words, from what Keepr saw and the image's size.
export function judge(seen: Seen | null, size: { width: number; height: number } | null, _shop: string | null = null) {
  const reasons: string[] = [];
  if (size && Math.max(size.width, size.height) < MIN_SIDE) reasons.push(`Too small for eBay, ${size.width} x ${size.height}`);
  if (!seen) {
    reasons.push('Could not be checked');
    return { ok: false, reasons };
  }
  if (seen.shop_mark) reasons.push('Shop\'s name or logo on it');
  if (seen.watermark) reasons.push('Watermarked');
  if (seen.overlay) reasons.push('Has text or a sticker laid over it');
  if (seen.shows === 'other') reasons.push('Not a photo of the product');
  else if (seen.background !== 'plain') reasons.push('A styled scene, not a plain product shot');
  if (seen.pack === 'differs') reasons.push(`A different pack or product${seen.note ? `: ${seen.note}` : ''}`);
  return { ok: reasons.length === 0, reasons };
}

// The model's list, even with a sentence or a fence around it.
export function parseSeen(text: string): Seen[] | null {
  const t = text.replace(/```json|```/g, '').trim();
  for (const s of [t, t.slice(t.indexOf('['), t.lastIndexOf(']') + 1)]) {
    try { const v = JSON.parse(s); if (Array.isArray(v)) return v; } catch { /* the next form */ }
  }
  return null;
}

// A Shopify image asks for a smaller copy by width, which keeps it under the size limit.
export function smaller(url: string) {
  if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) return null;
  const u = new URL(url);
  u.searchParams.set('width', '1600');
  return u.toString();
}

export function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
