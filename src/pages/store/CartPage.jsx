import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, CloseIcon, HeartIcon, MinusIcon, PlusIcon } from '@components/ui/store/icons';
import { mostOf, useBasket } from '@context/BasketContext';
import { useQuote } from '@hooks/useQuote';
import { useSaved } from '@hooks/useSaved';
import { deliveryFor, freeOver } from '@lib/storeConfig';
import { AskPanel } from '@components/ui/store/AskPanel';
import { BasketPromises, BasketTotals, basketArrival } from '@components/ui/store/BasketTotals';
import { GapShelf } from '@components/ui/store/GapShelf';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/cart-page.module.css';

/*
 * The basket.
 *
 * Prices on the lines are what was shown when each thing went in, until the
 * checkout function answers with today's; then the lines are corrected, and a
 * line whose price moved shows what it was beside the new figure, rather than
 * in a notice somewhere else on the page.
 */
export function CartPage() {
  const { lines, setQty, remove, subtotal: kept, count } = useBasket();
  const { quote, was } = useQuote(lines);
  const { has: isSaved, toggle: toggleSaved } = useSaved();

  // Out of the basket and onto Saved, so a maybe is kept rather than lost.
  function saveForLater(line) {
    if (!isSaved(line.id)) toggleSaved(line.id);
    remove(line.key);
  }

  // The checkout's figures once they arrive, the basket's own until then.
  const local = deliveryFor(kept);
  const figures = quote
    ? { subtotal: quote.subtotal, delivery: quote.delivery, total: quote.total, toFree: quote.toFree, freeOver: quote.freeOver }
    : { subtotal: kept, delivery: local.cost, total: local.total, toFree: local.toFree, freeOver: freeOver() };
  const gone = new Set((quote?.unavailable ?? []).map((u) => u.key));
  const arrival = quote && !gone.size ? basketArrival(quote.lines) : null;

  // The phone bar stands in for the summary's button until the real one is on screen.
  const button = useRef(null);
  const [buttonSeen, setButtonSeen] = useState(false);
  useEffect(() => {
    const el = button.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setButtonSeen(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [lines.length, gone.size]);

  if (lines.length === 0) {
    return (
      <section className={styles.page}>
        <Head title="Your basket" description="Your basket." path="/cart" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>Your basket is empty</h1>
          <p className={styles.emptyBody}>Anything you add stays here, even if you close the page.</p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.SHOP}>
            Start with everything <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    );
  }

  const checkout = gone.size > 0 ? (
    <span className={styles.checkout} aria-disabled="true" data-disabled>Checkout <ArrowRightIcon size={17} /></span>
  ) : (
    <Link className={styles.checkout} to={STORE_ROUTES.CHECKOUT}>Checkout <ArrowRightIcon size={17} /></Link>
  );

  return (
    <section className={styles.page}>
      <Head title="Your basket" description="Your basket." path="/cart" noindex />

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Your basket</h1>
        <p className={styles.headMeta}>
          <span>{count} {count === 1 ? 'item' : 'items'}</span>
          <Link className={styles.keep} to={STORE_ROUTES.SHOP}>Keep shopping</Link>
        </p>
      </header>

      {/* Four siblings on one grid: phones read lines, total, then the extras; wider screens keep the total in its own column. */}
      <div className={styles.body}>
          <ul className={styles.lines}>
            {lines.map((line) => {
              const image = imageAt(line.image_url, 300);
              const off = gone.has(line.key);
              const before = was[line.key];
              // The variant is part of the name everywhere, including what a screen reader announces.
              const name = line.variantLabel ? `${line.title}, ${line.variantLabel}` : line.title;
              const path = STORE_ROUTES.PRODUCT.replace(':slug', line.slug);
              return (
                <li className={styles.line} key={line.key} data-gone={off || undefined}>
                  <Link className={styles.thumb} to={path} tabIndex={-1} aria-hidden="true">
                    {image ? <img src={image} alt="" loading="lazy" /> : <span className={styles.noImage} />}
                  </Link>

                  <div className={styles.lineMain}>
                    <Link className={styles.lineTitle} to={path}>{line.title}</Link>
                    {line.variantLabel && <p className={styles.variant}>{line.variantLabel}</p>}
                    {off && <p className={styles.goneNote}>No longer on sale. Remove it to carry on.</p>}
                    {!off && line.qty > 1 && <p className={styles.unit} data-price>{formatGbp(line.price)} each</p>}

                    <div className={styles.lineFoot}>
                      {!off && (
                        <div className={styles.qty}>
                          <button
                            type="button"
                            onClick={() => setQty(line.key, line.qty - 1)}
                            aria-label={line.qty === 1 ? `Remove ${name}` : `One fewer ${name}`}
                          >
                            <MinusIcon size={15} />
                          </button>
                          <span data-price aria-live="polite">{line.qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(line.key, line.qty + 1)}
                            disabled={line.qty >= mostOf(line.stock)}
                            aria-label={`One more ${name}`}
                          >
                            <PlusIcon size={15} />
                          </button>
                        </div>
                      )}
                      {!off && (
                        <button type="button" className={styles.remove} data-save onClick={() => saveForLater(line)} aria-label={`Save ${name} for later`}>
                          <HeartIcon size={14} /> Save for later
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.remove}
                        data-strong={off || undefined}
                        onClick={() => remove(line.key)}
                        aria-label={`Remove ${name} from your basket`}
                      >
                        <CloseIcon size={14} /> Remove
                      </button>
                    </div>
                  </div>

                  <div className={styles.lineMoney}>
                    {!off && <p className={styles.lineTotal} data-price>{formatGbp(line.price * line.qty)}</p>}
                    {!off && before !== undefined && (
                      <p className={styles.was}>
                        <span className={styles.wasLabel}>{line.price > before ? 'Was' : 'Down from'}</span>{' '}
                        <s data-price>{formatGbp(before * line.qty)}</s>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

        <div className={styles.shelf}>
          <GapShelf gap={gone.size ? 0 : figures.toFree} />
        </div>

        {/* Under the lines it is about, and quiet: one line until somebody wants to ask. */}
        <div className={styles.ask}>
          <AskPanel basket={lines} quiet />
        </div>

        <aside className={styles.summary} aria-label="Order total">
          <BasketTotals {...figures} arrival={arrival} />
          <div ref={button}>{checkout}</div>
          {gone.size > 0 && (
            <p className={styles.held}>
              {gone.size === 1 ? 'One thing is' : `${gone.size} things are`} no longer on sale. Remove {gone.size === 1 ? 'it' : 'them'} to check out.
            </p>
          )}
          <BasketPromises />
        </aside>
      </div>

      {/* Phones only: the total and the way forward, until the summary's own button scrolls into view. */}
      <div className={styles.bar} data-hidden={buttonSeen || undefined} aria-hidden={buttonSeen || undefined}>
        <p className={styles.barTotal}>
          <span>To pay</span>
          <strong data-price>{formatGbp(figures.total)}</strong>
        </p>
        {checkout}
      </div>
    </section>
  );
}
