import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ArrowRightIcon, CloseIcon, LockIcon, MinusIcon, PlusIcon, ReturnIcon, VanIcon } from '@components/ui/store/icons';
import { useBasket } from '@context/BasketContext';
import { imageAt } from '@utils/categories';
import { formatGbp } from '@utils/formatGbp';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/cart-page.module.css';

const FREE_OVER = 40;
const POSTAGE = 3.95;
const MAX_QTY = 20;

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
  const { lines, setQty, remove, subtotal, count } = useBasket();

  const free = subtotal >= FREE_OVER;
  const delivery = free ? 0 : POSTAGE;
  const toFree = Math.max(0, FREE_OVER - subtotal);
  const total = subtotal + delivery;

  if (lines.length === 0) {
    return (
      <section className={styles.page}>
        <Head title="Your basket" description="Your basket." path="/cart" noindex />
        <div className={styles.empty}>
          <h1 className={`${styles.emptyTitle} wide`}>Your basket is empty</h1>
          <p className={styles.emptyBody}>
            Eight departments and seventy eight products, so there is probably
            something in there you were going to need anyway.
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
              <li className={styles.line} key={line.key}>
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
                  <p className={styles.unit} data-price>{formatGbp(line.price)} each</p>

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
                        onClick={() => setQty(line.key, Math.min(MAX_QTY, line.qty + 1))}
                        disabled={line.qty >= MAX_QTY}
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

                <p className={styles.lineTotal} data-price>{formatGbp(line.price * line.qty)}</p>
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

          <Link className={styles.checkout} to={STORE_ROUTES.CHECKOUT}>
            Checkout <ArrowRightIcon size={17} />
          </Link>

          <Link className={styles.keep} to={STORE_ROUTES.SHOP}>Keep shopping</Link>

          <ul className={styles.reassure}>
            <li><LockIcon size={17} /><span>No account needed</span></li>
            <li><ReturnIcon size={17} /><span>30 days to change your mind</span></li>
            <li><VanIcon size={17} /><span>Free UK delivery over {formatGbp(FREE_OVER)}</span></li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
