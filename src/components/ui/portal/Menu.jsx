import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/menu.module.css';

/*
 * A select that looks like the rest of the toolbar. One button reads "Label: Value"; it opens a listbox that the
 * keyboard can drive the way a native select can: arrows, Home and End, Enter, Escape, and typing a letter to jump.
 * A long list gets a search field, and each option can carry a count and a line of explanation.
 */

// Open and close together, closed by a click outside, Escape, or Tab away.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  return { open, setOpen, close, wrap, trigger };
}

export function Menu({ label, value, options, onChange, icon, align = 'end', empty = 'Nothing here', wide, button, quiet }) {
  const { open, setOpen, close, wrap, trigger } = usePopover();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef(null);
  const find = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  const searchable = options.length > 8;

  const current = options.find((o) => o.value === value) ?? options[0];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  // Opening puts the cursor on the chosen option, and on the search field when there is one.
  useLayoutEffect(() => {
    if (!open) return;
    setQ('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    requestAnimationFrame(() => (searchable ? find.current : list.current)?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keeps the active option in view by scrolling the list alone. scrollIntoView would move the page as well.
  useEffect(() => {
    const el = list.current;
    const item = el?.querySelector(`[data-index="${active}"]`);
    if (!item) return;
    const top = item.offsetTop - 4;
    const bottom = item.offsetTop + item.offsetHeight + 4;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
  }, [active, open]);

  const choose = (o) => {
    if (!o) return;
    onChange(o.value);
    close();
  };

  // Keys inside the menu belong to it: A or R here must never approve or reject the card behind.
  const onKey = (e) => {
    e.stopPropagation();
    const last = shown.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(last); return; }
    if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    // Typing jumps to the next option starting with those letters, as a native select does.
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase(), at: now };
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  const onTrigger = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); }
  };

  const changed = !quiet && current && current.value !== options[0]?.value;

  return (
    <div ref={wrap} className={styles.wrap}>
      <button ref={trigger} type="button" className={styles.trigger} data-on={changed || undefined}
        aria-label={button ? undefined : `${label}: ${current?.label ?? ''}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
        onClick={() => setOpen((v) => !v)} onKeyDown={onTrigger}>
        {icon && <Icon name={icon} className={styles.icon} />}
        {button ?? (
          <>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{current?.short ?? current?.label}</span>
          </>
        )}
        <Icon name="IconCaret" className={styles.caret} />
      </button>

      {open && (
        <div className={styles.pop} data-align={align} data-wide={wide || undefined}>
          {searchable && (
            <div className={styles.findRow}>
              <Icon name="IconSearch" className={styles.findIcon} />
              <input ref={find} className={styles.find} value={q} placeholder={`Find in ${label.toLowerCase()}`}
                onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
                role="combobox" aria-expanded="true" aria-controls={`${id}-list`}
                aria-activedescendant={shown[active] ? `${id}-${active}` : undefined} aria-label={`Find in ${label}`} />
            </div>
          )}
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label} tabIndex={searchable ? -1 : 0}
            className={styles.list} onKeyDown={searchable ? undefined : onKey}
            aria-activedescendant={!searchable && shown[active] ? `${id}-${active}` : undefined}>
            {shown.map((o, i) => (
              <li key={o.value || 'none'} id={`${id}-${i}`} data-index={i} role="option" aria-selected={o.value === value}
                className={styles.option} data-active={i === active || undefined} data-rule={o.rule || undefined}
                onPointerMove={() => setActive(i)} onClick={() => choose(o)}>
                <span className={styles.tick} aria-hidden="true">
                  {o.value === value && <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                </span>
                <span className={styles.text}>
                  <span className={styles.optLabel}>{o.label}</span>
                  {o.hint && <span className={styles.hint}>{o.hint}</span>}
                </span>
                {o.count != null && <span className={styles.count} data-num>{o.count.toLocaleString('en-GB')}</span>}
              </li>
            ))}
            {!shown.length && <li className={styles.none}>{empty}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
