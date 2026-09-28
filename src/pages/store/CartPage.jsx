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
  const { lines, setQty, remove, restore, subtotal: kept, count } = useBasket();
  const { quote, was } = useQuote(lines);
  // The same heart as everywhere else in the shop: it saves, and never touches the basket.
  const { has: isSaved, toggle: toggleSaved } = useSaved();

  /*
   * Removed lines, kept for this visit so a mis-tap can be undone.
   *
   * Each one holds the line as it was and where it sat, and shows in that spot
   * as a single "Removed. Undo" row. Taking the last one to nought with the
   * minus button counts as a removal too, since it is one.
   */
  const [removed, setRemoved] = useState([]);
  function takeOut(line) {
    const index = lines.findIndex((l) => l.key === line.key);
    setRemoved((r) => [...r.filter((x) => x.line.key !== line.key), { line, index }]);
    remove(line.key);
  }
  function undo(entry) {
    restore(entry.line, entry.index);
    setRemoved((r) => r.filter((x) => x.line.key !== entry.line.key));
  }
  // A line that came back another way (added again from a card) no longer needs its Undo row.
  const shown = removed.filter((x) => !lines.some((l) => l.key === x.line.key));

  // Lines and Undo rows in one list, each Undo row where its line was.
  const rows = lines.map((line) => ({ line }));
  [...shown].sort((a, b) => a.index - b.index).forEach((entry) => {
    rows.splice(Math.min(entry.index, rows.length), 0, { undo: entry });
  });

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
    const last = shown[shown.length - 1];
    return (
      <section className={styles.page}>
        <Head title="Your basket" description="Your basket." path="/cart" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>Your basket is empty</h1>
          {last ? (
            <p className={styles.emptyBody} role="status">
              You removed {last.line.title}.{' '}
              <button type="button" className={styles.undo} onClick={() => undo(last)}>Undo</button>
            </p>
          ) : (
            <p className={styles.emptyBody}>Anything you add stays here, even if you close the page.</p>
          )}
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
            {rows.map(({ line, undo: entry }) => {
              if (entry) {
                return (
                  <li className={styles.undoRow} key={`undo:${entry.line.key}`} role="status">
                    <span className={styles.undoText}>Removed <strong>{entry.line.title}</strong></span>
                    <button type="button" className={styles.undo} onClick={() => undo(entry)}>Undo</button>
                  </li>
                );
              }
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
                            onClick={() => (line.qty === 1 ? takeOut(line) : setQty(line.key, line.qty - 1))}
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
                        <button
                          type="button"
                          className={styles.remove}
                          data-save
                          aria-pressed={isSaved(line.id)}
                          onClick={() => toggleSaved(line.id, line)}
                          aria-label={isSaved(line.id) ? `${name} is saved. Remove from saved` : `Save ${name}`}
                        >
                          <HeartIcon size={14} /> {isSaved(line.id) ? 'Saved' : 'Save'}
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.remove}
                        data-strong={off || undefined}
                        onClick={() => takeOut(line)}
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

        {/* One area for both, so an empty shelf leaves no gap of its own behind. */}
        <div className={styles.extras}>
          <div className={styles.shelf}>
            <GapShelf gap={gone.size ? 0 : figures.toFree} />
          </div>

          {/* Under the lines it is about, and quiet: one line until somebody wants to ask. */}
          <div className={styles.ask}>
            <AskPanel basket={lines} quiet />
          </div>
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
