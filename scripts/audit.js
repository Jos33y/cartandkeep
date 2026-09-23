/*
 * Audits an existing eBay catalogue. Takes a seller, pulls everything they
 * have live, and asks of each listing the only question that matters:
 * could this ever have made money.
 *
 *   node scripts/audit.js --file=bellatiquelistings.csv --csv=audit.csv
 *   node scripts/audit.js --file=listings.csv --band=evri5 --target=5
 *
 * Takes the listings export, reads the item id out of each eBay URL, and asks
 * eBay what each one has actually sold. The Browse sellers filter cannot do
 * this on its own: it is a filter, and the API still demands a q or a category
 * alongside it, so a seller's whole catalogue is not reachable that way.
 *
 * For every listing it works out the highest landed cost that would still
 * clear the target profit. If that number is below what the thing plausibly
 * costs, the listing was never going to pay whatever anyone did with it.
 *
 * It also checks each item against its own market, because a listing priced
 * miles above what the same product sells for elsewhere is not a product
 * problem, it is a pricing one, and those are fixable.
 *
 * Needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';

const BANDS = {
  letter100: { postage: 1.52, packaging: 0.15, label: 'large letter to 100g' },
  letter250: { postage: 1.81, packaging: 0.15, label: 'large letter to 250g' },
  letter500: { postage: 2.30, packaging: 0.20, label: 'large letter to 500g' },
  evri5: { postage: 2.62, packaging: 0.40, label: 'Evri to 5kg' },
  evri10: { postage: 5.87, packaging: 0.50, label: 'Evri 5 to 10kg' },
  parcel: { postage: 4.25, packaging: 0.40, label: 'Royal Mail small parcel' },
};

const D = {
  marketplace: 'EBAY_GB',
  band: 'evri5',
  target: 5.00,
  fvfPct: 0.128, fvfFixed: 0.30, adRate: 0.03,
  returnRate: 0.05, returnCost: 6.00,
  minAgeDays: 7,
  marketSample: 20,   // listings to read when checking an item's own market
};

// The export is quoted and full of commas inside fields, so it needs a real
// parser rather than a split.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const src = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0];
  return rows.slice(1).filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h || `col${i}`, r[i] ?? ''])));
}

function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, '').trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

let lastCall = 0;
const paced = async (fn, gap = 110) => {
  const wait = Math.max(0, gap - (Date.now() - lastCall));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fn();
};

async function token({ clientId, clientSecret }) {
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
  });
  if (!res.ok) throw new Error(`ebay auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const hdrs = (a, m) => ({ Authorization: `Bearer ${a}`, 'X-EBAY-C-MARKETPLACE-ID': m });

// ------------------------------------------------------------------ the maths

export function bandOf(c = D) { return BANDS[c.band] ?? BANDS.parcel; }

// Everything that leaves on an order regardless of what the goods cost.
export function fixedCost(price, c = D) {
  const b = bandOf(c);
  return Math.round((price * c.fvfPct + c.fvfFixed + price * c.adRate
    + b.postage + b.packaging + c.returnRate * c.returnCost) * 100) / 100;
}

// The highest the goods could have cost and still cleared the target. If this
// comes back at or under zero, the listing could never pay at any buying price.
export function maxLandedCost(price, c = D) {
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round((price - fixedCost(price, c) - c.target) * 100) / 100;
}

export function readSold(detail) {
  for (const a of detail?.estimatedAvailabilities ?? []) {
    const n = Number(a?.estimatedSoldQuantity);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function readAge(item, now = Date.now()) {
  const raw = item?.itemOriginDate ?? item?.itemCreationDate;
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = (now - t) / 86400000;
  return d >= 0 ? Math.max(d, 1) : null;
}

export function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.floor(xs.length / 2)];
}

// A short searchable phrase from a keyword-stuffed eBay title.
export function toQuery(title, words = 6) {
  // "hot" is not noise: hot water, hot plate, hot tub. Stripping it is the same
  // error as the pipeline stripping "pet" out of pet water fountain.
  const noise = /\b(free|fast|uk|gb|new|genuine|original|quality|top|best|premium|brand|sealed|in box|delivery|postage|stock|sale|offer|deal|choose|value|super|with|for|and|the)\b/gi;
  const t = String(title).replace(/[|/\\,\-–—"“”'’()\[\]]+/g, ' ').replace(noise, ' ');
  return t.replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 1).slice(0, words).join(' ').toLowerCase();
}

// pass    it sells and it could pay
// price   it could pay but it is priced away from where the market buys
// never   no buying price would have made this work
// dead    nothing has sold on it
export function classify({ price, sold, ageDays, marketMedian }, c = D) {
  const cap = maxLandedCost(price, c);
  const reasons = [];
  if (cap == null || cap <= 0) return { verdict: 'never', cap, reasons: ['no buying price clears the target at this selling price'] };
  if (sold === 0) reasons.push('nothing has sold');
  if (marketMedian != null && price > marketMedian * 1.35) {
    reasons.push(`priced ${Math.round((price / marketMedian - 1) * 100)}% over the market median of £${marketMedian.toFixed(2)}`);
  }
  if (marketMedian != null && maxLandedCost(marketMedian, c) <= 0) {
    return { verdict: 'never', cap, reasons: [...reasons, `the market itself sells at £${marketMedian.toFixed(2)}, which cannot pay`] };
  }
  if (sold === 0) return { verdict: 'dead', cap, reasons };
  if (reasons.length) return { verdict: 'price', cap, reasons };
  return { verdict: 'pass', cap, reasons };
}

// ------------------------------------------------------------------- fetching

// The numeric id out of an eBay item URL, whatever query string follows it.
export function legacyId(url) {
  const m = String(url ?? '').match(/\/itm\/(?:.*?\/)?(\d{9,15})/);
  return m ? m[1] : null;
}

// The export's column names come from whatever scraped it, so find the columns
// by shape rather than by name.
export function readExport(rows) {
  const out = [];
  for (const r of rows) {
    const vals = Object.values(r).map((v) => String(v ?? ''));
    const url = vals.find((v) => /ebay\.[a-z.]+\/itm\//.test(v));
    const priceCell = vals.find((v) => /^\s*[£$€]\s?[\d,]+\.\d{2}/.test(v));
    const title = vals
      .filter((v) => v && !/^https?:/.test(v) && !/^\s*[£$€]/.test(v))
      .sort((a, b) => b.length - a.length)[0];
    const id = legacyId(url);
    const price = priceCell ? Number(priceCell.replace(/[^\d.]/g, '')) : null;
    if (id && Number.isFinite(price)) out.push({ legacyId: id, price, title: title ?? '', url });
  }
  return out;
}

async function getByLegacyId({ access, marketplace, id }) {
  const url = new URL(`${BROWSE}/item/get_item_by_legacy_id`);
  url.searchParams.set('legacy_item_id', id);
  const res = await paced(() => fetch(url, { headers: hdrs(access, marketplace) }));
  if (!res.ok) return { error: res.status };
  return res.json();
}

async function marketFor({ access, marketplace, q, sample }) {
  const url = new URL(`${BROWSE}/item_summary/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(sample));
  const res = await paced(() => fetch(url, { headers: hdrs(access, marketplace) }));
  if (!res.ok) return null;
  const body = await res.json();
  return median((body.itemSummaries ?? []).map((i) => Number(i.price?.value)));
}

// ----------------------------------------------------------------------- main

async function main() {
  const argv = process.argv.slice(2);
  const get = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const cfg = {
    ...D,
    marketplace: get('marketplace', D.marketplace),
    band: get('band', D.band),
    target: Number(get('target', D.target)),
  };
  const file = get('file', null);
  const csv = get('csv', null);
  const noMarket = argv.includes('--no-market');
  const limit = Number(get('limit', 0));

  if (!file) {
    console.error('\nGive the listings export: --file=bellatiquelistings.csv\n');
    process.exit(1);
  }

  for (const f of ['.env.local', '.env']) {
    try {
      const vars = parseEnv(await readFile(f, 'utf8'));
      for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
    } catch { /* absent is normal */ }
  }
  const clientId = process.env.EBAY_CLIENT_ID ?? process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET ?? process.env.EBAY_CERT_ID;
  if (!clientId || !clientSecret) {
    console.error('eBay credentials not found in the environment or .env.local');
    process.exit(1);
  }

  const raw = await readFile(file, 'utf8');
  const parsed = parseCsv(raw);
  let items = readExport(parsed);
  if (!items.length) {
    console.error(`\nNo eBay item URLs with prices found in ${file}.`);
    console.error('The export needs a column holding /itm/ links and one holding prices.\n');
    process.exit(1);
  }
  if (limit) items = items.slice(0, limit);

  const access = await token({ clientId, clientSecret });

  console.log(`\n${items.length} listings from ${file}`);
  console.log(`costed on ${bandOf(cfg).label}, target £${cfg.target.toFixed(2)} a unit`);
  console.log(`about ${items.length * (noMarket ? 1 : 2)} API calls\n`);

  const rows = [];
  let gone = 0;
  for (const it of items) {
    const detail = await getByLegacyId({ access, marketplace: cfg.marketplace, id: it.legacyId });
    if (detail?.error) { gone += 1; }
    const sold = readSold(detail);
    const ageDays = readAge(detail);
    const q = toQuery(it.title);
    const marketMedian = noMarket ? null : await marketFor({ access, marketplace: cfg.marketplace, q, sample: cfg.marketSample });

    const c = classify({ price: it.price, sold, ageDays, marketMedian }, cfg);
    rows.push({
      title: it.title, price: it.price, sold, ageDays: ageDays == null ? null : Math.round(ageDays),
      perMonth: sold != null && ageDays >= cfg.minAgeDays ? Math.round((sold / ageDays) * 30) : null,
      marketMedian, maxLanded: c.cap, verdict: c.verdict, reasons: c.reasons, itemId: it.legacyId,
    });
  }
  if (gone) console.log(`  ${gone} of ${items.length} no longer return from eBay, so they have ended.\n`);

  const by = (v) => rows.filter((r) => r.verdict === v);
  console.log('  verdict   count   what it means');
  console.log(`  never     ${String(by('never').length).padStart(5)}   no buying price would have made this pay`);
  console.log(`  dead      ${String(by('dead').length).padStart(5)}   could pay, but nothing has sold on it`);
  console.log(`  price     ${String(by('price').length).padStart(5)}   sells, but priced away from the market`);
  console.log(`  pass      ${String(by('pass').length).padStart(5)}   selling, and it can pay`);
  console.log();

  for (const v of ['never', 'price', 'dead', 'pass']) {
    const list = by(v);
    if (!list.length) continue;
    console.log(`${v.toUpperCase()}\n`);
    for (const r of list.sort((a, b) => (b.perMonth ?? 0) - (a.perMonth ?? 0)).slice(0, 25)) {
      const mm = r.marketMedian == null ? '   -  ' : `£${r.marketMedian.toFixed(2)}`;
      console.log(`  £${r.price.toFixed(2).padStart(7)}  market ${mm}  max buy £${String(r.maxLanded ?? '-').padStart(6)}  `
        + `${String(r.sold ?? '?').padStart(4)} sold  ${String(r.ageDays ?? '?').padStart(4)}d  ${String(r.title).slice(0, 44)}`);
      for (const why of r.reasons) console.log(`             ${why}`);
    }
    console.log();
  }

  if (csv) {
    const head = 'verdict,price,market_median,max_landed_cost,sold,age_days,units_per_month,title,item_id,reasons\n';
    await writeFile(csv, head + rows.map((r) => [
      r.verdict, r.price, r.marketMedian ?? '', r.maxLanded ?? '', r.sold ?? '', r.ageDays ?? '',
      r.perMonth ?? '', JSON.stringify(r.title), r.itemId, JSON.stringify(r.reasons.join('; ')),
    ].join(',')).join('\n') + '\n');
    console.log(`${csv} written, ${rows.length} rows.\n`);
  }

  console.log('Max buy is the most the goods could have cost and still cleared the target.');
  console.log('Where it is negative, no supplier on earth would have saved that listing.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`\naudit failed: ${e?.stack ?? e}\n`); process.exit(1); });
}
