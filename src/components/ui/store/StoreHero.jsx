import { Link } from 'react-router';
import { ArrowRightIcon, MessageIcon, ReturnIcon, VanIcon } from '@components/ui/store/icons';
import { ShelfUnit } from '@components/ui/store/ShelfUnit';
import { freeOver, replyPromise, returnsTerms, storeConfig } from '@lib/storeConfig';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/store-hero.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);
const pounds = (n) => (Number.isInteger(Number(n)) ? `\u00a3${Number(n)}` : `\u00a3${Number(n).toFixed(2)}`);

// Headline from Settings when she has written one; her tagline, turned into a headline, until then.
export function StoreHero({ groups }) {
  const sections = groups.filter((g) => g.path !== 'Everything else' && g.name !== 'Everything in the shop');
  const { voice = {} } = storeConfig();
  const title = voice.hero_title || 'One small shop.';
  const em = voice.hero_em || 'A very large cupboard.';

  const proof = [
    { Icon: VanIcon, text: `Free delivery from ${pounds(freeOver())}` },
    { Icon: ReturnIcon, text: `${returnsTerms().days ?? 30}-day returns` },
    { Icon: MessageIcon, text: `Replies ${replyPromise()}` },
  ];

  return (
    <section className={styles.band}>
      <span className={styles.wall} aria-hidden="true" />
      <span className={styles.floor} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.copy}>
          <h1 className={`${styles.title} wide`}>
            <span className={styles.line}>{title}</span>
            <em className={styles.em}>{em}</em>
          </h1>

          <p className={styles.sub}>If it is not on the shelf yet, tell us and we will find it.</p>

          <div className={styles.actions}>
            <Link to={STORE_ROUTES.SHOP} className={styles.primary}>
              Shop the cupboard <ArrowRightIcon size={18} />
            </Link>
            <Link to={STORE_ROUTES.REQUEST} className={styles.secondary}>Tell us what you need</Link>
          </div>

          <ul className={styles.proof}>
            {proof.map(({ Icon, text }) => (
              <li key={text}><Icon size={16} />{text}</li>
            ))}
          </ul>

          {sections.length >= 2 && (
            <div className={styles.chips}>
              {sections.slice(0, 6).map((g) => (
                <Link key={g.slug} to={categoryPath(g.slug)} className={styles.chip}>
                  {g.name}
                  <span className={styles.chipCount}>{g.count ?? g.items?.length ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={styles.stage}>
          <ShelfUnit sections={sections} />
          <span className={styles.contact} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
