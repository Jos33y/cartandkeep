/*
 * Fills the store product record from a Browse lookup, and says what is
 * missing afterwards.
 *
 * The previous version made the same call and kept the category. Everything
 * else in the response went in the bin: brand, item specifics, the seller's
 * description, extra photographs, condition, MPN and GTIN, availability, and
 * the whole `regulatory` container that eBay added for GPSR, which carries
 * hazard statements, energy labels and safety pictograms.
 *
 * All of that is seller provided, so the honest expectation is that most of it
 * is empty on her listings: they were created in bulk by somebody paid fifty
 * pounds, and GPSR obliges sellers operating in or shipping to the EU and
 * Northern Ireland rather than GB-only sellers. That is exactly why this
 * prints a coverage table. Knowing which of thirteen fields are actually
 * populated across seventy eight products is worth more than another guess
 * about it.
 *
 * Nothing here writes a claim it cannot source. Two fields are derived rather
 * than read, `returns_class` and the hazard flag, and both are recorded in
 * `derived_fields` and only written to sample rows. A derived returns class is
 * a legal term nobody has checked and it must not reach a customer.
 *
 * Usage:
 *   node scripts/enrich-store.js --dry
 *   node scripts/enrich-store.js
 *   node scripts/enrich-store.js --force      redo ones already done
 *   node scripts/enrich-store.js --coverage   report only, writes nothing
 *   node scripts/enrich-store.js --groups     the category grouping
 */

import { connect } from '../pipeline/lib/db.js';
import { token } from '../pipeline/sources/ebayBrowse.js';
import { groupCategories, leafOf, topOf } from '../src/utils/categories.js';

const BROWSE = 'https://api.ebay.com/buy/browse/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flag = (name) => process.argv.slice(2).includes(`--${name}`);

/*
 * Words that mean a product cannot come back once it is opened.
 *
 * A suggestion, never a decision. The classes are a contract term and she is a
 * lawyer, so this writes to sample rows and records itself as derived. The
 * point is that the page renders something true-shaped while she decides,
 * rather than promising an unconditional return on a bottle of drain
 * unblocker.
 */
const CONSUMABLE = /\b(cleaner|unblocker|bleach|detergent|fluid|solution|shampoo|vinegar|glue|adhesive|weed ?killer|herbicide|insecticide|killer|spray|refill|coffee|tea\b|drink|supplement|capsule|gummies|sachet|powder|paint|oil|fuel|remover|disinfectant)\b/i;
const SEALED = /\b(cream|balm|lotion|serum|gel|soap|scrub|deodorant|antiperspirant|toothbrush|razor|pillow|bedding|underwear|sock|earring|incontinence|pad|liner|suppositor|hygien|pamper|spa|bath (?:set|bomb)|cosmetic|makeup|make-up|lip|mask)\b/i;

/*
 * Hazard suspects.
 *
 * Not a classification. GB CLP classification is a supplier's job and reading
 * it off a product title would be exactly the "asserting instead of reading"
 * fault. This only flags which products need a human to go and look at the
 * actual label, which on this catalogue is about six of them.
 */
const HAZARD_SUSPECT = /\b(bleach|unblocker|drain|weed ?killer|herbicide|insecticide|wasp|pest|disinfectant|jeyes|glue|adhesive|solvent|acid|caustic|carpet (?:cleaner|solution)|fuel|aerosol|paint)\b/i;

function classifyReturns(title) {
  if (CONSUMABLE.test(title)) return 'none';
  if (SEALED.test(title)) return 'sealed';
  return 'standard';
}

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

