import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { CategoryHeader } from '@components/ui/store/CategoryHeader';
import { BrowseToolbar } from '@components/ui/store/BrowseToolbar';
import { FilterPanel } from '@components/ui/store/FilterPanel';
import { LoadTrack } from '@components/ui/store/LoadTrack';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { QuickView } from '@components/ui/store/QuickView';
import { ProductCardSkeleton } from '@components/ui/store/Skeleton';
import { CloseIcon } from '@components/ui/store/icons';
import { useBrowse, useFacets, useGroups, prefetchProduct } from '@hooks/useCatalogue';
import { useBrowseParams } from '@hooks/useBrowseParams';
import { useTenant } from '@hooks/useTenant';
import { findGroup } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { deliveryEstimate, formatDeliveryDay } from '@utils/delivery';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/category-page.module.css';

// Old price-band pages are filters now.
const BANDS = { 'under-20': 20 };
const DENSITY_KEY = 'ck.density';

function useDensity() {
  const [density, setDensity] = useState(() => {
    try { return window.localStorage.getItem(DENSITY_KEY) === 'dense' ? 'dense' : 'roomy'; } catch { return 'roomy'; }
  });
  const choose = (d) => { setDensity(d); try { window.localStorage.setItem(DENSITY_KEY, d); } catch { /* private mode */ } };
  return [density, choose];
}

