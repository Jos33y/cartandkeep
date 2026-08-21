import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { StoreHero } from '@components/ui/store/StoreHero';
import { TrustStrip } from '@components/ui/store/TrustStrip';
import { CategoryTiles } from '@components/ui/store/CategoryTiles';
import { Shelf } from '@components/ui/store/Shelf';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { OfflineNotice } from '@components/ui/store/OfflineNotice';
import { PromiseBand } from '@components/ui/store/PromiseBand';
import { QuickView } from '@components/ui/store/QuickView';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { groupCategories, leafOf, priceGroups, visibleGroups } from '@utils/categories';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/home-page.module.css';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';

/*
 * The shop front. There is no separate catalogue route, so home is the
 * catalogue: hero, trust, departments, then a shelf per department.
 *
 * No <main> here. StoreShell already provides one and a second would nest.
 */

// Substring across the title and the leaf category, every word having to match
// somewhere. Enough for seventy eight products, and honest about what it is:
// when the catalogue outgrows it, this is replaced by a real index rather than
// stretched.
function match(product, terms) {
  const hay = `${product.title} ${leafOf(product.category_path) ?? ''} ${product.category ?? ''}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export function HomePage() {
  const tenant = useTenant();
  // undefined while it resolves, null when it resolved to nothing. The hook
  // treats those as two different things, and collapsing them is what made
  // this page load forever instead of saying what went wrong.
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows, error } = useStoreProducts(tenantId);
  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState(null);

  // Her names, so the departments on this page and the ones in the header
  // read the same. Empty until they load, which renders exactly what the
  // shop rendered before this existed.
  const names = useCategoryNames();
  const groups = useMemo(() => visibleGroups(groupCategories(rows, { names })), [rows, names]);


  // Price bands are real routes, defined once in @utils/categories so the
  // category page resolves the same slugs this shelf links to.
  const bands = useMemo(() => priceGroups(rows), [rows]);

  // Real leaf categories from the catalogue, most common first. Nothing here
  // can return an empty result, because every one of them came out of a
  // product that exists.
  const suggestions = useMemo(() => {
    const tally = new Map();
    for (const p of rows) {
      const leaf = leafOf(p.category_path);
      if (leaf) tally.set(leaf, (tally.get(leaf) ?? 0) + 1);
    }
    return [...tally.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([leaf]) => leaf);
  }, [rows]);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(
    () => (terms.length ? rows.filter((p) => match(p, terms)) : []),
    [rows, query],
  );

  // Four, not three. The window is a 2x2 and three of anything reads as a
  // curation, which is the opposite of what a general store is selling.
  const featured = useMemo(
    () => rows.filter((p) => p.image_url).slice(0, 4),
    [rows],
  );

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}><ProductGridSkeleton /></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          {/* Offline is by far the likeliest reason a catalogue query fails on
              an installed app, and telling somebody on a train that the
              problem is at our end is both wrong and alarming. */}
          <OfflineNotice>
            <h1 className={`${styles.plainTitle} wide`}>The shop did not load</h1>
            <p className={styles.notice}>
              Refresh the page, and if it keeps happening the problem is at our
              end rather than yours.
            </p>
            {error?.message && <p className={styles.noticeDetail}>{error.message}</p>}
          </OfflineNotice>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={`${styles.plainTitle} wide`}>Nothing is on sale yet</h1>
          <p className={styles.notice}>Products appear here as soon as they go live.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Not inside the wrapper. The hero carries its own full bleed band and
          its own max width, which is what gives the top of the shop a ground
          the rest of the page does not have. */}
      <StoreHero
        query={query}
        onQuery={setQuery}
        suggestions={suggestions}
        featured={featured}
        count={rows.length}
      />

      <TrustStrip />

      {/* Searching replaces the shelves rather than sitting above them. Two
          sets of products on one screen, one filtered and one not, is the
          fastest way to make someone think the search is broken. */}
      {terms.length > 0 ? (
        <div className={styles.wrap}>
          <div className={styles.resultsHead}>
            <h2 className={`${styles.heading} wide`}>
              {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{query.trim()}&rdquo;
            </h2>
            <button type="button" className={styles.back} onClick={() => setQuery('')}>
              Show everything
            </button>
          </div>

          {results.length > 0 ? (
            <ProductGrid products={results} onQuickView={setPeek} />
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyLead}>Nothing matches that yet.</p>
              <p className={styles.emptyBody}>
                Try a shorter word, or browse a department below.
              </p>
              {/* The query goes with them, so the request form arrives with
                  the box filled in rather than asking for the same words a
                  second time. */}
              <Link
                className={styles.emptyCta}
                to={`${STORE_ROUTES.REQUEST}?for=${encodeURIComponent(query.trim())}&from=${encodeURIComponent('home search')}`}
              >
                Ask us to stock it
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={styles.wrap}>
            <CategoryTiles groups={groups} />
          </div>


          {bands.map((band) => (
            <div className={styles.wrap} key={band.slug}>
              <div className={styles.shelvesHead}>
                <h2 className={`${styles.heading} wide`}>Everything {band.name.toLowerCase()}</h2>
              </div>
              <Shelf group={band} onQuickView={setPeek} />
            </div>
          ))}

          <div className={styles.wrap}>
            <div className={styles.shelvesHead}>
              <h2 className={`${styles.heading} wide`}>Every department, one scroll</h2>
            </div>
            <div className={styles.shelves}>
              {groups.map((group) => (
                <Shelf key={group.slug} group={group} onQuickView={setPeek} />
              ))}
            </div>
          </div>

          <PromiseBand />
        </>
      )}

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
