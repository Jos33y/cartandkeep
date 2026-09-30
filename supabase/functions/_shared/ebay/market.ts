// A product's own market on eBay UK: what new, fixed-price listings from UK sellers ask for it now, postage included.
// For a card whose shelf product is not the product that proved the market (a different pack, or a different item
// altogether): she can list the shelf product as it is, priced from its own market, not the other product's.

import { call } from './listing.ts';

type Json = Record<string, any>;

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// The words to search by: the product name without a trailing variant (" - Red") or bracketed notes.
export function searchQuery(title: string) {
  return String(title ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+[-|]\s+.*$/, '')
    .replace(/[^A-Za-z0-9&' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// What a listing's title must carry to be the same product: the brand, and any model code ("MG 16", "WBP1").
export function mustCarry(title: string, brand: string | null = null) {
  const out: string[] = [];
  const b = compact(brand ?? '') || compact(String(title ?? '').split(/\s+/)[0] ?? '');
  if (b.length >= 3) out.push(b);
  for (const m of String(title ?? '').matchAll(/\b([A-Za-z]{1,5})[\s-]?(\d{1,5}[A-Za-z]{0,3})\b/g)) {
    const code = compact(`${m[1]}${m[2]}`);
    if (code.length >= 3 && /\d/.test(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const i = (xs.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round((xs[lo] + (xs[hi] - xs[lo]) * (i - lo)) * 100) / 100;
};

export function spread(totals: number[]) {
  const xs = [...totals].filter((x) => x > 0).sort((a, b) => a - b);
  return { n: xs.length, low: xs[0] ?? null, p25: pct(xs, 0.25), median: pct(xs, 0.5), p75: pct(xs, 0.75), high: xs.at(-1) ?? null };
}

export async function marketFor(title: string, app: string, { brand = null }: { brand?: string | null } = {}) {
  const q = searchQuery(title);
  if (!q) return null;
  const filter = 'buyingOptions:{FIXED_PRICE},conditions:{NEW},itemLocationCountry:GB';
  const r = await call(`/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(filter)}&limit=50`, app);
  const need = mustCarry(q, brand);
  const listings = ((r.itemSummaries ?? []) as Json[])
    .map((it) => {
      const price = Number(it.price?.value ?? 0);
      const ship = it.shippingOptions?.[0];
      const postage = ship?.shippingCostType === 'CALCULATED' ? null : Number(ship?.shippingCost?.value ?? 0);
      return {
        title: String(it.title ?? ''),
        price,
        postage,
        total: postage == null ? price : Math.round((price + postage) * 100) / 100,
        url: it.itemWebUrl ?? null,
        image: it.image?.imageUrl ?? null,
        feedback: it.seller?.feedbackScore ?? null,
      };
    })
    // The same product only: its brand and model code in the title.
    .filter((x) => x.price > 0 && need.every((w) => compact(x.title).includes(w)))
    .sort((a, b) => a.total - b.total);
  return { query: q, must: need, ...spread(listings.map((x) => x.total)), listings: listings.slice(0, 12), at: new Date().toISOString() };
}
