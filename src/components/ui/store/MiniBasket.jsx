import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowRightIcon, CloseIcon, MinusIcon, PlusIcon, VanIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/mini-basket.module.css';

const FREE_OVER = 40;
const MAX_QTY = 20;

/*
 * Opens when something is added.
 *
 * Adding to the basket used to change a button for 1.6 seconds and increment a
 * number in the corner. Somebody who adds three things across three pages has
 * no idea what is in there without leaving the page they are shopping, and a
 * basket a shopper is not sure about is a basket they abandon.
 *
 * It is a panel, not a page, and it never navigates on its own. Being thrown
 * to a basket page after every add is the other way to get this wrong, and it
 * is worse: it ends the browsing.
 *
 * It closes itself after a while, because a panel that sits over the grid
 * until dismissed is a panel that has to be dismissed.
 */
const AUTO_CLOSE = 6000;

export function MiniBasket() {
  const { lines, lastAdded, dismissAdded, setQty, subtotal, count } = useBasket();
  const panel = useRef(null);
  const closeBtn = useRef(null);
  const returnTo = useRef(null);

  const open = Boolean(lastAdded) && lines.length > 0;

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(dismissAdded, AUTO_CLOSE);
    return () => clearTimeout(t);
    // `lastAdded.at` rather than `open`, so adding a second thing restarts the
    // clock instead of the panel vanishing mid-read.
  }, [open, lastAdded?.at, dismissAdded]);

  useEffect(() => {
    if (!open) return undefined;

    returnTo.current = document.activeElement;

    function onKey(e) {
      if (e.key === 'Escape') dismissAdded();
    }
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      // Focus goes back to the card that opened it. Anything else drops a
      // keyboard user at the top of the document.
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
    };
  }, [open, dismissAdded]);

  if (!open) return null;

  const toFree = Math.max(0, FREE_OVER - subtotal);
  // Newest first: the thing just added is what somebody is checking.
  const ordered = [...lines].reverse();

  return (
    <>
      {/* Not a scrim over the page. This is a confirmation, not a decision,
          and dimming the grid behind it says "stop what you were doing". */}
      <div className={styles.panel} ref={panel} role="dialog" aria-label="Added to basket">
        <header className={styles.head}>
          <p className={styles.added}>
            Added <strong>{lastAdded.title}</strong>
          </p>
          <button ref={closeBtn} type="button" className={styles.close} onClick={dismissAdded} aria-label="Close">
            <CloseIcon size={17} />
          </button>
        </header>

        <ul className={styles.lines}>
          {ordered.slice(0, 4).map((line) => (
            <li key={line.id} data-new={line.id === lastAdded.id || undefined}>
              <span className={styles.thumb}>
                {line.image_url && <img src={imageAt(line.image_url, 300)} alt="" loading="lazy" />}
              </span>
              <span className={styles.lineMain}>
                <span className={styles.lineTitle}>{line.title}</span>
                <span className={styles.qty}>
                  <button
                    type="button"
                    onClick={() => setQty(line.id, line.qty - 1)}
                    aria-label={line.qty === 1 ? `Remove ${line.title}` : `One fewer ${line.title}`}
                  >
                    <MinusIcon size={13} />
                  </button>
                  <span data-price>{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(line.id, Math.min(MAX_QTY, line.qty + 1))}
                    disabled={line.qty >= MAX_QTY}
                    aria-label={`One more ${line.title}`}
                  >
                    <PlusIcon size={13} />
                  </button>
                </span>
              </span>
              <span className={styles.lineTotal} data-price>{formatGbp(line.price * line.qty)}</span>
            </li>
          ))}
        </ul>

        {lines.length > 4 && (
          <p className={styles.more}>and {lines.length - 4} more in your basket</p>
        )}

        {/* The one number worth a nudge here, on the screen where somebody is
            still browsing and can act on it. */}
        {toFree > 0 && (
          <p className={styles.nudge}>
            <VanIcon size={16} />
            <span data-price>{formatGbp(toFree)}</span> more and delivery is free
          </p>
        )}

        <footer className={styles.foot}>
          <p className={styles.subtotal}>
            <span>Subtotal, {count} {count === 1 ? 'item' : 'items'}</span>
            <span data-price>{formatGbp(subtotal)}</span>
          </p>

          <div className={styles.actions}>
            <Link className={styles.checkout} to={STORE_ROUTES.CHECKOUT} onClick={dismissAdded}>
              Checkout <ArrowRightIcon size={16} />
            </Link>
            <Link className={styles.viewBasket} to={STORE_ROUTES.CART} onClick={dismissAdded}>
              View basket
            </Link>
          </div>

          <button type="button" className={styles.keep} onClick={dismissAdded}>
            Keep shopping
          </button>
        </footer>
      </div>
    </>
  );
}
