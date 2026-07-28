import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { velocityTrend } from '../lib/metrics.js';

/*
 * Zik has no export on the trial tier, so the table is copied out of the browser
 * and lands as one field per line rather than as CSV. The record is nine fields
 * and repeats cleanly, so it parses reliably. If a real CSV export appears later
 * this adapter changes shape and nothing downstream moves.
 *
 * Zik gives demand and price but no active listing count, so sell-through is not
 * computable from this source alone. It comes from Browse or Terapeak.
 */

export const id = 'zik_export';
export const provides = ['velocity', 'demand'];

const FIELDS = ['title', 'uploaded', 'sold7', 'rev7', 'sold14', 'rev14', 'sold30', 'rev30', 'price'];

function num(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/[£$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(field); field = ''; }
    else field += c;
  }
  out.push(field);
  return out;
}

// The tidy CSV written by pipeline/tidy-zik.js, which is what a person reads.
export function parseTidyCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  return lines.slice(1).map((line) => {
    const c = splitCsvLine(line);
    return {
      title: c[idx('title')],
      uploaded: c[idx('uploaded')],
      price: num(c[idx('price')]),
      sold7: num(c[idx('sold_7d')]),
      sold14: num(c[idx('sold_14d')]),
      sold30: num(c[idx('sold_30d')]),
      rev30: num(c[idx('revenue_30d')]),
    };
  }).filter((r) => r.title && r.price > 0);
}

// Either format works, so a raw paste can be dropped in and used immediately
// without waiting for anyone to tidy it.
export function parse(text) {
  const first = text.replace(/\r/g, '').split('\n').find((l) => l.trim());
  return /title\s*,/i.test(first ?? '') ? parseTidyCsv(text) : parsePastedTable(text);
}

export function parsePastedTable(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // The pasted header is a single "Image" cell rather than a full header row.
  const start = /^image$/i.test(lines[0] ?? '') ? 1 : 0;
  const body = lines.slice(start);

  const rows = [];
  for (let i = 0; i + FIELDS.length <= body.length; i += FIELDS.length) {
    const chunk = body.slice(i, i + FIELDS.length);
    const r = Object.fromEntries(FIELDS.map((f, j) => [f, chunk[j]]));
    for (const k of ['sold7', 'rev7', 'sold14', 'rev14', 'sold30', 'rev30', 'price']) r[k] = num(r[k]);
    if (!r.title || !(r.price > 0)) continue;
    rows.push(r);
  }
  return rows;
}

// The same listing appears more than once in a browser paste.
export function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) {
    const prev = seen.get(r.title);
    if (!prev || (r.sold30 ?? 0) > (prev.sold30 ?? 0)) seen.set(r.title, r);
  }
  return [...seen.values()];
}

export function toSignals(rows) {
  const sold = rows.map((r) => r.sold30 ?? 0);
  const max = Math.max(...sold, 1);

  return rows.map((r) => ({
    externalRef: null,
    title: r.title,
    category: null,
    kind: 'velocity',
    value: Math.round((r.sold30 / max) * 100) / 100,
    price: r.price,
    // Demand facts travel alongside the normalised signal, because the gates
    // need the real numbers rather than a 0..1 abstraction of them.
    demand: {
      sold7: r.sold7,
      sold14: r.sold14,
      sold30: r.sold30,
      revenue30: r.rev30,
      trend: velocityTrend({ sold7: r.sold7, sold30: r.sold30 }),
      uploaded: r.uploaded,
    },
    raw: r,
  }));
}

async function latestFile(dir, prefix) {
  const names = (await readdir(dir))
    .filter((n) => n.toLowerCase().startsWith(prefix))
    .filter((n) => /\.(csv|txt|tsv)$/i.test(n))
    .sort();
  if (!names.length) throw new Error(`no ${prefix}*.txt or .csv found in ${dir}`);
  return path.join(dir, names[names.length - 1]);
}

export async function fetchSignals({ config }) {
  const dir = config.dropDir;
  if (!dir) throw new Error('zik_export: config.dropDir not set');
  const file = await latestFile(dir, config.prefix ?? 'zik');
  const rows = dedupe(parse(await readFile(file, 'utf8')));
  if (config.debug) console.log(`      ${path.basename(file)}: ${rows.length} unique listings`);
  return toSignals(rows);
}

export { fetchSignals as fetch };
