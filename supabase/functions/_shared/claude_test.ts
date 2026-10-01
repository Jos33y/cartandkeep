// Calls shaped for Claude Sonnet 5.5: run with
//   deno test --allow-env supabase/functions/_shared/claude_test.ts

function assertEquals(a: unknown, b: unknown) {
  const x = JSON.stringify(a); const y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x}`);
}
import { askTool, bodyFor, strictSchema } from './claude.ts';
import { MODEL } from './model.ts';

Deno.test('a strict schema: every object closed and every property required, unsupported limits moved to the description', () => {
  const s = strictSchema({
    type: 'object',
    properties: {
      sure: { type: 'integer', minimum: 0, maximum: 100 },
      options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      label: { type: 'object', properties: { signal: { type: 'string', enum: ['Warning', 'Danger'] } } },
    },
    required: ['sure'],
  });
  assertEquals(s, {
    type: 'object',
    properties: {
      sure: { type: 'integer', description: '(minimum 0, maximum 100)' },
      options: { type: 'array', items: { type: 'string' }, description: '(minItems 2, maxItems 4)' },
      label: { type: 'object', properties: { signal: { type: 'string', enum: ['Warning', 'Danger'] } }, additionalProperties: false, required: ['signal'] },
    },
    required: ['sure', 'options', 'label'],
    additionalProperties: false,
  });
});

Deno.test('every request: Sonnet 5.5, thinking kept low, no forced tool, no sampling settings', () => {
  const b = bodyFor({ system: 'S', content: 'C', maxTokens: 10, tools: [{ name: 't' }] });
  assertEquals([b.model, b.thinking, b.tool_choice, 'temperature' in b, 'top_p' in b], [MODEL, { type: 'between_tools' }, { type: 'auto' }, false, false]);
  assertEquals(MODEL, 'claude-sonnet-5-5');
});

Deno.test('a tool answer: asked for once more when the first reply is prose; sent unstrict when the schema is refused', async () => {
  const sent: any[] = [];
  const replies = [
    { ok: false, status: 400, body: { error: { message: 'tools.0.strict: schema not supported' } } },
    { ok: true, status: 200, body: { content: [{ type: 'text', text: 'Here you go' }], stop_reason: 'end_turn' } },
    { ok: true, status: 200, body: { content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', name: 'fill', input: { values: [1] } }] } },
  ];
  const real = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    const r = replies.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  try {
    const out = await askTool('k', { system: 'S', content: 'facts', maxTokens: 50, tool: { name: 'fill', input_schema: { type: 'object', properties: { values: { type: 'array', items: { type: 'integer' } } } } } });
    assertEquals(out.input, { values: [1] });
    assertEquals([sent[0].tools[0].strict, sent[1].tools[0].strict, sent[2].tools[0].strict], [true, undefined, undefined]);
    assertEquals(sent[2].messages[0].content.at(-1).text, 'facts\n\nAnswer with the fill tool. Use it now; do not reply in prose.');
  } finally {
    globalThis.fetch = real;
  }
});
