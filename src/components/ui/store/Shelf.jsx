import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ProductCard } from '@components/ui/store/ProductCard';
import { ArrowRightIcon, ChevronRightIcon } from '@components/ui/store/icons';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/shelf.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

/*
 * The signature. A row per department, with the name held still in a panel
 * while the products scroll past it.
 *
 * The first version had no way to move the rail with a mouse. Snap scrolling
 * and an edge that bleeds off the container are thumb affordances and they say
 * nothing to a trackpad, so the shelf was unusable on the surface most of the
 * first traffic will arrive on.
 *
 * Arrows appear only when there is somewhere to go, and each one disables
 * itself at its end rather than sitting there doing nothing.
 */
export function Shelf({ group, limit = 8, onQuickView }) {
  const rail = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    // A pixel of slack, because a scrolled-to-the-end element is routinely a
    // fraction short of its own scrollWidth on a fractional display scale.
    setEdges({
      start: el.scrollLeft > 1,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return undefined;
    measure();
    el.addEventListener('scroll', measure, { passive: true });

    // Guarded. Without it, an environment that lacks ResizeObserver throws in
    // an effect and takes the whole shelf down rather than losing one
    // measurement. The window resize listener covers the same ground less
    // precisely, which is the right fallback.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      el.removeEventListener('scroll', measure);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, [measure, group.slug]);

  // One card plus its gutter, read off the DOM rather than hard coded, so the
  // step stays right when the breakpoint changes the card width.
  function nudge(direction) {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  }

  const items = group.items.slice(0, limit);
  const cheapest = Math.min(...group.items.map((p) => Number(p.price)));
  const more = group.items.length - items.length;

  return (
    <section className={styles.shelf} aria-labelledby={`shelf-${group.slug}`}>
      <div className={styles.panel}>
        <div className={styles.panelTop}>
          <h2 id={`shelf-${group.slug}`} className={`${styles.name} wide`}>{group.name}</h2>
          <p className={styles.meta}>
            {group.items.length} {group.items.length === 1 ? 'product' : 'products'}
            {Number.isFinite(cheapest) && <> &middot; from <span data-price>{formatGbp(cheapest)}</span></>}
          </p>
        </div>

        <div className={styles.panelFoot}>
          {/* Recently viewed has no route behind it. Price bands do, because
              they are resolved by the category page like any department. */}
          {group.route !== false ? (
            <Link className={styles.go} to={categoryPath(group.slug)}>
              Browse all {group.items.length}
              <ArrowRightIcon size={14} />
            </Link>
          ) : <span />}

          {(edges.start || edges.end) && (
            <div className={styles.arrows}>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => nudge(-1)}
                disabled={!edges.start}
                aria-label={`Scroll ${group.name} back`}
              >
                <ChevronRightIcon size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button
                type="button"
                className={styles.arrow}
                onClick={() => nudge(1)}
                disabled={!edges.end}
                aria-label={`Scroll ${group.name} forward`}
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The fades are the second affordance and they cost nothing: a card
          disappearing under a soft edge reads as more to come, where a card
          cut off by a hard container edge reads as a bug. */}
      <div className={styles.railWrap} data-start={edges.start || undefined} data-end={edges.end || undefined}>
        <ul className={styles.rail} ref={rail}>
          {items.map((product, i) => (
            <li key={product.id} className={styles.cell}>
              <ProductCard product={product} index={i} onQuickView={onQuickView} />
            </li>
          ))}
          {more > 0 && group.route !== false && (
            <li className={styles.cell}>
              <Link className={styles.rest} to={categoryPath(group.slug)}>
                <span className={styles.restN} data-price>+{more}</span>
                <span className={styles.restLabel}>more in {group.name}</span>
                <ArrowRightIcon size={16} />
              </Link>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
