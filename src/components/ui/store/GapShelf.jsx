import { useMemo } from 'react';
import { Link } from 'react-router';
import { useBasket } from '@context/BasketContext';
import { useSaved } from '@hooks/useSaved';
import { useBrowse, useCards } from '@hooks/useStoreCatalogue';
import { CheckIcon, HeartIcon, PlusIcon } from '@components/ui/store/icons';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/gap-shelf.module.css';

const SHOW = 4;

/*
 * What would make delivery free, from her own shelves.
 *
 * Things they saved come first, because those are already wanted. Then her
 * products priced from the gap upwards, cheapest first, so the first thing
 * offered is the smallest spend that gets there. Nothing is shown once
 * delivery is free, and nothing already in the basket is offered again.
 */
export function GapShelf({ gap }) {
  const { lines, add } = useBasket();
  const { ids: savedIds } = useSaved();
  const inBasket = useMemo(() => new Set(lines.map((l) => l.id)), [lines]);

  const on = gap > 0;
  const { items: saved } = useCards(on ? savedIds : []);
  const filters = useMemo(() => ({ min: Math.floor(gap), max: Math.ceil(gap + 25), inStock: true, sort: 'price-asc' }), [gap]);
  const { items: near } = useBrowse(filters, { limit: 16, enabled: on });

  const picks = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const [from, list] of [['saved', saved], ['near', near]]) {
      for (const p of list ?? []) {
        if (out.length >= SHOW || seen.has(p.id) || inBasket.has(p.id) || p.buyable === false) continue;
        seen.add(p.id);
        out.push({ ...p, from });
      }
    }
    return out;
  }, [saved, near, inBasket]);

  if (!on || picks.length === 0) return null;

  // Said once in the heading when every pick closes the gap, and per tile only when some do not.
  const priceOf = (p) => (p.variantCount > 0 ? p.priceFrom || p.price : p.price);
  const allClose = picks.every((p) => priceOf(p) >= gap);

  return (
    <section className={styles.shelf} aria-labelledby="gap-shelf-title">
      <header className={styles.head}>
        <div>
          <h2 id="gap-shelf-title" className={styles.title}>
            <span data-price>{formatGbp(gap)}</span> from free delivery
          </h2>
          {allClose && <p className={styles.sub}>Any one of these makes it free.</p>}
        </div>
        <Link className={styles.more} to={STORE_ROUTES.SHOP}>See everything</Link>
      </header>

      <ul className={styles.row}>
        {picks.map((p) => {
          const path = STORE_ROUTES.PRODUCT.replace(':slug', p.slug);
          const price = priceOf(p);
          const closes = !allClose && price >= gap;
          return (
            <li key={p.id} className={styles.tile}>
              <Link className={styles.frame} to={path} tabIndex={-1} aria-hidden="true">
                {p.image_url ? <img src={imageAt(p.image_url, 300)} alt="" loading="lazy" /> : <span className={styles.noImage} />}
                {p.from === 'saved' && <span className={styles.saved}><HeartIcon size={12} />Saved</span>}
              </Link>
              <Link className={styles.name} to={path}>{p.title}</Link>
              <div className={styles.foot}>
                <span className={styles.price} data-price>
                  {p.variantCount > 0 && <span className={styles.from}>from </span>}
                  {formatGbp(price)}
                </span>
                {p.variantCount > 0 ? (
                  <Link className={styles.add} to={path} aria-label={`Choose an option of ${p.title}`}>Choose</Link>
                ) : (
                  <button type="button" className={styles.add} onClick={() => add(p, 1)} aria-label={`Add ${p.title} to your basket`}>
                    <PlusIcon size={14} />Add
                  </button>
                )}
              </div>
              {closes && <p className={styles.closes}><CheckIcon size={12} />Delivery free with this</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
