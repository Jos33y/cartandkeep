/*
 * One real landed cost, for one product, from CJ. Goods plus a live freight
 * quote to GB, not an estimate.
 *
 *   node scripts/cost.js --rate=0.79 "cat water fountain stainless steel 2.2L"
 *   node scripts/cost.js --rate=0.79 --price=22 --top=3 "puppy playpen foldable metal"
 *
 * Every margin in the gate rests on a landed cost that nobody has measured.
 * This measures one. It reuses the pipeline's own CJ adapter rather than a
 * second implementation, so what it proves is what the pipeline will do.
 *
 * Needs CJ_API_KEY, and --rate because the adapter refuses to invent one.
 */

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  token, searchByKeyword, productDetail, freightQuote, pointsUsed, setPace,
} from '../pipeline/sources/cjDropshipping.js';

const FVF_PCT = 0.128;
const FVF_FIXED = 0.30;
const AD_RATE = 0.03;
const RETURNS = 0.30;
const RM_PARCEL = 4.25;
const RM_PACKAGING = 0.40;

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

// Same shape as the gate's model, split by who posts the parcel. The route is
// the single biggest thing in these numbers and it was missing from all of them.
export function margins({ price, landed, selfPostBand = { postage: RM_PARCEL, packaging: RM_PACKAGING } }) {
  if (!Number.isFinite(price) || !Number.isFinite(landed)) return null;
  const fees = price * FVF_PCT + FVF_FIXED + price * AD_RATE + RETURNS;
  return {
    supplierShips: Math.round((price - fees - landed) * 100) / 100,
    sheStocksAndPosts: Math.round((price - fees - selfPostBand.postage - selfPostBand.packaging - landed) * 100) / 100,
  };
}

const gbp = (n) => (n == null ? '     -' : `£${Number(n).toFixed(2)}`.padStart(7));

async function main() {
  const argv = process.argv.slice(2);
  const get = (k, d) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const keyword = argv.filter((a) => !a.startsWith('--')).join(' ');

  if (!keyword) {
    console.error('Give a product to search for, in quotes.');
    process.exit(1);
  }

  const rate = Number(get('rate'));
  if (!Number.isFinite(rate) || rate <= 0) {
    console.error('--rate= is required. USD to GBP. The adapter refuses to invent one and so does this.');
    process.exit(1);
  }

  const price = Number(get('price', 0)) || null;
  const top = Number(get('top', 3));
  const country = get('country', '');   // empty means every warehouse
  const dest = get('dest', 'GB');

  for (const f of ['.env.local', '.env']) {
    try {
      const vars = parseEnv(await readFile(f, 'utf8'));
      for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
    } catch { /* absent is normal */ }
  }

  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) {
    const seen = Object.keys(process.env).filter((k) => /cj/i.test(k)).sort();
    console.error(`\nCJ_API_KEY not set. Keys containing "cj": ${seen.join(', ') || 'none'}\n`);
    process.exit(1);
  }

  setPace(1);
  const access = await token(apiKey);
  const config = { usdToGbp: rate, size: 20, shippingEstimateGbp: 0 };

  console.log(`\n"${keyword}"  rate ${rate}  dest ${dest}${country ? `  warehouse ${country}` : '  every warehouse'}\n`);

  const matches = await searchByKeyword(keyword, {
    access, config, maxGoodsGbp: null, country: country || null, categoryIds: [],
  });

  if (!matches.length) {
    console.log(`No CJ match. ${matches.total ?? 0} total for that query.`);
    console.log('That is a route failure, not a product failure. Try fewer words.\n');
    return;
  }

  console.log(`${matches.length} returned of ${matches.total ?? '?'} total. Pricing the top ${top}.\n`);

  for (const m of matches.slice(0, top)) {
    let detail = null; let freight = null; let why = null;
    try { detail = await productDetail({ access, pid: m.external_ref }); }
    catch (e) { why = `detail failed: ${e.message}`; }

    if (detail?.vid) {
      try {
        const q = await freightQuote({ access, vid: detail.vid, destAreaCode: dest, config });
        if (q?.empty) why = q.reason; else freight = q;
      } catch (e) { why = e.message; }
    } else if (detail) why = 'no variant id on the product';

    const landed = m.unit_cost != null && freight ? Math.round((m.unit_cost + freight.fee) * 100) / 100 : null;

    console.log(`  ${String(m.title ?? '').slice(0, 68)}`);
    console.log(`    goods ${gbp(m.unit_cost)}   freight ${freight ? gbp(freight.fee) : '      ?'}   landed ${gbp(landed)}`
      + (freight ? `   ${freight.service}, ${freight.days ?? '?'} days` : ''));
    if (!freight && why) console.log(`    no freight quote: ${why}`);
    if (detail) console.log(`    ${detail.variants} variants, ${detail.weight_g ?? '?'}g`);

    if (price && landed != null) {
      const m2 = margins({ price, landed });
      console.log(`    at £${price.toFixed(2)}:  CJ ships ${gbp(m2.supplierShips)} a unit   `
        + `she stocks and posts ${gbp(m2.sheStocksAndPosts)} a unit`);
    }
    console.log('');
  }

  const pts = pointsUsed();
  if (pts) console.log(`CJ points: ${pts.usedToday} used today, ${pts.remaining} left\n`);
  console.log('A match is a guess until somebody looks at the picture and agrees it is the same product.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`\ncost failed: ${e?.stack ?? e}\n`); process.exit(1); });
}
