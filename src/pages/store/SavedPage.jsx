import { useEffect, useState } from 'react';
import { Head } from '@components/layout/shared/Head';
import { QuickView } from '@components/ui/store/QuickView';
import { SavedRow } from '@components/ui/store/SavedRow';
import { SavedPanel } from '@components/ui/store/SavedPanel';
import { SavedHero } from '@components/ui/store/SavedHero';
import { EmptyHero } from '@components/ui/store/EmptyHero';
import { PickUp } from '@components/ui/store/PickUp';
import { CloseIcon, HeartIcon } from '@components/ui/store/icons';
import { imageAt } from '@utils/categories';
import { useSaved } from '@hooks/useSaved';
import { useCards } from '@hooks/useStoreCatalogue';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/pages/store/saved-page.module.css';

/*
 * Saved items.
 *
 * Kept on the device, not on a server, because there is no account and there
 * is not going to be one. That is worth saying on the page, and the link in
 * the panel is the answer to it: the list goes to another device, or to
 * another person, without anybody signing up for anything.
 *
 * Rows rather than the shop's grid. By the time something is here the
 * browsing is done and the deciding has started, and a row has room for what
 * changes a decision: the price since it was saved, how many are left, whether
 * it is already in the basket.
 */
export function SavedPage() {
  const { ids, has, snapshot, remove, removeMany, toggle, restore } = useSaved();
  const [peek, setPeek] = useState(null);

  // Only the saved products are fetched, live ones only, in the order they were saved.
  const { status, items } = useCards(ids);
  const ready = status === 'ready';
  // A refetch follows every unsave; until it lands, what was just taken off stays off.
  const saved = items.filter((p) => has(p.id));

  /*
   * Anything saved that is no longer sold.
   *
   * One saved with its name stays, greyed, because she may put it back.
   * One saved before names were kept has nothing to show but a number, and a
   * number nobody can act on is a dead end, so it is cleared once and the page
   * says so.
   */
  const live = new Set(items.map((p) => p.id));
  const missing = ready ? ids.filter((id) => !live.has(id)) : [];
  const named = missing.map((id) => ({ id, ...snapshot(id) })).filter((g) => g.title);
  const nameless = missing.filter((id) => !snapshot(id));

  // A set, so StrictMode running the effect twice still counts each one once.
  const [clearedIds, setClearedIds] = useState(() => new Set());
  const cleared = clearedIds.size;
  const namelessKey = nameless.join(',');
  useEffect(() => {
    if (!namelessKey) return;
    const drop = namelessKey.split(',');
    removeMany(drop);
    setClearedIds((prev) => new Set([...prev, ...drop]));
  }, [namelessKey, removeMany]);

  // Taken off with the heart, kept for the visit so it can be put back where it was.
  const [unsaved, setUnsaved] = useState([]);
  function unsave(product) {
    const index = ids.indexOf(product.id);
    const snap = snapshot(product.id);
    setUnsaved((u) => [...u.filter((x) => x.product.id !== product.id), { product, index, snap }]);
    toggle(product.id);
  }
  function undo(entry) {
    restore(entry.product.id, entry.index, entry.snap);
    setUnsaved((u) => u.filter((x) => x.product.id !== entry.product.id));
  }
  const pending = unsaved.filter((x) => !has(x.product.id));

  const rows = saved.map((product) => ({ product }));
  [...pending].sort((a, b) => a.index - b.index).forEach((entry) => {
    rows.splice(Math.min(entry.index, rows.length), 0, { undo: entry });
  });


  return (
    <section className={styles.page}>
      <Head title="Saved" description="Things you have saved." path="/saved" noindex />

      {(saved.length > 0 || pending.length > 0 || (status === 'loading' && ids.length > 0)) && (
        <SavedHero items={saved} snapshot={snapshot} ready={ready} />
      )}

      {cleared > 0 && (
        <p className={styles.cleared} role="status">
          {cleared === 1 ? 'One thing you saved is' : `${cleared} things you saved are`} no longer sold, so {cleared === 1 ? 'it has' : 'they have'} been cleared.
        </p>
      )}

      {status === 'loading' && ids.length > 0 && <RowsSkeleton count={Math.min(ids.length, 4)} />}

      {(ready || ids.length === 0) && saved.length === 0 && pending.length === 0 && <EmptySaved onQuickView={setPeek} />}

      {ready && (saved.length > 0 || pending.length > 0) && (
        <div className={styles.body}>
          <ul className={styles.rows}>
            {rows.map(({ product, undo: entry }) => (entry ? (
              <li className={styles.undoRow} key={`undo:${entry.product.id}`} role="status">
                <span className={styles.undoText}>Taken off Saved: <strong>{entry.product.title}</strong></span>
                <button type="button" className={styles.undo} onClick={() => undo(entry)}>Undo</button>
              </li>
            ) : (
              <SavedRow key={product.id} product={product} snap={snapshot(product.id)} onUnsave={unsave} />
            )))}
          </ul>

          {saved.length > 0 && (
            <div className={styles.side}>
              <SavedPanel items={saved} ids={saved.map((p) => p.id)} />
            </div>
          )}
        </div>
      )}

      {ready && named.length > 0 && (
        <section className={styles.goneBlock} aria-labelledby="saved-gone">
          <h2 id="saved-gone" className={styles.goneTitle}>No longer on sale</h2>
          <ul className={styles.goneList}>
            {named.map((g) => {
              const image = imageAt(g.image_url, 160);
              return (
                <li key={g.id} className={styles.goneItem}>
                  <span className={styles.goneThumb}>{image ? <img src={image} alt="" loading="lazy" /> : null}</span>
                  <span className={styles.goneName}>{g.title}</span>
                  <button type="button" className={styles.goneRemove} onClick={() => remove(g.id)} aria-label={`Remove ${g.title} from saved`}>
                    <CloseIcon size={14} /> Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <QuickView product={peek} onClose={() => setPeek(null)} />
    </section>
  );
}

// Nothing saved: what the heart is for, then what they have already been looking at, each with a heart of its own.
function EmptySaved({ onQuickView }) {
  return (
    <>
      <EmptyHero Icon={HeartIcon} kicker="Your keep" title="Nothing saved yet" cta={{ to: STORE_ROUTES.SHOP, label: 'Have a look around' }}>
        <p>Tap the heart on anything you want to come back to. It waits here, and you can send the whole list to another device, or to someone as a wish list.</p>
      </EmptyHero>
      <PickUp withSaved={false} onQuickView={onQuickView} />
    </>
  );
}

function RowsSkeleton({ count }) {
  return (
    <ul className={styles.rows} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.skeleton}><span /><span /><span /></li>
      ))}
    </ul>
  );
}
