import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Gallery } from '@components/ui/store/Gallery';
import { DeliveryEstimate } from '@components/ui/store/DeliveryEstimate';
import { ProductTerms } from '@components/ui/store/ProductTerms';
import { StockSignal, isBuyable } from '@components/ui/store/StockSignal';
import { VariantChoice } from '@components/ui/store/VariantChoice';
import { anyBuyable } from '@hooks/useStoreProducts';
import { Specifications } from '@components/ui/store/Specifications';
import { SupplierText } from '@components/ui/store/SupplierText';
import { Shelf } from '@components/ui/store/Shelf';
import { BasketIcon, ChevronRightIcon, PlusIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { useRecentlyViewed } from '@hooks/useRecentlyViewed';
import { trackProductView } from '@lib/analytics';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { categorySlug, groupCategories, leafOf, topOf } from '@utils/categories';
import styles from '@styles/pages/store/product-page.module.css';

/*
 * One product.
 *
 * It reads the whole catalogue rather than fetching one row. At seventy eight
 * products that is one request instead of two, the related shelf comes free
 * from data already in hand, and moving between products is instant because
 * nothing is refetched. When the catalogue outgrows that, this becomes a
 * single row query and a separate related call, and the change is confined to
 * these three lines.
 */
export function ProductPage() {
  const { slug } = useParams();
  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows } = useStoreProducts(tenantId);
  const { add } = useBasket();
  const { record } = useRecentlyViewed();

  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  /*
   * The chosen variant, cleared when the product changes.
   *
   * Without the reset, walking from a bed sheet to a duvet cover through a
   * related products link keeps the previous product's variant selected, and
   * the Add button then adds a size that belongs to something else. The router
   * reuses this component across those two routes, so nothing else unmounts it.
   */
  const [chosen, setChosen] = useState(null);
  const buyRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  const product = useMemo(() => rows.find((p) => p.slug === slug), [rows, slug]);

  /*
   * Cleared when the product changes.
   *
   * Walking from a bed sheet to a duvet cover through a related products link
   * reuses this component, so without the reset the previous product's variant
   * stays selected and the Add button adds a size belonging to something else.
   *
   * Declared after `product` rather than beside the other state, because a
   * dependency on `product?.id` above the line that defines it is a temporal
   * dead zone crash on every product page rather than a subtle bug.
   */
  useEffect(() => { setChosen(null); }, [product?.id]);

  // The sticky bar appears when the real button leaves the viewport, not on a
  // scroll distance. Tied to the button, it is never on screen at the same
  // time as the thing it duplicates.
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: '-72px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [product?.id]);

  useEffect(() => { setQty(1); setAdded(false); }, [slug]);

  // Recorded once the product resolves, so a slug that matches nothing never
  // ends up on the shelf. Keyed on the id rather than the slug, so a rerender
  // does not count a second view of the same thing.
  useEffect(() => {
    if (!product?.id) return;
    record(product.id);
    trackProductView(product);
  }, [product?.id]);

  const related = useMemo(() => {
    if (!product) return null;
    const groups = groupCategories(rows);
    const name = topOf(product.category_path);
    const group = groups.find((g) => g.slug === categorySlug(name ?? ''));
    if (!group) return null;
    const items = group.items.filter((p) => p.id !== product.id);
    return items.length ? { ...group, items } : null;
  }, [rows, product]);

  if (status === 'loading') {
    return <div className={styles.page}><div className={styles.wrap}><div className={styles.loading} /></div></div>;
  }

  if (!product) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={`${styles.gone} wide`}>That product is not here</h1>
          <p className={styles.goneNote}>
            It may have sold out, or the address may be wrong.
          </p>
          <Link className={styles.goneBack} to={STORE_ROUTES.HOME}>See everything in the shop</Link>
        </div>
      </div>
    );
  }

  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [product.image_url].filter(Boolean);

  /*
   * The chosen variant's price, or the product's when there is none.
   *
   * A product with variants shows the cheapest until one is picked, prefixed
   * with "from", because a shop that shows £24.99 and charges £29.99 at the
   * basket has misled somebody even if every figure was true at the time.
   */
  const hasVariants = product.variants?.length > 0;
  const price = Number(chosen?.price ?? (hasVariants ? product.priceFrom : product.price));
  const showFrom = hasVariants && !chosen && product.priceFrom !== product.priceTo;

  // A compare at price on a product with variants would need one per variant to
  // mean anything, so it is not shown on those until it does.
  const saving = !hasVariants && product.compare_at != null
    ? Number(product.compare_at) - price : 0;

  const buyable = anyBuyable(product);
  const ready = hasVariants ? Boolean(chosen) : buyable;
  const department = topOf(product.category_path);
  const leaf = leafOf(product.category_path) ?? product.category;

  function onAdd() {
    // Refused rather than defaulted. Picking a size for somebody is how a shop
    // posts the wrong one.
    if (hasVariants && !chosen) return;
    add(product, qty, chosen);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to={STORE_ROUTES.HOME}>Shop</Link>
          {department && (
            <>
              <ChevronRightIcon size={13} />
              <Link to={STORE_ROUTES.CATEGORY.replace(':slug', categorySlug(department))}>
                {department}
              </Link>
            </>
          )}
          {leaf && <><ChevronRightIcon size={13} /><span aria-current="page">{leaf}</span></>}
        </nav>

        <div className={styles.top}>
          <Gallery images={images} title={product.title} />

          <div className={styles.detail}>
            <p className={styles.eyebrow}>
              {product.brand && <span className={styles.brand}>{product.brand}</span>}
              {product.brand && leaf && <span aria-hidden="true"> &middot; </span>}
              {leaf}
            </p>
            <h1 className={styles.title}>{product.title}</h1>

            <div className={styles.stockRow}>
              <StockSignal product={product} size="large" />
            </div>

            <p className={styles.priceRow}>
              {showFrom && <span className={styles.from}>from</span>}
              <span className={styles.price} data-price>{formatGbp(price)}</span>
              {saving > 0 && (
                <>
                  <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>
                  <span className={styles.saving}>Save {formatGbp(saving)}</span>
                </>
              )}
            </p>

            <VariantChoice product={product} chosen={chosen} onChoose={setChosen} />

            {/* The date sits above the button, not below it. It is an input to
                the decision, and everything below the button is read after
                somebody has already made it. */}
            <DeliveryEstimate product={product} />

            <div className={styles.buy} ref={buyRef}>
              <div className={styles.qty}>
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  disabled={qty === 1}
                  aria-label="One fewer"
                >
                  &minus;
                </button>
                <span data-price aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</span>
                <button type="button" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="One more">
                  +
                </button>
              </div>

              <button
                type="button"
                className={styles.addBtn}
                onClick={onAdd}
                data-added={added || undefined}
                disabled={!ready}
              >
                {added ? <BasketIcon size={18} /> : <PlusIcon size={18} />}
                <span aria-live="polite">
                  {!buyable ? 'Out of stock'
                    : hasVariants && !chosen ? 'Choose one first'
                      : added ? 'Added to basket' : 'Add to basket'}
                </span>
              </button>
            </div>

            <ProductTerms product={product} />

            {/* Her words first and the supplier's second, never mixed. A
                description she has written replaces the supplier block
                entirely, because at that point there is a better answer. */}
            {product.description ? (
              <div className={styles.description}>
                <h2 className={styles.descHead}>About this product</h2>
                <p>{product.description}</p>
              </div>
            ) : (
              <SupplierText text={product.source_description} />
            )}

            <Specifications specifications={product.specifications} />
          </div>
        </div>
      </div>

      {related && (
        <div className={styles.wrap}>
          <div className={styles.relatedHead}>
            <h2 className={`${styles.relatedTitle} wide`}>More in {related.name}</h2>
          </div>
          <Shelf group={related} limit={8} />
        </div>
      )}

      {/* The single largest conversion lever on a product page, and it costs
          nothing. Rendered always and hidden by transform, so it slides rather
          than appearing. */}
      <div className={styles.sticky} data-shown={stuck || undefined} aria-hidden={!stuck}>
        <div className={styles.stickyInner}>
          <span className={styles.stickyName}>{product.title}</span>
          <span className={styles.stickyPrice} data-price>{formatGbp(price * qty)}</span>
          <button
            type="button"
            className={styles.addBtn}
            onClick={onAdd}
            tabIndex={stuck ? 0 : -1}
            disabled={!isBuyable(product)}
          >
            {!buyable ? 'Out of stock'
              : hasVariants && !chosen ? 'Choose one first'
                : added ? 'Added' : 'Add to basket'}
          </button>
        </div>
      </div>
    </div>
  );
}
