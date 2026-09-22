import { useEffect, useMemo, useState } from 'react';
import { useCoverage } from '@hooks/useCoverage';
import { useBoundaries } from '@hooks/useBoundaries';
import { loadTenant } from '@lib/tenant';
import { matchBoundary, breadcrumb } from '@utils/category';
import styles from '@styles/pages/portal/coverage-page.module.css';
import { PageSkeleton } from '@components/ui/portal/Skeleton';

const OUTCOME = {
  shortlisted: 'Reached the shortlist',
  not_holding: 'Selling, but not holding',
  no_headroom: 'No room after costs',
  killed_at_strip: 'Dropped on first look',
  swept: 'Searched',
};

const readable = (term) => term.replace(/-/g, ' ');

export function CoveragePage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows } = useCoverage(tenant?.id);
  const boundaries = useBoundaries(tenant?.id);

  const { groups, dropped } = useMemo(() => {
    const map = new Map();
    const early = [];

    for (const t of rows) {
      // A term dropped before scraping never resolved to a category, so it
      // cannot be grouped by one. Listing it separately is the honest place.
      if (!t.ebay_category_path) { early.push(t); continue; }

      const { label, agreed } = matchBoundary(t.ebay_category_path, boundaries);
      if (!map.has(label)) map.set(label, { label, agreed, path: t.ebay_category_path, terms: [] });
      map.get(label).terms.push(t);
    }

    return {
      groups: [...map.values()].sort((a, b) => {
        const s = (g) => g.terms.reduce((n, t) => n + t.stock_count, 0);
        return s(b) - s(a);
      }),
      dropped: early,
    };
  }, [rows, boundaries]);

  if (tenant === undefined || status === 'loading') {
    return <PageSkeleton />;
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.head}>
          <p className="micro">Coverage</p>
          <h1 className={styles.title}>Nothing searched yet</h1>
          <p className={styles.lead}>
            Every keyword we search will be listed here with what it found, including
            the ones that found nothing.
          </p>
        </header>
      </div>
    );
  }

  const searched = rows.length;
  const reached = groups.length;

  // Summing stock across keywords double counts anything two keywords both
  // found, so this counts keywords rather than products and cannot disagree
  // with the batch.
  const producing = rows.filter((t) => t.stock_count > 0).length;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="micro">Coverage</p>
        <h1 className={styles.title}>Where we have looked</h1>
        <p className={styles.lead}>
          Every keyword searched, what it found, and what it did not. A keyword that
          found nothing is worth as much on this page as one that found something,
          because it is a part of the market we can stop paying attention to.
        </p>

        <dl className={styles.summary}>
          <Sum label="Keywords searched" value={searched} />
          <Sum label="Categories reached" value={reached} />
          <Sum label="Keywords that found stock" value={producing} />
        </dl>
      </header>

      {groups.map((g) => (
        <section key={g.label} className={styles.group}>
          <header className={styles.groupHead}>
            <h2 className={styles.groupLabel}>{g.label}</h2>
            <p className={styles.groupPath}>{breadcrumb(g.path)}</p>
            {!g.agreed && <span className={styles.outside}>outside the agreed categories</span>}
          </header>

          <ul className={styles.terms}>
            {g.terms.map((t) => <Term key={t.id} term={t} />)}
          </ul>
        </section>
      ))}

      <p className={styles.footnote}>
        Counts are per keyword. Two keywords searching the same corner of a
        category will both find some of the same products, so these do not add up
        to the number in a batch.
      </p>

      {dropped.length > 0 && (
        <section className={styles.group}>
          <header className={styles.groupHead}>
            <h2 className={styles.groupLabel}>Checked and dropped</h2>
            <p className={styles.groupPath}>
              Read on the summary figures alone, before any products were pulled
            </p>
          </header>

          <ul className={styles.terms}>
            {dropped.map((t) => <Term key={t.id} term={t} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function Term({ term }) {
  const latest = term.windows.at(-1);

  return (
    <li className={styles.term}>
      <div className={styles.termMain}>
        <p className={styles.termName}>{readable(term.term)}</p>
        <p className={`${styles.outcome} ${styles[term.outcome] ?? ''}`}>
          {OUTCOME[term.outcome] ?? term.outcome}
        </p>
      </div>

      {latest ? (
        <dl className={styles.figures}>
          <Fig label="Sellers" value={latest.sellers} />
          <Fig label="Average price" value={latest.avg_price != null ? `£${Number(latest.avg_price).toFixed(2)}` : null} />
          <Fig label="Sell-through" value={latest.sell_through != null ? `${Number(latest.sell_through).toFixed(1)}%` : null} />
          <Fig label="Listable" value={term.listable_count} />
          <Fig label="Stock" value={term.stock_count} strong={term.stock_count > 0} />
        </dl>
      ) : (
        <p className={styles.note}>{term.outcome_note ?? 'No figures kept'}</p>
      )}
    </li>
  );
}

function Fig({ label, value, strong }) {
  if (value == null) return null;
  return (
    <div className={`${styles.fig} ${strong ? styles.figStrong : ''}`}>
      <dt className={styles.figLabel}>{label}</dt>
      <dd className={styles.figValue} data-num>{value}</dd>
    </div>
  );
}

function Sum({ label, value }) {
  return (
    <div className={styles.sum}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.sumValue}`}>{value}</dd>
    </div>
  );
}
