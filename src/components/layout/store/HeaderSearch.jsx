import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRightIcon, CloseIcon, SearchIcon } from '@components/ui/store/icons';
import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { imageAt, leafOf } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { useBrowse } from '@hooks/useCatalogue';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/layout/store/header-search.module.css';

const MAX_RESULTS = 6;
const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

function Marked({ text, terms }) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className={styles.mark}>{part}</mark> : part));
}

// Real product types from her catalogue, shown one at a time in the empty field.
function useExamples(rows) {
  return useMemo(() => {
    const seen = new Set();
    for (const p of rows) {
      const leaf = leafOf(p.category_path);
      if (leaf && !/[/&]/.test(leaf) && leaf.length < 22) seen.add(leaf.toLowerCase());
      if (seen.size >= 6) break;
    }
    return [...seen];
  }, [rows]);
}

function Rotating({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (words.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);
  if (!words.length) return <span>Search the shop</span>;
  return (
    <span>
      Search for <span key={i} className={styles.word}>{words[i]}</span>
    </span>
  );
}

export function HeaderSearch({ sections, sheet = false, onClose, inputRef: externalRef }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  // On a section page the search looks inside it, shown as a chip that removes itself; everywhere else it searches the whole shop.
  const onSection = pathname.startsWith('/c/') ? sections.find((s) => pathname === `/c/${s.slug}`) ?? null : null;
  const [scoped, setScoped] = useState(true);
  const scope = scoped ? onSection : null;
  const resultsPath = (q) => `${scope ? categoryPath(scope.slug) : STORE_ROUTES.SHOP}?q=${encodeURIComponent(q)}`;
  const listId = useId();
  const ownRef = useRef(null);
  const inputRef = externalRef ?? ownRef;
  const boxRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(sheet);
  const [active, setActive] = useState(-1);
  // A small sample of the shop for the rotating examples; the search itself asks the database, typo-tolerant, a moment after typing stops.
  const sample = useBrowse({}, { limit: 24 });
  const examples = useExamples(sample.items);
  const [asked, setAsked] = useState('');
  useEffect(() => { const t = setTimeout(() => setAsked(query.trim()), 180); return () => clearTimeout(t); }, [query]);

  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter((t) => t.length > 1), [query]);
  const found = useBrowse({ q: asked, sort: 'relevance', keys: scope?.keys ?? null }, { limit: MAX_RESULTS, enabled: asked.length > 1 });

  const results = useMemo(() => {
    if (!terms.length) return { sections: [], products: [] };
    const matchedSections = sections.filter((s) => terms.every((t) => s.name.toLowerCase().includes(t))).slice(0, 3);
    return { sections: matchedSections, products: found.items, total: found.total ?? 0 };
  }, [terms, sections, found.items, found.total]);

  // Every row the keyboard can land on, in the order it is drawn.
  const options = useMemo(() => {
    if (!terms.length) return sections.slice(0, 8).map((s) => ({ key: `s-${s.slug}`, to: categoryPath(s.slug) }));
    return [
      ...results.sections.map((s) => ({ key: `s-${s.slug}`, to: categoryPath(s.slug) })),
      ...results.products.map((p) => ({ key: `p-${p.id}`, to: STORE_ROUTES.PRODUCT.replace(':slug', p.slug) })),
      { key: 'all', to: results.products.length ? resultsPath(query.trim()) : `${STORE_ROUTES.REQUEST}?for=${encodeURIComponent(query.trim())}&from=header%20search` },
    ];
  }, [terms, results, sections, query]);

  const idOf = (key) => `${listId}-${key}`;

  useEffect(() => { setActive(-1); }, [query]);

  useEffect(() => { if (sheet) inputRef.current?.focus(); }, [sheet, inputRef]);

  // A new page closes the panel and clears it; the search has done its job.
  // On a browse page the box shows the search already applied, so there is one place to change it.
  useEffect(() => {
    setOpen(sheet);
    setScoped(true);
    const onBrowse = pathname === STORE_ROUTES.SHOP || pathname.startsWith('/c/');
    setQuery(onBrowse ? new URLSearchParams(search).get('q') ?? '' : '');
  }, [pathname, search, sheet]);

  useEffect(() => {
    if (sheet) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [sheet]);

  function go(to) {
    setOpen(false);
    inputRef.current?.blur();
    onClose?.();
    navigate(to);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); onClose?.(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && options[active]) go(options[active].to);
      else if (query.trim()) go(resultsPath(query.trim()));
    }
  }

  const activeKey = active >= 0 ? options[active]?.key : null;
  const rowProps = (key, to) => ({
    id: idOf(key),
    role: 'option',
    'aria-selected': activeKey === key,
    'data-active': activeKey === key || undefined,
    onPointerDown: (e) => e.preventDefault(),
    onClick: () => go(to),
  });

  const showPanel = open && (sheet || sections.length > 0 || terms.length > 0);

  return (
    <div
      ref={boxRef}
      className={styles.box}
      data-sheet={sheet || undefined}
      data-open={showPanel || undefined}
      // Keyboard focus leaving closes the panel too; it only closed for a click outside, so tabbing on left it covering the page.
      onBlur={(e) => { if (!sheet && !e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
    >
      <div className={styles.field}>
        <SearchIcon size={18} />
        {scope && (
          <button type="button" className={styles.scope} onClick={() => { setScoped(false); inputRef.current?.focus(); }} aria-label={`Searching in ${scope.name}. Search the whole shop instead`}>
            in {scope.name}
            <CloseIcon size={12} />
          </button>
        )}
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          aria-label="Search the shop"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={activeKey ? idOf(activeKey) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {!query && <span className={styles.ghost} aria-hidden="true"><Rotating words={examples} /></span>}
        {query ? (
          <button type="button" className={styles.clear} aria-label="Clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
            <CloseIcon size={16} />
          </button>
        ) : !sheet && (
          <kbd className={styles.kbd} aria-hidden="true">{isMac ? '\u2318' : 'Ctrl'} K</kbd>
        )}
      </div>

      {showPanel && (
        <div className={styles.panel} id={listId} role="listbox" aria-label="Search suggestions">
          {!terms.length ? (
            <>
              <p className={styles.head}>Jump to a shelf</p>
              <div className={styles.shelves}>
                {sections.slice(0, 8).map((s) => (
                  <div key={s.slug} className={styles.shelf} {...rowProps(`s-${s.slug}`, categoryPath(s.slug))}>
                    <SectionGlyph name={s.name} size={28} className={styles.glyph} />
                    <span className={styles.shelfName}>{s.name}</span>
                    <span className={styles.count}>{s.count ?? s.items?.length ?? 0}</span>
                  </div>
                ))}
                {!sections.length && <p className={styles.hint}>Type what you are looking for.</p>}
              </div>
            </>
          ) : (
            <>
              {results.sections.map((s) => (
                <div key={s.slug} className={styles.row} {...rowProps(`s-${s.slug}`, categoryPath(s.slug))}>
                  <span className={styles.thumb}><SectionGlyph name={s.name} size={24} /></span>
                  <span className={styles.rowText}><span className={styles.rowTitle}><Marked text={s.name} terms={terms} /></span><span className={styles.rowMeta}>Shelf, {s.count ?? s.items?.length ?? 0} products</span></span>
                </div>
              ))}
              {results.products.map((p) => (
                <div key={p.id} className={styles.row} {...rowProps(`p-${p.id}`, STORE_ROUTES.PRODUCT.replace(':slug', p.slug))}>
                  <span className={styles.thumb}>{p.image_url ? <img src={imageAt(p.image_url, 140)} alt="" loading="lazy" /> : null}</span>
                  <span className={styles.rowText}><span className={styles.rowTitle}><Marked text={p.title} terms={terms} /></span></span>
                  <span className={styles.price} data-price>{formatGbp(p.priceFrom ?? p.price)}</span>
                </div>
              ))}
              <div className={styles.all} {...rowProps('all', options.at(-1)?.to)}>
                {results.products.length
                  ? <>See all {results.total} {results.total === 1 ? 'result' : 'results'} for &ldquo;{query.trim()}&rdquo;</>
                  : <>Nothing yet. Ask us to stock &ldquo;{query.trim()}&rdquo;</>}
                <ArrowRightIcon size={16} />
              </div>
            </>
          )}
          {sheet && (
            <p className={styles.foot}>
              <Link to={STORE_ROUTES.SHOP} onClick={() => onClose?.()}>Browse everything in the shop</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
