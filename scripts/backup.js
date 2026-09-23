/*
 * Takes a timestamped copy of everything a rerun could destroy, and compares
 * two copies afterwards.
 *
 * The shortlist CSV is regenerable and cheap to copy. The database is not.
 * `run.js` still deletes then inserts, so an import that goes wrong takes the
 * batch with it, and a decision she made cannot be recomputed from a scrape.
 * Sources and notes are typed by hand and have no other copy anywhere. The
 * Terapeak row exports cannot be regenerated at all: the tool refuses some
 * windows outright and the rest are a manual export each.
 *
 * Usage:
 *   node scripts/backup.js
 *   node scripts/backup.js --out=backups --tenant=cart-and-keep
 *   node scripts/backup.js --check=backups/20260814T171758Z
 *   node scripts/backup.js --check=backups/NEWER --against=backups/OLDER
 *
 * Writes one directory per run, named for the moment it was taken:
 *   backups/20260814T171758Z/candidates.json      one file per table, rows as fetched
 *   backups/20260814T171758Z/drops/merged/...     every CSV under drops, path mirrored
 *   backups/20260814T171758Z/MANIFEST.txt         row counts, so a short file is obvious
 *
 * Nothing is deleted and nothing is pruned. Old backups are cheap and the one
 * you delete is the one you needed.
 */

import { mkdirSync, copyFileSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

import { connect } from '../pipeline/lib/db.js';

// Every table the portal or the pipeline writes to, with how each one is
// reached rather than an assumption that they are all the same shape.
//
// `research_windows` carries no tenant_id. It hangs off research_terms by
// term_id, and the backup asserted otherwise and came back incomplete. A
// backup that reports a missing table is doing its job; one that quietly
// writes an empty file is not.
//
// Order is restore order, parents before children, so the manifest reads as a
// plan rather than as an alphabetical list.
//
// `order` overrides the column paging sorts on. It defaults to id and it is
// not cosmetic: see fetchAll.
const TABLES = [
  ['batches', { by: 'tenant' }],
  ['candidates', { by: 'tenant' }],
  ['decisions', { by: 'tenant' }],
  ['candidate_sources', { by: 'tenant' }],
  ['candidate_notes', { by: 'tenant' }],
  ['research_terms', { by: 'tenant' }],
  ['research_windows', { by: 'parent', parent: 'research_terms', key: 'term_id' }],
  ['listings', { by: 'tenant' }],
  ['listing_performance', { by: 'tenant' }],
  ['tenant_sources', { by: 'tenant' }],
  ['tenants', { by: 'all' }],
  ['category_boundaries', { by: 'all' }],
  ['rate_cards', { by: 'all' }],
];

// Everything under here, at any depth. Named as a root rather than as a list of
// subdirectories, because the raw Terapeak exports are the expensive artefact
// on this project and a hand written list is how they came to be left out.
const CSV_ROOTS = ['drops'];

const PAGE = 1000;

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
}

/*
 * Supabase caps a select at 1,000 rows and returns the first page without
 * complaining, so a table read in one call looks complete and is not. Paging
 * is not an optimisation here, it is the difference between a backup and a
 * truncated file that will be trusted in six weeks.
 *
 * The order clause is part of the same fault. A range over an unordered select
 * leaves row order to the planner, so page two can repeat rows from page one
 * and omit others while the total still looks plausible. Ordering on the
 * primary key makes the pages disjoint.
 */
async function fetchAll(db, table, scope) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select('*')
      .order(scope.order ?? 'id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (scope.tenantId) query = query.eq('tenant_id', scope.tenantId);
    if (scope.parentIds) query = query.in(scope.key, scope.parentIds);

    const { data, error } = await query;
    if (error) return { rows: null, error: error.message };
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, error: null };
}

function* walkCsv(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) yield* walkCsv(full);
    // Case insensitive. The Terapeak exports arrive named .CSV and the old
    // filter tested endsWith('.csv'), so every raw export was skipped while the
    // manifest reported the merged ones as copied.
    else if (entry.name.toLowerCase().endsWith('.csv')) yield full;
  }
}

