/*
 * Reading what the run produced: the CSV, the shelf map, the product JSON.
 *
 * Split out of import-gate.js when it passed nine hundred lines. Same
 * functions, same behaviour.
 */

/*
 * Reading a CSV cell. A blank is null rather than zero: a zero written where
 * the answer is "we could not see" is the most expensive error in this
 * pipeline, because it looks like data.
 */
export const num = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null;
};

export const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

export const yes = (v) => String(v ?? '').trim().toLowerCase() === 'true';


import fs from 'node:fs';

export function parseCsv(text) {
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

/*
 * The shelf. Keyed on the query, because that is what shelf-queries.js wrote
 * and what external_ref is. Without this the goods cost is unknown and every
 * figure on the card is headroom rather than profit.
 */
export function readShelf(path) {
  if (!path) return new Map();
  const map = new Map();
  for (const file of String(path).split(',').map((f) => f.trim()).filter(Boolean)) {
    if (!fs.existsSync(file)) {
      console.error(`\n  ${file} not found. Importing without its shelf prices.\n`);
      continue;
    }
    readShelfInto(map, file);
  }
  return map;
}

// Several maps can price the same query; the cheaper shelf is the one to buy from.
function readShelfInto(map, path) {
  for (const r of parseCsv(fs.readFileSync(path, 'utf8'))) {
    const q = (r.query || '').trim();
    if (!q) continue;
    const price = Number(r.shelf);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (map.has(q) && map.get(q).price <= price) continue;
    map.set(q, {
      price,
      url: (r.url || '').trim() || null,
      product: (r.name || '').trim() || null,
      shop: shopFromUrl(r.url),
    });
  }
}

/*
 * Listing data, keyed on the product URL because that is the only thing the
 * gate CSV and the product fetch have in common.
 */
export function readProducts(path) {
  if (!path) return new Map();
  if (!fs.existsSync(path)) {
    console.error(`\n  ${path} not found. Importing without listing data.\n`);
    return new Map();
  }
  const list = JSON.parse(fs.readFileSync(path, 'utf8'));
  return new Map((Array.isArray(list) ? list : [list]).filter((p) => p?.url).map((p) => [p.url, p]));
}

export function shopFromUrl(url) {
  const host = (url || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (!host) return null;
  const known = {
    'home.bargains': 'Home Bargains',
    'homebargains.co.uk': 'Home Bargains',
    'therange.co.uk': 'The Range',
    'qdstores.co.uk': 'QD Stores',
    'theworks.co.uk': 'The Works',
    'savers.co.uk': 'Savers',
    'superdrug.com': 'Superdrug',
    'poundland.co.uk': 'Poundland',
    'zooplus.co.uk': 'Zooplus',
  };
  return known[host] ?? host;
}

/*
 * Which shops might carry this. A proposal, not a finding: each one renders as
 * a search, so a shop that does not stock it returns an empty result page
 * rather than asserting something false. Six fixed links did assert something
 * false, which is how Screwfix came to be offered as a source of dog food.
 *
 * Run once at import and stored, not called on render. A card that calls the
 * API to draw itself costs a call every time the board is opened and shows
 * different shops each time.
 */
// .env.local is a file, not the process environment. gate.js loads it for its
// own credentials; this does the same rather than expecting a shell variable.
