// eBay's item details (Type, Brand, Colour), filled from the facts on the card, never guessed. Choices from eBay's
// own list come back exactly as eBay spells them; a value the facts do not support is left for her.

import { MODEL } from './model.ts';

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
  const l = c.listing ?? {};
  return [
    ['eBay category', category],
    ['Her title', draft.title],
    ['Her description', draft.description],
    ['Shop title', l.title],
    ['Brand', l.brand],
    ['Shop category', l.shop_category],
    ['Shop description', l.description],
    ['Features', Array.isArray(l.features) ? l.features.join('; ') : null],
    ['Research title', c.title],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}

export async function fillAspects(key: string, facts: string, wanted: Wanted[]): Promise<Record<string, string>> {
  if (!wanted.length || !facts) return {};
  const list = wanted.map((w) => `- ${w.name}${w.required ? ' (required)' : ''}${w.values.length ? `: ${w.mode === 'SELECTION_ONLY' ? 'one of' : 'for example'} ${w.values.join(' | ')}` : ''}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: ASPECT_SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'fill' },
      messages: [{ role: 'user', content: `Facts:\n${facts}\n\nItem specifics to fill:\n${list}` }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `Anthropic returned ${res.status}`);
  const call = (body.content ?? []).find((b: Json) => b.type === 'tool_use');
  return keepValid(call?.input?.values ?? [], wanted);
}
