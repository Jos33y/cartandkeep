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

export async function token(apiKey) {
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

// Per product rather than per term. Demand decided this list already, so this
// asks whether one known product can be sourced, not what CJ happens to stock.
// listV2 returns a product level code. Freight prices a variant, and the
// variant also carries the weight and dimensions that decide her postage band,
// which is the assumption sitting under every headroom figure we have.
export async function productDetail({ access, pid }) {
  const url = new URL(`${BASE}/product/query`);
  url.searchParams.set('pid', pid);

  const res = await paced(() => fetch(url, { headers: { 'CJ-Access-Token': access } }));
  const json = await res.json();
  if (json.pointsInfo) points = json.pointsInfo;
  if (!json.result && !json.success) throw new Error(json.message ?? 'no product detail');

  const d = json.data ?? {};
  const variants = d.variants ?? [];

  // Cheapest variant, because that is the one a price comparison should use and
  // the one the listing headline usually quotes.
  const variant = [...variants]
    .filter((v) => Number(v.variantSellPrice) > 0)
    .sort((a, b) => Number(a.variantSellPrice) - Number(b.variantSellPrice))[0] ?? variants[0] ?? null;

  return {
    // vid is what freight prices. The sku is a human readable code and passing
    // it as a vid returns "Variant not found".
    vid: variant?.vid ?? variant?.variantId ?? null,
    sku: variant?.variantSku ?? d.productSku ?? null,
    variants: variants.length,
    weight_g: Number(variant?.variantWeight) || Number(d.productWeight) || null,
    length_mm: Number(variant?.variantLength) || null,
    width_mm: Number(variant?.variantWidth) || null,
    height_mm: Number(variant?.variantHeight) || null,
    priceUsd: Number(variant?.variantSellPrice) || null,
  };
}

// Goods price is not landed cost. A £4.74 bowl rack quoted $22.47 delivered to
// one address, so a flat shipping estimate understates by a multiple and every
// margin built on it is optimistic in the flattering direction.
export async function freightQuote({
  access, vid, quantity = 1, destAreaCode = 'GB', config = {},
}) {
  if (!vid) throw new Error('freightQuote needs a variant id, not a sku');
  const rate = Number(config.usdToGbp);
  if (!Number.isFinite(rate)) throw new Error('cj_dropshipping: config.usdToGbp not set');

  const endpoint = config.freightEndpoint ?? 'freightCalculate';

  const res = await paced(() =>
    fetch(`${BASE}/logistic/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': access },
      // Proven against CJ's own documented sku: freightCalculate takes
      // startCountryCode, endCountryCode and a products array keyed on vid.
      // The reqDTOS shape in the example belongs to the other endpoint and
      // returns an empty option list.
      body: JSON.stringify({
        startCountryCode: config.srcAreaCode ?? 'CN',
        endCountryCode: destAreaCode,
        products: [{ quantity, vid }],
      }),
    }),
  );

  const json = await res.json();
  if (!json.result && !json.success) throw new Error(json.message ?? 'no freight response');

  const raw = json.data ?? [];
  const options = raw
    .map((o) => ({
      service: o.logisticName ?? o.option?.enName ?? null,
      arrival: o.logisticAging ?? o.arrivalTime ?? null,
      feeUsd: Number(o.logisticPrice ?? o.discountFee),
    }))
    .filter((o) => Number.isFinite(o.feeUsd) && o.feeUsd > 0)
    .sort((a, b) => a.feeUsd - b.feeUsd);

  // A silent null is indistinguishable from a call that was never made, and
  // that ambiguity already cost one run.
  if (!options.length) {
    return {
      empty: true,
      returned: raw.length,
      reason: raw.length
        ? 'options returned with no usable fee'
        : `no options from ${endpoint} for ${destAreaCode}${json.message ? `, said "${json.message}"` : ''}`,
    };
  }

  const cheapest = options[0];
  // Slowest acceptable arrival is the last number in "12-50".
  const days = Number(String(cheapest.arrival ?? '').split('-').pop()) || null;

  return {
    service: cheapest.service,
    fee: Math.round(cheapest.feeUsd * rate * 100) / 100,
    feeUsd: cheapest.feeUsd,
    days,
    options: options.length,
  };
}

// The third level category tree. Filtering by it is the only way to stop an
// Elasticsearch best match returning human furniture for "dog bed".
export async function categories(access) {
  const res = await paced(() =>
    fetch(`${BASE}/product/getCategory`, { headers: { 'CJ-Access-Token': access } }),
  );
  const json = await res.json();
  if (!json.result && !json.success) throw new Error(json.message ?? 'no response');

  const out = [];
  for (const one of json.data ?? []) {
    for (const two of one.categoryFirstList ?? []) {
      for (const three of two.categorySecondList ?? []) {
        out.push({
          id: three.categoryId,
          name: three.categoryName,
          path: [one.categoryFirstName, two.categorySecondName, three.categoryName].join(' | '),
        });
      }
    }
  }
  return out;
}

export async function searchByKeyword(keyword, { access, config, maxGoodsGbp, country, categoryIds }) {
  const rate = Number(config.usdToGbp);
  if (!Number.isFinite(rate)) throw new Error('cj_dropshipping: config.usdToGbp not set');

  // countryCode filters to products holding inventory in that country, which on
  // CJ is a small fraction of the catalogue. The caller decides, because the
  // pipeline config sets GB for a different purpose.
  const countryCode = country === undefined ? config.countryCode ?? null : country;

  const url = new URL(`${BASE}/product/listV2`);
  url.searchParams.set('keyWord', keyword);
  if (countryCode) url.searchParams.set('countryCode', countryCode);
  url.searchParams.set('page', '1');
  url.searchParams.set('size', String(Math.min(config.size ?? 10, 100)));
  url.searchParams.set('features', 'enable_category');

  // keyWord is a best match search, so the words are ORed and the most listed
  // product wins. A category is the only thing that keeps it on the subject.
  for (const id of categoryIds ?? []) url.searchParams.append('lv3categoryList', id);

  // Goods above headroom cannot produce a margin at any volume, so there is no
  // reason to fetch them. It is also what stops a search for a dog bed
  // returning three foot single beds for people.
  if (Number.isFinite(maxGoodsGbp) && maxGoodsGbp > 0) {
    url.searchParams.set('endSellPrice', (maxGoodsGbp / rate).toFixed(2));
  }

  // Same retry the term adapter does. Throwing on the first 429 turned a
  // transient rate limit into a lost product.
  const maxRetries = config.maxRetries ?? 3;
  let json = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const res = await paced(() => fetch(url, { headers: { 'CJ-Access-Token': access } }));
    json = await res.json();
    if (json.pointsInfo) points = json.pointsInfo;

    if (res.status !== 429 && json.code !== 429) break;

    if (classify429(json, json.pointsInfo) === 'points') {
      throw new Error(`CJ points exhausted. ${json.message ?? ''}`);
    }

    if (attempt === maxRetries) throw new Error('CJ rate limited after retries');
    await sleep(2000 * 2 ** attempt);
  }

  if (!json.result && !json.success) throw new Error(json.message ?? 'no response');

  const products = json.data?.content?.flatMap((c) => c.productList ?? []) ?? [];
  const shippingEstimate = Number(config.shippingEstimateGbp ?? 0);
  const total = json.data?.totalRecords ?? null;

  const mapped = products.map((p) => {
    const pair = normaliseProduct(p, { rate, shippingEstimate, marketplaceCountry: countryCode });
    if (!pair) return null;
    const [supply] = pair;
    return {
      external_ref: supply.externalRef,
      title: supply.title,
      image_url: supply.imageUrl,
      category: supply.category,
      unit_cost: supply.landedCost,
      raw: supply.raw,
    };
  }).filter(Boolean);

  mapped.total = total;
  mapped.query = url.search;
  return mapped;
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
