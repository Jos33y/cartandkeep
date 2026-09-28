import { useBasket } from '@context/BasketContext';
import { BasketIcon, DeviceIcon, GiftIcon, HeartIcon, HourglassIcon, PriceDownIcon } from '@components/ui/store/icons';
import { priceSince } from '@components/ui/store/SavedRow';
import { imageAt } from '@utils/categories';
import styles from '@styles/ui/store/saved-hero.module.css';

const LOW = 5;
const nearlyGone = (p) => p.availability === 'low_stock' || (Number.isFinite(p.stock) && p.stock > 0 && p.stock <= LOW);
const SHOWN = 4;

/*
 * The top of Saved, and of a shared list.
 *
 * The things themselves, pinned up as photographs, beside a line of facts that
 * each change what somebody does next: how many are already in the basket,
 * which have come down in price, which are nearly gone. A fact with nothing to
 * say is left out rather than shown as nought.
 */
export function SavedHero({ items = [], snapshot = () => null, shared = false, name = '', ready = true }) {
  const { lines } = useBasket();
  const inBasket = new Set(lines.map((l) => l.id));

  const count = items.length;
  const already = items.filter((p) => inBasket.has(p.id)).length;
  const cheaper = shared ? 0 : items.filter((p) => priceSince(p, snapshot(p.id))?.down).length;
  const low = items.filter(nearlyGone).length;
  const photos = items.filter((p) => p.image_url).slice(0, SHOWN);
  const more = count - photos.length;

  function toLink() {
    const box = document.getElementById('send-list');
    if (!box) return;
    box.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    box.querySelector('input')?.focus({ preventScroll: true });
  }

  const title = shared ? (name ? `${name}'s list` : 'A shared list') : 'Saved';

  return (
    <header className={styles.hero} data-shared={shared || undefined}>
      <div className={styles.text}>
        <p className={styles.kicker}>
          {shared ? <><GiftIcon size={16} /> A list from Cart &amp; Keep</> : <><HeartIcon size={16} /> Your keep</>}
        </p>
        <h1 className={`${styles.title} wide`}>{title}</h1>

        {ready && count > 0 && (
          <ul className={styles.facts}>
            <li><HeartIcon size={16} /><span><b>{count}</b> {shared ? (count === 1 ? 'thing on it' : 'things on it') : 'kept'}</span></li>
            {already > 0 && <li data-tone="sage"><BasketIcon size={16} /><span><b>{already}</b> already in your basket</span></li>}
            {cheaper > 0 && <li data-tone="sage"><PriceDownIcon size={16} /><span><b>{cheaper}</b> cheaper since you saved {cheaper === 1 ? 'it' : 'them'}</span></li>}
            {low > 0 && <li data-tone="gold"><HourglassIcon size={16} /><span><b>{low}</b> nearly gone</span></li>}
          </ul>
        )}

        {shared ? (count > 0 || !ready) && (
          <p className={styles.note}>
            {name
              ? `Things ${name} has saved. Buy one for yourself, or send it to ${name} as a gift with no prices in the box.`
              : 'Things somebody saved and sent you. Buy one for yourself, or send it as a gift with no prices in the box.'}
          </p>
        ) : (
          <p className={styles.device}>
            <DeviceIcon size={16} />
            <span>
              Kept on this device only.{' '}
              {count > 0 && <button type="button" className={styles.toLink} onClick={toLink}>Send yourself the link</button>}
              {count > 0 && ' to have it anywhere.'}
            </span>
          </p>
        )}
      </div>

      {ready && photos.length > 0 && (
        <div className={styles.board} aria-hidden="true" data-count={photos.length + (more > 0 ? 1 : 0)}>
          {photos.map((p, i) => (
            <span key={p.id} className={styles.photo} style={{ '--i': i }}>
              <img src={imageAt(p.image_url, 300)} alt="" loading="eager" decoding="async" />
              {inBasket.has(p.id) && <span className={styles.pin} data-tone="sage"><BasketIcon size={12} /></span>}
              {!inBasket.has(p.id) && !shared && priceSince(p, snapshot(p.id))?.down && <span className={styles.pin} data-tone="sage"><PriceDownIcon size={12} /></span>}
            </span>
          ))}
          {more > 0 && <span className={`${styles.photo} ${styles.more}`} style={{ '--i': photos.length }}>+{more}</span>}
        </div>
      )}
    </header>
  );
}
