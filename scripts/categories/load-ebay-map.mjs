/*
 * Puts the eBay-to-Google table (ebay-to-google.mjs) into google_from_ebay, so every product on her shop is given
 * its Google category by the same rows the research cards use. Run after any change to that table:
 *   node scripts/categories/load-ebay-map.mjs --dry
 *   node scripts/categories/load-ebay-map.mjs
 * Then reads every product the table can place better (fill_product_google, 0129). Her own choices are never touched.
 */
import { EBAY_TO_GOOGLE } from './ebay-to-google.mjs';
import { loadTaxonomy } from './taxonomy.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const file = args.find((a) => a.startsWith('--taxonomy='))?.split('=')[1] ?? 'research/google/taxonomy-with-ids.en-GB.txt';
const tax = loadTaxonomy(file);

// A path not in Google's file stops the run before anything is written, as makeMapper does.
const rows = EBAY_TO_GOOGLE.map(([ebay, google], i) => {
  const id = tax.idOf(google);
  if (id == null) { console.error(`\n  Not in Google's taxonomy: "${google}" (row ${i + 1}). Nothing written.\n`); process.exit(1); }
  return { position: i + 1, ebay_prefix: ebay, google_id: id };
});
console.log(`\n  ${rows.length} rows, every Google path found`);
if (dry) { console.log('  Dry run, nothing written.\n'); process.exit(0); }

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { error } = await db.from('google_from_ebay').upsert(rows, { onConflict: 'position' });
if (error) { console.error(`  Not loaded: ${error.message}`); process.exit(1); }
const { error: dErr } = await db.from('google_from_ebay').delete().gt('position', rows.length);
if (dErr) { console.error(`  Rows past ${rows.length} not removed: ${dErr.message}`); process.exit(1); }
console.log(`  google_from_ebay holds ${rows.length} rows`);

const { data: changed, error: fErr } = await db.rpc('fill_product_google', { p_tenant: null });
if (fErr) { console.error(`  Products not read: ${fErr.message}`); process.exit(1); }
console.log(`  ${changed} product${changed === 1 ? '' : 's'} given a Google category or a better one.\n`);
