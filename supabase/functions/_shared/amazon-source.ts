// Keeper task 02, pass 1 (keeper-task-02-amazon-sourcing.md): a candidate found on Amazon UK by its barcode alone.
//   1. Search Amazon UK for the barcode (Apify, axesso_data/amazon-search-scraper, one results page).
//   2. Read the first results in full with the product reader we already use (amazon.ts).
//   3. Approve only when every rule below holds, in code. No judgement, no Claude.
// Pure apart from runSearch, so the tests hold every rule.

import { goodsOf, pageFor, type Read } from './amazon.ts';
import { modelsIn, packOf } from './match.ts';

type Json = Record<string, any>;

export const SEARCH_ACTOR = 'axesso_data~amazon-search-scraper';
/*
 * Which search result is the product (Joseph, 3 October):
 *   one result   it is the product: the barcode found it;
 *   more than one   the title picks it: the result whose title matches the card's. None matching, the card is left.
 * Only the chosen one is read in full.
 */
const WORD_STOP = new Set(['the', 'and', 'for', 'with', 'new', 'set', 'from', 'pack', 'kit', 'toy', 'toys', 'gift', 'uk']);
const wordsOf = (t: unknown) => String(t ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !WORD_STOP.has(w));
const squash = (t: unknown) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// How well a result's title matches the card's title, 0 to 1. A model number on the card ("Lego 77260") has to be in
// the result's title; otherwise it is the share of the card's words the result's title carries.
export function titleMatch(cardTitle: unknown, resultTitle: unknown) {
  const theirs = squash(resultTitle);
  const models = modelsIn(cardTitle);
  if (models.length) return models.some((m) => theirs.includes(m)) ? 1 : 0;
  const ours = [...new Set(wordsOf(cardTitle))];
  if (!ours.length) return 0;
  const said = new Set(wordsOf(resultTitle));
  return ours.filter((w) => said.has(w)).length / ours.length;
}

// Below this share of the card's words, a title does not match.
export const TITLE_MATCH = 0.6;

export function pickResult(cardTitle: unknown, results: Json[]): { asin: string; via: 'only' | 'title' } | { asin: null; why: string } {
  if (!results.length) return { asin: null, why: 'none' };
  if (results.length === 1) return { asin: results[0].asin, via: 'only' };
  const scored = results.map((r) => ({ r, score: titleMatch(cardTitle, r.title) })).filter((x) => x.score >= TITLE_MATCH);
  if (!scored.length) return { asin: null, why: `${results.length} results for the barcode, and no title matches this card` };
  // The best match; on a tie, the one Amazon put first.
  scored.sort((a, b) => b.score - a.score || a.r.position - b.r.position);
  return { asin: scored[0].r.asin, via: 'title' };
}

// Apify's prices, in dollars: the search is paid per product it returns, the reader per page it reads.
export const SEARCH_USD_PER_RESULT = 10 / 1000;
export const READ_USD_PER_PAGE = 1.5 / 1000;

// What a lookup cost, in pence. The pound to the dollar as Keeper's own runs count it (KEEPER_GBP_PER_USD).
export function pence(results: number, reads: number, gbpPerUsd = 0.75) {
  const usd = results * SEARCH_USD_PER_RESULT + reads * READ_USD_PER_PAGE;
  return Math.round(usd * gbpPerUsd * 100 * 100) / 100;
}

/*
 * A barcode as Keeper searches it, the same rule as keeper_gtin (0133): 8, 12, 13 or 14 digits with a correct check
 * digit; a value of 8 to 11 digits not valid as it stands is tried padded to 12, which recovers a UPC that lost its
 * leading zeros when it was stored as a number.
 */
