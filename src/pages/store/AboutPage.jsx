import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { ABOUT } from '@data/about';
import { gbp, legalTerms, legalTrader, traderIdentity } from '@data/legal';
import { siteUrl } from '@lib/storeConfig';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/about-page.module.css';

const SHOW_NOTES = import.meta.env.DEV;

// Each refusal is struck through as it comes into view: the page's one idea, and a literal reading of the heading.
function Refusals({ items }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <ul ref={ref} className={styles.refusals} data-seen={seen || undefined}>
      {items.map((item, i) => (
        <li key={item.no} className={styles.refusal} style={{ '--i': i }}>
          <p className={styles.no}><s>{item.no}</s></p>
          <p className={styles.why}>{item.why}</p>
        </li>
      ))}
    </ul>
  );
}

function Block({ block }) {
  if (block.t === 'lede') return <p className={styles.lede}>{block.v}</p>;
  if (block.t === 'h') return <h2 className={styles.h2}>{block.v}</h2>;
  if (block.t === 'p') return <p className={styles.p}>{block.v}</p>;
  if (block.t === 'refusals') return <Refusals items={block.v} />;
  if (block.t === 'her') {
    if (ABOUT.herWords) {
      return (
        <>
          <h2 className={styles.h2}>Who runs it</h2>
          <p className={styles.p}>{ABOUT.herWords}</p>
        </>
      );
    }
    return SHOW_NOTES ? (
      <p className={styles.confirm}>
        <span className={styles.confirmTag}>Needs her words</span>
        Two or three sentences: who she is, where she is, and why she started this. This section stays off the live page until they exist.
      </p>
    ) : null;
  }
  return null;
}

function Facts() {
  const T = legalTerms();
  const tr = legalTrader();
  const who = traderIdentity(tr) ?? tr.tradingAs;
  const rows = [
    who && ['Run by', who],
    tr.address && ['Based at', tr.address],
    ['Delivery', `${gbp(T.postage)}, free from ${gbp(T.freeDeliveryOver)}`],
    ['Returns', `${T.returnDays} days${T.postagePaidBy === 'customer' ? '' : ', return postage paid'}`],
    ['Paying', 'By card through Stripe, no account'],
  ].filter(Boolean);

  return (
    <aside className={styles.facts} aria-label="The shop at a glance">
      <p className={styles.factsHead}>At a glance</p>
      <dl className={styles.factsList}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.factRow}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <a className={styles.factsMail} href={`mailto:${tr.email}`}>{tr.email}</a>
      <Link className={styles.factsLink} to="/legal/terms">Terms of sale <ArrowRightIcon size={14} /></Link>
    </aside>
  );
}

export function AboutPage() {
  const site = siteUrl();
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
          url: `${site}/about`,
          mainEntity: { '@id': `${site}/#organization` },
        }}
      />

      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link to={STORE_ROUTES.HOME}>Shop</Link>
        <ChevronRightIcon size={16} />
        <span aria-current="page">About</span>
      </nav>

      <div className={styles.layout}>
        <article className={styles.article}>
          <h1 className={`${styles.title} wide`}>A general store, not a niche.</h1>
          {ABOUT.blocks.map((block, i) => <Block key={i} block={block} />)}

          <div className={styles.after}>
            <Link className={styles.cta} to={STORE_ROUTES.SHOP}>
              See everything in the shop <ArrowRightIcon size={16} />
            </Link>
            <p className={styles.afterNote}>
              Or read <Link to="/legal/delivery">how delivery works</Link> and{' '}
              <Link to="/legal/returns">what happens if you change your mind</Link>.
            </p>
          </div>
        </article>

        <Facts />
      </div>
    </section>
  );
}
