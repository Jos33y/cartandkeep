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

    const [list, demand] = await Promise.all([
      supabase.from('store_requests')
        .select('id, wanted, paying, seen_at, email, name, source, status, note, created_at, product_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),

      supabase.from('store_request_demand')
        .select('wanted, asks, unanswered, paying, last_asked')
        .eq('tenant_id', tenantId)
        .order('asks', { ascending: false }),
    ]);

    const error = list.error ?? demand.error;
    if (error) return setState({ ...EMPTY, status: 'error', error });

    const rows = list.data ?? [];

    setState({
      status: 'ready',
      error: null,
      rows,
      demand: demand.data ?? [],
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
