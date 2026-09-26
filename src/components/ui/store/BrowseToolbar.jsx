import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, CloseIcon, SearchIcon } from '@components/ui/store/icons';
import { formatGbp } from '@utils/formatGbp';
import { deliveryEstimate, formatDeliveryDay } from '@utils/delivery';
import styles from '@styles/ui/store/browse-toolbar.module.css';

export const SORT_LABELS = {
  featured: 'Featured',
  relevance: 'Best match',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
  newest: 'Newest',
  name: 'Name, A to Z',
};

// Each active filter as a chip that removes itself, in the order a shopper reads the rail.
function chipsFor(filters) {
  const chips = [];
  if (filters.q) chips.push({ key: 'q', label: `\u201c${filters.q}\u201d`, clear: { q: null } });
  if (filters.min !== null || filters.max !== null) {
    const label = filters.min !== null && filters.max !== null
      ? `${formatGbp(filters.min)} to ${formatGbp(filters.max)}`
      : filters.min !== null ? `From ${formatGbp(filters.min)}` : `Up to ${formatGbp(filters.max)}`;
    chips.push({ key: 'price', label, clear: { min: null, max: null } });
  }
  if (filters.dispatchMax !== null) chips.push({ key: 'by', label: `Arrives by ${formatDeliveryDay(deliveryEstimate(filters.dispatchMax).to, { withDate: false })}`, clear: { dispatchMax: null } });
  if (filters.inStock) chips.push({ key: 'stock', label: 'In stock', clear: { inStock: false } });
  for (const b of filters.brands) chips.push({ key: `b:${b}`, label: b, clear: { brands: filters.brands.filter((x) => x !== b) } });
  return chips;
}

// Stays under the header while the grid scrolls: search within, what is filtered, how many, and in what order.
export function BrowseToolbar({ filters, update, clear, total, of = null, density, onDensity, onOpenFilters, activeCount, searchLabel }) {
  const [q, setQ] = useState(filters.q);
  const typing = useRef(null);
  useEffect(() => { setQ(filters.q); }, [filters.q]);

  function onType(value) {
    setQ(value);
    clearTimeout(typing.current);
    // Typing replaces the history entry, so Back undoes the search rather than each letter.
    typing.current = setTimeout(() => update({ q: value }, { replace: true }), 280);
  }

  const chips = chipsFor(filters);
  const sorts = filters.q ? SORT_LABELS : Object.fromEntries(Object.entries(SORT_LABELS).filter(([k]) => k !== 'relevance'));

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <button type="button" className={styles.filtersBtn} onClick={onOpenFilters}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M8.5 15h3" /></svg>
          Filters
          {activeCount > 0 && <span className={styles.badge} data-num>{activeCount}</span>}
        </button>

        <label className={styles.search}>
          <SearchIcon size={16} />
          <input type="search" value={q} onChange={(e) => onType(e.target.value)} placeholder={searchLabel} aria-label={searchLabel} />
          {q && (
            <button type="button" className={styles.clearQ} onClick={() => onType('')} aria-label="Clear the search">
              <CloseIcon size={14} />
            </button>
          )}
        </label>

        {/* The head already gives the section's total; here it only appears once a filter or search has narrowed it. */}
        <p className={styles.count} aria-live="polite">
          {activeCount > 0 && total !== null && (
            <><span data-num>{total.toLocaleString('en-GB')}</span>{of !== null && total !== of ? <> of {of.toLocaleString('en-GB')}</> : null} {(of ?? total) === 1 ? 'product' : 'products'}</>
          )}
        </p>

        <label className={styles.sort}>
          <span className={styles.sortLabel}>Sort</span>
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            {Object.entries(sorts).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <ChevronDownIcon size={14} />
        </label>

        <div className={styles.density} role="radiogroup" aria-label="Card size">
          <button type="button" role="radio" aria-checked={density === 'roomy'} aria-label="Larger cards" onClick={() => onDensity('roomy')} data-on={density === 'roomy' || undefined}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>
          </button>
          <button type="button" role="radio" aria-checked={density === 'dense'} aria-label="Smaller cards" onClick={() => onDensity('dense')} data-on={density === 'dense' || undefined}>
            <svg viewBox="0 0 20 20" aria-hidden="true">{[3, 8.5, 14].flatMap((x) => [3, 8.5, 14].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="3.5" height="3.5" rx="1" />))}</svg>
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((c) => (
            <button key={c.key} type="button" className={styles.chip} onClick={() => update(c.clear)} aria-label={`Remove ${c.label}`}>
              {c.label}
              <CloseIcon size={12} />
            </button>
          ))}
          {chips.length > 1 && <button type="button" className={styles.clearAll} onClick={clear}>Clear all</button>}
        </div>
      )}
    </div>
  );
}
