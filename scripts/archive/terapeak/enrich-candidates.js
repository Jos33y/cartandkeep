/*
 * Fills image_url and the eBay category on candidates, from a Browse lookup
 * against the reference listing each figure was measured from.
 *
 * No eBay user data is read or stored, so the deletion exemption is untouched.
 *
 * Usage:
 *   node scripts/enrich-candidates.js
 *   node scripts/enrich-candidates.js --date=2026-08-10
 *   node scripts/enrich-candidates.js --force        redo ones already done
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/ebayBrowse.js';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The leaf name off the end of the path. eBay's own classification of this
// exact listing, so it needs no maintenance and cannot be wrong the way a title
// word list is wrong. A broad sweep lands every row under one search term, and
// this is what separates raised toilet seats from half steps.
const leafOf = (path) => {
  if (!path) return null;
  const leaf = path.split('|').pop()?.trim();
  return leaf || null;
};

/*
 * Real dimensions, where the seller gave them.
 *
 * The bulky flag is a word list guessing from titles, and it is set on 101 of
 * 178 rows with no magnitude behind it. Postage is the largest unmodelled cost
 * in the whole batch and the band is decided by size, not weight: large letter
 * is 353 x 250 x 25mm, small parcel 450 x 350 x 160mm.
 *
 * Sellers fill this in when they use calculated postage and leave it empty on
 * flat rate, so it will be null on many. A real figure on a third of the batch
 * is worth more than a word list on all of it.
 */
const box = (p) => {
  const d = p?.dimensions;
  const w = p?.weight;
  if (!d && !w) return null;

  // Everything to millimetres and grams, because eBay returns whichever unit
  // the seller typed and a band compared in mixed units is worse than none.
  const toMm = { INCH: 25.4, FOOT: 304.8, CENTIMETER: 10, MILLIMETER: 1, METER: 1000 };
  const toG = { POUND: 453.592, OUNCE: 28.3495, KILOGRAM: 1000, GRAM: 1 };
  const mm = (v) => (v == null ? null : Math.round(v * (toMm[d?.unit] ?? 10)));

  const sides = [mm(d?.length), mm(d?.width), mm(d?.height)]
    .filter((n) => n != null)
    .sort((a, b) => b - a);

  return {
    length_mm: sides[0] ?? null,
    width_mm: sides[1] ?? null,
    depth_mm: sides[2] ?? null,
    weight_g: w?.value == null ? null : Math.round(w.value * (toG[w.unit] ?? 1)),
    package_type: p?.packageType ?? null,
    source: 'ebay_seller',
  };
};

// held is the row as it already stands. The eBay leaf is the right cluster
// when a sweep crossed several of them, as the mobility sweep did across seven.
// It is the wrong one when the sweep was a single leaf: every bedding row
// returns "Bedding Sets & Duvet Covers" and 308 products collapse into one
// undifferentiated list. So a cluster the importer has already assigned wins,
// and the leaf only fills a gap.
const shape = (item, held) => ({
  image_url: item?.image?.imageUrl ?? item?.additionalImages?.[0]?.imageUrl ?? null,
  ebay_category_id: item?.categoryId ?? null,
  ebay_category_path: item?.categoryPath ?? null,
  cluster: held?.cluster?.trim() || leafOf(item?.categoryPath),
  dimensions: box(item?.packageWeightAndSize),
});

const get = (access, marketplace, url) => fetch(url, {
  headers: {
    Authorization: `Bearer ${access}`,
    'X-EBAY-C-MARKETPLACE-ID': marketplace,
  },
});

// A listing with sizes is a variation group, and get_item_by_legacy_id refuses a
// group id without a variation id. For those the legacy id is the group id, so
// the group endpoint answers instead. Most dog beds are sold in sizes.
async function lookupGroup({ access, marketplace, legacyId, held }) {
  const url = new URL(`${BROWSE}/item/get_items_by_item_group`);
  url.searchParams.set('item_group_id', legacyId);

  const res = await get(access, marketplace, url);
  if (!res.ok) return null;

  const body = await res.json();
  const first = body.items?.[0];
  if (!first) return null;

  return { ...shape(first, held), variation_count: body.items.length };
}