const checks = (s: string) => {
  const d = s.split('').map(Number);
  const last = d.pop()!;
  const sum = d.reverse().reduce((acc, x, i) => acc + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === last;
};
export function keeperGtin(value: unknown): string | null {
  const s = String(value ?? '').replace(/\s/g, '');
  if (!/^\d{8,14}$/.test(s)) return null;
  const tries = s.length <= 11 ? [s, s.padStart(12, '0')] : [s];
  return tries.find((t) => [8, 12, 13, 14].includes(t.length) && checks(t)) ?? null;
}

// The candidate's barcode, in gtinOf's order (src/lib/golive.js) and the same as candidate_gtin (0133).
export function candidateGtin(row: Json): string | null {
  const m = row?.margin ?? {};
  const l = row?.listing ?? {};
  for (const v of [m.shelf?.gtin, m.cost_from?.gtin, m.gtin, l.gtin, l.ean]) {
    const g = keeperGtin(v);
    if (g) return g;
  }
  return null;
}

// A barcode as digits, compared without its leading zeros: a 12-digit UPC and its 13-digit EAN with a leading 0 are
// the same code, and so is a UPC that lost its zeros on the way.
export const sameCode = (a: unknown, b: unknown) => {
  const x = String(a ?? '').replace(/\D/g, '').replace(/^0+/, '');
  const y = String(b ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return x.length >= 7 && x === y;
};

// Every barcode the Amazon page shows: its own barcode line, and every 8 to 14 digit code in a UPC, EAN, GTIN or
// barcode line of its details (Amazon sometimes lists two, comma separated).
export function codesOn(read: Read): string[] {
  const out = new Set<string>(read.facts?.barcodes ?? []);
  if (read.facts?.barcode) out.add(read.facts.barcode);
  for (const line of read.facts?.details ?? []) {
    const m = /^(upc|ean|gtin|isbn-13|barcode|global trade identification number)\s*:\s*(.+)$/i.exec(String(line));
    if (!m) continue;
    for (const code of m[2].match(/\d{8,14}/g) ?? []) out.add(code);
  }
  return [...out];
}

// The pack the page names: a count from the title ("Pack of 3", "x6"), "6 x 500ml", or a number of items over one in
// its details. Null when it names none.
// Unit count is left out: Amazon gives it as a size ("500.0 Millilitre"), not a pack.
const ITEMS = /^(number of items|item package quantity|package quantity|pack quantity)\s*:\s*(\d+)\s*$/i;
const MULTI = /\b(\d+)\s?x\s?\d+(\.\d+)?\s?(ml|l|g|kg|cl|oz)\b/i;

export function packOn(title: unknown, details: unknown[] = []) {
  const t = String(title ?? '');
  const multi = MULTI.exec(t);
  if (multi && Number(multi[1]) > 1) return { kind: 'count' as const, n: Number(multi[1]), said: multi[0] };
  const p = packOf(t);
  if (p?.kind === 'count' && p.n > 1) return { ...p, said: `${p.n} in the title` };
  for (const line of details) {
    const m = ITEMS.exec(String(line));
    if (m && Number(m[2]) > 1) return { kind: 'count' as const, n: Number(m[2]), said: `${m[1]}: ${m[2]}` };
  }
  return null;
}

/*
 * Another pack on the page rules it out: third-party sellers sometimes list a multipack under the single item's
 * barcode. Amazon naming a count the candidate does not have, or a different weight or volume, is enough.
 * A page that names no pack is not a doubt: the barcode is the product.
 */
export function packDoubt(candidateTitle: unknown, read: Read): string | null {
  const theirs = packOn(read.facts?.title, read.facts?.details ?? []);
  const ours = packOf(candidateTitle);
  if (theirs) {
    const multi = MULTI.exec(String(candidateTitle ?? ''));
    const ourCount = multi ? Number(multi[1]) : ours?.kind === 'count' ? ours.n : 1;
    if (ourCount !== theirs.n) return `Amazon's page is a pack of ${theirs.n} (${theirs.said}); this card is ${ourCount === 1 ? 'a single' : `a pack of ${ourCount}`}`;
  }
  const theirWeight = packOf(read.facts?.title);
  if (theirWeight?.kind === 'weight' && ours?.kind === 'weight' && Math.abs(theirWeight.n - ours.n) > 0.5) {
    return `Amazon's page is ${theirWeight.n}g or ml; this card is ${ours.n}`;
  }
  return null;
}

// Free delivery to her on Prime: Amazon sends it (sold by anyone, sent by Amazon), or Amazon sells it.
export const sentByAmazon = (offer: Json | null | undefined) =>
  /amazon/i.test(String(offer?.fulfilled_by ?? '')) || /^amazon/i.test(String(offer?.sold_by ?? ''));

const pounds = (v: number) => `£${v.toFixed(2)}`;

export type Verdict =
  | { ok: true; asin: string; cost: number | null; delivery: number | null; status: 'quoted' | 'unavailable'; line: string; why: string }
  | { ok: false; asin: string | null; line: string; why: string };

const STOCK_WORDS: Record<string, string> = { in: 'in stock', low: 'running low', slow: 'slow to dispatch', out: 'out of stock', unknown: 'stock not shown' };

/*
 * One Amazon page against the candidate: the page the barcode search found. Sourced on Amazon when it is the right
 * product (Joseph, 3 October: "sourced on amazon whether amazon sends it or not will be determined when we get to
 * approved"):
 *   the page was found;
 *   it shows no other barcode (most pages show none, and the search has already matched it: LEGO's never do);
 *   it names no other pack.
 * Who sells and sends it, the stock, the delivery and the price do not stop it: they are saved with the supplier and
 * shown on the card in Approved, where she decides. With no price (no buy box, out of stock) the supplier is saved as
 * unavailable, with no cost, so nothing is priced from a guess.
 * The cost is the price shown today, deal or not (Part 14, version 3). A seller's delivery charge to her is part of it.
 */
export function judge(candidate: { title?: string | null }, gtin: string, read: Read): Verdict {
  const asin = read.asin ?? null;
  const no = (line: string, why = line): Verdict => ({ ok: false, asin, line, why });
  if (!read.found || !read.facts) return no('The Amazon page could not be read.');
  const codes = codesOn(read);
  if (codes.length && !codes.some((c) => sameCode(c, gtin))) return no(`Amazon's page has another barcode (${codes.join(', ')}).`);
  const pack = packDoubt(candidate.title, read);
  if (pack) return no('Another pack on Amazon.', `${pack}.`);
  const offer = read.offer;
  const cost = goodsOf(offer);
  const amazon = sentByAmazon(offer);
  // What getting it to her costs: nothing on Prime from Amazon; another seller's delivery charge when it shows one.
  const delivery = !amazon && Number(offer.shipping) > 0 ? Number(offer.shipping) : null;
  const who = amazon
    ? (/^amazon/i.test(String(offer.sold_by ?? '')) ? 'sold by Amazon' : `sent by Amazon${offer.sold_by ? ` for ${offer.sold_by}` : ''}`)
    : `sold by ${offer.sold_by ?? 'another seller'}${delivery ? `, ${pounds(delivery)} delivery` : ''}`;
  const head = codes.length ? 'Same barcode on Amazon' : 'Found by its barcode on Amazon';
  const deal = offer.deal && offer.was ? `, on a deal (usually ${pounds(Number(offer.was))})` : '';
  return {
    ok: true,
    asin: asin!,
    cost,
    delivery,
    status: cost == null ? 'unavailable' : 'quoted',
    line: `${head}, ${cost != null ? `${pounds(cost)}, ` : 'no price now, '}${who}, ${STOCK_WORDS[offer.stock] ?? 'stock not shown'}.`,
    why: `${codes.length ? `Barcode ${gtin} on the Amazon page` : `Amazon's search for ${gtin} found it`}${deal}.${offer.stock_text ? ` Amazon says "${String(offer.stock_text).replace(/\.+$/, '')}".` : ''}${offer.fulfilled_by ? ` Sent by ${offer.fulfilled_by}.` : ''}`,
  };
}

/*
 * The search results for each barcode, in Amazon's order, sponsored ones left out. One run takes many barcodes.
 * Each result is paid for, so the count comes back too.
 */
export async function runSearch(barcodes: string[], token: string, { timeoutSecs = 90, fetcher = fetch } = {}) {
  const found = new Map<string, Json[]>();
  const perCode = new Map<string, number>();
  if (!barcodes.length) return { found, perCode, results: 0 };
  const res = await fetcher(`https://api.apify.com/v2/acts/${SEARCH_ACTOR}/run-sync-get-dataset-items?timeout=${timeoutSecs}&clean=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ input: barcodes.map((keyword) => ({ keyword, domainCode: 'co.uk', sortBy: 'relevanceblender', maxPages: 1 })) }),
    signal: AbortSignal.timeout((timeoutSecs + 15) * 1000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('Apify refused the token. Check APIFY_TOKEN in the function secrets.');
    if (res.status === 402) throw new Error('The Apify account is out of credit.');
    throw new Error(`Amazon's search did not answer (${res.status}).`);
  }
  const items = (await res.json().catch(() => [])) as Json[];
  let results = 0;
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.asin) continue;
    const key = String(item.keyword ?? '');
    results += 1;
    perCode.set(key, (perCode.get(key) ?? 0) + 1);
    if (item.sponsored) continue;
    const list = found.get(key) ?? [];
    list.push({ asin: String(item.asin).toUpperCase(), title: item.productDescription ?? null, price: item.price ?? null, position: Number(item.searchResultPosition ?? list.length) });
    found.set(key, list);
  }
  for (const list of found.values()) list.sort((a, b) => a.position - b.position);
  return { found, perCode, results };
}

