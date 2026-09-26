import { useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { PriceRange } from '@components/ui/store/PriceRange';
import { deliveryEstimate, formatDeliveryDay } from '@utils/delivery';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/filter-panel.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);
const TOP_BRANDS = 8;

function Group({ title, children, count = null }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.title}>
        {title}
        {count !== null && <span className={styles.titleCount}>{count}</span>}
      </h3>
      {children}
    </section>
  );
}

// "Arrives by" from real dispatch times: each option counts every product that would arrive by that day, so the numbers only ever grow down the list.
function arrivalOptions(dispatch) {
  const rows = [...(dispatch ?? [])].sort((a, b) => a.days - b.days);
  const byDay = new Map();
  let running = 0;
  for (const { days, count } of rows) {
    running += count;
    const to = deliveryEstimate(days).to;
    byDay.set(to, { days, count: running, to });
  }
  return [...byDay.values()].slice(0, 4);
}

// The filters, shared by the desktop rail and the phone sheet. Every count comes from the database and excludes its own filter.
export function FilterPanel({ facets, filters, update, groups = null, everything = false }) {
  const [brandQuery, setBrandQuery] = useState('');
  const [allBrands, setAllBrands] = useState(false);
  const arrivals = useMemo(() => arrivalOptions(facets?.dispatch), [facets?.dispatch]);

  const brands = facets?.brands ?? [];
  const chosen = new Set(filters.brands);
  const matching = brandQuery
    ? brands.filter((b) => b.brand.toLowerCase().includes(brandQuery.toLowerCase()))
    : brands;
  // Chosen brands stay in view even when they fall outside the top eight.
  const shownBrands = allBrands || brandQuery
    ? matching
    : [...brands.filter((b) => chosen.has(b.brand)), ...brands.filter((b) => !chosen.has(b.brand))].slice(0, Math.max(TOP_BRANDS, chosen.size));

  const toggleBrand = (brand) => update({ brands: chosen.has(brand) ? filters.brands.filter((b) => b !== brand) : [...filters.brands, brand] });
  const countFor = (group) => (facets?.groups ?? []).filter((g) => group.keys.includes(g.key)).reduce((n, g) => n + g.count, 0);

  return (
    <div className={styles.panel}>
      {everything && groups?.length > 1 && (
        <Group title="Sections">
          <ul className={styles.links}>
            {groups.map((g) => {
              const n = countFor(g);
              return (
                <li key={g.slug}>
                  <NavLink className={styles.link} to={categoryPath(g.slug)} data-empty={n === 0 || undefined}>
                    <span>{g.name}</span>
                    <span className={styles.n} data-num>{n.toLocaleString('en-GB')}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      <Group title="Price">
        <PriceRange price={facets?.price} min={filters.min} max={filters.max} onCommit={(p) => update(p, { replace: true })} />
      </Group>

      {arrivals.length > 0 && (
        <Group title="Arrives by">
          <div className={styles.options} role="radiogroup" aria-label="Arrives by">
            <label className={styles.option}>
              <input type="radio" name="arrives" checked={filters.dispatchMax === null} onChange={() => update({ dispatchMax: null })} />
              <span className={styles.optionLabel}>Any day</span>
            </label>
            {arrivals.map((a) => (
              <label key={a.to} className={styles.option} data-empty={a.count === 0 || undefined}>
                <input type="radio" name="arrives" checked={filters.dispatchMax === a.days} onChange={() => update({ dispatchMax: a.days })} />
                <span className={styles.optionLabel}>{formatDeliveryDay(a.to)}</span>
                <span className={styles.n} data-num>{a.count.toLocaleString('en-GB')}</span>
              </label>
            ))}
          </div>
          <p className={styles.note}>Estimated from our usual dispatch times.</p>
        </Group>
      )}

      <Group title="Availability">
        <label className={styles.switchRow}>
          <span className={styles.optionLabel}>In stock only</span>
          <span className={styles.n} data-num>{(facets?.in_stock ?? 0).toLocaleString('en-GB')}</span>
          <input className={styles.switch} type="checkbox" role="switch" checked={filters.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
        </label>
      </Group>

      {brands.length > 0 && (
        <Group title="Brand" count={filters.brands.length ? `${filters.brands.length} chosen` : null}>
          {brands.length > TOP_BRANDS && (
            <input
              className={styles.search}
              type="search"
              placeholder={`Search ${brands.length} brands`}
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              aria-label="Search brands"
            />
          )}
          <div className={styles.options}>
            {shownBrands.map((b) => (
              <label key={b.brand} className={styles.option}>
                <input type="checkbox" checked={chosen.has(b.brand)} onChange={() => toggleBrand(b.brand)} />
                <span className={styles.optionLabel}>{b.brand}</span>
                <span className={styles.n} data-num>{b.count.toLocaleString('en-GB')}</span>
              </label>
            ))}
            {brandQuery && matching.length === 0 && <p className={styles.note}>No brand matches that.</p>}
          </div>
          {!brandQuery && brands.length > TOP_BRANDS && (
            <button type="button" className={styles.more} onClick={() => setAllBrands((v) => !v)}>
              {allBrands ? 'Show fewer' : `Show all ${brands.length}`}
            </button>
          )}
        </Group>
      )}
    </div>
  );
}
