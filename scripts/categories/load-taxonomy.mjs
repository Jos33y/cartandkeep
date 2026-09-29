/*
 * Puts Google's taxonomy into the google_categories table, so the portal can show names and the feed can use IDs.
 *   node scripts/categories/load-taxonomy.mjs --dry
 *   node scripts/categories/load-taxonomy.mjs
 * Reads research/google/taxonomy-with-ids.en-GB.txt. Safe to rerun: rows are upserted by ID.
 */
import fs from 'node:fs';
import { loadTaxonomy } from './taxonomy.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const file = args.find((a) => a.startsWith('--taxonomy='))?.split('=')[1] ?? 'research/google/taxonomy-with-ids.en-GB.txt';
const tax = loadTaxonomy(file);
const version = fs.readFileSync(file, 'utf8').match(/Version:\s*(\S+)/)?.[1] ?? 'unknown';

const rows = [];
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^(\d+) - (.+)$/);
  if (!m) continue;
  const id = Number(m[1]);
  const parts = m[2].split(' > ');
  rows.push({
    id, path: m[2].trim(), name: parts[parts.length - 1].trim(), depth: parts.length, version,
    top_id: tax.topOf(id), level2_id: tax.level2Of(id), level3_id: parts.length >= 3 ? tax.idOf(parts.slice(0, 3).join(' > ')) : null,
  });
}
console.log(`\n  ${rows.length} categories, version ${version}, ${rows.filter((r) => r.depth === 1).length} top categories`);
if (dry) { console.log('  Dry run, nothing written.\n'); process.exit(0); }

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
// Parents first, so every row's top and level-two IDs already exist if the table ever gains foreign keys.
rows.sort((a, b) => a.depth - b.depth);
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from('google_categories').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
  if (error) { console.error(`  Stopped at row ${i}: ${error.message}`); process.exit(1); }
}
const { count } = await db.from('google_categories').select('id', { count: 'exact', head: true });
console.log(`  google_categories now holds ${count}.\n`);
