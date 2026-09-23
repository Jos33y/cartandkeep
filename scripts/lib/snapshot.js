/*
 * Snapshots, and what sold between two of them.
 *
 * Split out of gate.js when it passed nine hundred lines. Same functions, same
 * behaviour: the file it came from now imports them.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const SNAP_DIR = '.gate';

// ------------------------------------------------------------------ snapshots

// The sweep caches its category tree in the same directory, and "categories-
// EBAY_GB.json" sorts after every ISO timestamp, so it was being read as the
// previous snapshot. That is where the NaN came from.
const SNAPSHOT_NAME = /^\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/;

export async function priorSnapshot() {
  try {
    const files = (await readdir(SNAP_DIR)).filter((f) => SNAPSHOT_NAME.test(f)).sort();
    if (!files.length) return null;
    const raw = JSON.parse(await readFile(path.join(SNAP_DIR, files[files.length - 1]), 'utf8'));
    return raw;
  } catch { return null; }
}

// Lifetime sold is not a rate. The difference between two runs is.
export function deltas(now, prior) {
  if (!prior) return null;
  const byId = new Map();
  for (const r of prior.results ?? []) for (const l of r.listings ?? []) byId.set(l.itemId, l.soldLifetime);

  const out = [];
  for (const r of now.results ?? []) {
    let moved = 0; let seen = 0;
    for (const l of r.listings ?? []) {
      const was = byId.get(l.itemId);
      if (was == null || l.soldLifetime == null) continue;
      seen += 1;
      // A listing that was revised or relisted resets. A fall is not a refund.
      if (l.soldLifetime >= was) moved += l.soldLifetime - was;
    }
    out.push({ q: r.q, movedSincePrior: seen ? moved : null, listingsMatched: seen });
  }
  const days = Math.round((Date.parse(now.at) - Date.parse(prior.at)) / 86400000);
  return { sincePriorDays: days, rows: out };
}
