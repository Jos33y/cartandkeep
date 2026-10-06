// Every call to Claude from the functions, in one place, written for Claude Sonnet 5.5 (1 October 2026).
//
// Sonnet 5.5 changed three things these calls relied on:
//   - forcing a tool (tool_choice "tool" or "any") is refused, so a tool is offered with tool_choice "auto",
//     marked strict so its answer always fits the schema, and the prompt says to use it;
//   - thinking runs unless told otherwise, and these are extraction jobs, so it is kept to between_tools, the
//     lowest setting, which keeps output tokens (and the bill) where they were;
//   - non-default temperature and top_p are refused; none are sent.
// The draft function keeps its own copy of this (it deploys as one folder); change both together.

import { MODEL } from './model.ts';
import { note } from './usage.ts';

type Json = Record<string, any>;

export const THINKING = { type: 'between_tools' };

// Keywords strict schemas do not take. What they said moves into the description, where the model still reads it.
const UNSUPPORTED = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'multipleOf'];

/*
 * A schema strict tool use accepts: every object closed (additionalProperties false) and every property required,
 * so no optional parameters count against the limit of 24. Answers that may be empty are empty strings or arrays.
 */
export function strictSchema(s: Json): Json {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(strictSchema);
  const out: Json = {};
  const notes: string[] = [];
  for (const [k, v] of Object.entries(s)) {
    if (UNSUPPORTED.includes(k)) { notes.push(`${k} ${v}`); continue; }
    if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v as Json).map(([p, sub]) => [p, strictSchema(sub as Json)]));
    else if (k === 'items') out.items = strictSchema(v as Json);
    else out[k] = v;
  }
  if (notes.length) out.description = [out.description, `(${notes.join(', ')})`].filter(Boolean).join(' ');
  if (out.type === 'object' && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

export const strictTool = (tool: Json): Json => ({ ...tool, strict: true, input_schema: strictSchema(tool.input_schema) });

type Content = string | Json[];
const withAsk = (content: Content, ask: string): Json[] => (
  typeof content === 'string' ? [{ type: 'text', text: `${content}\n\n${ask}` }] : [...content, { type: 'text', text: ask }]
);

export async function post(key: string, body: Json) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  // Counted for whoever asked: the request, or the card Keeper is working on (usage.ts).
  note(payload?.usage, body?.model);
  if (!res.ok) {
    const e = new Error(payload?.error?.message ?? `Anthropic returned ${res.status}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  return payload as Json;
}

// The request body every call sends: the model, thinking kept low, the system as cached blocks.
export function bodyFor({ system, content, maxTokens, tools, model = MODEL }: { system: string | Json[]; content: Content; maxTokens: number; tools?: Json[]; model?: string | null }) {
  model = model || MODEL;
  const sys = typeof system === 'string' ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system;
  return {
    model,
    max_tokens: maxTokens,
    // Haiku takes no thinking setting; Sonnet 5.5 is kept to its lowest.
    ...(/haiku/i.test(model) ? {} : { thinking: THINKING }),
    system: sys,
    ...(tools ? { tools, tool_choice: { type: 'auto' } } : {}),
    messages: [{ role: 'user', content }],
  };
}

// A plain answer in text: titles, descriptions, the photo check.
export async function askText(key: string, opts: { system: string | Json[]; content: Content; maxTokens: number; model?: string | null }) {
  const payload = await post(key, bodyFor(opts));
  return ((payload.content ?? []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

/*
 * An answer through one tool. Offered, not forced; the prompt asks for it, and once more if the first reply came
 * back as prose. A schema eBay-style limits cannot compile is sent again unstrict rather than failing the job.
 */
export async function askTool(key: string, opts: { system: string | Json[]; content: Content; maxTokens: number; tool: Json; model?: string | null }): Promise<{ input: Json; payload: Json }> {
  const ask = `Answer with the ${opts.tool.name} tool.`;
  let tool: Json = strictTool(opts.tool);
  const once = async (content: Content) => {
    try {
      return await post(key, bodyFor({ ...opts, content, tools: [tool] }));
    } catch (e) {
      if ((e as { status?: number }).status === 400 && /strict|schema|grammar/i.test((e as Error).message)) {
        tool = { ...opts.tool };
        return post(key, bodyFor({ ...opts, content, tools: [tool] }));
      }
      throw e;
    }
  };
  let payload = await once(withAsk(opts.content, ask));
  let call = ((payload.content ?? []) as Json[]).find((b) => b.type === 'tool_use');
  if (!call && payload.stop_reason !== 'max_tokens') {
    payload = await once(withAsk(opts.content, `${ask} Use it now; do not reply in prose.`));
    call = ((payload.content ?? []) as Json[]).find((b) => b.type === 'tool_use');
  }
  if (!call) {
    throw new Error(payload.stop_reason === 'max_tokens' ? 'The answer was cut off before it finished. Try again.' : 'The answer came back empty. Try again.');
  }
  return { input: (call.input ?? {}) as Json, payload };
}
