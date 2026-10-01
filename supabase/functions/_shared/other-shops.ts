// Other UK shops that sell the same product: found with Claude's web search, each page read and held to a strict
// match before anything from it is used. Their photos go through the same check as the first shop's; their facts
// go to the writing as facts, never as wording. Amazon, eBay and marketplaces are left out: they block reads, and
// a marketplace photo is another seller's.

import { THINKING, post, strictTool } from './claude.ts';
import { MODEL } from './model.ts';
import { matchScore, packOf } from './match.ts';

type Json = Record<string, any>;

export const OTHERS_VERSION = 1;
export const MAX_PAGES = 4;
export const PHOTOS_PER_PAGE = 4;
// Fewer passed photos than this from the first shop and Keepr looks wider.
export const ENOUGH_PHOTOS = 3;

// Marketplaces and aggregators: their photos are other sellers', and some refuse to be read at all.
export const BLOCKED = [
  'amazon.co.uk', 'amazon.com', 'ebay.co.uk', 'ebay.com', 'etsy.com', 'aliexpress.com', 'temu.com', 'wish.com',
  'onbuy.com', 'fruugo.co.uk', 'fruugo.com', 'facebook.com', 'pinterest.com', 'pinterest.co.uk', 'youtube.com',
  'idealo.co.uk', 'pricespy.co.uk', 'pricerunner.com', 'google.com', 'google.co.uk', 'reddit.com', 'tiktok.com',
];

export const PAGES_SYSTEM = `You find UK retailers' product pages for one exact product, so a small UK shop can check their photos and facts.

Search the web. Use the barcode first when one is given; then the brand, the model and the pack size. Keep only:
- a page for this exact product: the same brand, model, size and pack count;
- a single product page, not a search, category, comparison or review page;
- a UK retailer's own shop: the maker's own UK shop, a high street chain or an independent UK shop.
Never a marketplace or a page where other sellers list (Amazon, eBay, OnBuy, Etsy and the like). Never the shop or shops named as already used.

Return the pages with the pages tool: at most four, the most certain first. An empty list is the right answer when no page is certain.`;

export const PAGES_TOOL = {
  name: 'pages',
  description: 'The product pages found for this exact product.',
  input_schema: {
    type: 'object',
    properties: {
      pages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The product page address, exactly as found.' },
            shop: { type: 'string', description: 'The shop\'s name.' },
            why: { type: 'string', description: 'One short line: what shows it is the same product.' },
          },
          required: ['url', 'shop', 'why'],
        },
      },
    },
    required: ['pages'],
  },
};

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const blocked = (u: string) => { const h = host(u); return !h || BLOCKED.some((b) => h === b || h.endsWith(`.${b}`)); };

export function productLine(p: Json) {
  return [
    `Product: ${p.title}`, p.brand && `Brand: ${p.brand}`, p.gtin && `Barcode: ${p.gtin}`, p.mpn && `Model: ${p.mpn}`,
    p.used?.length && `Already used, leave out: ${p.used.join(', ')}`,
  ].filter(Boolean).join('\n');
}

// The pages the model returned, as addresses we will read: unique, http(s), no marketplace, no shop already used.
export function pagesFrom(input: Json, used: string[] = []) {
  const seen = new Set(used.map(host));
  const out: Json[] = [];
  for (const p of (input?.pages ?? []) as Json[]) {
    const url = String(p?.url ?? '').trim();
    if (!/^https?:\/\//.test(url) || blocked(url) || seen.has(host(url))) continue;
    seen.add(host(url));
    out.push({ url, shop: String(p?.shop ?? host(url)).slice(0, 60), why: String(p?.why ?? '').slice(0, 200) });
  }
  return out.slice(0, MAX_PAGES);
}

/*
 * Web search through Claude: the search runs on Anthropic's side, the pages come back through the pages tool.
 * A long search can pause (stop_reason pause_turn); it is sent back once to finish.
 */
export async function findPages(key: string, product: Json): Promise<{ pages: Json[]; searches: number }> {
  const tools = [
    { type: 'web_search_20250305', name: 'web_search', max_uses: 3, blocked_domains: BLOCKED, user_location: { type: 'approximate', country: 'GB' } },
    strictTool(PAGES_TOOL),
  ];
  const messages: Json[] = [{ role: 'user', content: `${productLine(product)}\n\nAnswer with the pages tool.` }];
  const body = () => ({ model: MODEL, max_tokens: 2500, thinking: THINKING, system: PAGES_SYSTEM, tools, tool_choice: { type: 'auto' }, messages });
  let payload = await post(key, body());
  let searches = Number(payload.usage?.server_tool_use?.web_search_requests ?? 0);
  if (payload.stop_reason === 'pause_turn') {
    messages.push({ role: 'assistant', content: payload.content });
    payload = await post(key, body());
    searches += Number(payload.usage?.server_tool_use?.web_search_requests ?? 0);
  }
  const call = ((payload.content ?? []) as Json[]).find((b) => b.type === 'tool_use' && b.name === 'pages');
  return { pages: pagesFrom(call?.input ?? {}, product.used ?? []), searches };
}

const words = (t: unknown) => new Set(String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3));

/*
 * Is a page we read the same product. A shared barcode settles it, and a different one rules it out. Otherwise the
 * brand has to be on both, model numbers and packs must not disagree, and nearly all of the product's own words
 * have to be in the page's title. A search result's word for it is not enough: the page itself has to say so.
 */
export function samePage(product: Json, read: Json): { ok: boolean; via: string } {
  const r = matchScore(product, { title: read.title, brand: read.brand, gtin: read.gtin });
  if (r.score === 1) return { ok: true, via: 'the same barcode' };
  if (r.rules_out) return { ok: false, via: r.via };
  const brand = String(product.brand ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = String(read.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (brand && !title.includes(brand) && String(read.brand ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') !== brand) return { ok: false, via: 'another brand' };
  if (r.via === 'brand and model') return { ok: true, via: 'the brand and model' };
  const mine = words(product.title);
  const theirs = words(read.title);
  const shared = [...mine].filter((w) => theirs.has(w)).length;
  const cover = mine.size ? shared / mine.size : 0;
  // Both say a pack, or neither does: one silent about the pack could be a multipack.
  const packs = Boolean(packOf(product.title)) === Boolean(packOf(read.title));
  if (cover >= 0.8 && packs) return { ok: true, via: 'the brand, name and pack' };
  return { ok: false, via: `only ${Math.round(cover * 100)}% of the name matches` };
}
