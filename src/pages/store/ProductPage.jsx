import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Gallery } from '@components/ui/store/Gallery';
import { ProductTag } from '@components/ui/store/ProductTag';
import { ArrivalTrack } from '@components/ui/store/ArrivalTrack';
import { FreeDeliveryBar } from '@components/ui/store/FreeDeliveryBar';
import { ProductTerms } from '@components/ui/store/ProductTerms';
import { AskPanel } from '@components/ui/store/AskPanel';
import { StockSignal } from '@components/ui/store/StockSignal';
import { VariantChoice } from '@components/ui/store/VariantChoice';
import { Reviews } from '@components/ui/store/Reviews';
import { Specifications } from '@components/ui/store/Specifications';
import { SupplierText } from '@components/ui/store/SupplierText';
import { Shelf } from '@components/ui/store/Shelf';
import { BasketIcon, ChevronRightIcon, PlusIcon } from '@components/ui/store/icons';
import { anyBuyable, useStoreProducts } from '@hooks/useStoreProducts';
import { useBasket } from '@context/BasketContext';
import { useRecentlyViewed } from '@hooks/useRecentlyViewed';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { useTenant } from '@hooks/useTenant';
import { trackProductView } from '@lib/analytics';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { groupCategories, visibleGroups } from '@utils/categories';
import { shopSectionOf } from '@utils/categoryNames';
import styles from '@styles/pages/store/product-page.module.css';

const LEFTOVER = 'Everything else';
const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

// Somewhere to go next: her section when it has at least two others, otherwise the rest of the shop.
function nextShelf(rows, product, names) {
  const groups = visibleGroups(groupCategories(rows, { names }));
  const others = (g) => g.items.filter((p) => p.id !== product.id);
  const own = groups.find((g) => g.path !== LEFTOVER && g.items.some((p) => p.id === product.id));
  if (own && others(own).length >= 2) return { ...own, items: others(own) };

  const rest = rows.filter((p) => p.id !== product.id);
  if (rest.length === 0) return null;
  // One leftover group is the whole shop and has a route; several groups do not share one.
  const whole = groups.length === 1 ? groups[0] : null;
  return whole
    ? { ...whole, name: 'Everything in the shop', items: rest }
    : { slug: 'shop', name: 'Everything in the shop', items: rest, route: false };
}