async function lookup({ access, marketplace, legacyId, held }) {
  const url = new URL(`${BROWSE}/item/get_item_by_legacy_id`);
  url.searchParams.set('legacy_item_id', legacyId);

  const res = await get(access, marketplace, url);

  // A delisted item is expected, not a failure. It just cannot be enriched.
  if (res.status === 404) return { gone: true };

  if (res.status === 400) {
    const grouped = await lookupGroup({ access, marketplace, legacyId, held });
    if (grouped) return grouped;

    const body = await res.json().catch(() => null);
    const e = body?.errors?.[0];
    throw new Error(`browse 400 for ${legacyId}${e ? ` (${e.errorId}: ${e.message})` : ''}`);
  }

  if (!res.ok) throw new Error(`browse ${res.status} for ${legacyId}`);

  return shape(await res.json(), held);
}

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const date = args.find((a) => a.startsWith('--date='))?.split('=')[1];

  if (!E.EBAY_CLIENT_ID || !E.EBAY_CLIENT_SECRET) {
    console.error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET.');
    process.exit(1);
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .select('id, name, marketplace')
    .eq('slug', slug)
    .single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  let q = db
    .from('candidates')
    .select('id, external_ref, title, enriched_at, image_url, cluster, dimensions, batches!inner ( delivered_for )')
    .eq('tenant_id', tenant.id)
    .not('external_ref', 'is', null);

  if (date) q = q.eq('batches.delivered_for', date);
  // A row stamped as enriched but carrying no image was never finished, or was
  // overwritten by something downstream. Either way it is still work to do.
  if (!force) q = q.or('enriched_at.is.null,image_url.is.null,cluster.is.null,dimensions.is.null');

  const { data: rows, error } = await q;

  if (error) {
    console.error('Could not read candidates:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('\nNothing to enrich.\n');
    return;
  }

  const access = await token({ clientId: E.EBAY_CLIENT_ID, clientSecret: E.EBAY_CLIENT_SECRET });
  const marketplace = E.EBAY_MARKETPLACE_ID || tenant.marketplace || 'EBAY_GB';

  console.log(`\n${tenant.name}, ${rows.length} to enrich on ${marketplace}\n`);

  let done = 0;
  let gone = 0;
  let failed = 0;
  let sized = 0;

  for (const row of rows) {
    try {
      const found = await lookup({ access, marketplace, legacyId: row.external_ref, held: row });

      if (found.gone) {
        gone += 1;
        console.log(`  gone  ${row.external_ref}  ${row.title.slice(0, 44)}`);
        // Only the timestamp. Naming any other column here writes null over
        // whatever a previous run found.
        await db.from('candidates').update({ enriched_at: new Date().toISOString() }).eq('id', row.id);
        continue;
      }

      const { error: uErr } = await db
        .from('candidates')
        .update({ ...found, enriched_at: new Date().toISOString() })
        .eq('id', row.id);

      if (uErr) throw new Error(uErr.message);

      done += 1;
      if (found.dimensions) sized += 1;
      console.log(
        `  ok    ${String(found.cluster ?? '-').slice(0, 20).padEnd(20)}  `
        + `${found.dimensions
          ? `${String(found.dimensions.length_mm ?? '?').padStart(4)}x`
            + `${String(found.dimensions.width_mm ?? '?').padStart(4)}x`
            + `${String(found.dimensions.depth_mm ?? '?').padStart(4)}mm`
          : '     no size    '}  `
        + `${row.title.slice(0, 30)}`,
      );
    } catch (e) {
      failed += 1;
      console.error(`  FAIL  ${row.external_ref}  ${e.message}`);
    }

    await sleep(250);
  }

  console.log(
    `\n${done} enriched, ${sized} with real dimensions, `
    + `${gone} no longer listed, ${failed} failed.\n`,
  );
}

main();
