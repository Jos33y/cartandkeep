import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { ABOUT } from '@data/about';
import { TRADER } from '@data/legal';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/about-page.module.css';

const SITE = 'https://cartandkeep.com';

/*
 * About, and the one page written for search as much as for a reader.
 *
 * The Section 4 line is "one SEO-optimised landing page live at launch". This
 * is it: it carries the terms somebody actually types when they are checking
 * whether a shop is real, and an AboutPage graph so the organisation has
 * something to attach to.
 */
function Block({ block }) {
  if (block.t === 'lede') return <p className={styles.lede}>{block.v}</p>;
  if (block.t === 'h') return <h2 className={styles.h2}>{block.v}</h2>;
  if (block.t === 'p') return <p className={styles.p}>{block.v}</p>;
  if (block.t === 'list') {
    return (
      <ul className={styles.list}>
        {block.v.map((line) => <li key={line}>{line}</li>)}
      </ul>
    );
  }
  if (block.t === 'confirm') {
    return (
      <p className={styles.confirm}>
        <span className={styles.confirmTag}>Needs her words</span>
        {block.v}
      </p>
    );
  }
  if (block.t === 'trader') {
    return (
      <address className={styles.trader}>
        <span>{TRADER.name}</span>
        <span>{TRADER.address}</span>
        <span>{TRADER.company}</span>
        <a href={`mailto:${TRADER.email}`}>{TRADER.email}</a>
      </address>
    );
  }
  return null;
}

export function AboutPage() {
  return (
    <section className={styles.page}>
      <Head
        title={ABOUT.title}
        description={ABOUT.description}
        path="/about"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: ABOUT.title,
          description: ABOUT.description,
          url: `${SITE}/about`,
          mainEntity: { '@id': `${SITE}/#organization` },
        }}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">About</span>
      </nav>

      <article className={styles.article}>
        <h1 className={`${styles.title} wide`}>A small UK shop with a very large cupboard</h1>
        {ABOUT.blocks.map((block, i) => <Block key={i} block={block} />)}
      </article>

      <div className={styles.after}>
        <Link className={styles.cta} to={STORE_ROUTES.SHOP}>
          See everything in the shop <ArrowRightIcon size={16} />
        </Link>
        <p className={styles.afterNote}>
          Or read <Link to="/legal/delivery">how delivery works</Link> and{' '}
          <Link to="/legal/returns">what happens if you change your mind</Link>.
        </p>
      </div>
    </section>
  );
}