// The phone and tablet filters: a sheet from the bottom, with the result count on its one button.
function FilterSheet({ open, onClose, total, onClear, children }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { html.style.overflow = before; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Filters" ref={panel} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHead}>
          <span className={styles.grip} aria-hidden="true" />
          <h2 className={styles.sheetTitle}>Filters</h2>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close filters"><CloseIcon size={18} /></button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        <div className={styles.sheetFoot}>
          <button type="button" className={styles.sheetClear} onClick={onClear}>Clear all</button>
          <button type="button" className={styles.sheetShow} onClick={onClose}>
            {total === null ? 'Show products' : `Show ${total.toLocaleString('en-GB')} ${total === 1 ? 'product' : 'products'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// A section, or the whole shop, a page of cards at a time. Everything about the view lives in the address.
export function CategoryPage({ everything = false }) {
  const { slug } = useParams();
  const tenant = useTenant();
  const tenantId = tenant?.id ?? null;
  const { status: groupsStatus, groups, total: shopTotal } = useGroups();
  const { filters, update, clear, active } = useBrowseParams();
  const [density, setDensity] = useDensity();
  const [sheet, setSheet] = useState(false);
  const [peek, setPeek] = useState(null);

  const group = useMemo(() => (everything ? null : findGroup(groups, slug)), [everything, groups, slug]);
  const scoped = useMemo(() => ({ ...filters, keys: group?.keys ?? null }), [filters, group]);
  const ready = everything || Boolean(group);
  const browse = useBrowse(ready ? scoped : { ...scoped, keys: ['\u0000none'] });
  const { facets } = useFacets(ready ? scoped : { ...scoped, keys: ['\u0000none'] });

  const activeCount = (filters.q ? 1 : 0) + (filters.min !== null || filters.max !== null ? 1 : 0)
    + (filters.dispatchMax !== null ? 1 : 0) + (filters.inStock ? 1 : 0) + filters.brands.length;

  if (!everything && BANDS[slug]) {
    return <Navigate to={`${STORE_ROUTES.SHOP}?max=${BANDS[slug]}`} replace />;
  }

  if (!everything && groupsStatus === 'ready' && !group) {
    return (
      <section className={styles.page}>
        <div className={styles.gone}>
          <h1 className="wide">Nothing on this shelf</h1>
          <p>It may have been renamed or emptied.</p>
          <Link className={styles.back} to={STORE_ROUTES.SHOP}>See everything in the shop</Link>
        </div>
      </section>
    );
  }

  // An old address, such as the eBay name before she renamed it, moves to the group's own, keeping the filters.
  if (group && slug !== group.slug) {
    return <Navigate to={`${STORE_ROUTES.CATEGORY.replace(':slug', group.slug)}${window.location.search}`} replace />;
  }

  const name = everything ? 'Everything in the shop' : group?.name ?? '';
  const count = everything ? (groupsStatus === 'ready' ? shopTotal : null) : group?.count ?? null;
  const priceMin = everything ? Math.min(...groups.map((g) => g.priceMin)) : group?.priceMin;
  const priceMax = everything ? Math.max(...groups.map((g) => g.priceMax)) : group?.priceMax;
  const path = everything ? STORE_ROUTES.SHOP : STORE_ROUTES.CATEGORY.replace(':slug', group?.slug ?? '');
  // Sections are the header rail's job; the filter rail is only filters.
  const panel = <FilterPanel facets={facets} filters={filters} update={update} />;
  const loading = browse.status === 'loading' && browse.items.length === 0;

  // The arrival day most of these share, said once in the head; a card only states its own when it differs.
  const arrivalOf = (p) => deliveryEstimate(p.dispatch_days).to;
  const common = (() => {
    const tally = new Map();
    for (const p of browse.items) if (p.buyable !== false) tally.set(arrivalOf(p), (tally.get(arrivalOf(p)) ?? 0) + 1);
    let best = null;
    for (const [day, n] of tally) if (!best || n > best.n) best = { day, n };
    return best && best.n >= Math.ceil(browse.items.length / 2) ? { ...best, all: best.n === browse.items.length } : null;
  })();
  const arrives = common ? `${common.all ? 'Arrives' : 'Most arrive'} by ${formatDeliveryDay(common.day)}` : null;

  return (
    <section className={styles.page}>
      {name && (
        <Head
          title={name}
          description={count ? `${count.toLocaleString('en-GB')} ${count === 1 ? 'product' : 'products'} from ${formatGbp(priceMin)}, delivered from the UK. No account needed to buy.` : undefined}
          path={path}
          noindex={active}
        />
      )}

      {/* No section tabs here: the header's shelf rail already carries them on every page, and a second row cost the short laptop its first row of products. */}
      <CategoryHeader name={name} count={count} priceMin={priceMin} priceMax={priceMax} arrives={arrives} />

      <div className={styles.layout}>
        <aside className={styles.rail} aria-label="Filters">{panel}</aside>

        <div className={styles.main}>
          <BrowseToolbar
            filters={filters}
            update={update}
            clear={clear}
            total={browse.total}
            of={count}
            density={density}
            onDensity={setDensity}
            onOpenFilters={() => setSheet(true)}
            activeCount={activeCount}
            searchLabel={everything ? 'Search the shop' : `Search ${name}`}
          />

          <div className={styles.results} data-refreshing={browse.status === 'refreshing' || undefined}>
            {loading && (
              <ul className={styles.skeletons} data-density={density} aria-label="Loading products">
                {Array.from({ length: 8 }, (_, i) => <li key={i}><ProductCardSkeleton /></li>)}
              </ul>
            )}

            {!loading && browse.status === 'error' && browse.items.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyLead}>The products did not load.</p>
                <p className={styles.emptyNote}>Refresh the page. If it keeps happening, the problem is at our end.</p>
              </div>
            )}

            {!loading && browse.total === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyLead}>Nothing matches all of that.</p>
                <p className={styles.emptyNote}>Take one filter off to widen it.</p>
                <div className={styles.emptyActions}>
                  {filters.q && <button type="button" onClick={() => update({ q: null })}>Remove “{filters.q}”</button>}
                  {filters.brands.length > 0 && <button type="button" onClick={() => update({ brands: [] })}>Any brand</button>}
                  {(filters.min !== null || filters.max !== null) && <button type="button" onClick={() => update({ min: null, max: null })}>Any price</button>}
                  {filters.inStock && <button type="button" onClick={() => update({ inStock: false })}>Include out of stock</button>}
                  {filters.dispatchMax !== null && <button type="button" onClick={() => update({ dispatchMax: null })}>Any delivery day</button>}
                </div>
              </div>
            )}

            {browse.items.length > 0 && (
              <ProductGrid
                products={browse.items}
                density={density}
                onQuickView={setPeek}
                shelfName={everything ? null : name}
                onPrefetch={(s) => prefetchProduct(tenantId, s)}
                commonArrival={common?.day ?? null}
              />
            )}
          </div>

          {browse.items.length > 0 && (
            <LoadTrack shown={browse.items.length} total={browse.total} pageSize={browse.pageSize} busy={browse.status === 'more'} onMore={browse.loadMore} />
          )}
        </div>
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} total={facets?.total ?? browse.total} onClear={clear}>
        {panel}
      </FilterSheet>

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}
