/*
 * Which hand typed rows would not survive the next import.
 *
 * `candidate_notes` cascades on a candidate delete and `candidate_sources`
 * sits on the same foreign key, so a product that drops off a batch takes its
 * sources and notes with it. Those are typed by hand and have no other copy.
 * Two of them went on 15 August.
 *
 * Reads a backup directory and the shortlist. Touches no database and writes
 * nothing.
 *
 * Usage:
 *   node scripts/sources-at-risk.js --backup=backups/20260816T194453Z
 *   node scripts/sources-at-risk.js --backup=backups/20260816T194453Z --routes=proven,sourceable
 *
 * The survival test mirrors the importer: on the shortlist, status listable,
 * headroom at or above the gate, and at least one of the named routes. It is a
 * mirror and mirrors drift, so treat a clean result as a reason to look rather
 * than as a guarantee.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const GATE_ABS = 4.00;

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};

const backup = arg('backup');
if (!backup || !existsSync(backup)) {
  console.error('Pass --backup= a directory written by scripts/backup.js');
  process.exit(1);
}

const routes = (arg('routes') ?? 'proven,sourceable')
  .split(',').map((r) => r.trim()).filter(Boolean);

const read = (name) => {
  const path = join(backup, name);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
};

const candidates = read('candidates.json');
const sources = read('candidate_sources.json');
const notes = read('candidate_notes.json');
const batches = read('batches.json');

// The shortlist inside the backup rather than the working copy, so the answer
// describes the same moment the backup does.
let shortlistPath = join(backup, 'drops', 'merged', 'shortlist.csv');
if (!existsSync(shortlistPath)) shortlistPath = join(backup, 'shortlist.csv');
if (!existsSync(shortlistPath)) {
  console.error(`No shortlist.csv in ${backup}. Take a backup with the current script.`);
  process.exit(1);
}

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

const shortlist = new Map();
for (const r of parseCsv(readFileSync(shortlistPath, 'utf8'))) {
  shortlist.set(r.item_id, r);
}

const batchById = new Map(batches.map((b) => [b.id, b]));
const byId = new Map(candidates.map((c) => [c.id, c]));

function survives(candidate) {
  const row = shortlist.get(candidate.external_ref);
  if (!row) return { ok: false, why: 'not on the shortlist' };
  if ((row.status ?? '').trim() !== 'listable') return { ok: false, why: `shortlist status ${row.status}` };
  const headroom = Number(row.headroom);
  if (!Number.isFinite(headroom) || headroom < GATE_ABS) {
    return { ok: false, why: `headroom ${row.headroom || 'none'} below the gate` };
  }
  const carried = (row.routes ?? '').split('+').map((s) => s.trim()).filter(Boolean);
  const hit = carried.filter((r) => routes.includes(r));
  if (!hit.length) return { ok: false, why: `routes ${carried.join('+') || 'none'}` };
  return { ok: true, why: hit.join('+') };
}

const attached = new Map();
const add = (candidateId, kind) => {
  if (!attached.has(candidateId)) attached.set(candidateId, { sources: 0, notes: 0 });
  attached.get(candidateId)[kind] += 1;
};
for (const s of sources) add(s.candidate_id, 'sources');
for (const n of notes) add(n.candidate_id, 'notes');

console.log(`\n  ${backup}`);
console.log(`  ${sources.length} source row(s), ${notes.length} note row(s), on ${attached.size} candidate(s)`);
console.log(`  routes kept: ${routes.join(', ')}\n`);

let atRisk = 0;
let orphaned = 0;

for (const [candidateId, counts] of attached) {
  const candidate = byId.get(candidateId);
  if (!candidate) {
    // A source pointing at a candidate that is not in the backup is already a
    // problem and is worth saying out loud rather than skipping quietly.
    console.log(`  ORPHAN   candidate ${candidateId} not in this backup`
      + `  ${counts.sources} source(s), ${counts.notes} note(s)`);
    orphaned += 1;
    continue;
  }
  const verdict = survives(candidate);
  const batch = batchById.get(candidate.batch_id);
  const when = batch?.delivered_for ?? batch?.batch_date ?? 'no batch';
  const tag = verdict.ok ? 'keeps  ' : 'AT RISK';
  if (!verdict.ok) atRisk += 1;
  console.log(`  ${tag}  ${String(candidate.external_ref).padEnd(14)}${String(when).padEnd(12)}`
    + `${counts.sources}s ${counts.notes}n  ${verdict.why}`);
  console.log(`            ${String(candidate.title ?? '').slice(0, 62)}`);
}

console.log('');
if (orphaned) console.log(`  ${orphaned} attached to a candidate not in the backup.`);
if (atRisk) {
  console.error(`  ${atRisk} candidate(s) carrying hand typed rows would drop off the batch.`);
  console.error('  Copy what is on them before running the import without --dry.');
  process.exit(1);
}
console.log('  Nothing hand typed is on a product that would drop off.');