async function main() {
  // Reading a backup is a local operation and must not need credentials. It
  // used to connect first, so a check ran only while the database was up, which
  // is the moment you least want to be told to fix an env file.
  const check = arg('check');
  if (check) return verify(check, arg('against'));

  const { db, E } = await connect();

  const slug = arg('tenant') ?? E.VITE_TENANT_SLUG ?? 'cart-and-keep';
  const outRoot = arg('out') ?? 'backups';

  const { data: tenant, error: tErr } = await db
    .from('tenants').select('id, name').eq('slug', slug).single();

  if (tErr || !tenant) {
    console.error(`No tenant with slug "${slug}".`);
    process.exit(1);
  }

  const dir = join(outRoot, stamp());
  mkdirSync(dir, { recursive: true });

  const lines = [`Cart and Keep backup`, `Tenant: ${tenant.name} (${slug})`,
    `Taken: ${new Date().toISOString()}`, ''];
  let failed = 0;

  const fetched = {};

  for (const [table, spec] of TABLES) {
    const scope = { order: spec.order };
    if (spec.by === 'tenant') scope.tenantId = tenant.id;
    if (spec.by === 'parent') {
      const parent = fetched[spec.parent];
      if (!parent) {
        console.error(`  ${table.padEnd(22)} FAILED  ${spec.parent} was not read first`);
        lines.push(`${table.padEnd(22)} FAILED  ${spec.parent} was not read first`);
        failed += 1;
        continue;
      }
      scope.key = spec.key;
      scope.parentIds = parent.map((r) => r.id);
      // No parents means no children, and `.in()` on an empty list is an
      // error on some drivers rather than an empty result.
      if (scope.parentIds.length === 0) {
        writeFileSync(join(dir, `${table}.json`), '[]');
        console.log(`  ${table.padEnd(22)} ${'0'.padStart(6)} rows`);
        lines.push(`${table.padEnd(22)} ${'0'.padStart(6)} rows  (no ${spec.parent})`);
        continue;
      }
    }

    const { rows, error } = await fetchAll(db, table, scope);

    if (error) {
      // A missing table or a wrong assumption about scoping is worth seeing
      // rather than swallowing. This list is written by hand and the schema
      // moves under it.
      console.error(`  ${table.padEnd(22)} FAILED  ${error}`);
      lines.push(`${table.padEnd(22)} FAILED  ${error}`);
      failed += 1;
      continue;
    }

    fetched[table] = rows;
    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`  ${table.padEnd(22)} ${String(rows.length).padStart(6)} rows`);
    lines.push(`${table.padEnd(22)} ${String(rows.length).padStart(6)} rows`);
  }

  lines.push('');
  let copied = 0;
  for (const root of CSV_ROOTS) {
    if (!existsSync(root)) continue;
    for (const src of walkCsv(root)) {
      // The path is mirrored rather than flattened, because two directories
      // under drops can hold a file of the same name and a flat copy loses one
      // of them without saying so.
      const target = join(dir, relative('.', src));
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(src, target);
      copied += 1;
      lines.push(`${relative('.', src).split(/[\\/]/).join('/')}  copied`);
    }
  }
  console.log(`  ${'csv files'.padEnd(22)} ${String(copied).padStart(6)} copied`);
  if (copied === 0) {
    console.error('  no CSV files found under drops. Check the working directory.');
  }

  writeFileSync(join(dir, 'MANIFEST.txt'), `${lines.join('\n')}\n`);

  const shown = dir.split(/[\\/]/).join('/');
  console.log(`\n${shown}`);
  // Printed in full rather than as a placeholder. Angle brackets are
  // redirection operators in the Windows shell and a pasted `<stamp>` fails
  // with a syntax error that looks like the script's fault.
  console.log(`  node scripts/backup.js --check=${shown}`);
  console.log(`  node scripts/backup.js --check=THE_NEXT_ONE --against=${shown}`);
  if (failed) {
    console.error(`${failed} table(s) failed. The backup is incomplete.`);
    process.exit(1);
  }
}

/*
 * A row count survives an import that replaced every row with a different one,
 * so counts alone cannot answer the only question worth asking after a
 * `--replace`: what was in the old copy and is not in the new one.
 *
 * A reimport rewrites every primary key, so the comparison cannot use ids. It
 * uses a natural key found by reading the rows rather than by asserting the
 * schema, because the table list is maintained by hand and the schema moves
 * under it. A table with no usable natural key is compared on count, and says
 * that is what it did rather than reporting a clean zero.
 */
const KEY_CANDIDATES = ['external_ref', 'item_id', 'product_key', 'slug', 'term', 'code'];

