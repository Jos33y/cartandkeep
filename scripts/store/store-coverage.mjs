/*
 * Writes the Google best sellers funnel for a store batch already imported (store_coverage). New imports write it
 * themselves (import-store); this is for a batch imported before that, or to refresh one. Lists only, unless --apply.
 *
 *   node scripts/store/store-coverage.mjs --label="Home & Garden" --coverage=research/picks/hg-rerun/coverage.csv --checked=research/picks/checked.csv
 *   node scripts/store/store-coverage.mjs --label="Home & Garden" --coverage=research/picks/hg-rerun/coverage.csv --checked=research/picks/checked.csv --apply
 */
import { squash } from './match.mjs';
import { buildCoverage, printCoverage, readCoverageFiles, writeCoverage } from './coverage.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const label = arg('label');
const slug = arg('tenant', 'cart-and-keep');
const apply = args.includes('--apply');
if (!label) { console.error('\n  Pass --label= the category the batch was imported under, e.g. --label="Home & Garden".\n'); process.exit(1); }
const term = arg('term', `store-${squash(label).replace(/ /g, '-')}`);
const { rows, checked } = readCoverageFiles(arg('coverage', 'research/picks/coverage.csv'), arg('checked', 'research/picks/checked.csv'));

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }
const { data: batches } = await db.from('batches').select('id, delivered_for').eq('tenant_id', tenant.id).eq('term', term).order('delivered_for', { ascending: false });
if (!batches?.length) { console.error(`No batch with term "${term}". Import the store cards first.`); process.exit(1); }

const built = await buildCoverage({ db, tenantId: tenant.id, batchId: batches[0].id, rows, checked });
printCoverage(label, built.list, built);
if (!apply) { console.log('\n  List only. Run again with --apply to write it to her portal.\n'); process.exit(0); }
await writeCoverage(db, built.list);
console.log(`\n  Written ${built.list.length} rows to store_coverage.\n`);