export function ProductPage() {
  const { slug } = useParams();
  const tenant = useTenant();
  // undefined while the tenant loads, null when there is none: the products hook treats them differently.
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows } = useStoreProducts(tenantId);
  const { add } = useBasket();
  const { record } = useRecentlyViewed();
  const names = useCategoryNames();

  const [added, setAdded] = useState(false);
  const [inBasket, setInBasket] = useState(false);
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState(null);
  const buyRef = useRef(null);
  const chooserRef = useRef(null);
  const [stuck, setStuck] = useState(false);

  const product = useMemo(() => rows.find((p) => p.slug === slug), [rows, slug]);

  useEffect(() => { setChosen(null); }, [product?.id]);
  useEffect(() => { setQty(1); setAdded(false); setInBasket(false); }, [slug]);

  // The sticky bar shows once the buy row has scrolled up under the header.
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id) return;
    record(product.id);
    trackProductView(product);
  }, [product?.id]);

  const next = useMemo(() => (product ? nextShelf(rows, product, names) : null), [rows, product, names]);

  if (status === 'loading') {
    return <div className={styles.page}><div className={styles.wrap}><div className={styles.loading} /></div></div>;
  }

  if (!product) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={`${styles.gone} wide`}>That product is not here</h1>
          <p className={styles.goneNote}>It may have sold out, or the address may be wrong.</p>
          <Link className={styles.goneBack} to={STORE_ROUTES.HOME}>See everything in the shop</Link>
        </div>
      </div>
    );
  }

  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [product.image_url].filter(Boolean);

  const hasVariants = product.variants?.length > 0;
  const price = Number(chosen?.price ?? (hasVariants ? product.priceFrom : product.price));
  const showFrom = hasVariants && !chosen && product.priceFrom !== product.priceTo;
  const saving = !hasVariants && product.compare_at != null ? Number(product.compare_at) - price : 0;
  const buyable = anyBuyable(product);
  const ready = hasVariants ? Boolean(chosen) : buyable;
  const section = shopSectionOf(product, names);
  const sectionGroup = section ? visibleGroups(groupCategories(rows, { names })).find((g) => g.name === section) : null;
  const label = hasVariants && !chosen ? 'Choose one first' : added ? 'Added to basket' : 'Add to basket';

  function onAdd() {
    if (hasVariants && !chosen) return;
    add(product, qty, chosen);
    setAdded(true);
    setInBasket(true);
    setTimeout(() => setAdded(false), 1600);
  }

  // From the sticky bar, a product that needs a size goes back to the chooser rather than doing nothing.
  function onStickyAdd() {
    if (hasVariants && !chosen) {
      chooserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      chooserRef.current?.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    onAdd();
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link to={STORE_ROUTES.HOME}>Shop</Link>
          {section && (
            <>
              <ChevronRightIcon size={13} />
              {sectionGroup ? <Link to={categoryPath(sectionGroup.slug)}>{section}</Link> : <span>{section}</span>}
            </>
          )}
          <ChevronRightIcon size={13} />
          <span className={styles.crumbHere} aria-current="page">{product.title}</span>
        </nav>

        <div className={styles.top}>
          <div className={styles.media}>
            <Gallery images={images} title={product.title} afterFrame={<span className={styles.board} aria-hidden="true" />} />
          </div>

          <div className={styles.detail}>
            {(product.brand || section) && (
              <p className={styles.eyebrow}>
                {product.brand && <span className={styles.brand}>{product.brand}</span>}
                {product.brand && section && <span aria-hidden="true"> &middot; </span>}
                {section}
              </p>
            )}
            <h1 className={styles.title}>{product.title}</h1>

            <ProductTag specifications={product.specifications} />

            <div className={styles.buyCard}>
              <div className={styles.priceRow}>
                <p className={styles.price}>
                  {showFrom && <span className={styles.from}>from</span>}
                  <span data-price>{formatGbp(price)}</span>
                  {saving > 0 && (
                    <>
                      <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>
                      <span className={styles.saving}>Save {formatGbp(saving)}</span>
                    </>
                  )}
                </p>
                <StockSignal product={product} />
              </div>

              <div ref={chooserRef}>
                <VariantChoice product={product} chosen={chosen} onChoose={setChosen} />
              </div>

              <div className={styles.buy} ref={buyRef}>
                <div className={styles.qty}>
                  <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty === 1} aria-label="One fewer">&minus;</button>
                  <span aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</span>
                  <button type="button" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="One more">+</button>
                </div>
                <button type="button" className={styles.addBtn} onClick={onAdd} data-added={added || undefined} disabled={!ready}>
                  {added ? <BasketIcon size={18} /> : <PlusIcon size={18} />}
                  <span aria-live="polite">{buyable ? label : 'Out of stock'}</span>
                </button>
              </div>

              <div className={styles.delivery}>
                <ArrivalTrack product={product} />
                <FreeDeliveryBar pending={inBasket || !ready ? 0 : price * qty} />
              </div>

              <ProductTerms product={product} />
            </div>
          </div>
        </div>
      </div>

      <section className={`${styles.wrap} ${styles.about}`} aria-labelledby="about">
        <h2 id="about" className={`${styles.aboutTitle} wide`}>Everything about it</h2>
        <div className={styles.aboutGrid}>
          <div className={styles.aboutMain}>
            {/* Her words replace the supplier's entirely once she has written them. */}
            {product.description ? (
              <div className={styles.description}>
                <h3 className={styles.descHead}>About this product</h3>
                <p>{product.description}</p>
              </div>
            ) : (
              <SupplierText text={product.source_description} />
            )}
          </div>
          <div className={styles.aboutSide}>
            <Specifications specifications={product.specifications} />
            <div className={styles.slip}>
              <AskPanel product={product} />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.wrap}>
        <Reviews product={product} />
      </div>

      {next && (
        <section className={styles.wrap} aria-labelledby="next">
          <h2 id="next" className={`${styles.nextTitle} wide`}>Also on the shelf</h2>
          <Shelf group={next} limit={8} />
        </section>
      )}

      <div className={styles.sticky} data-shown={stuck || undefined} aria-hidden={!stuck}>
        <div className={styles.stickyInner}>
          <span className={styles.stickyName}>{product.title}</span>
          <span className={styles.stickyPrice} data-price>{formatGbp(price * qty)}</span>
          <button type="button" className={styles.addBtn} onClick={onStickyAdd} tabIndex={stuck ? 0 : -1} disabled={!buyable}>
            {buyable ? (added ? 'Added' : hasVariants && !chosen ? 'Choose one first' : 'Add to basket') : 'Out of stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
