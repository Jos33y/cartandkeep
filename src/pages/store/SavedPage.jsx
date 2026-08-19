import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Head } from '@components/layout/shared/Head';
import { ProductGrid } from '@components/ui/store/ProductGrid';
import { ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { QuickView } from '@components/ui/store/QuickView';
import { ArrowRightIcon } from '@components/ui/store/icons';
import { useSaved } from '@hooks/useSaved';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/saved-page.module.css';

/*
 * Saved items.
 *
 * Kept on the device, not on a server, because there is no account and there
 * is not going to be one. That is worth saying on the page: somebody who saves
 * six things on a phone should know they will not be on the laptop, rather
 * than find out.
 */
export function SavedPage() {
  const { ids } = useSaved();
  const [peek, setPeek] = useState(null);

  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows } = useStoreProducts(tenantId);

  const saved = useMemo(() => {
    const byId = new Map(rows.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [rows, ids]);

  // Anything saved that is no longer in the catalogue. Said out loud rather
  // than quietly dropped, because "I saved six things and now there are five"
  // is worse than being told one sold out.
  const gone = ids.length - saved.length;

  return (
    <section className={styles.page}>
      <Head title="Saved" description="Things you have saved." path="/saved" noindex />

      <header className={styles.head}>
        <h1 className={`${styles.title} wide`}>Saved</h1>
        {ids.length > 0 && (
          <p className={styles.note}>
            Kept on this device. There is no account, so these will not follow
            you to another one.
          </p>
        )}
      </header>

      {status === 'loading' && <ProductGridSkeleton count={4} />}

      {status === 'ready' && saved.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>Nothing saved yet.</p>
          <p className={styles.emptyBody}>
            Tap the heart on anything you want to come back to.
          </p>
          <Link className={styles.emptyCta} to={STORE_ROUTES.HOME}>
            Have a look around <ArrowRightIcon size={16} />
          </Link>
        </div>
      )}

      {status === 'ready' && saved.length > 0 && (
        <>
          <p className={styles.count}>
            {saved.length} {saved.length === 1 ? 'item' : 'items'}
            {gone > 0 && <span className={styles.gone}> &middot; {gone} no longer available</span>}
          </p>
          <ProductGrid products={saved} onQuickView={setPeek} />
        </>
      )}

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}
