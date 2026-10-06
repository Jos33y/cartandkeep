// Keepr's judgement of whether an eBay listing sells the product she sources. Used to move a card to a listing:
// at 95 or more Keepr moves it itself, under that it suggests the listing and she decides.

import { askTool } from './claude.ts';
import { matchScore } from './match.ts';
import { forLooking } from './look-size.ts';

type Json = Record<string, any>;

export const AUTO_SWAP = 0.95;

export const SAME_SYSTEM = `You compare a product a UK seller can buy from her supplier with eBay listings, and say how sure you are that each listing sells exactly the same product.

Exactly the same means: the same brand, the same model or range, the same size, pack count or quantity, and the same variant where the variant changes what the buyer gets (a set of 2 is not a single; 500ml is not 1 litre). A colour difference counts only when the supplier product names one colour and the listing names another.

How sure, as a whole number from 0 to 100:
- 95 to 100 only when brand, model and pack all agree in the text or the photos and nothing contradicts them.
- 80 to 94 when it is very likely the same but one detail cannot be confirmed (pack not stated on one side, for example).
- 50 to 79 when it is the same kind of product and brand but the model or pack is unclear.
- Under 50 when it is a different product, a different pack, an accessory for it, or a bundle with other things.
A bundle, a refill, a spare part or a listing "for" or "compatible with" the product is never the same product.
Photos are evidence like the text. Never raise a score because a listing sells well.
Say why in eight words or fewer each, in British English.`;

const TOOL = {
  name: 'judge',
  description: 'How sure you are that each listing sells exactly the supplier product.',
  input_schema: {
    type: 'object',
    properties: {
      verdicts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item_id: { type: 'string' },
            sure: { type: 'integer', minimum: 0, maximum: 100 },
            why: { type: 'string' },
          },
          required: ['item_id', 'sure', 'why'],
        },
      },
    },
    required: ['verdicts'],
  },
};

const line = (k: string, v: unknown) => (v == null || v === '' ? null : `${k}: ${v}`);

export function describeProduct(p: Json) {
  return [
    line('Title', p.title), line('Brand', p.brand), line('Barcode', p.gtin), line('Model', p.mpn),
    line('Description', p.description ? String(p.description).slice(0, 700) : null),
  ].filter(Boolean).join('\n');
}

export function describeListing(l: Json) {
  const f = l.facts ?? {};
  const aspects = Object.entries(f.aspects ?? {}).slice(0, 15).map(([k, v]) => `${k}=${v}`).join('; ');
  return [
    line('Item', l.entry.item_id), line('Title', l.entry.title), line('Brand', f.brand), line('Barcode', f.gtin),
    line('Model', f.mpn), line('Item details', aspects || null), line('Category', f.category),
  ].filter(Boolean).join('\n');
}

// The verdicts as the card keeps them. A fact that rules a listing out (another barcode, another model number,
// another pack) caps it under the line Keepr acts on, whatever the model said; a shared barcode is certain.
export function settle(product: Json, listings: Json[], said: Json[]): Json[] {
  return listings.map((l): Json => {
    const reading = matchScore(product, { title: l.entry.title, brand: l.facts?.brand, gtin: l.facts?.gtin });
    const v = said.find((x) => String(x?.item_id) === String(l.entry.item_id));
    let sure = v ? Math.max(0, Math.min(100, Number(v.sure) || 0)) / 100 : reading.score * 0.9;
    let why = v?.why ? String(v.why).slice(0, 240) : `Read from the titles: ${reading.via}.`;
    if (reading.score === 1) { sure = 1; why = 'The same barcode.'; }
    if (reading.rules_out) { sure = Math.min(sure, 0.4); why = `Not the same: ${reading.via}.`; }
    return { ...l, sure: Math.round(sure * 100) / 100, why };
  }).sort((a, b) => b.sure - a.sure || Number(b.entry.proved) - Number(a.entry.proved) || (b.entry.per_day ?? 0) - (a.entry.per_day ?? 0));
}

export async function judgeSame(key: string, product: Json, listings: Json[], lessons: string | null = null): Promise<Json[]> {
  if (!listings.length) return [];
  const images = [product.image, ...listings.map((l) => l.entry.image_url)].filter((u) => typeof u === 'string' && /^https:\/\//.test(u))
    .map((u) => forLooking(u, 500) ?? u);
  const text = `The supplier product:\n${describeProduct(product)}\n\n${listings.map((l, i) => `Listing ${i + 1}\n${describeListing(l)}`).join('\n\n')}`
    + (images.length ? `\n\nPhotos, in order: ${product.image ? 'the supplier product, then ' : ''}each listing that has one.` : '')
    // What Keeper has learned about matching her cards (keeper_lessons, area match): how she judges, never facts.
    + (lessons ? `\n\nWHAT KEEPER HAS LEARNED about matching her cards (follow where it fits; never facts about this product):\n${String(lessons).slice(0, 1500)}` : '');
  const ask = async (withImages: boolean) => {
    const { input } = await askTool(key, {
      system: SAME_SYSTEM,
      maxTokens: 900,
      tool: TOOL,
      content: [
        ...(withImages ? images.map((url) => ({ type: 'image', source: { type: 'url', url } })) : []),
        { type: 'text', text },
      ],
    });
    return (input?.verdicts ?? []) as Json[];
  };
  // The words first (4 October: photos were most of the bill). Only when they leave a listing in doubt, sure enough
  // to matter but not enough to move the card, is it asked again with the photos.
  const words = await ask(false);
  const unsure = words.some((v) => Number(v?.sure) >= 50 && Number(v?.sure) < 95);
  if (!images.length || !unsure) return words;
  try {
    return await ask(true);
  } catch (e) {
    // A photo the model cannot fetch should not cost the judgement: the words stand.
    if (/image|media|url|fetch/i.test(e instanceof Error ? e.message : String(e))) return words;
    throw e;
  }
}

// The supplier product's name from its web address, when the page cannot be read: Amazon and most shops put the
// product's words in the path ("/Beurer-MG-16-Mini-Massager/dp/B00..."). Never a guess beyond those words.
export function titleFromUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const named = parts.filter((p) => /[a-z]/i.test(p) && /[-_]/.test(p) && !/^(dp|gp|product|products|p|item|itm|ref=.*)$/i.test(p));
    const best = named.sort((a, b) => b.length - a.length)[0];
    if (!best) return null;
    const words = decodeURIComponent(best).replace(/\.(html?|aspx|php)$/i, '').split(/[-_+]+/).filter(Boolean);
    return words.length >= 2 ? words.join(' ').slice(0, 120) : null;
  } catch {
    return null;
  }
}
