/*
 * Three questions, a handful of calls, no assumptions.
 *
 * 1. Does the bulk item read carry sold quantities? The gate reads ten
 *    listings one at a time, which is ten calls from the Browse bucket. The
 *    bulk call takes twenty ids at once and draws on a separate bucket that
 *    is untouched. If the sold figures are in it, a gated query costs two
 *    calls instead of twenty one.
 * 2. Is the keyset entitled to Marketplace Insights, which carries real sold
 *    history rather than a rate derived from lifetime sales over age?
 * 3. Is it entitled to the Product Research API, which is what Terapeak runs
 *    on?
 *
 * Nothing here changes the pipeline. It prints what eBay says so the change
 * can be written against a real response rather than a guess.
 *
 * Usage:
 *   node scripts/probe-apis.js
 *   node scripts/probe-apis.js --q="bed rail for elderly"
 */

import { pathToFileURL } from 'node:url';
import { token, loadEnvFiles, pickCredentials, search } from './gate.js';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';
const INSIGHTS = 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search';
const RESEARCH = 'https://api.ebay.com/sell/analytics/v1/product_insight';

const headers = (access) => ({
  authorization: `Bearer ${access}`,
  'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB',
  accept: 'application/json',
});

const show = (label, res, body) => {
  console.log(`\n--- ${label}: HTTP ${res.status}`);
  console.log(JSON.stringify(body).slice(0, 700));
};

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const q = arg('q', 'bed rail for elderly');

  const loaded = await loadEnvFiles(arg('env-file'));
  const cred = pickCredentials(process.env, arg('id-key'), arg('secret-key'));
  if (!cred.clientId || !cred.clientSecret) {
    console.error(`\nNo eBay credentials found. Read: ${loaded.join(', ') || 'nothing'}\n`);
    process.exit(1);
  }
  const access = await token(cred);

  const found = await search({
    access, marketplace: 'EBAY_GB', q, limit: 5,
    filter: 'conditions:{NEW},buyingOptions:{FIXED_PRICE}',
  });
  const ids = (found.itemSummaries ?? []).map((i) => i.itemId).filter(Boolean);
  console.log(`\n"${q}": ${ids.length} ids from one search call`);

  if (ids.length) {
    const url = new URL(`${BROWSE}/item/`);
    url.searchParams.set('item_ids', ids.join(','));
    const res = await fetch(url, { headers: headers(access) });
    const body = await res.json();

    const items = body?.items ?? [];
    const withSold = items.filter((i) => i?.estimatedAvailabilities?.length).length;
    console.log(`\n--- bulk item read: HTTP ${res.status}, ${items.length} items, `
      + `${withSold} carrying estimatedAvailabilities`);
    if (items[0]) {
      console.log('  fields on the first item:');
      console.log(`  ${Object.keys(items[0]).join(', ')}`);
      console.log(`  estimatedAvailabilities: ${JSON.stringify(items[0].estimatedAvailabilities ?? null)}`);
      console.log(`  itemCreationDate: ${items[0].itemCreationDate ?? '?'}  `
        + `itemOriginDate: ${items[0].itemOriginDate ?? '?'}`);
    } else {
      console.log(`  ${JSON.stringify(body).slice(0, 500)}`);
    }
  }

  const insights = new URL(INSIGHTS);
  insights.searchParams.set('q', q);
  insights.searchParams.set('limit', '3');
  const iRes = await fetch(insights, { headers: headers(access) });
  show('marketplace insights, sold history', iRes, await iRes.json());

  const rRes = await fetch(`${RESEARCH}?marketplace_id=EBAY_GB&keyword=${encodeURIComponent(q)}`, {
    headers: headers(access),
  });
  show('product research', rRes, await rRes.json());

  console.log('\nA 403 here means the keyset is not entitled, which is an answer too.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`\nprobe failed: ${e?.stack ?? e}\n`);
    process.exit(1);
  });
}