function naturalKey(rows) {
  if (!rows.length) return null;
  for (const key of KEY_CANDIDATES) {
    if (!(key in rows[0])) continue;
    const values = rows.map((r) => r[key]);
    if (values.some((v) => v === null || v === undefined || v === '')) continue;
    if (new Set(values.map(String)).size !== values.length) continue;
    return key;
  }
  return null;
}

// Ids change on every reimport and carry no evidence of change. These
// timestamps are written by the import rather than by anyone deciding anything.
const VOLATILE = new Set(['created_at', 'updated_at', 'inserted_at', 'imported_at']);
const isVolatile = (field) => field === 'id' || field.endsWith('_id') || VOLATILE.has(field);

function changedFields(a, b) {
  const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const field of fields) {
    if (isVolatile(field)) continue;
    if (JSON.stringify(a[field] ?? null) !== JSON.stringify(b[field] ?? null)) out.push(field);
  }
  return out;
}

function readTables(dir) {
  const out = {};
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    out[name.replace('.json', '')] = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  }
  return out;
}

function verify(dir, against) {
  if (!existsSync(dir)) {
    console.error(`No backup at ${dir}`);
    process.exit(1);
  }
  const current = readTables(dir);

  if (!against) {
    let empty = 0;
    for (const [table, rows] of Object.entries(current)) {
      console.log(`  ${table.padEnd(22)} ${String(rows.length).padStart(6)} rows`);
      if (rows.length === 0) empty += 1;
    }
    console.log(`\n${empty} empty table(s).`);
    return;
  }

  if (!existsSync(against)) {
    console.error(`No backup at ${against}`);
    process.exit(1);
  }
  const older = readTables(against);

  console.log(`  new  ${dir}`);
  console.log(`  old  ${against}\n`);
  console.log(`  ${'table'.padEnd(22)}${'old'.padStart(7)}${'new'.padStart(7)}${'lost'.padStart(7)}${'added'.padStart(7)}${'changed'.padStart(9)}  key`);

  let lostTotal = 0;

  for (const table of [...new Set([...Object.keys(older), ...Object.keys(current)])].sort()) {
    const oldRows = older[table] ?? [];
    const newRows = current[table] ?? [];
    const key = naturalKey(oldRows) ?? naturalKey(newRows);

    if (!key) {
      const delta = oldRows.length - newRows.length;
      const note = delta > 0 ? `${delta} fewer, counts only` : 'counts only, no natural key';
      console.log(`  ${table.padEnd(22)}${String(oldRows.length).padStart(7)}${String(newRows.length).padStart(7)}${'-'.padStart(7)}${'-'.padStart(7)}${'-'.padStart(9)}  ${note}`);
      if (delta > 0) lostTotal += delta;
      continue;
    }

    const oldBy = new Map(oldRows.map((r) => [String(r[key]), r]));
    const newBy = new Map(newRows.map((r) => [String(r[key]), r]));
    const lost = [...oldBy.keys()].filter((k) => !newBy.has(k));
    const added = [...newBy.keys()].filter((k) => !oldBy.has(k));
    let changed = 0;
    const fieldTally = new Map();
    for (const [k, row] of oldBy) {
      if (!newBy.has(k)) continue;
      const diff = changedFields(row, newBy.get(k));
      if (!diff.length) continue;
      changed += 1;
      for (const f of diff) fieldTally.set(f, (fieldTally.get(f) ?? 0) + 1);
    }

    lostTotal += lost.length;
    console.log(`  ${table.padEnd(22)}${String(oldRows.length).padStart(7)}${String(newRows.length).padStart(7)}${String(lost.length).padStart(7)}${String(added.length).padStart(7)}${String(changed).padStart(9)}  ${key}`);

    // Lost keys are printed in full up to twenty, because the point of the
    // comparison is to hand back something that can be looked up rather than a
    // number that has to be believed.
    if (lost.length) {
      for (const k of lost.slice(0, 20)) console.log(`      lost  ${k}`);
      if (lost.length > 20) console.log(`      lost  and ${lost.length - 20} more`);
    }
    if (fieldTally.size) {
      const top = [...fieldTally.entries()].sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(([f, n]) => `${f} ${n}`).join(', ');
      console.log(`      changed  ${top}`);
    }
  }

  console.log(`\n  ids and created/updated timestamps are excluded from the change`);
  console.log(`  test, because a reimport rewrites them whether or not anything moved.`);

  if (lostTotal) {
    console.error(`\n${lostTotal} row(s) in the old copy and not in the new one.`);
    process.exit(1);
  }
  console.log(`\nNothing lost.`);
}

main();
