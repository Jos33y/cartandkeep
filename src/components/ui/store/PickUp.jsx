import { Link } from 'react-router';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { ArrowRightIcon, ClockIcon, HeartIcon } from '@components/ui/store/icons';
import { useSaved } from '@hooks/useSaved';
import { useRecentlyViewed } from '@hooks/useRecentlyViewed';
import { useCards } from '@hooks/useStoreCatalogue';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/pick-up.module.css';

const SHOW = 4;

/*
 * Where somebody left off: what they saved, then what they looked at.
 *
 * Under an empty basket or an empty Saved, so the page offers their own
 * things back before it offers the whole shop. Each list only appears when it
 * has something in it, and nothing shows twice.
 */
export function PickUp({ withSaved = true, onQuickView }) {
  const { ids: savedIds } = useSaved();
  const { ids: seenIds, off } = useRecentlyViewed();
  const savedFirst = withSaved ? savedIds.slice(0, SHOW) : [];
  const seenOnly = off ? [] : seenIds.filter((id) => !savedFirst.includes(id)).slice(0, SHOW);
  const { items: saved } = useCards(savedFirst);
  const { items: seen } = useCards(seenOnly);

  if (!saved.length && !seen.length) return null;

  return (
    <div className={styles.wrap}>
      {saved.length > 0 && (
        <section aria-labelledby="pickup-saved">
          <div className={styles.head}>
            <h2 id="pickup-saved" className={styles.title}><HeartIcon size={18} data-fill /> From your Saved</h2>
            {savedIds.length > saved.length && (
              <Link className={styles.more} to={STORE_ROUTES.SAVED}>All {savedIds.length} saved <ArrowRightIcon size={14} /></Link>
            )}
          </div>
          <ProductGrid products={saved} onQuickView={onQuickView} />
        </section>
      )}
      {seen.length > 0 && (
        <section aria-labelledby="pickup-seen">
          <div className={styles.head}>
            <h2 id="pickup-seen" className={styles.title}><ClockIcon size={18} /> You looked at these recently</h2>
          </div>
          <ProductGrid products={seen} onQuickView={onQuickView} />
        </section>
      )}
    </div>
  );
}
