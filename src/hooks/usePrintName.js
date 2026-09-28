import { useEffect } from 'react';

/*
 * The name a printed page is saved under.
 *
 * Browsers offer the page title as the file name when printing to PDF, so a
 * receipt saved as "Receipt CK-3HCV-AB7M | Cart & Keep" lands in Downloads
 * with a pipe in it and nothing to sort by. For the length of the print the
 * title becomes a proper file name, with the date and time in the sortable
 * order, and goes back afterwards. On beforeprint rather than only on the
 * button, so Ctrl+P gets the same name.
 */
export function usePrintName(name) {
  useEffect(() => {
    if (!name) return undefined;
    let before = null;
    const on = () => { before = document.title; document.title = name; };
    const off = () => { if (before !== null) document.title = before; before = null; };
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
      off();
    };
  }, [name]);
}

// "2026-09-28 18-34" in London time: sorts in a folder, and has no characters a file system refuses.
export function stampFor(at) {
  if (!at) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}-${p.minute}`;
}
