/*
 * Seeds the storefront catalogue from her own live eBay listings.
 *
 * Everything written here is `is_sample = true` and `status = 'draft'`, so
 * nothing this script writes can reach a customer. Clearing it is one command,
 * printed at the end.
 *
 * Why her listings and not our candidates. They are real products with real
 * images at prices she already chose, and the store needs stock on Wednesday.
 * A candidate is a market reading, not a thing on sale.
 *
 * The filter is store arithmetic, not eBay's. There is no 12.8% marketplace
 * fee and no ad rate on her own site, so the same product affords about 17.7%
 * of the sale price more per unit. Across her 282 listings, measured on the
 * screen vocabulary's own bands:
 *
 *              cannot pay for a free unit   afford GBP 8+   afford GBP 12+
 *   on eBay              93                      56              39
 *   on the store         61                      97              56
 *
 * 97 clear the floor. 19 of those carry a screen and are held back for her,
 * so 78 seed. Nothing is dropped silently: the banded file keeps every row
 * with its figures beside it.
 *
 * Input is the banded file written by `scripts/band-listings.py`, not the raw
 * export. The band and the store afford figure are computed there, using the
 * tested screen vocabulary. This script does not own a second copy of it.
 *
 * Usage:
 *   python scripts/band-listings.py --in=drops/bellatique-listings-034.csv
 *   node scripts/seed-store.js --csv=drops/store-seed.csv --dry
 *   node scripts/seed-store.js --csv=drops/store-seed.csv
 *   node scripts/seed-store.js --clear
 */

import { existsSync, readFileSync } from 'node:fs';

import { connect } from '../pipeline/lib/db.js';

// The floor is applied here rather than in the Python step so it can be moved
// without regenerating the file. Deliberately permissive: it is below every
// landed cost measured on this project, so it excludes only products that
// cannot work at any supply cost.
const FLOOR = 8.00;

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};
const flag = (name) => process.argv.slice(2).includes(`--${name}`);

// A minimal RFC 4180 reader. The export quotes titles containing commas and
// the naive split loses half a title without saying so.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function slugify(title, ref) {
  const base = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  // The reference keeps it unique. Two listings for the same product under
  // slightly different titles are common in this catalogue.
  return `${base}-${ref}`;
}

async function main() {
  const { db, E } = await connect();
  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name').eq('slug', slug).single();
  if (tErr || !tenant) {
    console.error(`No tenant with slug "${slug}".`);
    process.exit(1);
  }

  if (flag('clear')) {
    const { error, count } = await db.from('store_products')
      .delete({ count: 'exact' })
      .eq('tenant_id', tenant.id).eq('is_sample', true);
    if (error) { console.error(error.message); process.exit(1); }
    console.log(`Removed ${count ?? 0} sample product(s).`);
    return;
  }

  const path = arg('csv');
  if (!path || !existsSync(path)) {
    console.error('Pass --csv= the listings export.');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (!rows.length || !('afford_store' in rows[0])) {
    console.error('That file has no afford_store column. Run scripts/band-listings.py first.');
    process.exit(1);
  }

  const kept = [];
  let belowFloor = 0;
  let screened = 0;

  for (const r of rows) {
    const ref = r.item_id;
    const title = (r.title ?? '').trim();
    const price = Number(r.price);
    const afford = Number(r.afford_store);
    if (!ref || !title || !Number.isFinite(price)) continue;

    if (afford < FLOOR) { belowFloor += 1; continue; }
    // A screened title is her call, not ours. A cosmetic or ingestible product
    // carries a regime this project has not read, so it is held back rather
    // than seeded and rather than dropped silently.
    if (r.screens) { screened += 1; continue; }

    const image = (r.image_url ?? '').trim() || null;

    kept.push({
      tenant_id: tenant.id,
      slug: slugify(title, ref),
      title,
      price,
      image_url: image,
      images: image ? [image] : [],
      postage_band: r.postage_band || 'small_parcel',
      status: 'draft',
      is_sample: true,
      source_kind: 'ebay_listing',
      source_ref: ref,
      position: null,
    });
  }

  console.log(`  ${rows.length} rows read`);
  console.log(`  ${belowFloor} below the GBP ${FLOOR.toFixed(2)} store floor`);
  console.log(`  ${screened} clearing the floor but carrying a screen, held for her`);
  console.log(`  ${kept.length} to seed, all marked sample and draft`);

  const missing = kept.filter((p) => !p.image_url).length;
  if (missing) console.log(`  ${missing} of those carry no image`);

  if (flag('dry')) {
    for (const p of kept.slice(0, 8)) {
      console.log(`     £${p.price.toFixed(2).padStart(7)}  ${p.postage_band.padEnd(14)}${p.title.slice(0, 46)}`);
    }
    console.log('\nDry run, nothing written.');
    return;
  }

  // Upsert on the natural key so a rerun updates rather than duplicates.
  const { error } = await db.from('store_products')
    .upsert(kept, { onConflict: 'tenant_id,slug' });
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`\nSeeded ${kept.length} sample product(s) as draft.`);
  console.log('  node scripts/seed-store.js --clear');
}

main();
