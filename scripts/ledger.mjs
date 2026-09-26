// Which query files are done, part done or untouched, worked out from the scan and gate CSVs on disk,
// so the record can never fall behind the work.
//   node scripts/ledger.mjs            prints the table and writes research/ledger.md

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const QUERIES = join('research', 'queries');
const SCANS = join('research', 'scans');
const GATES = join('research', 'gates');

const csvQueries = (path) => {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  const head = (lines.shift() ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const at = head.indexOf('query');
  if (at < 0) return [];
  return lines.map((l) => {
    // The query is the first quoted or unquoted field in every CSV these scripts write.
    const m = at === 0 ? l.match(/^"((?:[^"]|"")*)"|^([^,]*)/) : null;
    return (m ? (m[1] ?? m[2]) : l.split(',')[at] ?? '').replace(/""/g, '"').trim().toLowerCase();
  }).filter(Boolean);
};

const setFrom = (dir) => {
  const all = new Set();
  if (!existsSync(dir)) return all;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
    for (const q of csvQueries(join(dir, f))) all.add(q);
  }
  return all;
};

const scanned = setFrom(SCANS);
const gated = setFrom(GATES);

// Query files are the drafter's output; the scan's own "gated-" and gate "passes-" lists are not.
const files = readdirSync(QUERIES)
  .filter((f) => /^queries-.+\.txt$/.test(f) && !/-rest\.txt$/.test(f) && !/^queries-gated-/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const rows = files.map((f) => {
  const phrases = readFileSync(join(QUERIES, f), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('#')[0].trim().toLowerCase());
  const g = phrases.filter((q) => gated.has(q)).length;
  // A file is scanned from the top, so what counts is how far down it the scans reached. A phrase that
  // also sits in another file does not make this one started, and a few held back as account risk do
  // not stop it reading as done.
  let last = -1;
  phrases.forEach((q, i) => { if (scanned.has(q)) last = i; });
  const reached = last + 1;
  const inReach = phrases.slice(0, reached).filter((q) => scanned.has(q)).length;
  // A handful of shared phrases near the top is coincidence, not a scan of this file.
  const worked = reached > 0 && inReach >= reached * 0.8 && (inReach >= 10 || reached >= phrases.length - 5);
  const elsewhere = phrases.filter((q) => scanned.has(q)).length - (worked ? inReach : 0);
  const s = worked ? reached : 0;
  const state = !worked ? 'untouched' : reached >= phrases.length - 5 ? 'scanned' : `part, next --start=${reached}`;
  return { file: f, phrases: phrases.length, scanned: s, gated: g, state, elsewhere };
});

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const pad = (v, n) => String(v).padStart(n);
const lines = rows.map((r) => `| ${r.file} | ${r.phrases} | ${r.scanned} | ${r.gated} | ${r.state}${r.elsewhere ? `, ${r.elsewhere} also checked in other files` : ''} |`);
const md = [
  '# Research ledger',
  '',
  `Worked out from the scan and gate CSVs on ${new Date().toISOString().slice(0, 16).replace('T', ' ')}. Rerun \`node scripts/ledger.mjs\` rather than editing this.`,
  '',
  `**${sum('phrases').toLocaleString('en-GB')} phrases drafted, ${sum('scanned').toLocaleString('en-GB')} scanned, ${sum('gated').toLocaleString('en-GB')} gated.**`,
  '',
  '| File | Phrases | Scanned | Gated | State |',
  '|---|---|---|---|---|',
  ...lines,
  '',
].join('\n');
writeFileSync(join('research', 'ledger.md'), md);

console.log(`\n  ${sum('phrases')} phrases drafted, ${sum('scanned')} scanned, ${sum('gated')} gated\n`);
for (const r of rows.filter((r) => r.state !== 'untouched')) {
  console.log(`  ${r.file.padEnd(40)} ${pad(r.scanned, 4)}/${pad(r.phrases, 3)} scanned  ${pad(r.gated, 4)} gated  ${r.state}`);
}
const untouched = rows.filter((r) => r.state === 'untouched');
console.log(`\n  ${untouched.length} files untouched. Written to research/ledger.md\n`);
