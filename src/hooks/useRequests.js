import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@lib/supabase';

/*
 * What people asked her to stock.
 *
 * The most useful screen on this portal for the money, because every row is
 * somebody saying unprompted what they would buy. The research pipeline pays
 * for demand signal; this arrives free and it is from her own visitors rather
 * than from a marketplace average.
 *
 * Two reads. The list, and the view that groups anything asked for more than
 * once. The grouping is in the database rather than here so the count on this
 * screen and any count anywhere else cannot disagree.
 */

const EMPTY = {
  status: 'loading',
  rows: [],
  demand: [],
  error: null,
  counts: { new: 0, looking: 0, sourced: 0, declined: 0, all: 0 },
};

export function useRequests(tenantId) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, status: 'loading' }));

    const list = await supabase.from('store_requests')
      .select('id, wanted, paying, seen_at, email, name, source, status, note, created_at, product_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const { error } = list;
    if (error) return setState({ ...EMPTY, status: 'error', error });

    const rows = list.data ?? [];

    setState({
      status: 'ready',
      error: null,
      rows,
      demand: groupDemand(rows),
      counts: {
        new: rows.filter((r) => r.status === 'new').length,
        looking: rows.filter((r) => r.status === 'looking').length,
        sourced: rows.filter((r) => r.status === 'sourced').length,
        declined: rows.filter((r) => r.status === 'declined').length,
        all: rows.length,
      },
    });
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const setStatus = useCallback(async (id, status) => {
    const { error } = await supabase.from('store_requests').update({ status }).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  /*
   * Her note, saved separately from the status.
   *
   * Recording the supplier she found is a different act from deciding what to
   * do about the request, and she will often do one without the other. An
   * empty box clears the note rather than saving a blank one.
   */
  const saveNote = useCallback(async ({ id, note }) => {
    const trimmed = String(note ?? '').trim();
    const { error } = await supabase.from('store_requests')
      .update({ note: trimmed || null }).eq('id', id);
    if (error) throw error;
    await load();
  }, [load]);

  return { ...state, reload: load, setStatus, saveNote };
}

/*
 * The list as a spreadsheet.
 *
 * Export is in the signed scope as a data ownership promise, and it is built
 * now rather than at handover because built early it demonstrates the promise
 * is real and built late it is a scramble during a termination.
 *
 * Written rather than installed. Quoting and line breaks are about twenty
 * lines of a specification that has not changed since 2005, and the channel
 * import reader on this project was written for the same reason.
 */
// Grouped here rather than in store_request_demand, which only matched exact wording, so
// "toilet frame with arms" and "Toilet frames with arms, adjustable height" were two things.
const STOP = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'of', 'to', 'in', 'on', 'my', 'some', 'any', 'please', 'or']);

function wordsOf(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

function alike(a, b) {
  if (a.joined === b.joined) return true;
  const [small, large] = a.set.size <= b.set.size ? [a, b] : [b, a];
  if (small.set.size < 2) return false;
  let shared = 0;
  for (const w of small.set) if (large.set.has(w)) shared += 1;
  if (shared === small.set.size) return true;
  return shared / (a.set.size + b.set.size - shared) >= 0.6;
}

export function groupDemand(rows) {
  const items = rows.map((r) => {
    const words = wordsOf(r.wanted);
    return { r, set: new Set(words), joined: words.join('') };
  });
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].joined && alike(items[i], items[j])) parent[find(j)] = find(i);
    }
  }

  const groups = new Map();
  items.forEach((it, i) => {
    const k = find(i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it.r);
  });

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const paid = g.map((r) => Number(r.paying)).filter((n) => Number.isFinite(n) && n > 0);
      return {
        // The shortest wording is usually the plainest name for the thing.
        wanted: [...g].sort((a, b) => a.wanted.length - b.wanted.length)[0].wanted,
        asks: g.length,
        unanswered: g.filter((r) => r.status === 'new').length,
        paying: paid.length ? Math.round((paid.reduce((n, v) => n + v, 0) / paid.length) * 100) / 100 : null,
        last_asked: g.map((r) => r.created_at).sort().at(-1),
        ids: g.map((r) => r.id),
      };
    })
    .sort((a, b) => b.asks - a.asks || String(b.last_asked).localeCompare(String(a.last_asked)));
}

export function toCsv(rows, columns) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Quoted when it contains anything that would end a field or a row, and
    // internal quotes doubled, which is the whole of the rule.
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const head = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(',')).join('\r\n');

  /*
   * A byte order mark, and CRLF.
   *
   * Excel on Windows opens a UTF-8 CSV as Windows-1252 without the mark, which
   * turns £ into a pair of characters and any accented supplier name into
   * nonsense. She is on Windows and she will open this in Excel.
   */
  return `\uFEFF${head}\r\n${body}\r\n`;
}

export function download(name, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Released on the next tick rather than immediately, because revoking before
  // the click has been handled cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Named with the date, so a folder of these sorts and nobody has to open two
// to find out which is newer.
export const stamped = (what) => {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return `cart-and-keep-${what}-${d}.csv`;
};