// The supplier row Keeper writes on approval (keeper_source_approve, 0133).
export function sourceOf(read: Read, verdict: Extract<Verdict, { ok: true }>) {
  return {
    asin: verdict.asin,
    title: read.facts?.title ?? null,
    url: pageFor(verdict.asin).replace('?psc=1', ''),
    image_url: read.facts?.images?.[0] ?? null,
    cost: verdict.cost,
    // Another seller's delivery to her, kept as the freight on her route so the landed cost counts it.
    delivery: verdict.delivery,
    status: verdict.status,
    note: verdict.line,
    raw: {
      sold_by: read.offer.sold_by, fulfilled_by: read.offer.fulfilled_by, price: read.offer.price, was: read.offer.was,
      shipping: read.offer.shipping, stock: read.offer.stock, stock_text: read.offer.stock_text, read_at: read.read_at,
    },
  };
}

/*
 * What the approval fills on the card from the reading, only where empty (keeper_source_approve, 0136). Code only:
 * the same as the card does on opening (supplierPatch) and Get it ready does for the parcel (packedKg), kept equal to
 * src/lib/supplierWatch.js by the tests.
 */
const UNIT: Array<[RegExp, number]> = [[/^(kg|kilo|kilogram|kilograms)$/i, 1], [/^(g|gram|grams)$/i, 0.001], [/^(lb|lbs|pound|pounds)$/i, 0.4536], [/^(oz|ounce|ounces)$/i, 0.02835]];
export function weightKg(text: unknown): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|kilo|g|grams?|lbs?|pounds?|oz|ounces?)\b/i.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const unit = UNIT.find(([re]) => re.test(m[2]));
  const kg = unit ? n * unit[1] : null;
  return kg && kg > 0 && kg < 100 ? Math.round(kg * 1000) / 1000 : null;
}
export function amazonWeight(read: Read): number | null {
  const details = read?.facts?.details ?? [];
  const line = details.find((d) => /^(item weight|weight|product weight)\s*:/i.test(d))
    ?? details.find((d) => /weight/i.test(d) && !/capacity|max|load/i.test(d));
  return weightKg(line?.split(':').slice(1).join(':')) ?? null;
}
// Packed, it weighs more: 15% for the box and wrapping, rounded up to the next 50g, at least 50g more.
// Rounded to the gram before rounding up: 0.1 + 0.05 is 0.15000000000000002 in floating point, which rounded a 100g
// item up to 200g, not 150g.
export const packedKg = (itemKg: number | null) => (itemKg ? Math.ceil(Math.round(Math.max(itemKg * 1.15, itemKg + 0.05) * 20 * 1e6) / 1e6) / 20 : null);

export function fillOf(read: Read) {
  return {
    supplier_text: read?.facts?.text ?? null,
    supplier_url: read?.url ?? null,
    weight_kg: packedKg(amazonWeight(read)),
  };
}
