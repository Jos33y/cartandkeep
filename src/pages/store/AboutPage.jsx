import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { Prose } from '@components/ui/store/Prose';
import { SenderLabel } from '@components/ui/store/SenderLabel';
import { siteUrl, storeConfig } from '@lib/storeConfig';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/about-page.module.css';

const filled = (s) => typeof s === 'string' && s.trim() !== '';

// Each refusal is struck through as it comes into view: the heading, read literally.
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
          {filled(item.why) && <p className={styles.why}>{item.why}</p>}
        </li>
      ))}
    </ul>
  );
}

function Part({ heading, text }) {
  if (!filled(heading) && !filled(text)) return null;
  return (
    <section className={styles.part}>
      {filled(heading) && <h2 className={styles.h2}>{heading}</h2>}
      {filled(text) && <div className={styles.text}><Prose text={text} /></div>}
    </section>
  );
}


// The words come from Settings. Anything not written there is left off rather than filled in.
export function AboutPage() {
  const site = siteUrl();
  const { voice = {}, shopName } = storeConfig();
  const about = voice.about ?? {};
  const name = shopName || 'the shop';
  const title = filled(about.title) ? about.title : `About ${name}`;
  const sections = (about.sections ?? []).filter((s) => filled(s?.heading) || filled(s?.text));
  const refusals = (about.refusals ?? []).filter((r) => filled(r?.no));
  const description = filled(about.lede) ? about.lede : `Who ${name} is, and how it works.`;

  return (
    <section className={styles.page}>
      <Head
        title={`About ${name}`}
        description={description}
        path="/about"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: `About ${name}`,
          description,
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
        <header className={styles.head}>
          <h1 className={`${styles.title} wide`}>{title}</h1>
          {filled(about.lede) && <p className={styles.lede}>{about.lede}</p>}
        </header>

        <div className={styles.label}>
          <SenderLabel />
        </div>

        <article className={styles.article}>
          {sections.map((s, i) => <Part key={i} heading={s.heading} text={s.text} />)}

          {refusals.length > 0 && (
            <section className={styles.part}>
              <h2 className={styles.h2}>What we will not do</h2>
              <Refusals items={refusals} />
            </section>
          )}

          {filled(about.her_words) && <Part heading="Who runs it" text={about.her_words} />}

          {about.closing && <Part heading={about.closing.heading} text={about.closing.text} />}

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
      </div>
    </section>
  );
}
