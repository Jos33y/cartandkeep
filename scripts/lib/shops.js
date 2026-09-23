/*
 * Which shops might carry a product. A proposal, not a finding.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

import { parseEnv } from './env.js';
import { num } from './sources.js';
import fs from 'node:fs';

export function envKey(name) {
  if (process.env[name]) return process.env[name];
  for (const f of ['.env.local', '.env']) {
    try {
      const v = parseEnv(fs.readFileSync(f, 'utf8'))[name];
      if (v) return v;
    } catch { /* absent is normal */ }
  }
  return null;
}

export async function proposeShops(titles, key) {
  if (!key || !titles.length) return new Map();

  const prompt = `For each UK product below, name the 4 to 6 UK high street or online retailers most likely to stock it.
Only shops that sell in the UK and publish prices online. No marketplaces except eBay. No shop that plainly would not carry the category.
Reply with JSON only, no preamble and no markdown fence: an object mapping each product title exactly as given to an array of shop names.

${titles.map((t) => `- ${t}`).join('\n')}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`  shop proposal failed, ${res.status}. Falling back to the fixed list.`);
      return new Map();
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return new Map(Object.entries(parsed).map(([k, v]) => [k, (Array.isArray(v) ? v : []).slice(0, 6)]));
  } catch (err) {
    console.error(`  shop proposal failed, ${err.message}. Falling back to the fixed list.`);
    return new Map();
  }
}


// CSVs written before gate.js emitted codes: these match its fixed sentences.
