import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { QuickView } from '@components/ui/store/QuickView';
import { SearchIcon } from '@components/ui/store/icons';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { trackSearch } from '@lib/analytics';
import { searchProducts, suggestions } from '@utils/search';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/search-page.module.css';

/*
 * Search, on its own route.
 *
 * The header's magnifying glass pointed at /search, which did not exist, so
 * every use of it landed on the not-found page. That is the same fault the old
 * header had with /c/beauty and I put it back three days later.
 *
 * The query lives in the URL rather than in state, so a result set can be
 * shared, bookmarked and reached with the back button. It also means the hero
 * on the shop front can hand off here instead of filtering in place.
 *
 * The matching itself is in @utils/search, so this page and the hero cannot
 * disagree about what a word means.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [draft, setDraft] = useState(query);
  const [peek, setPeek] = useState(null);

  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows } = useStoreProducts(tenantId);

  useEffect(() => { setDraft(query); }, [query]);

  /*
   * Recorded once the results are known, so a search that found nothing is
   * distinguishable from one that found forty. A term with zero results is the
   * single most actionable line in the whole analytics table: it is somebody
   * telling us what to stock.
   */
  useEffect(() => {
    if (status !== 'ready' || !query.trim()) return;
    trackSearch(query, results.length);
  }, [status, query, results.length]);

  const results = useMemo(() => searchProducts(rows, query), [rows, query]);
  const terms = useMemo(() => suggestions(rows), [rows]);

  function submit(event) {
    event.preventDefault();
    const next = draft.trim();
    // replace, not push. Typing three queries should not mean three presses of
    // the back button to leave the page.
    setParams(next ? { q: next } : {}, { replace: true });
  }

  return (
    <section className={styles.page}>
      <Head
        title={query ? `Search: ${query}` : 'Search'}
        description="Search everything in the shop."
        path="/search"
        noindex
      />

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Search</h1>

        <form className={styles.form} onSubmit={submit} role="search">
          <SearchIcon size={20} />
          <input
            className={styles.input}
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Try floor lamp, dog bed, saucepan"
            aria-label="Search the shop"
            enterKeyHint="search"
            autoFocus
          />
          <button type="submit" className={styles.go}>Search</button>
        </form>

        {!query && terms.length > 0 && (
          <div className={styles.terms}>
            <span className={styles.termsLabel}>Popular</span>
            {terms.map((t) => (
              <button key={t} type="button" className={styles.term} onClick={() => setParams({ q: t })}>
                {t}
              </button>
            ))}
          </div>
        )}
      </header>

      {status === 'loading' && <ProductGridSkeleton count={8} />}

      {status === 'ready' && query && (
        results.length > 0 ? (
          <>
            <p className={styles.count}>
              {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
            </p>
            <ProductGrid products={results} onQuickView={setPeek} />
          </>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyLead}>Nothing matches &ldquo;{query}&rdquo;.</p>
            <p className={styles.emptyBody}>
              Try a shorter word, or browse a department. If we should stock it,
              ask and we will look into it. That is how a fair amount of what is
              here got here.
            </p>
            {/*
              * The best moment on the shop to ask for a request.
              *
              * Somebody has searched for a thing, been told it is not here, and
              * already typed the words. `for` carries the query into the form,
              * so the box arrives filled in rather than asking them to type it
              * a second time.
              */}
            <Link
              className={styles.emptyCta}
              to={`${STORE_ROUTES.REQUEST}?for=${encodeURIComponent(query)}&from=${encodeURIComponent('search')}`}
            >
              Ask us to stock it
            </Link>
          </div>
        )
      )}

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}
