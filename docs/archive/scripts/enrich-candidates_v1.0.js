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

const shape = (item) => ({
  image_url: item?.image?.imageUrl ?? item?.additionalImages?.[0]?.imageUrl ?? null,
  ebay_category_id: item?.categoryId ?? null,
  ebay_category_path: item?.categoryPath ?? null,
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
async function lookupGroup({ access, marketplace, legacyId }) {
  const url = new URL(`${BROWSE}/item/get_items_by_item_group`);
  url.searchParams.set('item_group_id', legacyId);

  const res = await get(access, marketplace, url);
  if (!res.ok) return null;

  const body = await res.json();
  const first = body.items?.[0];
  if (!first) return null;

  return { ...shape(first), variation_count: body.items.length };
}

async function lookup({ access, marketplace, legacyId }) {
  const url = new URL(`${BROWSE}/item/get_item_by_legacy_id`);
  url.searchParams.set('legacy_item_id', legacyId);

  const res = await get(access, marketplace, url);

  // A delisted item is expected, not a failure. It just cannot be enriched.
  if (res.status === 404) return { gone: true };

  if (res.status === 400) {
    const grouped = await lookupGroup({ access, marketplace, legacyId });
    if (grouped) return grouped;

    const body = await res.json().catch(() => null);
    const e = body?.errors?.[0];
    throw new Error(`browse 400 for ${legacyId}${e ? ` (${e.errorId}: ${e.message})` : ''}`);
  }

  if (!res.ok) throw new Error(`browse ${res.status} for ${legacyId}`);

  return shape(await res.json());
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
    .select('id, external_ref, title, enriched_at, image_url, batches!inner ( delivered_for )')
    .eq('tenant_id', tenant.id)
    .not('external_ref', 'is', null);

  if (date) q = q.eq('batches.delivered_for', date);
  // A row stamped as enriched but carrying no image was never finished, or was
  // overwritten by something downstream. Either way it is still work to do.
  if (!force) q = q.or('enriched_at.is.null,image_url.is.null');

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

  for (const row of rows) {
    try {
      const found = await lookup({ access, marketplace, legacyId: row.external_ref });

      if (found.gone) {
        gone += 1;
        console.log(`  gone  ${row.external_ref}  ${row.title.slice(0, 44)}`);
        await db.from('candidates').update({ enriched_at: new Date().toISOString() }).eq('id', row.id);
        continue;
      }

      const { error: uErr } = await db
        .from('candidates')
        .update({ ...found, enriched_at: new Date().toISOString() })
        .eq('id', row.id);

      if (uErr) throw new Error(uErr.message);

      done += 1;
      console.log(
        `  ok    ${found.ebay_category_id ?? '-'}  ${found.variation_count ? `${String(found.variation_count).padStart(3)}v  ` : '      '}${row.title.slice(0, 40)}`,
      );
    } catch (e) {
      failed += 1;
      console.error(`  FAIL  ${row.external_ref}  ${e.message}`);
    }

    await sleep(250);
  }

  console.log(`\n${done} enriched, ${gone} no longer listed, ${failed} failed.\n`);
}

main();
