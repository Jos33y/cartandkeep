import { useState } from 'react';
import { Link } from 'react-router';
import { useBasket } from '@context/BasketContext';
import { useSaved } from '@hooks/useSaved';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { StockSignal } from '@components/ui/store/StockSignal';
import { quickViewFrom } from '@components/ui/store/QuickView';
import { anyBuyable } from '@hooks/useStoreProducts';
import { imageAt } from '@utils/categories';
import { shopSectionOf } from '@utils/categoryNames';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { CheckIcon, EyeIcon, HeartIcon, PlusIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/product-card.module.css';

const productPath = (slug) => STORE_ROUTES.PRODUCT.replace(':slug', slug);

// An article, not a link: buttons cannot live inside an anchor. The title's link stretches over the card instead.
export function ProductCard({ product, index = 0, onQuickView, shelfName = null }) {
  const { add } = useBasket();
  const { has, toggle } = useSaved();
  const names = useCategoryNames();
  const [added, setAdded] = useState(false);
  const [broken, setBroken] = useState(false);

  const image = imageAt(product.image_url, 500);
  const image2x = imageAt(product.image_url, 800);
  // Hidden on a shelf that already carries the same name.
  const own = shopSectionOf(product, names);
  const sectionName = own && own !== shelfName ? own : null;
  const hasVariants = product.variants?.length > 0;
  const buyable = anyBuyable(product);
  const saved = has(product.id);

  const saving = !hasVariants && product.compare_at != null
    ? Number(product.compare_at) - Number(product.price)
    : null;
  const from = hasVariants && product.priceFrom !== product.priceTo;
  const shown = hasVariants ? product.priceFrom : Number(product.price);

  function onAdd() {
    if (!buyable || hasVariants) return;
    add(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article className={styles.card}>
      <div className={styles.frame}>
        {image && !broken ? (
          <img
            className={styles.image}
            src={image}
            srcSet={image2x ? `${image} 1x, ${image2x} 2x` : undefined}
            alt=""
            loading={index < 4 ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className={styles.noImage}>No photograph yet</span>
        )}

        {saving > 0 && <span className={`${styles.flag} ${styles.flagSale}`}>Save {formatGbp(saving)}</span>}
        {product.is_sample && <span className={styles.flag}>Sample</span>}

        <div className={styles.tools}>
          {onQuickView && (
            <button type="button" className={styles.tool} data-look title="Quick look" aria-label={`Quick look at ${product.title}`} onClick={(e) => { quickViewFrom(e.currentTarget); onQuickView(product); }}>
              <EyeIcon size={17} />
            </button>
          )}
          <button
            type="button"
            className={styles.tool}
            data-on={saved || undefined}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${product.title} from saved` : `Save ${product.title}`}
            onClick={() => toggle(product.id)}
          >
            <HeartIcon size={16} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {sectionName && <p className={styles.section}>{sectionName}</p>}
        <h3 className={styles.title}>
          <Link className={styles.link} to={productPath(product.slug)}>{product.title}</Link>
        </h3>

        {/* The line is reserved whether or not it has anything to say, so every card in a row is the same height. */}
        <div className={styles.signal}>
          <StockSignal product={product} size="small" />
        </div>

        <div className={styles.foot}>
          <p className={styles.priceRow}>
            {from && <span className={styles.from}>from</span>}
            <span className={styles.price} data-price>{formatGbp(shown)}</span>
            {saving > 0 && <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>}
          </p>

          {hasVariants ? (
            <Link className={styles.choose} to={productPath(product.slug)} tabIndex={-1} aria-hidden="true">Choose</Link>
          ) : (
            <button
              type="button"
              className={styles.add}
              onClick={onAdd}
              disabled={!buyable}
              data-added={added || undefined}
              aria-label={buyable ? `Add ${product.title} to basket` : `${product.title} is out of stock`}
            >
              {added ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
              <span className={styles.addLabel} aria-live="polite">{!buyable ? 'Sold out' : added ? 'Added' : 'Add'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
