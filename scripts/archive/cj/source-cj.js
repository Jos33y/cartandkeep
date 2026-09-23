/*
 * Looks for a supplier for products demand already chose. The reverse of the
 * pipeline adapter, which asks CJ what it stocks and lets the catalogue decide
 * the shortlist.
 *
 * Nothing it finds is trusted. Matching an eBay title to a supplier catalogue
 * is a guess, so every result is written unconfirmed and a margin is only
 * computed from a source somebody has agreed with.
 *
 * Usage:
 *   node scripts/source-cj.js --date=2026-08-10 --dry
 *   node scripts/source-cj.js --date=2026-08-10
 *   node scripts/source-cj.js --date=2026-08-10 --limit=5
 *   node scripts/source-cj.js --date=2026-08-10 --limit=3 --dry --no-cap
 *
 * A dry run prints what came back. A cheapest price on its own tells you
 * nothing about whether the search found the right product.
 */

import { connect } from '../pipeline/lib/db.js';
import {
  token, searchByKeyword, productDetail, freightQuote, pointsUsed, setPace,
} from '../pipeline/sources/cjDropshipping.js';

// Longest matching prefix, same rule the portal uses for its own boundaries.
function categoriesFor(path, mappings) {
  const parts = String(path ?? '').split(/\s*[|>]\s*/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!parts.length) return [];

  let best = { depth: 0, ids: [] };

  for (const m of mappings) {
    const prefix = String(m.ebay_path_prefix).split(/\s*[|>]\s*/).map((x) => x.trim().toLowerCase());
    if (prefix.length > parts.length) continue;
    if (prefix.some((seg, i) => seg !== parts[i])) continue;
    if (prefix.length > best.depth) best = { depth: prefix.length, ids: [] };
    if (prefix.length === best.depth) best.ids.push(m.supplier_category_id);
  }

  return best.ids;
}

// eBay titles are keyword stuffed for search, not written for a human. Feeding
// one to CJ whole returns nothing, so it is cut back to the product words.
const NOISE = new Set([
  'for', 'with', 'and', 'the', 'pet', 'pets', 'new', 'free', 'uk', 'x', 'xl', 'xxl',
  'large', 'small', 'medium', 'extra', 'jumbo', 'size', 'sizes', 'various', 'pack',
  'packs', 'soft', 'heavy', 'duty', 'premium', 'professional', 'luxury', 'quality',
  'washable', 'non', 'slip', 'anti', 'super', 'best', 'top', 'hot', 'sale',
]);

export function keywordFor(title, take = 3) {
  const words = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    // Any token carrying a digit is a size, a quantity or listing debris.
    .filter((w) => w.length > 2 && !NOISE.has(w) && !/\d/.test(w));

  const seen = new Set();
  const out = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length === take) break;
  }
  return out.join(' ');
}

