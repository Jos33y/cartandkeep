import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { EmptyHero } from '@components/ui/store/EmptyHero';
import { PickUp } from '@components/ui/store/PickUp';
import { QuickView } from '@components/ui/store/QuickView';
import { SectionGlyph } from '@components/ui/store/SectionGlyph';
import { ArrowRightIcon, SearchIcon } from '@components/ui/store/icons';
import { useGroups } from '@hooks/useStoreCatalogue';
import { visibleGroups } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/not-found/not-found.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

/*
 * The catch-all for the whole shop.
 *
 * A 404 is somebody who wanted something and did not get it, which makes it
 * the one page where an apology is worth less than a way forward: a search,
 * her own sections as they stand today, and whatever this shopper had already
 * saved or looked at.
 *
 * The sections come from the database, the same list as the header's rail.
 * The old page carried a fixed list from the eBay categories, which stopped
 * existing when the shop's sections became hers.
 *
 * The path is shown because a mistyped or truncated URL is the commonest cause
 * and seeing it is often the whole fix.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [peek, setPeek] = useState(null);
  const { groups } = useGroups();
  const sections = useMemo(() => visibleGroups(groups), [groups]);

  function submit(event) {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`${STORE_ROUTES.SEARCH}?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className={styles.page}>
      {/* noindex, because a 404 that gets indexed is a 404 that keeps sending people here. */}
      <Head title="Page not found" description="That page does not exist." path={pathname} noindex />

      <EmptyHero
        Icon={SearchIcon}
        kicker="404, not found"
        title="That page is not here"
        cta={{ to: STORE_ROUTES.SHOP, label: 'Everything in the shop' }}
        extra={(
          <form className={styles.search} onSubmit={submit} role="search">
            <SearchIcon size={20} />
            <input
              className={styles.input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What were you after?"
              aria-label="Search the shop"
              enterKeyHint="search"
            />
            <button type="submit" className={styles.go}>Search</button>
          </form>
        )}
      >
        <p>
          Nothing lives at <code className={styles.path}>{pathname}</code>. It may have been a product
          that sold out, or a link that lost its tail on the way to you.
        </p>
      </EmptyHero>

      {sections.length > 0 && (
        <nav className={styles.sections} aria-labelledby="nf-sections">
          <h2 id="nf-sections" className={styles.sectionsHead}>Or start with a section</h2>
          <ul className={styles.sectionList}>
            {sections.map((s) => (
              <li key={s.slug}>
                <Link className={styles.section} to={categoryPath(s.slug)}>
                  <SectionGlyph name={s.name} size={32} className={styles.glyph} />
                  <span className={styles.sectionText}>
                    <span className={styles.sectionName}>{s.name}</span>
                    <span className={styles.sectionMeta}>
                      {s.count} {s.count === 1 ? 'product' : 'products'}
                      {Number.isFinite(s.priceMin) && <>, from <span data-price>{formatGbp(s.priceMin)}</span></>}
                    </span>
                  </span>
                  <ArrowRightIcon size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <PickUp onQuickView={setPeek} />
      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}
