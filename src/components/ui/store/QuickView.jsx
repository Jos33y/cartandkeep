import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Gallery } from '@components/ui/store/Gallery';
import { ArrivalTrack } from '@components/ui/store/ArrivalTrack';
import { FreeDeliveryBar } from '@components/ui/store/FreeDeliveryBar';
import { StockSignal } from '@components/ui/store/StockSignal';
import { anyBuyable } from '@hooks/useStoreProducts';
import { ArrowRightIcon, BasketIcon, CloseIcon, PlusIcon, ReturnIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { useProduct } from '@hooks/useCatalogue';
import { trackQuickView } from '@lib/analytics';
import { returnsTerms } from '@lib/storeConfig';
import { formatGbp } from '@utils/formatGbp';
import { shopSectionOf } from '@utils/categoryNames';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/quick-view.module.css';

const FLY_MS = 460;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const still = () => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Set by the card as it opens the dialog. Safari does not focus a clicked button, so focus cannot be relied on to say where it came from.
let opener = null;
export const quickViewFrom = (el) => { opener = el; };
const cardPhotoOf = (el) => (el instanceof HTMLElement ? el.closest('article')?.querySelector('img') : null);

// A copy of the photograph flown between two boxes above everything, so the dialog and the card never have to share an element.
function fly(src, from, to, onDone) {
  const ghost = document.createElement('img');
  ghost.src = src;
  ghost.alt = '';
  ghost.className = styles.ghost;
  document.body.appendChild(ghost);
  const box = (r, round, pad) => ({
    left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: round, padding: pad,
  });
  const run = ghost.animate([box(from.rect, from.round, from.pad), box(to.rect, to.round, to.pad)], { duration: FLY_MS, easing: EASE, fill: 'forwards' });
  run.onfinish = () => { ghost.remove(); onDone(); };
  return () => { run.cancel(); ghost.remove(); };
}

// Look without leaving the shelf: the product is lifted off its card, and set back down on close.
export function QuickView({ product: card, onClose }) {
  const { add } = useBasket();
  // A browse card carries two photographs and a size count; the full product has every photograph and the sizes. Usually already fetched when the card was hovered.
  const { product: full } = useProduct(card?.slug);
  const product = card && full && full.id === card.id ? full : card;
  const names = useCategoryNames();
  const [added, setAdded] = useState(false);
  const [inBasket, setInBasket] = useState(false);
  const [qty, setQty] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panel = useRef(null);
  const closeBtn = useRef(null);
  const returnTo = useRef(null);
  const origin = useRef(null);
  const cancelFlight = useRef(null);

  const frameOf = () => panel.current?.querySelector('[data-gallery-frame]');

  // Every way out comes through here, so the photograph always goes back to its card.
  const requestClose = useCallback(() => {
    if (leavingRef.current) return;
    const card = origin.current;
    const frame = frameOf();
    if (still() || !card || !frame || !card.isConnected) { closeRef.current(); return; }
    leavingRef.current = true;
    setLeaving(true);
    const img = frame.querySelector('img');
    frame.style.visibility = 'hidden';
    cancelFlight.current?.();
    cancelFlight.current = fly(
      img?.currentSrc || card.currentSrc,
      { rect: frame.getBoundingClientRect(), round: '14px', pad: '16px' },
      { rect: card.getBoundingClientRect(), round: '6px', pad: '0px' },
      () => { card.style.visibility = ''; closeRef.current(); },
    );
  }, []);

  useEffect(() => {
    if (!product) return undefined;
    returnTo.current = opener ?? document.activeElement;
    closeBtn.current?.focus({ preventScroll: true });

    // The viewport scrolls, so it is the viewport that is locked, with its scrollbar space kept so the page does not shift.
    const html = document.documentElement;
    const before = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable';

    function onKey(e) {
      if (e.key === 'Escape') { requestClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = panel.current?.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = before.overflow;
      html.style.scrollbarGutter = before.gutter;
      opener = null;
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus({ preventScroll: true });
    };
  }, [product?.id, requestClose]);

  // Lift the photograph off the card before the first paint, so the card is never seen empty and the dialog never seen without it.
  useLayoutEffect(() => {
    if (!product) return undefined;
    const card = cardPhotoOf(opener ?? document.activeElement);
    origin.current = card;
    const frame = frameOf();
    if (!card || !frame || still()) return undefined;

    const from = card.getBoundingClientRect();
    card.style.visibility = 'hidden';
    frame.style.visibility = 'hidden';
    cancelFlight.current = fly(
      card.currentSrc,
      { rect: from, round: '6px', pad: '0px' },
      { rect: frame.getBoundingClientRect(), round: '14px', pad: '16px' },
      () => { frame.style.visibility = ''; },
    );
    return () => {
      cancelFlight.current?.();
      card.style.visibility = '';
    };
  }, [product?.id]);

  useEffect(() => {
    setQty(1);
    setAdded(false);
    setInBasket(false);
    setLeaving(false);
    leavingRef.current = false;
    if (product?.id) trackQuickView(product);
  }, [product?.id]);

  if (!product) return null;

  const images = Array.isArray(product.images) && product.images.length
    ? product.images.filter(Boolean)
    : [product.image_url].filter(Boolean);

  // A browse card summarises sizes as a count and brings its own buyable flag.
  const hasVariants = (product.variantCount ?? product.variants?.length ?? 0) > 0;
  const buyable = product.buyable ?? anyBuyable(product);
  // The cheapest when there are variants: quick view carries no chooser, so one figure would be wrong for some sizes.
  const from = hasVariants && product.priceFrom !== product.priceTo;
  const price = hasVariants ? product.priceFrom : Number(product.price);
  const saving = !hasVariants && product.compare_at != null ? Number(product.compare_at) - price : 0;
  const returnDays = Number(returnsTerms().days);
  const section = shopSectionOf(product, names);
  const productPath = STORE_ROUTES.PRODUCT.replace(':slug', product.slug);

  function onAdd() {
    if (hasVariants || !buyable) return;
    add(product, qty);
    setAdded(true);
    setInBasket(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className={styles.scrim} data-leaving={leaving || undefined} onClick={requestClose}>
      <div
        className={styles.panel}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qv-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeBtn} type="button" className={styles.close} onClick={requestClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>

        <div className={styles.body}>
          <div className={styles.media}>
            <Gallery images={images} title={product.title} afterFrame={<span className={styles.board} aria-hidden="true" />} />
          </div>

          <div className={styles.detail}>
            {section && <p className={styles.section}>{section}</p>}
            <h2 id="qv-title" className={styles.title}>{product.title}</h2>

            <div className={styles.priceRow}>
              <p className={styles.price}>
                {from && <span className={styles.from}>from</span>}
                <span data-price>{formatGbp(price)}</span>
                {saving > 0 && <span className={styles.was} data-price>{formatGbp(product.compare_at)}</span>}
              </p>
              <StockSignal product={product} />
            </div>

            <div className={styles.buy}>
              {!hasVariants && (
                <div className={styles.qty}>
                  <button type="button" onClick={() => setQty((n) => Math.max(1, n - 1))} disabled={qty === 1} aria-label="One fewer">&minus;</button>
                  <span aria-label={`Quantity ${qty}`}>{qty}</span>
                  <button type="button" onClick={() => setQty((n) => Math.min(20, n + 1))} aria-label="One more">+</button>
                </div>
              )}
              {hasVariants ? (
                // A link, not a dead button: the page has the room for a chooser.
                <Link className={styles.addBtn} to={productPath} onClick={() => closeRef.current()}>
                  <span>Choose a size</span>
                  <ArrowRightIcon size={17} />
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
                  <span aria-live="polite">{!buyable ? 'Out of stock' : added ? 'Added to basket' : 'Add to basket'}</span>
                </button>
              )}
            </div>

            <div className={styles.delivery}>
              <ArrivalTrack product={product} />
              <FreeDeliveryBar pending={inBasket || !buyable || hasVariants ? 0 : price * qty} />
            </div>

            {returnDays > 0 && (
              <p className={styles.returns}>
                <ReturnIcon size={16} />
                {returnDays} {returnDays === 1 ? 'day' : 'days'} to change your mind.
              </p>
            )}

            <Link className={styles.full} to={productPath} onClick={() => closeRef.current()}>
              Full details <ArrowRightIcon size={15} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
