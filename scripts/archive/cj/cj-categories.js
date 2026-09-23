/*
 * Prints CJ's third level category tree, optionally filtered. Their keyword
 * search is best match across the whole catalogue, so a category id is what
 * keeps a search for a dog bed away from three foot single beds for people.
 *
 * Usage:
 *   node scripts/cj-categories.js pet
 *   node scripts/cj-categories.js dog
 */

import { connect } from '../pipeline/lib/db.js';
import { token, categories } from '../pipeline/sources/cjDropshipping.js';

async function main() {
  const { db, E } = await connect();
  const needle = process.argv.slice(2).find((a) => !a.startsWith('--'))?.toLowerCase() ?? '';
  const slug = E.VITE_TENANT_SLUG || 'cart-and-keep';

  const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).single();
  const { data: source } = await db
    .from('tenant_sources')
    .select('credential_ref')
    .eq('tenant_id', tenant.id)
    .eq('source_id', 'cj_dropshipping')
    .single();

  const creds = JSON.parse(source?.credential_ref ?? '{}');
  const apiKey = E[creds.apiKey] ?? E.CJ_API_KEY;
  if (!apiKey) {
    console.error('CJ API key not found in the environment.');
    process.exit(1);
  }

  const access = await token(apiKey);
  const all = await categories(access);
  const hits = needle ? all.filter((c) => c.path.toLowerCase().includes(needle)) : all;

  console.log(`\n${hits.length} of ${all.length} categories${needle ? ` matching "${needle}"` : ''}\n`);
  for (const c of hits) console.log(`  ${c.id}  ${c.path}`);
  console.log();
}

main();
