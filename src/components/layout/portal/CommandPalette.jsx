import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { PORTAL_NAV_SECTIONS, navLabel, portalPath } from '@utils/constants';
import { Icon } from '@components/ui/icons';
import styles from '@styles/layout/portal/command-palette.module.css';

const ENTRIES = PORTAL_NAV_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.label })));

// Anywhere in the name, but only at the start of a word in the section, so "or" does not find Finance under Performance.
function matches(entry, q) {
  if (!q) return true;
  const label = entry.label.toLowerCase();
  const words = `${entry.label} ${entry.section}`.toLowerCase().split(/\s+/);
  return q.toLowerCase().split(/\s+/).filter(Boolean)
    .every((w) => label.includes(w) || words.some((h) => h.startsWith(w)));
}

// Label hits first, so typing "or" lands on Orders rather than on something filed under Performance.
function rank(entry, q) {
  const l = entry.label.toLowerCase();
  const w = q.toLowerCase().trim();
  if (!w) return 0;
  if (l.startsWith(w)) return 0;
  if (l.includes(w)) return 1;
  return 2;
}

export function CommandPalette({ open, onClose, agentName }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const listId = useId();

  const results = useMemo(
    () => ENTRIES.map((e) => ({ ...e, label: navLabel(e, agentName) })).filter((e) => matches(e, q)).sort((a, b) => rank(a, q) - rank(b, q)),
    [q, agentName],
  );

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (entry) => {
    onClose();
    navigate(portalPath(entry.route));
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Tab') e.preventDefault();
  };

  return createPortal(
    <div className={styles.layer}>
      <button type="button" className={styles.scrim} aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Go to a screen">
        <div className={styles.field}>
          <Icon name="IconSearch" className={styles.fieldIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to a screen"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className={styles.esc}>Esc</kbd>
        </div>

        {results.length ? (
          <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
            {results.map((r, i) => (
              <li
                key={r.route}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`${styles.option} ${i === active ? styles.active : ''}`}
                onPointerMove={() => setActive(i)}
                onClick={() => go(r)}
              >
                <span className={styles.optionIcon}><Icon name={r.icon} className={styles.glyph} /></span>
                <span className={styles.optionLabel}>{r.label}</span>
                <span className={styles.optionSection}>{r.section}</span>
                <Icon name="IconCaret" className={styles.enter} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No screen by that name.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
