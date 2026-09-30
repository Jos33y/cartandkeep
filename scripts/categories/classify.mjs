/*
 * Places a product in Google's taxonomy from its title, for cards with no eBay category to map: the Google best
 * sellers (their export names only the top category) and older eBay cards. One call per 80 titles, answers kept in
 * research/categories/ai-cache.json so a title is never classified twice.
 *
 * The model chooses only from a fixed list (her categories, to the third level; four levels under Mobility &
 * Accessibility) and, for a store card, only inside the top category its export came from. An answer outside the
 * list is thrown away, never guessed at.
 */
import fs from 'node:fs';

// Level-two categories she sells in (cart-and-keep/categories-2026-09-29.md, "yes" and "selective").
export const ALLOWED_LEVEL2 = [
  1679, 359, 5835, 3348, 630, 574, 638, 2956, 594, 2862, 4171, 689, 696, 604, // Home & Garden
  133, 499873, 127, 1974, 2878, 3650, 1167, 503739, // Hardware
  491, 2915, // Health & Beauty
  2, // Animals & Pet Supplies
  1253, 3793, 3867, // Toys & Games
  932, 950, 2636, // Office Supplies
  2082, 345, 342, 262, 223, 278, 1270, // Electronics
  990, 2047, 500086, 5613, // Sport, Business, Vehicles by exception
  // Baby & Toddler is left out: the model filed adult bed rails as Baby Safety. A real baby product stays top-only
  // for her to place by hand.
];
const DEEP = 'Health & Beauty > Healthcare > Mobility & Accessibility';

const CARE = 'Health & Beauty > Healthcare';

// withinTop: a top category ID, null for her whole list, or 'care' for Healthcare only (the care-shop question).
export function allowedCategories(tax, taxonomyFile, withinTop = null) {
  const out = [];
  for (const line of fs.readFileSync(taxonomyFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\d+) - (.+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const path = m[2].trim();
    const depth = path.split(' > ').length;
    if (withinTop === 'care') {
      if ((path === CARE || path.startsWith(`${CARE} > `)) && depth <= 4) out.push({ id, path });
      continue;
    }
    if (!ALLOWED_LEVEL2.includes(tax.level2Of(id))) continue;
    if (withinTop != null && tax.topOf(id) !== withinTop) continue;
    if (depth <= 3 || (depth === 4 && path.startsWith(DEEP))) out.push({ id, path });
  }
  return out;
}

function readCache(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

/*
 * items: [{ key, title, withinTop }]. Returns a Map key -> Google ID (only for titles it could place).
 * Items are grouped by withinTop, since each group is offered a different list.
 */
export async function classify(items, { tax, taxonomyFile, apiKey, model, cacheFile = 'research/categories/ai-cache.json', batch = 80, log = console.log }) {
  const cache = readCache(cacheFile);
  const result = new Map();
  const todo = [];
  // A cached answer counts only while it is still on the allowed list, so narrowing the list re-asks those titles.
  const allowedFor = new Map();
  const allowedIds = (top) => {
    if (!allowedFor.has(top)) allowedFor.set(top, new Set(allowedCategories(tax, taxonomyFile, top === '*' ? null : top).map((a) => a.id)));
    return allowedFor.get(top);
  };
  for (const it of items) {
    const top = it.withinTop ?? '*';
    const c = cache[`${top}|${it.title.toLowerCase()}`];
    if (c === 0) continue;
    if (c && allowedIds(top).has(c)) result.set(it.key, c);
    else todo.push(it);
  }
  if (!todo.length) return { result, calls: 0, cached: items.length };
  if (!apiKey) { log(`  No ANTHROPIC_API_KEY, so ${todo.length} titles were not classified; they keep their top category.`); return { result, calls: 0, cached: items.length - todo.length }; }

  const groups = new Map();
  for (const it of todo) groups.set(it.withinTop ?? '*', [...(groups.get(it.withinTop ?? '*') ?? []), it]);
  let calls = 0;
  for (const [top, group] of groups) {
    const allowed = allowedCategories(tax, taxonomyFile, top === '*' ? null : top);
    const note = top === 'care'
      ? 'These products were seen at shops that sell care and mobility aids. Choose a category only if the product itself is a care, health or mobility aid (an eating aid, a bed rail, a leg raiser, an alarm clock for hearing loss). An ordinary household, kitchen or electrical product, or one for cars, gets 0.\n\n'
      : '';
    const ids = new Set(allowed.map((a) => a.id));
    const list = allowed.map((a) => `${a.id} - ${a.path}`).join('\n');
    for (let i = 0; i < group.length; i += batch) {
      const part = group.slice(i, i + batch);
      const titles = part.map((it, n) => `${n + 1}. ${it.title}`).join('\n');
      // The rules and the category list are the same for every batch in a group: cached, so each batch after the
      // first pays a tenth for the list, which is most of the prompt.
      const body = {
        model,
        max_tokens: 2000,
        system: [
          { type: 'text', text: 'You file products into Google\'s product taxonomy. Use only the categories in the list given. Choose the most specific category that describes what the product is (not where it is used or who buys it). Reply with one line per product and nothing else: the product number, a tab, the category ID. If no category in the list fits, give 0.' },
          { type: 'text', text: `${note}Categories:\n${list}`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: `Products:\n${titles}` }],
      };
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      calls += 1;
      if (!res.ok) { log(`  Classification call failed (${res.status}); ${part.length} titles keep their top category.`); continue; }
      const text = (await res.json())?.content?.map((c) => c.text ?? '').join('') ?? '';
      const answers = new Map([...text.matchAll(/^\s*(\d+)\s*[\t:|,.-]\s*(\d+)\s*$/gm)].map((m) => [Number(m[1]), Number(m[2])]));
      part.forEach((it, n) => {
        const id = answers.get(n + 1);
        const ok = id && ids.has(id) ? id : 0;
        cache[`${top}|${it.title.toLowerCase()}`] = ok;
        if (ok) result.set(it.key, ok);
      });
      fs.mkdirSync(cacheFile.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
    }
  }
  return { result, calls, cached: items.length - todo.length };
}
