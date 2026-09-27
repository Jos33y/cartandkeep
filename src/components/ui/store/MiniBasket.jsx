import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon, CheckIcon, CloseIcon, MinusIcon, PlusIcon } from '@components/ui/store/icons';
import { mostOf, useBasket } from '@context/BasketContext';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import { freeOver } from '@lib/storeConfig';
import styles from '@styles/ui/store/mini-basket.module.css';

/*
 * The moment something goes in.
 *
 * The thing just added is the whole of the top: its photograph, its name said
 * once, its size and its own count. Everything else already in the basket is a
 * quiet row of thumbnails underneath, because this is a confirmation and not
 * the basket page.
 *
 * It never navigates on its own and never dims the page. It closes itself after
 * a few seconds, but not while a pointer or keyboard is on it, because a panel
 * that vanishes under somebody's finger is worse than one that stays.
 */
const AUTO_CLOSE = 6000;

export function MiniBasket() {
  const { lines, lastAdded, dismissAdded, setQty, subtotal, count } = useBasket();
  const panel = useRef(null);
  const returnTo = useRef(null);
  const [held, setHeld] = useState(false);

  const open = Boolean(lastAdded) && lines.length > 0;

  useEffect(() => {
    if (!open || held) return undefined;
    const t = setTimeout(dismissAdded, AUTO_CLOSE);
    return () => clearTimeout(t);
    // `lastAdded.at`, so adding a second thing restarts the clock instead of the panel vanishing mid-read.
  }, [open, held, lastAdded?.at, dismissAdded]);

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    function onKey(e) { if (e.key === 'Escape') dismissAdded(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      setHeld(false);
      // Focus goes back to whatever opened it, rather than the top of the document.
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
    };
  }, [open, dismissAdded]);

  if (!open) return null;

  const line = lines.find((l) => l.key === lastAdded.key) ?? lines[lines.length - 1];
  const others = lines.filter((l) => l.key !== line.key).reverse();
  const threshold = freeOver();
  const toFree = Math.max(0, threshold - subtotal);
  const share = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100;
  const name = line.variantLabel ? `${line.title}, ${line.variantLabel}` : line.title;

  return (
    <div
      className={styles.panel}
      ref={panel}
      role="dialog"
      aria-label="Added to your basket"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
    >
      <button type="button" className={styles.close} onClick={dismissAdded} aria-label="Close">
        <CloseIcon size={16} />
      </button>

      <div className={styles.hero}>
        <span className={styles.photo}>
          {line.image_url && <img src={imageAt(line.image_url, 300)} alt="" />}
          <span className={styles.tick} aria-hidden="true"><CheckIcon size={13} /></span>
        </span>
        <div className={styles.heroText}>
          <p className={styles.added} aria-live="polite">Added to your basket</p>
          <p className={styles.title}>{line.title}</p>
          {line.variantLabel && <p className={styles.variant}>{line.variantLabel}</p>}
          <div className={styles.heroFoot}>
            <span className={styles.qty}>
              <button type="button" onClick={() => setQty(line.key, line.qty - 1)} aria-label={line.qty === 1 ? `Remove ${name}` : `One fewer ${name}`}>
                <MinusIcon size={13} />
              </button>
              <span data-price>{line.qty}</span>
              <button type="button" onClick={() => setQty(line.key, line.qty + 1)} disabled={line.qty >= mostOf(line.stock)} aria-label={`One more ${name}`}>
                <PlusIcon size={13} />
              </button>
            </span>
            <span className={styles.linePrice} data-price>{formatGbp(line.price * line.qty)}</span>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className={styles.others}>
          <span className={styles.othersLabel}>Also in your basket</span>
          <span className={styles.stack}>
            {others.slice(0, 5).map((o) => (
              <span key={o.key} className={styles.mini} title={o.title}>
                {o.image_url && <img src={imageAt(o.image_url, 300)} alt="" loading="lazy" />}
              </span>
            ))}
            {others.length > 5 && <span className={styles.plus} data-price>+{others.length - 5}</span>}
          </span>
        </div>
      )}

      {threshold > 0 && (
        <div className={styles.shelf}>
          <span className={styles.track} aria-hidden="true"><span style={{ width: `${Math.max(4, share)}%` }} /></span>
          <span className={styles.shelfWords}>
            {toFree > 0
              ? <><span data-price>{formatGbp(toFree)}</span> from free delivery</>
              : <><CheckIcon size={13} />Delivery is free</>}
          </span>
        </div>
      )}

      <div className={styles.foot}>
        <p className={styles.subtotal}>
          <span>{count} {count === 1 ? 'item' : 'items'}</span>
          <span data-price>{formatGbp(subtotal)}</span>
        </p>
        <Link className={styles.checkout} to={STORE_ROUTES.CHECKOUT} onClick={dismissAdded}>
          Checkout <ArrowRightIcon size={16} />
        </Link>
        <Link className={styles.viewBasket} to={STORE_ROUTES.CART} onClick={dismissAdded}>View basket</Link>
      </div>
    </div>
  );
}
