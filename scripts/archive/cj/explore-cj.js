/*
 * The other direction. Instead of asking CJ for a product we already chose,
 * this lists what CJ actually stocks in our categories and works out what it
 * would have to sell for on eBay to be worth listing.
 *
 * This is not supply-first. CJ only proposes. Nothing here is a candidate until
 * Terapeak says the demand is there, which is a separate step and a manual one.
 *
 * Usage:
 *   node scripts/explore-cj.js --category=2410110341061612000 --limit=2
 *   node scripts/explore-cj.js --leaf="Dishes, Feeders" --limit=3 --target=6
 */

import { connect } from '../pipeline/lib/db.js';
import {
  token, searchByKeyword, productDetail, freightQuote, pointsUsed, setPace,
} from '../pipeline/sources/cjDropshipping.js';

const arg = (n) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const gbp = (n) => (n == null ? '     -' : `£${Number(n).toFixed(2)}`.padStart(7));

// eBay fee, ads and the fixed charge, from the same constants the analysis uses.
const EBAY_PCT = 0.128;
const EBAY_FIXED = 0.30;
const ADS_PCT = 0.06;

// She does not post it and does not pack it, so the only costs against the sale
// price are the platform's. Solve for the price that leaves the target.
function priceToClear(target, landed) {
  return Math.round(((target + EBAY_FIXED + landed) / (1 - EBAY_PCT - ADS_PCT)) * 100) / 100;
}

async function main() {
  const { db, E } = await connect();
  const limit = Number(arg('limit') ?? 2);
  const target = Number(arg('target') ?? 5);
  const leaf = arg('leaf');
  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant } = await db.from('tenants').select('id, name').eq('slug', slug).single();
  const { data: src } = await db
    .from('tenant_sources').select('config, credential_ref')
    .eq('tenant_id', tenant.id).eq('source_id', 'cj_dropshipping').single();

  const config = { ...(src?.config ?? {}) };
  const creds = JSON.parse(src?.credential_ref ?? '{}');
  const apiKey = E[creds.apiKey] ?? E.CJ_API_KEY;

  if (!apiKey || !Number.isFinite(Number(config.usdToGbp))) {
    console.error('Missing CJ key or usdToGbp.');
    process.exit(1);
  }

  let categoryIds = (arg('category') ?? '').split(',').map((x) => x.trim()).filter(Boolean);

  if (!categoryIds.length) {
    let q = db
      .from('supplier_categories')
      .select('supplier_category_id, supplier_category, ebay_path_prefix')
      .eq('tenant_id', tenant.id)
      .eq('supplier', 'cj_dropshipping');

    if (leaf) q = q.ilike('ebay_path_prefix', `%${leaf}%`);
    const { data } = await q;
    categoryIds = [...new Set((data ?? []).map((r) => r.supplier_category_id))];
  }

  if (!categoryIds.length) {
    console.error('No categories. Pass --category= or --leaf=.');
    process.exit(1);
  }

  if (config.requestsPerSecond) setPace(config.requestsPerSecond);
  const access = await token(apiKey);

  const keyword = arg('keyword') ?? 'pet';
  const found = await searchByKeyword(keyword, {
    access, config, country: null, categoryIds,
  });

  if (!found.length) {
    console.log('\nNothing returned for those categories.\n');
    return;
  }

  // Most listed first. A product nobody sells is not a product with no
  // competition, it is usually a product nobody wants.
  const ranked = [...found]
    .sort((a, b) => (Number(b.raw?.listedNum) || 0) - (Number(a.raw?.listedNum) || 0))
    .slice(0, limit);

  console.log(`\n${tenant.name}, ${found.length} products in those categories, pricing the top ${ranked.length} by how many sellers list them\n`);

  for (const p of ranked) {
    let detail = null;
    let freight = null;
    let note = null;

    try {
      detail = await productDetail({ access, pid: p.external_ref });
    } catch (e) {
      note = `detail failed: ${e?.message ?? String(e)}`;
    }

    if (detail?.vid) {
      try {
        const q = await freightQuote({
          access, vid: detail.vid, destAreaCode: config.destAreaCode ?? 'GB', config,
        });
        if (q?.empty) note = q.reason;
        else freight = q;
      } catch (e) {
        note = e?.message ?? String(e);
      }
    }

    const landed = freight ? Math.round((p.unit_cost + freight.fee) * 100) / 100 : null;
    const needs = landed == null ? null : priceToClear(target, landed);

    console.log(`  ${String(p.title ?? '').slice(0, 66)}`);
    console.log(
      `    goods ${gbp(p.unit_cost)}  freight ${gbp(freight?.fee)}  landed ${gbp(landed)}  `
      + `sell at ${gbp(needs)} to clear £${target.toFixed(2)}`,
    );
    console.log(
      `    ${p.raw?.listedNum ?? '?'} sellers list it, ${detail?.weight_g ?? '?'}g, `
      + `${freight ? `${freight.service}, ${freight.days ?? '?'} days` : note ?? 'no freight'}`,
    );
    console.log(`    check on Terapeak: what sells at £${needs ?? '?'} and how many a month\n`);
  }

  const pts = pointsUsed();
  if (pts) console.log(`  CJ points: ${pts.usedToday} used today, ${pts.remaining} remaining\n`);
  console.log('None of these are candidates. Terapeak decides that, not CJ.\n');
}

main();
