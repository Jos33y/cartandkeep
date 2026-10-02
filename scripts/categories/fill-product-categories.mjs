/*
 * Her shop's products, placed in Google's tree as far as eBay's category cannot: a product left at a top category,
 * or with none, is classified by its title, the same way categorise.mjs classifies a research card. Dry first:
 *   node scripts/categories/fill-product-categories.mjs --dry     counts, examples, research/categories/products-preview.csv
 *   node scripts/categories/fill-product-categories.mjs           writes google_category_id, source "ai"
 * Run load-ebay-map.mjs first. Her own choices (source "manual") are never asked about or changed.
 * A product the classifier cannot place keeps what it has; the dry run makes the calls too, so its counts are real.
 */
import fs from 'node:fs';
import { envKey } from '../lib/shops.js';
import { loadTaxonomy } from './taxonomy.mjs';
import { refineFor } from './ebay-to-google.mjs';
import { classify } from './classify.mjs';

const TAXONOMY = 'research/google/taxonomy-with-ids.en-GB.txt';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';

const tax = loadTaxonomy(TAXONOMY);
const depth = (id) => (id ? (tax.pathOf(id) ?? '').split(' > ').length : 0);
const refine = refineFor(tax);

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }

const products = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('store_products')
    .select('id, title, status, category_path, section, google_category_id, google_category_source')
    .eq('tenant_id', tenant.id).neq('status', 'archived').eq('is_sample', false).order('id').range(from, from + 999);
  if (error) { console.error(`Products not read: ${error.message}`); process.exit(1); }
  products.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
if (products.some((p) => p.google_category_source == null)) {
  console.error('\n  Some products have no Google category yet. Run load-ebay-map.mjs first.\n');
  process.exit(1);
}

// eBay's category reached below the top: kept. A top category only, or the default: asked against her whole list,
// since a top reached by eBay's catch-all row is not proof (a drill filed under Business, Office & Industrial).
const ask = products.filter((p) => ['ebay', 'default'].includes(p.google_category_source) && depth(p.google_category_id) < 2);
const clean = (t) => String(t ?? '').split('#')[0].trim();
const { result, calls, cached } = await classify(
  ask.map((p) => ({ key: p.id, title: clean(p.title), withinTop: null })),
  { tax, taxonomyFile: TAXONOMY, apiKey: envKey('ANTHROPIC_API_KEY'), model: process.env.CLASSIFY_MODEL || 'claude-sonnet-5-5' },
);

const writes = [];
for (const p of ask) {
  let id = result.get(p.id);
  if (!id) continue;
  const r = refine(id, clean(p.title));
  if (r) id = r.id;
  if (id !== p.google_category_id) writes.push({ id: p.id, title: p.title, from: tax.pathOf(p.google_category_id), to: tax.pathOf(id), google_category_id: id });
}

const by = (list, f) => list.reduce((o, x) => { const k = f(x); o[k] = (o[k] ?? 0) + 1; return o; }, {});
const after = new Map(writes.map((w) => [w.id, w.google_category_id]));
const final = products.map((p) => ({ ...p, google_category_id: after.get(p.id) ?? p.google_category_id, source: after.has(p.id) ? 'ai' : p.google_category_source }));
console.log(`\n  ${products.length} products. By source after this run: ${Object.entries(by(final, (p) => p.source)).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log('\n  By level two:');
const l2 = by(final.filter((p) => p.source !== 'default'), (p) => tax.pathOf(tax.level2Of(p.google_category_id) ?? p.google_category_id));
for (const [k, v] of Object.entries(l2).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log(`\n  Asked by title: ${ask.length} (${cached} from earlier answers, ${calls} calls now); placed deeper: ${writes.length}; left as they were: ${ask.length - writes.length}`);
for (const w of writes.slice(0, 25)) console.log(`         ${clean(w.title).slice(0, 50)}  >  ${w.to}`);
if (writes.length > 25) console.log(`         ... and ${writes.length - 25} more`);

const cols = ['id', 'title', 'status', 'source', 'path'];
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.mkdirSync('research/categories', { recursive: true });
fs.writeFileSync('research/categories/products-preview.csv',
  [cols.join(','), ...final.map((p) => [p.id, p.title, p.status, p.source, tax.pathOf(p.google_category_id)].map(cell).join(','))].join('\n') + '\n');
console.log('\n  research/categories/products-preview.csv');

if (dry) { console.log(`  Dry run: ${writes.length} product${writes.length === 1 ? '' : 's'} would change. Nothing written.\n`); process.exit(0); }
let done = 0;
for (let i = 0; i < writes.length; i += 20) {
  await Promise.all(writes.slice(i, i + 20).map(async (w) => {
    const { error } = await db.from('store_products').update({ google_category_id: w.google_category_id, google_category_source: 'ai' })
      .eq('id', w.id).in('google_category_source', ['ebay', 'default']);
    if (error) console.error(`  ${w.title}: not saved, ${error.message}`); else done += 1;
  }));
}
console.log(`  Written: ${done} of ${writes.length}.\n`);
