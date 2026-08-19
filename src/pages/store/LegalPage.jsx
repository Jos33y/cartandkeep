import { Link, useParams } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ChevronRightIcon } from '@components/ui/store/icons';
import { LEGAL_COLUMN, legalPage } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/legal-page.module.css';

const LABEL = {
  terms: 'Terms of sale',
  privacy: 'Privacy',
  returns: 'Returns',
  delivery: 'Delivery',
  cookies: 'Cookies',
  faq: 'Frequently asked',
};

/*
 * Every legal and help page, from one route.
 *
 * Six pages of prose as six components would be six places to forget a
 * heading level or a date. The content is data and this renders it.
 *
 * `confirm` blocks are loud on purpose. They are decisions only she can make
 * and they are on the live page rather than in a comment, because a
 * placeholder in a code comment is a placeholder nobody sees until a customer
 * does.
 */
function Block({ block }) {
  if (block.t === 'h') return <h2 className={styles.h2}>{block.v}</h2>;
  if (block.t === 'p') return <p className={styles.p}>{block.v}</p>;
  if (block.t === 'list') {
    return (
      <ul className={styles.list}>
        {block.v.map((line) => <li key={line}>{line}</li>)}
      </ul>
    );
  }
  if (block.t === 'note') return <p className={styles.note}>{block.v}</p>;
  if (block.t === 'confirm') {
    return (
      <p className={styles.confirm}>
        <span className={styles.confirmTag}>Needs confirming</span>
        {block.v}
      </p>
    );
  }
  return null;
}

export function LegalPage() {
  const { slug } = useParams();
  const page = legalPage(slug);

  if (!page) {
    return (
      <section className={styles.page}>
        <h1 className={`${styles.title} wide`}>That page does not exist</h1>
        <p className={styles.p}>It may have been renamed.</p>
        <Link className={styles.back} to={STORE_ROUTES.HOME}>Back to the shop</Link>
      </section>
    );
  }

  const reviewed = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(`${page.reviewed}T12:00:00Z`));

  return (
    <section className={styles.page}>
      <Head
        title={page.title}
        description={page.description}
        path={`/legal/${slug}`}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{page.title}</span>
      </nav>

      <div className={styles.body}>
        <article className={styles.article}>
          <h1 className={`${styles.title} wide`}>{page.title}</h1>
          <p className={styles.reviewed}>Last reviewed {reviewed}</p>
          {page.blocks.map((block, i) => <Block key={i} block={block} />)}
        </article>

        {/* Every legal page links to every other one. Somebody reading the
            returns page is one question away from wanting delivery, and
            sending them back to the footer to find it is the long way round. */}
        <aside className={styles.aside}>
          <h2 className={styles.asideHead}>The rest</h2>
          <ul className={styles.asideList}>
            {[...LEGAL_COLUMN, 'faq'].filter((s) => s !== slug).map((s) => (
              <li key={s}><Link to={`/legal/${s}`}>{LABEL[s] ?? s}</Link></li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
