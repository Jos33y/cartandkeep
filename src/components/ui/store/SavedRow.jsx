import { useState } from 'react';
import { Link } from 'react-router';
import { mostOf, useBasket } from '@context/BasketContext';
import { useSaved } from '@hooks/useSaved';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { StockSignal, isBuyable } from '@components/ui/store/StockSignal';
import { CheckIcon, HeartIcon, PlusIcon } from '@components/ui/store/icons';
import { imageAt } from '@utils/categories';
import { shopSectionOf } from '@utils/categoryNames';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/saved-row.module.css';

const productPath = (slug) => STORE_ROUTES.PRODUCT.replace(':slug', slug);
const ON_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

// "Saved today", "Saved 3 days ago", "Saved on 4 Sept", from the moment it was saved on this device.
export function savedWhen(at, now = Date.now()) {
  if (!Number.isFinite(at)) return null;
  const start = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(now) - start(at)) / 86400000);
  if (days <= 0) return 'Saved today';
  if (days === 1) return 'Saved yesterday';
  if (days < 14) return `Saved ${days} days ago`;
  return `Saved on ${ON_DAY.format(new Date(at))}`;
}

// What the price has done since it was saved, only for a product with one price and a price to compare with.
export function priceSince(product, snap) {
  const sized = (product.variantCount ?? 0) > 0;
  const then = Number(snap?.price);
  const now = Number(product.price);
  if (sized || !Number.isFinite(then) || then <= 0 || !Number.isFinite(now)) return null;
  const diff = Math.round((now - then) * 100) / 100;
  if (Math.abs(diff) < 0.01) return null;
  return diff < 0
    ? { down: true, text: `${formatGbp(-diff)} less than when you saved it` }
    : { down: false, text: `${formatGbp(diff)} more than when you saved it` };
}

/*
 * One saved thing, as a row: somewhere to decide rather than browse.
 *
 * On your own Saved the heart takes it off the list; on a list someone shared
 * it puts it on yours. Either way the basket is its own button, and a product
 * with sizes goes to its page to choose one, because guessing a size is worse
 * than asking for one.
 */
export function SavedRow({ product, snap = null, shared = false, onUnsave }) {
  const { add, lines } = useBasket();
  const { has, toggle } = useSaved();
  const names = useCategoryNames();
  const [added, setAdded] = useState(false);

  const image = imageAt(product.image_url, 300);
  const section = shopSectionOf(product, names);
  const sized = (product.variantCount ?? 0) > 0;
  const buyable = (product.buyable ?? true) && isBuyable(product);
  const inLine = sized ? null : lines.find((l) => l.key === product.id) ?? null;
  const inCount = sized
    ? lines.filter((l) => l.id === product.id).reduce((n, l) => n + l.qty, 0)
    : inLine?.qty ?? 0;
  const full = inLine ? inLine.qty >= mostOf(inLine.stock) : false;
  const range = sized && product.priceFrom !== product.priceTo;
  const shown = sized ? product.priceFrom : Number(product.price);
  const was = !sized && product.compare_at != null && Number(product.compare_at) > Number(product.price) ? Number(product.compare_at) : null;
  const change = shared ? null : priceSince(product, snap);
  const when = shared ? null : savedWhen(snap?.at);
  const saved = has(product.id);

  function onAdd() {
    if (!buyable || sized || full) return;
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  function onHeart() {
    if (!shared && saved && onUnsave) { onUnsave(product); return; }
    toggle(product.id, product);
  }

  return (
    <li className={styles.row} data-off={!buyable || undefined}>
      <Link className={styles.thumb} to={productPath(product.slug)} tabIndex={-1} aria-hidden="true">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span className={styles.noImage} />}
      </Link>

      <div className={styles.main}>
        {section && <p className={styles.section}>{section}</p>}
        <Link className={styles.title} to={productPath(product.slug)}>{product.title}</Link>
        <div className={styles.notes}>
          <StockSignal product={product} size="small" />
          {change && <span className={styles.change} data-down={change.down || undefined}>{change.text}</span>}
          {inCount > 0 && <span className={styles.inBasket}>In your basket ({inCount})</span>}
        </div>
        {when && <p className={styles.when}>{when}</p>}
      </div>

      <div className={styles.money}>
        <p className={styles.price}>
          {range && <span className={styles.from}>from</span>}
          <span data-price>{formatGbp(shown)}</span>
        </p>
        {was && <s className={styles.was} data-price>{formatGbp(was)}</s>}
      </div>

      <div className={styles.actions}>
        {sized ? (
          <Link className={styles.add} to={productPath(product.slug)}>Choose a size</Link>
        ) : (
          <button
            type="button"
            className={styles.add}
            onClick={onAdd}
            disabled={!buyable || full}
            data-added={added || undefined}
            aria-label={!buyable ? `${product.title} is out of stock`
              : full ? `${product.title}: as many as we have are in your basket`
                : inLine ? `Add one more ${product.title}, ${inLine.qty} in your basket` : `Add ${product.title} to basket`}
          >
            {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
            <span aria-live="polite">{!buyable ? 'Out of stock' : added ? 'Added' : full ? 'All in basket' : inLine ? 'Add another' : 'Add to basket'}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.heart}
          data-on={saved || undefined}
          aria-pressed={saved}
          onClick={onHeart}
          aria-label={saved ? `Remove ${product.title} from saved` : `Save ${product.title}`}
          title={saved ? 'Remove from saved' : 'Save'}
        >
          <HeartIcon size={18} />
        </button>
      </div>
    </li>
  );
}
