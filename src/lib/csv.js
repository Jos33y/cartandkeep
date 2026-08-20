/*
 * A CSV reader, because the exports are CSV and nothing here read one.
 *
 * Written rather than installed. It is forty lines of a specification that has
 * not changed since 2005, it needs to be exactly right rather than roughly
 * right, and adding a dependency to a lockfile is a decision that belongs to
 * whoever maintains the project rather than to whoever needed a parser.
 *
 * The awkward cases are not hypothetical. eBay titles contain commas
 * constantly, a returns note can contain a newline, Excel writes a byte order
 * mark on anything saved as CSV UTF-8, and a quote inside a quoted field is
 * doubled rather than escaped.
 */

export function parseCsv(text) {
  // Excel writes this and nothing strips it, so the first header comes back as
  // "\uFEFFOrder number" and every lookup by name misses.
  let input = String(text ?? '').replace(/^\uFEFF/, '');

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        // A doubled quote is one quote. Anything else closes the field.
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') { quoted = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }

    if (ch === '\r' || ch === '\n') {
      // Windows writes \r\n and a lone \r would otherwise produce a blank row.
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // Whatever was in hand when the text ran out, unless the file ended on a
  // newline and there is nothing there.
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/*
 * Rows keyed by header.
 *
 * Headers are normalised on the way in, because "Order number", "order_number"
 * and "Order Number " are the same column and which one arrives depends on
 * which export and which month.
 */
export const normaliseHeader = (h) => String(h ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function toObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map(normaliseHeader);

  return {
    headers,
    rows: rows.slice(1).map((r) => {
      const out = {};
      headers.forEach((h, i) => { if (h) out[h] = (r[i] ?? '').trim(); });
      return out;
    }),
  };
}

/*
 * A number out of whatever the platform wrote.
 *
 * eBay writes "£12.99" and TikTok writes "12.99" and both occasionally write
 * "1,234.56" or "(4.20)" for a negative. Returns null rather than zero when
 * there is nothing there, because a missing fee and a fee of nothing are
 * different facts and only one of them should be reported as a receipt.
 */
export function money(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits) return null;

  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

export function whole(value) {
  const n = Number(String(value ?? '').replace(/[^0-9-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/*
 * A date out of whatever the platform wrote.
 *
 * eBay UK exports write day first and Date.parse reads an ambiguous
 * "05/08/2026" as the fifth of August in some runtimes and the eighth of May in
 * others. Getting that wrong moves revenue between months, so day first is
 * handled explicitly rather than left to the engine.
 */
export function whenSold(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const [, d, m, y, hh = '12', mm = '00'] = dmy;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${mm}:00Z`;
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? null : at.toISOString();
  }

  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