const gbp = (n) => (n == null ? '     -' : `£${Number(n).toFixed(2)}`.padStart(6));

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const date = args.find((a) => a.startsWith('--date='))?.split('=')[1];
  const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0);
  const noCap = args.includes('--no-cap');
  const words = Number(args.find((a) => a.startsWith('--words='))?.split('=')[1] ?? 3);

  // Explicit empty means search every warehouse, which is most of the catalogue.
  const countryArg = args.find((a) => a.startsWith('--country='));
  const country = countryArg === undefined ? undefined : countryArg.split('=')[1] || null;

  const categoryIds = (args.find((a) => a.startsWith('--category='))?.split('=')[1] ?? '')
    .split(',').map((x) => x.trim()).filter(Boolean);

  // The docs name freightCalculate and freightCalculateTip and are unclear
  // which is the accurate one, so it is switchable rather than guessed.
  const freightEndpoint = args.find((a) => a.startsWith('--freight='))?.split('=')[1];
  const destOverride = args.find((a) => a.startsWith('--dest='))?.split('=')[1];

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name').eq('slug', slug).single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  const { data: source, error: sErr } = await db
    .from('tenant_sources')
    .select('config, credential_ref')
    .eq('tenant_id', tenant.id)
    .eq('source_id', 'cj_dropshipping')
    .single();

  if (sErr || !source) {
    console.error('No cj_dropshipping row in tenant_sources for this tenant.');
    process.exit(1);
  }

  const config = { ...(source.config ?? {}) };
  if (freightEndpoint) config.freightEndpoint = freightEndpoint;
  if (destOverride) config.destAreaCode = destOverride;

  // The same refusal the adapter makes. A guessed rate corrupts every cost.
  if (!Number.isFinite(Number(config.usdToGbp))) {
    console.error('cj_dropshipping config.usdToGbp is not set. Refusing to invent an exchange rate.');
    process.exit(1);
  }

  const creds = JSON.parse(source.credential_ref ?? '{}');
  const apiKey = E[creds.apiKey] ?? E.CJ_API_KEY;
  if (!apiKey) {
    console.error('CJ API key not found in the environment.');
    process.exit(1);
  }

  let q = db
    .from('candidates')
    .select('id, title, headroom, tier, margin, ebay_category_path, batches!inner ( delivered_for )')
    .eq('tenant_id', tenant.id)
    .order('score', { ascending: false, nullsFirst: false });

  if (date) q = q.eq('batches.delivered_for', date);

  const { data: rows, error } = await q;

  if (error) {
    console.error('Could not read candidates:', error.message);
    process.exit(1);
  }

  const candidates = limit ? rows.slice(0, limit) : rows;

  if (!candidates.length) {
    console.log('\nNothing to source.\n');
    return;
  }

  const { data: mappings } = await db
    .from('supplier_categories')
    .select('ebay_path_prefix, supplier_category_id')
    .eq('tenant_id', tenant.id)
    .eq('supplier', 'cj_dropshipping');

  if (config.requestsPerSecond) setPace(config.requestsPerSecond);
  const access = await token(apiKey);

  console.log(`\n${tenant.name}, sourcing ${candidates.length} candidates on CJ`);
  console.log(`  listV2 costs 50 points a call, so roughly ${candidates.length * 50} of 50,000 today\n`);

  let found = 0;
  let none = 0;
  const bestFor = new Map();

  for (const c of candidates) {
    const keyword = keywordFor(c.title, words);
    let matches = [];

    try {
      // Anything costing more than the headroom is already a loss.
      const cap = noCap || c.headroom == null
        ? null
        : Number(c.headroom) - Number(config.shippingEstimateGbp ?? 0);

      // Each product searches its own corner of CJ, derived from the eBay leaf
      // it is already filed under. One category set for a mixed batch searched
      // beds inside bowls.
      const cats = categoryIds.length
        ? categoryIds
        : categoriesFor(c.ebay_category_path, mappings ?? []);

      matches = await searchByKeyword(keyword, {
        access, config, maxGoodsGbp: cap, country, categoryIds: cats,
      });
    } catch (e) {
      console.error(`  FAIL  ${keyword}  ${e.message}`);
      if (/points exhausted/i.test(e.message)) break;
      continue;
    }

    if (!matches.length) {
      none += 1;
      // A zero with no query printed is not a finding, it is a blind spot.
      console.log(`  none  ${keyword.padEnd(28)}  ${matches.total ?? 0} total  ${matches.query ?? ''}`);
      continue;
    }

    found += 1;

    // CJ sorts by best match by default, so the first result is its answer to
    // the query. Sorting by price threw that away and reported the cheapest
    // thing in the category as the match for every product.
    const best = matches[0];
    bestFor.set(best.external_ref, [...(bestFor.get(best.external_ref) ?? []), best.title]);

    // One quote, on the best match only. Freight is where the cost actually is
    // and the flat estimate was understating it by a multiple.
    let freight = null;
    let freightNote = null;
    let detail = null;

    try {
      // The search returns a product code. Freight prices a variant, so the
      // detail call is the step in between, and it carries the dimensions too.
      detail = await productDetail({ access, pid: best.external_ref });
    } catch (e) {
      freightNote = `detail failed: ${e?.message ?? String(e)}`;
    }

    if (detail && !detail.vid) freightNote = 'no variant id on the product';

    if (detail?.vid) {
      try {
        const quote = await freightQuote({
          access,
          vid: detail.vid,
          destAreaCode: config.destAreaCode ?? 'GB',
          config,
        });

        if (!quote) freightNote = `quote came back as ${String(quote)} for ${detail.vid}`;
        else if (quote.empty) freightNote = `${quote.reason} (${detail.vid})`;
        else freight = quote;
      } catch (e) {
        freightNote = e?.message ?? `threw ${String(e)}`;
      }
    }

    // Postage comes back on because the supplier posts it, and the freight it
    // charges goes on instead.
    const postageBack = Number(c.margin?.postage ?? 0);
    const landed = best.unit_cost != null
      ? Math.round((best.unit_cost + (freight?.fee ?? 0)) * 100) / 100
      : null;

    const margin = c.headroom != null && landed != null
      ? Math.round((Number(c.headroom) + postageBack - landed) * 100) / 100
      : null;

    console.log(
      `  ok    ${keyword.padEnd(28)}  ${String(matches.length).padStart(2)} of ${matches.total ?? '?'}  `
      + `goods ${gbp(best.unit_cost)}  freight ${freight ? gbp(freight.fee) : '     ?'}  `
      + `landed ${gbp(landed)}  head ${gbp(c.headroom)}  margin ${gbp(margin)}`,
    );

    // Unconditional. A conditional log that prints nothing is the same as no
    // log at all, and that has now cost two runs.
    if (dry) {
      console.log(`          freight: ${freight
        ? `${freight.service}, ${freight.days ?? '?'} days, ${freight.options} options`
        : freightNote ?? 'no quote and no reason given'}`);

      if (detail) {
        console.log(
          `          product: ${detail.variants} variants, `
          + `${detail.weight_g ?? '?'}g, ${detail.length_mm ?? '?'}x${detail.width_mm ?? '?'}x${detail.height_mm ?? '?'}mm`,
        );
      }
    }

    // Whether the search found the product or a page of unrelated stock is only
    // visible in the titles.
    if (dry) {
      for (const m of matches.slice(0, 3)) {
        console.log(`          ${gbp(m.unit_cost)}  ${String(m.title ?? '').slice(0, 62)}`);
      }
      continue;
    }

    const { error: iErr } = await db
      .from('candidate_sources')
      .upsert(matches.map((m) => ({
        tenant_id: tenant.id,
        candidate_id: c.id,
        supplier: 'cj_dropshipping',
        external_ref: m.external_ref,
        title: m.title,
        image_url: m.image_url,
        category: m.category,
        unit_cost: m.unit_cost,
        currency: 'GBP',
        inventory: m.raw?.inventory ?? null,
        lead_time_days: Number(String(m.raw?.deliveryCycle ?? '').split('-').pop()) || null,
        supplier_kind: 'marketplace',
        fulfilment: 'dropship',
        // Only the best match carries a real freight quote. The rest are
        // alternatives nobody has priced.
        supplier_shipping: m.external_ref === best.external_ref ? freight?.fee ?? null : null,
        weight_g: m.external_ref === best.external_ref ? detail?.weight_g ?? null : null,
        length_mm: m.external_ref === best.external_ref ? detail?.length_mm ?? null : null,
        width_mm: m.external_ref === best.external_ref ? detail?.width_mm ?? null : null,
        height_mm: m.external_ref === best.external_ref ? detail?.height_mm ?? null : null,
        ships_from: 'CN',
        transit_days: m.external_ref === best.external_ref
          ? freight?.days ?? null
          : Number(String(m.raw?.deliveryCycle ?? '').split('-').pop()) || null,
        matched_on: keyword,
        raw: { ...(m.raw ?? {}), freight: m.external_ref === best.external_ref ? freight : null },
      })), { onConflict: 'candidate_id,supplier,external_ref' });

    if (iErr) console.error(`        write failed: ${iErr.message}`);
  }

  const pts = pointsUsed();
  if (pts) console.log(`\n  CJ points: ${pts.usedToday} used today, ${pts.remaining} remaining`);

  // One supplier product answering for many different candidates is a generic
  // fallback, not a match. Counting it as a match once each hides that.
  const reused = [...bestFor.entries()].filter(([, list]) => list.length > 1);

  console.log(`\n${found} with matches, ${none} with none. ${bestFor.size} distinct products behind them.`);

  if (reused.length) {
    console.log('\n  Returned as the best match for more than one candidate:');
    for (const [ref, list] of reused.sort((a, b) => b[1].length - a[1].length)) {
      console.log(`    ${String(list.length).padStart(2)} times  ${list[0].slice(0, 58)}`);
    }
    console.log('  A catalogue with one product answering every query has not matched anything.');
  }

  console.log(`${dry ? '\nDry run, nothing written.' : ''}`);
  console.log('Nothing is confirmed. A match has to be checked before its cost means anything.\n');
}

main();
