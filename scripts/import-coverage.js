/*
 * Records what was searched, not only what won. Reads every strips file plus
 * the shortlist, so a term that died at the strip stage is on record with the
 * figures that killed it.
 *
 * Usage:
 *   node scripts/import-coverage.js
 *   node scripts/import-coverage.js --dry
 *   node scripts/import-coverage.js --killed=cat-tree,dog-lead
 *
 * A term killed at the strip stage writes no strips file, so until the analysis
 * script records one it has to be named here or it goes unrecorded.
 */

import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../pipeline/lib/db.js';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

// The shortlist term column collapses a variant into its parent, so raised dog
// bowl's products are filed under dog bowl and matching on the string reported
// the best margin segment in the set as having found nothing. The merged file
// per term carries item ids, which is exact.
function itemsFor(term, mergedDir) {
  const file = path.join(mergedDir, `${term}_merged.csv`);
  if (!fs.existsSync(file)) return null;
  return new Set(
    parseCsv(fs.readFileSync(file, 'utf8'))
      .map((r) => r.item_id?.trim())
      .filter(Boolean),
  );
}

function outcomeFor({ term, shortlist, mergedDir, hasRows }) {
  const items = itemsFor(term, mergedDir);

  // No merged file and no row files means it never got past the aggregate strip,
  // which is the strip doing its job rather than a gap in the work.
  if (!items) return hasRows ? { outcome: 'no_headroom' } : { outcome: 'killed_at_strip' };

  const mine = shortlist.filter((r) => items.has(r.item_id?.trim()));
  const live = mine.filter((r) => r.status === 'listable' && !r.dropped_reason?.trim());
  const stock = live.filter((r) => r.stock_candidate?.trim() === 'yes');

  // A term that produced listable products succeeded, whether or not any of
  // them also hold against their own history. Stock is a tier inside the
  // shortlist under two routes, so a term handing over two hundred dropship
  // candidates and no stock buys is not a near miss. The stock count is
  // reported beside it and speaks for itself.
  if (!live.length) return { outcome: 'no_headroom', listable: 0, stock: 0 };
  return { outcome: 'shortlisted', listable: live.length, stock: stock.length };
}

async function main() {
  const { db, E } = await connect();
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const slug = args.find((a) => a.startsWith('--tenant='))?.split('=')[1]
    || E.VITE_TENANT_SLUG || 'cart-and-keep';
  const dropDir = args.find((a) => a.startsWith('--dir='))?.split('=')[1] || E.DROP_DIR || 'drops';
  const killed = (args.find((a) => a.startsWith('--killed='))?.split('=')[1] ?? '')
    .split(',').map((t) => t.trim()).filter(Boolean);

  const stripsDir = path.join(dropDir, 'terapeak');
  const mergedDir = path.join(dropDir, 'merged');
  const shortlistPath = path.join(mergedDir, 'shortlist.csv');

  if (!fs.existsSync(stripsDir)) {
    console.error(`No strips directory at ${stripsDir}.`);
    process.exit(1);
  }

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name').eq('slug', slug).single();

  if (tErr || !tenant) {
    console.error(`Tenant "${slug}" not found.`);
    process.exit(1);
  }

  const shortlist = fs.existsSync(shortlistPath)
    ? parseCsv(fs.readFileSync(shortlistPath, 'utf8'))
    : [];

  const inDir = fs.readdirSync(stripsDir);

  const rowFiles = new Set(
    inDir.filter((f) => /_\d{4}-\d{2}\.csv$/.test(f)).map((f) => f.replace(/_\d{4}-\d{2}\.csv$/, '')),
  );

  const stripFiles = new Set(
    inDir.filter((f) => f.endsWith('_strips.csv')).map((f) => f.replace('_strips.csv', '')),
  );

  const mergedFiles = new Set(
    fs.existsSync(mergedDir)
      ? fs.readdirSync(mergedDir)
        .filter((f) => f.endsWith('_merged.csv') && !f.startsWith('competitor'))
        .map((f) => f.replace('_merged.csv', ''))
      : [],
  );

  // A term scraped once and dropped has row files and no strips, so iterating
  // strips alone left it off the record entirely.
  const terms = [...new Set([...stripFiles, ...rowFiles, ...mergedFiles])].sort();

  // The categories the winners actually landed in, so a term carries eBay's
  // taxonomy rather than our search string.
  const { data: enriched } = await db
    .from('candidates')
    .select('external_ref, ebay_category_id, ebay_category_path')
    .eq('tenant_id', tenant.id)
    .not('ebay_category_id', 'is', null);

  const categoryByItem = new Map();
  for (const c of enriched ?? []) {
    if (c.external_ref) categoryByItem.set(c.external_ref, { id: c.ebay_category_id, path: c.ebay_category_path });
  }

  console.log(`\n${tenant.name}, ${terms.length} terms on disk\n`);

  for (const term of terms) {
    const stripPath = path.join(stripsDir, `${term}_strips.csv`);
    const windows = fs.existsSync(stripPath)
      ? parseCsv(fs.readFileSync(stripPath, 'utf8'))
      : [];
    const result = outcomeFor({ term, shortlist, mergedDir, hasRows: rowFiles.has(term) });
    // The category a term resolved to is whichever its own products landed in.
    const items = itemsFor(term, mergedDir);
    const category = items
      ? [...items].map((id) => categoryByItem.get(id)).find(Boolean) ?? null
      : null;

    console.log(
      `  ${result.outcome.padEnd(16)} ${String(windows.length).padStart(2)}w  `
      + `${String(result.listable ?? 0).padStart(3)} listable  `
      + `${String(result.stock ?? 0).padStart(2)} stock  ${term}`,
    );

    if (dry) continue;

    const { data: row, error: tErr2 } = await db
      .from('research_terms')
      .upsert({
        tenant_id: tenant.id,
        term,
        ebay_category_id: category?.id ?? null,
        ebay_category_path: category?.path ?? null,
        outcome: result.outcome,
        outcome_note: windows.length ? null : 'Scraped without an aggregate strip on record',
        listable_count: result.listable ?? 0,
        stock_count: result.stock ?? 0,
        last_swept_on: new Date().toISOString().slice(0, 10),
      }, { onConflict: 'tenant_id,term' })
      .select('id')
      .single();

    if (tErr2) {
      console.error(`    FAIL ${tErr2.message}`);
      continue;
    }

    const { error: wErr } = await db
      .from('research_windows')
      .upsert(windows.map((w) => ({
        term_id: row.id,
        window_month: w.window,
        avg_price: num(w.avg_price),
        price_min: num(w.price_min),
        price_max: num(w.price_max),
        avg_postage: num(w.avg_postage),
        free_postage: int(w.free_postage),
        sell_through: num(w.sell_through),
        sellers: int(w.sellers),
      })), { onConflict: 'term_id,window_month' });

    if (wErr) console.error(`    FAIL windows ${wErr.message}`);
  }

  for (const term of killed) {
    console.log(`  ${'killed_at_strip'.padEnd(16)}  0w    0 listable   0 stock  ${term}`);
    if (dry) continue;

    const { error } = await db.from('research_terms').upsert({
      tenant_id: tenant.id,
      term,
      outcome: 'killed_at_strip',
      outcome_note: 'Killed on the aggregate strip, before any rows were scraped',
      last_swept_on: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'tenant_id,term' });

    if (error) console.error(`    FAIL ${error.message}`);
  }

  console.log(dry ? '\nDry run, nothing written.\n' : '\nCoverage recorded.\n');
}

main();
