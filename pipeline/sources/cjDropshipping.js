import { readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const TOKEN_FILE = '.cj-token.json';

export const id = 'cj_dropshipping';
export const provides = ['supply', 'depth'];

// Free accounts get 1 request/second. Plus 2, Prime 4, Advanced 6.
// The margin is generous because requests sent a second apart can still arrive
// inside the same second at CJ's end.
let lastCall = 0;
let minGap = 1400;

export function setPace(requestsPerSecond) {
  minGap = Math.ceil(1000 / Math.max(1, requestsPerSecond)) + 400;
}

async function paced(fn) {
  const wait = Math.max(0, minGap - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fn();
}

// listV2 costs 50 points of a 50,000 daily allowance. Worth watching, because
// running out returns 429 and the batch simply stops.
let points = null;
export function pointsUsed() {
  return points;
}

// CJ returns 429 for both rate limiting and points exhaustion. One is transient
// and worth retrying, the other is not, and treating them alike wastes a run.
export function classify429(json, pointsInfo) {
  const msg = String(json?.message ?? '');
  if (/qps|too many requests|frequen/i.test(msg) && !/point/i.test(msg)) return 'rate';
  if (/point/i.test(msg) || pointsInfo?.remaining === 0) return 'points';
  return 'rate';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Access tokens live 15 days and CJ caches server side for 24 hours, so asking
// for a fresh one per run is both wasteful and rate limited. Cache to disk.
async function readCached() {
  try {
    const t = JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
    if (new Date(t.accessTokenExpiryDate) > new Date(Date.now() + 60_000)) return t;
    return { ...t, expired: true };
  } catch {
    return null;
  }
}

async function post(path, body) {
  const res = await paced(() =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  const json = await res.json();
  if (!json.result && !json.success) throw new Error(`CJ ${path}: ${json.message} (${json.code})`);
  return json.data;
}

async function token(apiKey) {
  const cached = await readCached();
  if (cached && !cached.expired) return cached.accessToken;

  const data = cached?.refreshToken
    ? await post('/authentication/refreshAccessToken', { refreshToken: cached.refreshToken })
        .catch(() => post('/authentication/getAccessToken', { apiKey }))
    : await post('/authentication/getAccessToken', { apiKey });

  await writeFile(TOKEN_FILE, JSON.stringify(data, null, 2));
  return data.accessToken;
}

// listedNum counts how many sellers already list this product. More is worse,
// so it inverts the same way eBay listing depth does.
export function saturationSignal(listedNum, ceiling = 2000) {
  const n = Number(listedNum) || 0;
  return 1 - Math.min(n, ceiling) / ceiling;
}

export function supplySignal({ inventory, deliveryCycle }) {
  const stock = Math.min(Number(inventory) || 0, 1000) / 1000;
  // Delivery cycle arrives as "3-5" days. Anything past a fortnight is not a
  // product she can sell against UK next-day expectations.
  const days = Number(String(deliveryCycle ?? '').split('-').pop()) || 14;
  const speed = Math.max(0, 1 - days / 14);
  return Math.round((stock * 0.6 + speed * 0.4) * 100) / 100;
}

// Number(null) is 0 and Number.isFinite(0) is true, so a missing price would
// become a zero landed cost, maximum apparent margin, and sort to the top of
// the batch. Reject anything that is not a positive number.
export function toGbp(usd, rate) {
  if (usd === null || usd === undefined || usd === '') return null;
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(n * rate * 100) / 100;
}

export function normaliseProduct(p, { rate, shippingEstimate, marketplaceCountry }) {
  // sellPrice is the goods cost in USD, not a landed cost. Freight is a separate
  // endpoint, so free-shipping items are accurate and the rest carry an estimate.
  const goods = toGbp(p.sellPrice ?? p.nowPrice, rate);
  if (goods === null) return null;

  const freeShipping = Number(p.addMarkStatus) === 1;
  const landedCost = Math.round((goods + (freeShipping ? 0 : shippingEstimate)) * 100) / 100;

  const base = {
    externalRef: p.id,
    title: p.nameEn,
    category: p.threeCategoryName ?? p.twoCategoryName ?? p.oneCategoryName ?? null,
    imageUrl: p.bigImage ?? null,
    landedCost,
  };

  const raw = {
    sku: p.sku,
    sellPriceUsd: p.sellPrice,
    fxRate: rate,
    freeShipping,
    shippingEstimate: freeShipping ? 0 : shippingEstimate,
    listedNum: p.listedNum,
    inventory: p.warehouseInventoryNum,
    deliveryCycle: p.deliveryCycle,
    ceCertified: Number(p.hasCECertification) === 1,
    warehouse: marketplaceCountry,
  };

  return [
    { ...base, kind: 'supply', value: supplySignal({ inventory: p.warehouseInventoryNum, deliveryCycle: p.deliveryCycle }), raw },
    { ...base, kind: 'depth', value: saturationSignal(p.listedNum), raw },
  ];
}

export async function fetchSignals({ config, credentials, query }) {
  const apiKey = credentials?.apiKey;
  if (!apiKey) throw new Error('cj_dropshipping: apiKey missing from credentials');

  const rate = Number(config.usdToGbp);
  if (!Number.isFinite(rate)) {
    // Guessing here would corrupt every margin in the batch, silently.
    throw new Error('cj_dropshipping: config.usdToGbp not set, refusing to invent an exchange rate');
  }

  if (config.requestsPerSecond) setPace(config.requestsPerSecond);

  const access = await token(apiKey);
  const countryCode = config.countryCode ?? 'GB';
  const size = Math.min(config.size ?? 20, 100);
  const shippingEstimate = Number(config.shippingEstimateGbp ?? 0);
  const maxRetries = config.maxRetries ?? 3;

  const signals = [];
  const failures = [];

  for (const term of query.terms) {
    const url = new URL(`${BASE}/product/listV2`);
    url.searchParams.set('keyWord', term);
    url.searchParams.set('countryCode', countryCode);
    url.searchParams.set('page', '1');
    url.searchParams.set('size', String(size));
    url.searchParams.set('features', 'enable_category');
    if (config.freeShippingOnly) url.searchParams.set('addMarkStatus', '1');
    if (config.minPrice) url.searchParams.set('startSellPrice', String(config.minPrice));
    if (config.maxPrice) url.searchParams.set('endSellPrice', String(config.maxPrice));

    let json = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const res = await paced(() =>
        fetch(url, { headers: { 'CJ-Access-Token': access } }),
      );
      json = await res.json();
      if (json.pointsInfo) points = json.pointsInfo;

      if (res.status !== 429 && json.code !== 429) break;

      if (classify429(json, json.pointsInfo) === 'points') {
        // Replenishment is roughly 35 points a minute against a 50 point call,
        // so waiting it out inside a run is not worth it.
        throw new Error(
          `CJ points exhausted. ${json.message ?? ''} Roughly 90 seconds per call until reset at 00:00 UTC.`,
        );
      }

      if (attempt === maxRetries) break;
      const backoff = 2000 * 2 ** attempt;
      if (config.debug) console.log(`      "${term}": rate limited, retrying in ${backoff}ms`);
      await sleep(backoff);
    }

    if (!json || (!json.result && !json.success)) {
      // Losing 24 good terms because the 25th was throttled is worse than a gap.
      failures.push(`${term}: ${json?.message ?? 'no response'}`);
      continue;
    }

    const products = json.data?.content?.flatMap((c) => c.productList ?? []) ?? [];
    if (config.debug) {
      const total = json.data?.totalRecords ?? 0;
      console.log(`      "${term}": ${products.length} returned, ${total} total match`);
    }
    for (const p of products) {
      const pair = normaliseProduct(p, { rate, shippingEstimate, marketplaceCountry: countryCode });
      if (pair) signals.push(...pair);
    }
  }

  if (failures.length) {
    console.log(`      ${failures.length} of ${query.terms.length} terms failed:`);
    for (const f of failures.slice(0, 5)) console.log(`        ${f}`);
  }

  return signals;
}

export { fetchSignals as fetch };
