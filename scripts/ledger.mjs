// Which query files are done, part done or untouched, worked out from the scan and gate CSVs on disk,
// so the record can never fall behind the work.
//   node scripts/ledger.mjs            prints the table and writes research/ledger.md

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { risky } from './lib/risk.js';

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
  const rawLines = readFileSync(join(QUERIES, f), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  const lines = rawLines
    .map((l) => { const [head, ...rest] = l.split('#'); return { q: head.trim().toLowerCase(), seed: rest.join('#') }; });
  const phrases = lines.map((x) => x.q);
  const g = phrases.filter((q) => gated.has(q)).length;
  // A line is dealt with if a scan read it, or if the scan holds it back as account risk by the same rules.
  const done = lines.map((x) => scanned.has(x.q) || risky(x.q, x.seed));
  const readByScan = lines.filter((x) => scanned.has(x.q)).length;
  const left = lines.map((x, i) => ({ ...x, i, raw: rawLines[i] })).filter((x) => !done[x.i]);
  // A few shared phrases are coincidence, not a scan of this file.
  const worked = readByScan >= 10 || (left.length === 0 && readByScan > 0);
  let state;
  if (!worked) state = 'untouched';
  else if (!left.length) state = 'scanned';
  // Part done: little after the first unchecked line has been read (a stray phrase shared with another
  // file does not count). Gaps: most of what follows was read, so the holes go to a file of their own.
  else if (done.slice(left[0].i).filter(Boolean).length < (lines.length - left[0].i) / 2) {
    // Unchecked from the very first line: nobody scanned this file; its read lines came from a subset
    // (the Lakeland winter and parts files) or another shop's file. The scan skips those, so start at 0.
    state = left[0].i === 0
      ? `untouched, ${readByScan} of its lines already checked elsewhere`
      : `part, next --start=${left[0].i}`;
  }
  else {
    // Lines skipped by an older rule, scattered through a scanned file. Resuming from the first would
    // re-scan everything after it, so the unchecked lines go to a file of their own instead.
    const out = join(QUERIES, 'left', f);
    mkdirSync(join(QUERIES, 'left'), { recursive: true });
    writeFileSync(out, left.map((x) => x.raw).join('\n') + '\n');
    state = `gaps: ${left.length} unchecked lines in left/${f}`;
  }
  const s = lines.length - left.length;
  const elsewhere = 0;
  return { file: f, phrases: phrases.length, scanned: s, gated: g, state, elsewhere };
});

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const pad = (v, n) => String(v).padStart(n);
const lines = rows.map((r) => `| ${r.file} | ${r.phrases} | ${r.scanned} | ${r.gated} | ${r.state} |`);
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
