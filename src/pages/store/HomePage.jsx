import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@components/layout/shared/Head';
import { StoreHero } from '@components/ui/store/StoreHero';
import { Shelf } from '@components/ui/store/Shelf';
import { ProductGridSkeleton } from '@components/ui/store/Skeleton';
import { OfflineNotice } from '@components/ui/store/OfflineNotice';
import { PromiseBand } from '@components/ui/store/PromiseBand';
import { QuickView } from '@components/ui/store/QuickView';
import { useBrowse, useGroups } from '@hooks/useStoreCatalogue';
import { visibleGroups } from '@utils/categories';
import styles from '@styles/pages/store/home-page.module.css';

const LEFTOVER = 'Everything else';

// Shelves below the first two mount as they come near the screen, so a long catalogue does not draw every card at once.
const SHELF_SIZE = 8;

// One shelf's first eight cards, fetched only once the shelf is near the screen.
function LoadedShelf({ group, onQuickView }) {
  const { items, status } = useBrowse({ keys: group.keys }, { limit: SHELF_SIZE });
  if (status === 'loading' && items.length === 0) return <div className={styles.shelfHold} aria-hidden="true" />;
  if (items.length === 0) return null;
  return <Shelf group={{ ...group, items }} onQuickView={onQuickView} />;
}

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
      {near ? <LoadedShelf group={group} onQuickView={onQuickView} /> : <div className={styles.shelfHold} aria-hidden="true" />}
    </div>
  );
}

export function HomePage() {
  // Sections and counts from the database; each shelf then fetches its own first eight. Only live products, whoever is signed in.
  const { status, groups: all, total, error } = useGroups();
  const [peek, setPeek] = useState(null);

  const groups = useMemo(() => {
    const shown = visibleGroups(all);
    // With no sections yet, the leftover bucket is the whole shop and should say so.
    return shown.length === 1 && shown[0].path === LEFTOVER ? [{ ...shown[0], name: 'Everything in the shop' }] : shown;
  }, [all]);


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

  if (total === 0) {
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
      <Head description="A general store for the house, one basket, delivered from the UK. No account needed to buy." path="/" />
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