async function lookup({ access, marketplace, legacyId }) {
  const url = new URL(`${BROWSE}/item/get_item_by_legacy_id`);
  url.searchParams.set('legacy_item_id', legacyId);
  // PRODUCT adds the catalogue record behind the listing, which is where brand
  // and GTIN live when the seller matched to one.
  url.searchParams.set('fieldgroups', 'PRODUCT');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
  });

  // A listing with sizes is a variation group and this endpoint refuses a
  // group id on its own. Her catalogue is full of sized clothing.
  if (res.status === 400) {
    const g = new URL(`${BROWSE}/item/get_items_by_item_group`);
    g.searchParams.set('item_group_id', legacyId);
    const gr = await fetch(g, {
      headers: { Authorization: `Bearer ${access}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace },
    });
    if (!gr.ok) return { item: null, gone: false, bad: true };
    const body = await gr.json();
    return { item: body?.items?.[0] ?? null, group: body?.items ?? [], gone: false };
  }
  if (res.status === 404) return { item: null, gone: true };
  if (!res.ok) throw new Error(`browse ${res.status} for ${legacyId}`);
  return { item: await res.json(), gone: false };
}

// Item specifics come back as a flat list of name and value. Kept in the order
// eBay returned them, because that order is roughly how a seller thinks about
// the product.
function aspects(item) {
  const out = {};
  for (const a of item?.localizedAspects ?? []) {
    if (a?.name && a?.value) out[a.name] = a.value;
  }
  return out;
}

// Strip the lister's template down to something readable. Never written to
// `description`, only to `source_description`, so nobody mistakes it for copy.
function plainText(html) {
  if (!html) return null;
  const text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 40 ? text.slice(0, 4000) : null;
}

/*
 * Brand, cleaned.
 *
 * The field came back with three faults across 78 rows and none of them are
 * eBay's: two brands carry a leading left-to-right mark, which is what happens
 * when a value is pasted out of an Amazon listing and it makes the string sort
 * and compare wrong forever. "Unbranded" arrived in two casings and a bare
 * dash. And three values are a shop name rather than a brand, because the
 * seller typed their own.
 *
 * Unbranded becomes null. A brand of "Unbranded" is not information, it is the
 * absence of it wearing a label, and the page should show nothing rather than
 * the word.
 */
const NOT_A_BRAND = new Set(['unbranded', 'no brand', 'generic', 'n/a', 'na', '-', '--']);

function cleanBrand(value) {
  if (!value) return null;
  const text = String(value)
    // Bidirectional marks and zero widths. Invisible, and they break every
    // comparison and sort they touch.
    .replace(/[\u200e\u200f\u200b\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // "BRITA Store" is a shop, not a brand.
    .replace(/\s+Store$/i, '');
  if (!text || NOT_A_BRAND.has(text.toLowerCase())) return null;
  return text;
}

const AVAILABILITY = {
  IN_STOCK: 'in_stock',
  LIMITED_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
};

function build(item, row) {
  const spec = aspects(item);
  const reg = item?.regulatory ?? {};
  const avail = item?.estimatedAvailabilities?.[0] ?? {};
  const images = [item?.image?.imageUrl, ...(item?.additionalImages ?? []).map((i) => i.imageUrl)]
    .filter(Boolean);

  const read = {};
  const derived = {};
  const patch = { enriched_at: new Date().toISOString() };

  const set = (column, value, source = 'ebay') => {
    if (value === null || value === undefined || value === '') return;
    patch[column] = value;
    (source === 'ebay' ? read : derived)[column] = true;
  };

  /*
   * Some nulls are a correction rather than an absence.
   *
   * `set` refuses null so a run that finds nothing never wipes what a previous
   * run found, which is right. But it also means a cleaner can never remove a
   * bad value already in the row: "Unbranded" cleaned to null was simply not
   * written, the old string stayed, and the coverage table then counted it as
   * a filled brand. A correction that reports success and changes nothing is
   * worse than no correction.
   *
   * So clearing is explicit and only for fields where a script is entitled to
   * say the previous value was wrong.
   */
  const clear = (column) => {
    patch[column] = null;
    read[column] = false;
  };

  set('category', leafOf(item?.categoryPath));
  set('category_path', item?.categoryPath);
  set('ebay_category_id', item?.categoryId);
  const brand = cleanBrand(spec.Brand ?? item?.brand);
  if (brand) set('brand', brand);
  else if (row.brand) clear('brand');
  set('condition', item?.condition);
  set('mpn', item?.mpn ?? spec.MPN);
  set('gtin', item?.gtin ?? spec.EAN ?? spec.UPC);
  set('source_description', plainText(item?.description ?? item?.shortDescription));
  set('availability', AVAILABILITY[avail?.estimatedAvailabilityStatus]);
  set('stock', Number.isFinite(avail?.estimatedAvailableQuantity) ? avail.estimatedAvailableQuantity : null);

  if (images.length > 1) set('images', images);
  if (Object.keys(spec).length) set('specifications', spec);

  // GPSR containers. Present only if the seller filled them, which on a bulk
  // listed catalogue means almost never.
  if (reg.hazmat) set('hazard', reg.hazmat);
  if (reg.energyEfficiencyLabel?.imageUrl) set('energy_label_url', reg.energyEfficiencyLabel.imageUrl);
  if (reg.documents?.length) set('safety_data_sheet_url', reg.documents[0]?.documentUrl ?? reg.documents[0]?.url);

  // Derived, and only ever onto a sample row. See the note at the top.
  if (row.is_sample) {
    const returns = classifyReturns(row.title);
    if (returns !== 'standard') set('returns_class', returns, 'derived');
    if (HAZARD_SUSPECT.test(row.title) && !reg.hazmat) derived.hazard_suspect = true;
  }

  patch.enriched_fields = read;
  patch.derived_fields = derived;
  return { patch, hazardSuspect: Boolean(derived.hazard_suspect) };
}

const FIELDS = [
  'brand', 'condition', 'mpn', 'gtin', 'source_description', 'specifications',
  'images', 'stock', 'availability', 'hazard', 'energy_label_url',
  'safety_data_sheet_url', 'category_path',
];

function coverage(rows) {
  console.log('\n  What is actually populated\n');
  console.log(`  ${'field'.padEnd(24)}${'filled'.padStart(7)}${'of'.padStart(5)}${'%'.padStart(7)}`);
  for (const f of FIELDS) {
    const n = rows.filter((r) => {
      const v = r[f];
      if (v === null || v === undefined || v === '') return false;
      // A brand of "Unbranded" is the absence of a brand wearing a label, and
      // counting it as filled is how a coverage table flatters itself.
      if (f === 'brand' && NOT_A_BRAND.has(String(v).trim().toLowerCase())) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    }).length;
    const pct = rows.length ? (n / rows.length) * 100 : 0;
    console.log(`  ${f.padEnd(24)}${String(n).padStart(7)}${String(rows.length).padStart(5)}${pct.toFixed(0).padStart(6)}%`);
  }

  const derivedReturns = rows.filter((r) => r.derived_fields?.returns_class).length;
  const suspects = rows.filter((r) => r.derived_fields?.hazard_suspect);
  console.log('');
  if (derivedReturns) {
    console.log(`  ${derivedReturns} returns class(es) were guessed from the title and nobody has checked them.`);
  }
  if (suspects.length) {
    console.log(`  ${suspects.length} product(s) look like classified mixtures and carry no hazard data:`);
    for (const s of suspects) console.log(`     ${String(s.source_ref).padEnd(14)}${s.title.slice(0, 58)}`);
    console.log('  Those should not be live until somebody has read the actual label.');
  }
}

async function main() {
  const { db, E } = await connect();
  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name, marketplace').eq('slug', slug).single();
  if (tErr || !tenant) {
    console.error(`No tenant with slug "${slug}".`);
    process.exit(1);
  }

  const select = `id, title, source_ref, is_sample, ${FIELDS.join(', ')}, derived_fields`;

  if (flag('coverage') || flag('groups')) {
    const { data: all } = await db.from('store_products').select(select).eq('tenant_id', tenant.id);
    if (flag('groups')) {
      const groups = groupCategories(all ?? []);
      console.log(`\n${tenant.name}, ${all?.length ?? 0} product(s) in ${groups.length} group(s)\n`);
      for (const g of groups) console.log(`  ${String(g.items.length).padStart(4)}  ${g.name}`);
      return;
    }
    coverage(all ?? []);
    return;
  }

  let q = db.from('store_products').select(select).eq('tenant_id', tenant.id);
  if (!flag('force')) q = q.is('brand', null);

  const { data: rows, error } = await q;
  if (error) { console.error('Could not read store products:', error.message); process.exit(1); }

  if (!rows?.length) {
    const { count } = await db.from('store_products')
      .select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
    console.log(count
      ? `\nAll ${count} store product(s) already enriched. Use --force to redo them.\n`
      : '\nNo store products at all. Run scripts/seed-store.js first.\n');
    return;
  }

  const marketplace = E.EBAY_MARKETPLACE_ID || tenant.marketplace || 'EBAY_GB';
  console.log(`\n${tenant.name}, ${rows.length} to enrich on ${marketplace}\n`);

  if (flag('dry')) {
    for (const r of rows.slice(0, 10)) {
      console.log(`  ${String(r.source_ref).padEnd(14)}${r.title.slice(0, 54)}`);
    }
    console.log('\nDry run, nothing written.');
    return;
  }

  const access = await token({ clientId: E.EBAY_CLIENT_ID, clientSecret: E.EBAY_CLIENT_SECRET });
  let done = 0;
  let gone = 0;
  let failed = 0;
  const suspects = [];

  for (const row of rows) {
    try {
      const { item, gone: missing, bad } = await lookup({ access, marketplace, legacyId: row.source_ref });

      if (missing || bad || !item) {
        gone += 1;
        console.log(`  gone  ${String(row.source_ref).padEnd(14)}${row.title.slice(0, 44)}`);
        // Only the timestamp. Naming any other column here writes null over
        // whatever a previous run found.
        await db.from('store_products')
          .update({ enriched_at: new Date().toISOString() }).eq('id', row.id);
        continue;
      }

      const { patch, hazardSuspect } = build(item, row);
      const { error: uErr } = await db.from('store_products').update(patch).eq('id', row.id);
      if (uErr) throw new Error(uErr.message);

      if (hazardSuspect) suspects.push(row);
      done += 1;

      const got = Object.keys(patch.enriched_fields).length;
      console.log(
        `  ok    ${String(patch.brand ?? '-').slice(0, 16).padEnd(17)}`
        + `${String(got).padStart(2)} fields  `
        + `${hazardSuspect ? 'HAZARD? ' : '        '}`
        + `${row.title.slice(0, 34)}`,
      );
    } catch (e) {
      failed += 1;
      console.error(`  fail  ${String(row.source_ref).padEnd(14)}${e.message}`);
    }
    await sleep(250);
  }

  console.log(`\n${done} enriched, ${gone} gone, ${failed} failed.`);
  if (suspects.length) {
    console.log(`\n${suspects.length} possible classified mixture(s) with no hazard data from eBay.`);
  }
  console.log('  node scripts/enrich-store.js --coverage');
}

main();
