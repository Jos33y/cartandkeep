import { useEffect, useMemo, useRef, useState } from 'react';
import { StoreHero } from '@components/ui/store/StoreHero';
import { Shelf } from '@components/ui/store/Shelf';
import { ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { OfflineNotice } from '@components/ui/store/OfflineNotice';
import { PromiseBand } from '@components/ui/store/PromiseBand';
import { QuickView } from '@components/ui/store/QuickView';
import { useStoreProducts } from '@hooks/useStoreProducts';
import { useTenant } from '@hooks/useTenant';
import { useCategoryNames } from '@hooks/useCategoryNamesStore';
import { groupCategories, visibleGroups } from '@utils/categories';
import styles from '@styles/pages/store/home-page.module.css';

const LEFTOVER = 'Everything else';

// Shelves below the first two mount as they come near the screen, so a long catalogue does not draw every card at once.
function LazyShelf({ group, onQuickView, eager }) {
  const ref = useRef(null);
  const [near, setNear] = useState(eager);

  useEffect(() => {
    if (near || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setNear(true); }, { rootMargin: '600px 0px' });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);

  return (
    <div ref={ref} className={styles.shelfSlot}>
      {near ? <Shelf group={group} onQuickView={onQuickView} /> : <div className={styles.shelfHold} aria-hidden="true" />}
    </div>
  );
}

export function HomePage() {
  const tenant = useTenant();
  const tenantId = tenant === undefined ? undefined : (tenant?.id ?? null);
  const { status, rows, error } = useStoreProducts(tenantId);
  const [peek, setPeek] = useState(null);
  const names = useCategoryNames();

  const groups = useMemo(() => {
    const all = visibleGroups(groupCategories(rows, { names }));
    // With no sections yet, the leftover bucket is the whole shop and should say so.
    return all.length === 1 && all[0].path === LEFTOVER ? [{ ...all[0], name: 'Everything in the shop' }] : all;
  }, [rows, names]);


  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}><ProductGridSkeleton /></div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <OfflineNotice>
            <h1 className={`${styles.plainTitle} wide`}>The shop did not load</h1>
            <p className={styles.notice}>Refresh the page, and if it keeps happening the problem is at our end rather than yours.</p>
            {error?.message && <p className={styles.noticeDetail}>{error.message}</p>}
          </OfflineNotice>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={`${styles.plainTitle} wide`}>Nothing is on sale yet</h1>
          <p className={styles.notice}>Products appear here as soon as they go live.</p>
        </div>
      </div>
    );
  }

  const sectioned = groups.length > 1;

  return (
    <div className={styles.page}>
      <StoreHero groups={groups} />

      <div className={styles.wrap}>
        {sectioned && (
          <div className={styles.shelvesHead}>
            <h2 className={`${styles.heading} wide`}>Browse the shelves</h2>
          </div>
        )}
        <div className={styles.shelves} data-single={!sectioned || undefined}>
          {groups.map((group, i) => (
            <LazyShelf key={group.slug} group={group} onQuickView={setPeek} eager={i < 2} />
          ))}
        </div>
      </div>

      <PromiseBand />

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </div>
  );
}
