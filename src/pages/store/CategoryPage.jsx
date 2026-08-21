import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CategoryHeader } from '@components/ui/store/CategoryHeader';
import { CategoryControls, SORTS } from '@components/ui/store/CategoryControls';
import { CategoryNav } from '@components/ui/store/CategoryNav';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { QuickView } from '@components/ui/store/QuickView';
import { CategoryNavSkeleton, ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { STORE_ROUTES } from '@utils/constants';
import { allGroups, findGroup, leafOf, topOf } from '@utils/categories';
import styles from '@styles/pages/store/category-page.module.css';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';

/*
 * One department.
 *
 * Groups are derived from whatever is in stock, so a slug can stop existing
 * between one visit and the next. That case gets a page saying so with a way
 * back, rather than an empty grid under a heading for something that is gone.
 */
/*
 * `everything` is the /shop route rather than a department.
 *
 * There was no all-products page at all: home is a hero and shelves, and
 * /c/:slug is one department, so "Keep shopping" and "Everything in the shop"
 * both landed on a landing page. This is the same page with the whole
 * catalogue in it, which means the sub-sections become departments and the
 * sort works exactly as it does everywhere else.
 */
export function CategoryPage({ everything = false }) {
  const { slug } = useParams();
  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows, error } = useStoreProducts(tenantId);

  const [leaf, setLeaf] = useState(null);
  const [sort, setSort] = useState('featured');
  const [peek, setPeek] = useState(null);

  // Departments and price bands, so /c/under-20 resolves the same way
  // /c/pet-supplies does.
  const names = useCategoryNames();
  /*
   * Not filtered by hidden.
   *
   * This resolves a route, and hidden means off the navigation rather than
   * deleted. Somebody holding a link to a department she has taken out of
   * the nav should still reach it rather than get a not found.
   */
  const groups = useMemo(() => allGroups(rows, { names }), [rows, names]);
  const group = useMemo(() => {
    if (everything) {
      return rows.length ? { name: 'Everything in the shop', slug: 'shop', items: rows } : null;
    }
    return findGroup(groups, slug);
  }, [everything, rows, groups, slug]);

  // Moving between departments must not carry a sub-section that does not
  // exist in the new one, which would show an empty grid for no reason.
  useEffect(() => { setLeaf(null); setSort('featured'); }, [slug, everything]);

  // Leaf categories with two or more behind them. A chip that narrows fifteen
  // products to one is a worse version of scrolling.
  const leaves = useMemo(() => {
    if (!group) return [];
    const tally = new Map();
    for (const p of group.items) {
      // Departments on /shop, leaf categories inside one. Seventy eight
      // products across forty leaves is a rail nobody reads.
      const name = everything ? topOf(p.category_path) : (leafOf(p.category_path) ?? p.category);
      if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    return [...tally.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [group, everything]);

  const visible = useMemo(() => {
    if (!group) return [];
    const key = (p) => (everything ? topOf(p.category_path) : (leafOf(p.category_path) ?? p.category));
    const filtered = leaf ? group.items.filter((p) => key(p) === leaf) : group.items;
    const fn = SORTS[sort]?.fn;
    return fn ? [...filtered].sort(fn) : filtered;
  }, [group, leaf, sort, everything]);

  if (status === 'loading') {
    return (
      <section className={styles.page}>
        <CategoryNavSkeleton />
        <ProductGridSkeleton count={8} />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className={styles.page}>
        <h1 className={`${styles.gone} wide`}>The shop did not load</h1>
        <p className={styles.goneNote}>
          Refresh the page, and if it keeps happening the problem is at our end
          rather than yours.
        </p>
        {error?.message && <p className={styles.goneDetail}>{error.message}</p>}
        <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
      </section>
    );
  }

  if (!group) {
    return (
      <section className={styles.page}>
        <h1 className={`${styles.gone} wide`}>Nothing in this category</h1>
        <p className={styles.goneNote}>It may have sold out or been renamed.</p>
        <Link className={styles.back} to={STORE_ROUTES.HOME}>See everything in the shop</Link>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <CategoryNav groups={groups} total={rows.length} />

      <CategoryHeader group={group} derived={Boolean(group.derived)} />

      <CategoryControls
        leaves={leaves}
        leaf={leaf}
        onLeaf={setLeaf}
        sort={sort}
        onSort={setSort}
        count={visible.length}
      />

      {visible.length > 0 ? (
        <ProductGrid products={visible} onQuickView={setPeek} />
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>Nothing in that sub-section right now.</p>
          <button type="button" className={styles.emptyAction} onClick={() => setLeaf(null)}>
            Show all of {group.name}
          </button>
        </div>
      )}

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}
