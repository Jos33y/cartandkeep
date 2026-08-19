import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, SearchIcon } from '@components/ui/store/icons';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/not-found/not-found.module.css';

/*
 * The catch-all for the whole shop, and it was a ten line stub.
 *
 * A 404 is somebody who wanted something and did not get it, which makes it
 * the one page where an apology is worth less than a way forward. It says what
 * happened in one line and then offers the three things that actually recover
 * the visit: a search, the departments, and everything.
 *
 * The path is shown because a mistyped or truncated URL is the commonest cause
 * and seeing it is often the whole fix.
 */
const DEPARTMENTS = [
  ['Home & DIY', '/c/home-furniture-and-diy'],
  ['Health & beauty', '/c/health-and-beauty'],
  ['Pet supplies', '/c/pet-supplies'],
  ['Sporting goods', '/c/sporting-goods'],
  ['Vehicle parts', '/c/vehicle-parts-and-accessories'],
  ['Under \u00a320', '/c/under-20'],
];

export function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function submit(event) {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`${STORE_ROUTES.SEARCH}?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className={styles.page}>
      {/* noindex, because a 404 that gets indexed is a 404 that keeps sending
          people here. */}
      <Head title="Page not found" description="That page does not exist." path={pathname} noindex />

      <p className={styles.code}>404</p>
      <h1 className={`${styles.title} wide`}>That page is not here</h1>
      <p className={styles.body}>
        Nothing lives at <code className={styles.path}>{pathname}</code>. It may
        have been a product that sold out, or a link that lost its tail on the
        way to you.
      </p>

      <form className={styles.search} onSubmit={submit} role="search">
        <SearchIcon size={20} />
        <input
          className={styles.input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for what you were after"
          aria-label="Search the shop"
          enterKeyHint="search"
        />
        <button type="submit" className={styles.go}>Search</button>
      </form>

      <nav className={styles.departments} aria-label="Departments">
        <h2 className={styles.departmentsHead}>Or start somewhere</h2>
        <ul>
          {DEPARTMENTS.map(([label, to]) => (
            <li key={to}><Link to={to}>{label}</Link></li>
          ))}
        </ul>
      </nav>

      <Link className={styles.cta} to={STORE_ROUTES.SHOP}>
        Everything in the shop <ArrowRightIcon size={16} />
      </Link>
    </section>
  );
}
