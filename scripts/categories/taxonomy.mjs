/*
 * Google's product taxonomy, read from Google's own file (research/google/taxonomy-with-ids.en-GB.txt).
 * A category is stored as its ID; the path is read from this file, never typed by hand.
 */
import fs from 'node:fs';

export function loadTaxonomy(file = 'research/google/taxonomy-with-ids.en-GB.txt') {
  const byId = new Map();
  const byPath = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\d+) - (.+)$/);
    if (!m) continue;
    const id = Number(m[1]);
    const path = m[2].trim();
    byId.set(id, path);
    byPath.set(path.toLowerCase(), id);
  }
  const parts = (id) => (byId.get(id) ?? '').split(' > ');
  // The ID of the ancestor at a level: 1 is the tab, 2 is the filter inside it.
  const levelId = (id, level) => {
    const p = parts(id);
    if (p.length < level) return null;
    return byPath.get(p.slice(0, level).join(' > ').toLowerCase()) ?? null;
  };
  return {
    size: byId.size,
    pathOf: (id) => byId.get(id) ?? null,
    idOf: (path) => byPath.get(String(path).trim().toLowerCase()) ?? null,
    topOf: (id) => levelId(id, 1),
    level2Of: (id) => levelId(id, 2),
    has: (id) => byId.has(id),
  };
}
