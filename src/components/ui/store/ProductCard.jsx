import { useState } from 'react';
import { Link } from 'react-router';
import { useBasket } from '@context/BasketContext';
import { useSaved } from '@hooks/useSaved';
import { StockSignal, isBuyable } from '@components/ui/store/StockSignal';
import { anyBuyable } from '@hooks/useStoreProducts';
import { imageAt, leafOf } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { BasketIcon, HeartIcon, PlusIcon, SearchIcon } from '@components/ui/store/icons';
import styles from '@styles/ui/store/product-card.module.css';

const productPath = (slug) => STORE_ROUTES.PRODUCT.replace(':slug', slug);

/*
 * One product.
 *
 * `index` is only used to decide which images load eagerly. The entry
 * animation is staggered by the grid, on the list item, because the delay is
 * read there and a custom property inherits downward.
 *
 * The card is a link and the two controls inside it are buttons, which means
 * both have to stop the click reaching the link. Miss that and adding to the
 * basket also navigates away from the grid, which is the most annoying
 * possible version of this component.
 *
 * The image fills the tile. The first version padded it and used contain, so
 * every photograph floated in a white box like a scraped feed, which is
 * exactly what a buyer must not think.
 *
 * The body is content height. The first version pinned the price to the bottom
 * with margin-top: auto, so a two word title left a third of the tile empty.
 */
export function ProductCard({ product, index = 0, onQuickView }) {
  const { add } = useBasket();
  const { has, toggle } = useSaved();
  const [added, setAdded] = useState(false);
  const [broken, setBroken] = useState(false);

  const image = imageAt(product.image_url, 500);
  const image2x = imageAt(product.image_url, 800);
  const leaf = leafOf(product.category_path) ?? product.category;
  const hasVariants = product.variants?.length > 0;
  const buyable = anyBuyable(product);

  // A compare at price needs one per variant to mean anything, so it is not
  // shown on a product that has them until it does.
  const saving = !hasVariants && product.compare_at != null
    ? Number(product.compare_at) - Number(product.price)
    : null;

  // The cheapest, prefixed. A card showing £24.99 for a bed sheet whose only
  // stocked size is the £29.99 one has misled somebody before they reached the
  // page, and "from" is the whole difference between a range and a price.
  const from = hasVariants && product.priceFrom !== product.priceTo;
  const shown = hasVariants ? product.priceFrom : Number(product.price);

  function onAdd(event) {
    /*
     * A product with variants is not added from a grid tile.
     *
     * Picking a size from a card means a card that has to be right about which
     * size, which price and how many of that size are left, in a tile the width
     * of a thumbnail. The whole card is already a link to the product page, so
     * this lets the click through rather than swallowing it: pressing "Choose a
     * size" opens the page, which is what the words promise.
     */
    if (hasVariants) return;

    event.preventDefault();
    event.stopPropagation();
    if (!buyable) return;
    add(product, 1);
    setAdded(true);
    // Long enough to read, short enough that a second add still feels
    // responsive rather than blocked.
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <Link
      className={styles.card}
      to={productPath(product.slug)}
    >
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

        {saving > 0 && (
          <span className={`${styles.flag} ${styles.flagSale}`}>
            Save {formatGbp(saving)}
          </span>
        )}
        {product.is_sample && <span className={styles.flag}>Sample</span>}

        <div className={styles.tools}>
          {onQuickView && (
            <button
              type="button"
              className={styles.tool}
              aria-label={`Quick look at ${product.title}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(product); }}
            >
              <SearchIcon size={16} />
            </button>
          )}
          {/* This did nothing at all until now. A heart that looks like it
              works and does not is worse than no heart, because somebody taps
              it, believes the thing is saved, and finds out otherwise later. */}
          <button
            type="button"
            className={styles.tool}
            data-on={has(product.id) || undefined}
            aria-pressed={has(product.id)}
            aria-label={has(product.id) ? `Remove ${product.title} from saved` : `Save ${product.title}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(product.id); }}
          >
            <HeartIcon size={16} />
          </button>
        </div>

        <button
          type="button"
          className={styles.add}
          onClick={onAdd}
          disabled={!buyable}
          data-added={added || undefined}
          aria-label={`Add ${product.title} to basket`}
        >
          {added ? <BasketIcon size={15} /> : <PlusIcon size={15} />}
          <span aria-live="polite">
            {!buyable ? 'Out of stock'
              : hasVariants ? 'Choose a size'
                : added ? 'Added' : 'Add to basket'}
          </span>
        </button>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{product.title}</h3>
        {leaf && <p className={styles.leaf}>{leaf}</p>}
        {(product.availability && product.availability !== 'in_stock')
          || (Number.isFinite(product.stock) && product.stock > 0 && product.stock <= 5) ? (
            <StockSignal product={product} size="small" />
          ) : null}

        <p className={styles.priceRow}>
          {from && <span className={styles.from}>from</span>}
          <span className={styles.price} data-price>{formatGbp(shown)}</span>
          {saving > 0 && (
            <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
