import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Gallery } from '@components/ui/store/Gallery';
import { DeliveryEstimate } from '@components/ui/store/DeliveryEstimate';
import { ProductTerms } from '@components/ui/store/ProductTerms';
import { StockSignal, isBuyable } from '@components/ui/store/StockSignal';
import { anyBuyable } from '@hooks/useStoreProducts';
import { ArrowRightIcon, BasketIcon, CloseIcon, PlusIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { trackQuickView } from '@lib/analytics';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { leafOf } from '@utils/categories';
import styles from '@styles/ui/store/quick-view.module.css';

/*
 * Look without leaving the grid.
 *
 * The point is not the modal, it is that browsing a general store means
 * checking twenty things and buying one. Making each check cost a page load
 * and a scroll back is what turns forty products into eight.
 *
 * It is a summary and a buy button, never a second product page. Anything that
 * needs reading is behind "Full details", because a dialog is the wrong place
 * to make somebody read.
 */
export function QuickView({ product, onClose }) {
  const { add } = useBasket();
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const panel = useRef(null);
  const closeBtn = useRef(null);
  const returnTo = useRef(null);

  useEffect(() => {
    if (!product) return undefined;

    // Where focus came from, so it goes back there on close. Without this a
    // keyboard user lands at the top of the document and has to find their
    // place in the grid again.
    returnTo.current = document.activeElement;
    closeBtn.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      // Focus stays inside. A dialog you can tab out of is a dialog that hides
      // the page behind it while letting you operate it blind.
      const focusable = panel.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
    };
  }, [product, onClose]);

  useEffect(() => {
    setQty(1);
    setAdded(false);
    if (product?.id) trackQuickView(product);
  }, [product?.id]);

  if (!product) return null;

  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : [product.image_url].filter(Boolean);

  const hasVariants = product.variants?.length > 0;
  const buyable = anyBuyable(product);

  // The cheapest when there are variants, because quick view deliberately does
  // not carry a chooser and a single figure on a range is a figure that is
  // wrong for at least one size.
  const from = hasVariants && product.priceFrom !== product.priceTo;
  const price = hasVariants ? product.priceFrom : Number(product.price);
  const saving = !hasVariants && product.compare_at != null
    ? Number(product.compare_at) - price : 0;
  const leaf = leafOf(product.category_path) ?? product.category;

  function onAdd() {
    /*
     * No chooser here on purpose.
     *
     * Quick view is a peek from a grid, and a size chooser inside a modal
     * inside a grid is three levels of decision in a panel somebody opened to
     * avoid navigating. A product with variants sends her to the page, which
     * has the room for it.
     */
    // Handled by the button becoming a link instead, so this is unreachable.
    // Left as a guard rather than removed, because `onAdd` is also wired to the
    // Enter key on the quantity control.
    if (hasVariants) return;
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.panel}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qv-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>

        <div className={styles.body}>
          <div className={styles.media}>
            <Gallery images={images} title={product.title} />
          </div>

          <div className={styles.detail}>
            {leaf && <p className={styles.leaf}>{leaf}</p>}
            <h2 id="qv-title" className={styles.title}>{product.title}</h2>

            <div className={styles.stockRow}><StockSignal product={product} /></div>

            <p className={styles.priceRow}>
              {from && <span className={styles.from}>from</span>}
              <span className={styles.price} data-price>{formatGbp(price)}</span>
              {saving > 0 && (
                <>
                  <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>
                  <span className={styles.saving}>Save {formatGbp(saving)}</span>
                </>
              )}
            </p>

            <div className={styles.buy}>
              <div className={styles.qty}>
                <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty === 1} aria-label="One fewer">&minus;</button>
                <span data-price aria-label={`Quantity ${qty}`}>{qty}</span>
                <button type="button" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="One more">+</button>
              </div>
              {hasVariants ? (
                /* A link, not a dead button. It said "Choose a size" and did
                   nothing when pressed, which is worse than a disabled control
                   because it looks like it should work. */
                <Link
                  className={styles.addBtn}
                  to={STORE_ROUTES.PRODUCT.replace(':slug', product.slug)}
                  onClick={onClose}
                >
                  <PlusIcon size={18} />
                  <span>Choose a size</span>
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={onAdd}
                  data-added={added || undefined}
                  disabled={!buyable}
                >
                  {added ? <BasketIcon size={17} /> : <PlusIcon size={17} />}
                  <span aria-live="polite">
                    {!buyable ? 'Out of stock'
                      : hasVariants ? 'Choose a size'
                        : added ? 'Added to basket' : 'Add to basket'}
                  </span>
                </button>
              )}
            </div>

            <DeliveryEstimate product={product} compact />

            <ProductTerms product={product} compact />

            <Link className={styles.full} to={STORE_ROUTES.PRODUCT.replace(':slug', product.slug)} onClick={onClose}>
              Full details <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
