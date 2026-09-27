import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, CloseIcon, LockIcon, MinusIcon, PlusIcon, ReturnIcon, VanIcon } from '@components/ui/store/icons';
import { mostOf, useBasket } from '@context/BasketContext';
import { useQuote } from '@hooks/useQuote';
import { deliveryFor, freeOver, returnsTerms } from '@lib/storeConfig';
import { AskPanel } from '@components/ui/store/AskPanel';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/cart-page.module.css';

/*
 * The basket.
 *
 * It was a seven line stub while the header counted items and every product
 * card added to it, which is the worst possible combination: the shop taught
 * people to use a thing that did not exist.
 *
 * Prices come from the line, not from the catalogue. A basket stores what was
 * shown when the item went in, so a price that changes while somebody is
 * shopping does not silently change what they thought they were buying.
 * Checkout reconciles against the live row, which is the right place for that
 * argument to happen.
 */
export function CartPage() {
  const { lines, setQty, remove, subtotal: kept, count } = useBasket();
  const { quote, changed } = useQuote(lines);

  // The checkout's figures once they arrive, the basket's own until then.
  const local = deliveryFor(kept);
  const subtotal = quote ? quote.subtotal : kept;
  const delivery = quote ? quote.delivery : local.cost;
  const toFree = quote ? quote.toFree : local.toFree;
  const total = quote ? quote.total : local.total;
  const free = delivery === 0;
  const gone = new Set((quote?.unavailable ?? []).map((u) => u.key));
  const days = Number(returnsTerms().days);

  if (lines.length === 0) {
    return (
      <section className={styles.page}>
        <Head title="Your basket" description="Your basket." path="/cart" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>Your basket is empty</h1>
          <p className={styles.emptyBody}>
            Anything you add stays here, even if you close the page.
          </p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.SHOP}>
            Start with everything <ArrowRightIcon size={16} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      {/* A basket is nobody's search result. */}
      <Head title="Your basket" description="Your basket." path="/cart" noindex />

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Your basket</h1>
        <p className={styles.count}>{count} {count === 1 ? 'item' : 'items'}</p>
      </header>

      <div className={styles.body}>
        <ul className={styles.lines}>
          {lines.map((line) => {
            const image = imageAt(line.image_url, 300);
            /*
             * The variant is part of the name everywhere, including in the
             * labels a screen reader announces. "Remove Bed Sheet" on a basket
             * holding two sizes of it does not say which one goes.
             */
            const name = line.variantLabel ? `${line.title}, ${line.variantLabel}` : line.title;
            return (
              // Keyed on the line, not the product. Two sizes of one thing are
              // two rows, and a duplicate React key would make them share state.
              <li className={styles.line} key={line.key} data-gone={gone.has(line.key) || undefined}>
                <Link className={styles.thumb} to={STORE_ROUTES.PRODUCT.replace(':slug', line.slug)}>
                  {image
                    ? <img src={image} alt="" loading="lazy" />
                    : <span className={styles.noImage}>No photograph</span>}
                </Link>

                <div className={styles.lineMain}>
                  <Link className={styles.lineTitle} to={STORE_ROUTES.PRODUCT.replace(':slug', line.slug)}>
                    {line.title}
                  </Link>
                  {/* Under the title rather than joined to it, so a long feed
                      title does not push the size onto a line of its own where
                      it reads as a separate product. */}
                  {line.variantLabel && (
                    <p className={styles.variant}>{line.variantLabel}</p>
                  )}
                  {gone.has(line.key)
                    ? <p className={styles.goneNote}>No longer on sale</p>
                    : <p className={styles.unit} data-price>{formatGbp(line.price)} each</p>}

                  <div className={styles.lineFoot}>
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
                        disabled={gone.has(line.key) || line.qty >= mostOf(line.stock)}
                        aria-label={`One more ${name}`}
                      >
                        <PlusIcon size={15} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => remove(line.key)}
                      aria-label={`Remove ${name} from your basket`}
                    >
                      <CloseIcon size={15} /> Remove
                    </button>
                  </div>
                </div>

                <p className={styles.lineTotal} data-price>{gone.has(line.key) ? '' : formatGbp(line.price * line.qty)}</p>
              </li>
            );
          })}
        </ul>

        <aside className={styles.summary}>
          <h2 className={styles.summaryHead}>Total</h2>

          <dl className={styles.figures}>
            <div>
              <dt>Subtotal</dt>
              <dd data-price>{formatGbp(subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd data-price>{free ? 'Free' : formatGbp(delivery)}</dd>
            </div>
            <div className={styles.grand}>
              <dt>To pay</dt>
              <dd data-price>{formatGbp(total)}</dd>
            </div>
          </dl>

          {/* The single most useful thing on this page. Somebody £4 short of
              free delivery will nearly always rather spend it on a product
              than on postage, and nobody can act on that if it is not said. */}
          {!free && (
            <div className={styles.nudge}>
              <p>
                <span data-price>{formatGbp(toFree)}</span> more and delivery is free.
              </p>
              <Link to={STORE_ROUTES.SHOP}>Find something to add</Link>
            </div>
          )}

          {changed.length > 0 && (
            <p className={styles.notice}>
              {changed.length === 1 ? `The price of ${changed[0]} has changed` : 'Some prices have changed'} since
              you added it. The total above is what you will pay.
            </p>
          )}

          {gone.size > 0 ? (
            <>
              <p className={styles.notice}>
                {gone.size === 1 ? 'One thing' : `${gone.size} things`} in your basket {gone.size === 1 ? 'is' : 'are'} no
                longer on sale. Remove {gone.size === 1 ? 'it' : 'them'} to carry on.
              </p>
              <span className={styles.checkout} aria-disabled="true" data-disabled>
                Checkout <ArrowRightIcon size={17} />
              </span>
            </>
          ) : (
            <Link className={styles.checkout} to={STORE_ROUTES.CHECKOUT}>
              Checkout <ArrowRightIcon size={17} />
            </Link>
          )}

          <Link className={styles.keep} to={STORE_ROUTES.SHOP}>Keep shopping</Link>

          <ul className={styles.reassure}>
            <li><LockIcon size={17} /><span>No account needed</span></li>
            {days > 0 && <li><ReturnIcon size={17} /><span>{days} {days === 1 ? 'day' : 'days'} to change your mind</span></li>}
            <li><VanIcon size={17} /><span>Free UK delivery over {formatGbp(freeOver())}</span></li>
          </ul>
        </aside>
      </div>

      {/* After the total, not beside it.
          A question about a basket is asked once somebody has seen what it
          comes to, and on a phone the summary stacks under the lines anyway,
          so anything above it arrives before the number that prompts the
          question. Full width rather than in the sticky column, which already
          carries the one action on this page. */}
      <div className={styles.ask}>
        <AskPanel basket={lines} />
      </div>
    </section>
  );
}
