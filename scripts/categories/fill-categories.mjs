/*
 * Gives every card in her queue a Google category and source labels, once. Dry first, always:
 *   node scripts/categories/fill-categories.mjs --dry     counts and examples, research/categories/fill-preview.csv
 *   node scripts/categories/fill-categories.mjs           writes the category columns only
 * Titles with no eBay category are classified by AI (one call per 80, answers cached); the dry run makes those calls
 * too, so the counts are real, and says how many it made. Nothing but the category columns is ever written.
 */
import fs from 'node:fs';
import { categorise } from './categorise.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1] ?? 'cart-and-keep';

const { connect } = await import('../../pipeline/lib/db.js');
const { db } = await connect();
const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) { console.error(`Tenant "${slug}" not found.`); process.exit(1); }
const { count: loaded } = await db.from('google_categories').select('id', { count: 'exact', head: true });
if (!loaded) { console.error('\n  google_categories is empty. Run scripts/categories/load-taxonomy.mjs first.\n'); process.exit(1); }

const { tally, rows, tax, writes, careMoves, careStayed } = await categorise(db, tenant.id, { dry });

const group = (key) => rows.reduce((o, r) => { (o[r[key] ?? 'none'] ??= []).push(r); return o; }, {});
const show = (id) => (id === 'none' ? '(none)' : tax.pathOf(Number(id)));
console.log(`\n  ${tally.cards} cards. By tab:`);
for (const [id, rs] of Object.entries(group('category_top_id')).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(rs.length).padStart(5)}  ${show(id)}`);
console.log('\n  By level two, with examples:');
// Grouped by tab and level two together, so cards with no level two are counted under their own tab.
const byL2 = rows.reduce((o, r) => { (o[`${r.category_top_id}|${r.category_level2_id ?? 'none'}`] ??= []).push(r); return o; }, {});
const clean = (t) => String(t ?? '').split('#')[0].trim();
for (const [k, rs] of Object.entries(byL2).sort((a, b) => b[1].length - a[1].length)) {
  const [top, l2] = k.split('|');
  console.log(`  ${String(rs.length).padStart(5)}  ${l2 === 'none' ? `${show(top)} (top only)` : show(l2)}`);
  console.log(`         ${rs.slice(0, 4).map((r) => clean(r.title).slice(0, 60)).join(' · ')}`);
}
const hc = rows.filter((r) => (r.path ?? '').startsWith('Health & Beauty > Healthcare > '));
if (hc.length) {
  console.log('\n  Healthcare, third level:');
  const g = hc.reduce((o, r) => { const k = r.path.split(' > ')[2]; o[k] = (o[k] ?? 0) + 1; return o; }, {});
  for (const [k, n] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
}
const bySource = rows.reduce((o, r) => { o[r.category_source] = (o[r.category_source] ?? 0) + 1; return o; }, {});
console.log(`\n  Placed by: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  Classified by title: ${tally.ai_titles} (${tally.ai_cached} from earlier answers, ${tally.ai_calls} calls now)`);
console.log(`  Flagged "check this is the same product": ${tally.flagged}`);
console.log(`  Parts and refills rule: ${tally.refined} moved`);
for (const r of rows.filter((x) => x.rule && x.rule !== 'care aid')) console.log(`         ${String(r.title).split('#')[0].trim().slice(0, 50)}  >  ${r.path}  (${r.rule})`);
console.log(`  Care-shop products outside Healthcare: ${tally.care_moved} moved to Healthcare, ${tally.care_stayed} stayed`);
for (const m of careMoves) console.log(`         ${m.title.slice(0, 50)}  >  ${m.to.replace('Health & Beauty > Healthcare > ', '')}   (was ${m.from})`);
if (careStayed.length) console.log(`         stayed: ${careStayed.map((x) => x.slice(0, 60)).join(' · ')}`);
console.log(`  Hers, left alone: ${tally.kept_hers}. New: ${tally.set}. Made more specific: ${tally.deeper}. Unchanged: ${tally.unchanged}.`);
const labels = rows.reduce((o, r) => { for (const l of r.source_labels) o[l] = (o[l] ?? 0) + 1; return o; }, {});
console.log(`  Source labels: ${Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${v}`).join(', ')}`);

const cols = ['id', 'title', 'category_id', 'path', 'category_source', 'rule', 'category_flag', 'source_labels'];
const cell = (v) => { const s = Array.isArray(v) ? v.join('; ') : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.mkdirSync('research/categories', { recursive: true });
fs.writeFileSync('research/categories/fill-preview.csv', [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
console.log(`\n  research/categories/fill-preview.csv`);
console.log(dry ? `  Dry run: ${writes} cards would change. Nothing written.\n` : `  Written: ${tally.written} of ${writes}.\n`);
