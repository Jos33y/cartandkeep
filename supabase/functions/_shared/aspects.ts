// eBay's item details (Type, Brand, Colour), filled from the facts on the card, never guessed. Choices from eBay's
// own list come back exactly as eBay spells them; a value the facts do not support is left for her.

import { itemFactsOf, listingOf, swappedTo } from './product.ts';
import { cleanAspects } from './ebay/item.ts';
import { askTool } from './claude.ts';

type Json = Record<string, any>;
export type Wanted = { name: string; mode: string; values: string[]; required: boolean };

export const ASPECT_SYSTEM = `You fill in eBay UK item specifics for a product listing, from the facts given and nothing else.

Rules:
- Classification specifics say what the product is: Type, Product type, Style, Department, Room, Suitable for. These
  may be chosen from what the product plainly is, when the facts make it clear.
- Specifications must be stated in the facts: size, capacity, volume, weight, dimensions, colour, material, power
  source, voltage, count, pack size, model, features, ingredients. If a fact does not say it, leave that one out.
- When allowed values are listed, answer with one of them exactly as written. Pick the closest honest one; if none
  honestly fits, leave it out.
- Otherwise a short value in British English, under 65 characters.
- Never invent, never pad. Leaving a specific out is always better than a guess: the seller fills it in.`;

const TOOL = {
  name: 'fill',
  description: 'Item specifics the facts support.',
  input_schema: {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, value: { type: 'string' } },
          required: ['name', 'value'],
        },
      },
    },
    required: ['values'],
  },
};

// The model's answer, held to eBay's list: a choice not on it is dropped; a free value is trimmed and capped.
export function keepValid(answer: Array<{ name?: string; value?: string }>, wanted: Wanted[]) {
  const out: Record<string, string> = {};
  const byName = new Map(wanted.map((w) => [w.name.toLowerCase(), w]));
  for (const a of answer ?? []) {
    const w = byName.get(String(a?.name ?? '').trim().toLowerCase());
    const v = String(a?.value ?? '').trim();
    if (!w || !v || /^(unknown|n\/a|none|not stated|does not apply)$/i.test(v)) continue;
    if (w.values.length && w.mode === 'SELECTION_ONLY') {
      const hit = w.values.find((x) => x.toLowerCase() === v.toLowerCase());
      if (hit) out[w.name] = hit;
      continue;
    }
    const listed = w.values.find((x) => x.toLowerCase() === v.toLowerCase());
    out[w.name] = listed ?? v.slice(0, 65);
  }
  return out;
}

// The facts the model may use, in one block.
export function aspectFacts(c: Json, draft: Json = {}, category: string | null = null) {
  const l = listingOf({ ...c, draft: { ...(c.draft ?? {}), ...draft } }) ?? {};
  const f = itemFactsOf({ ...c, draft: { ...(c.draft ?? {}), ...draft } }) ?? {};
  const held = Object.entries(cleanAspects(f.aspects ?? {})).map(([k, v]) => `${k}=${v}`).join('; ');
  const supplier = String({ ...(c.draft ?? {}), ...draft }.supplier_text ?? '').trim();
  return [
    ['eBay category', category],
    ['From her supplier (the product she sends; trust this first)', supplier ? supplier.slice(0, 2000) : null],
    ['Her title', draft.title],
    ['Her description', draft.description],
    ['Shop title', l.title],
    ['Brand', l.brand ?? f.brand],
    ['Model', f.mpn],
    ['Barcode', f.gtin],
    ['Shop category', l.shop_category],
    ['Shop description', l.description],
    ['Features', Array.isArray(l.features) ? l.features.join('; ') : null],
    // The eBay listing the card was moved to: what eBay holds for that product.
    ['Another eBay seller\'s item details (often wrong; use only what agrees with the rest)', held || null],
    // Once moved to another product, the research's title is the old one.
    ['Research title', swappedTo({ ...c, draft: { ...(c.draft ?? {}), ...draft } }) ? null : c.title],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}

export async function fillAspects(key: string, facts: string, wanted: Wanted[]): Promise<Record<string, string>> {
  if (!wanted.length || !facts) return {};
  const list = wanted.map((w) => `- ${w.name}${w.required ? ' (required)' : ''}${w.values.length ? `: ${w.mode === 'SELECTION_ONLY' ? 'one of' : 'for example'} ${w.values.join(' | ')}` : ''}`).join('\n');
  const { input } = await askTool(key, { system: ASPECT_SYSTEM, content: `Facts:\n${facts}\n\nItem specifics to fill:\n${list}`, maxTokens: 800, tool: TOOL });
  return keepValid(input?.values ?? [], wanted);
}
