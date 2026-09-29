import { useEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import { searchCategories } from '@lib/categories';
import styles from '@styles/ui/portal/category-picker.module.css';

// "Move to": a search over Google's categories under her tabs, each shown as its path. Picking one hands back its id.
export function CategoryPicker({ current, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => {
      searchCategories(q).then(setFound).catch((e) => setFailed(e?.message ?? 'Search did not work. Try again.'));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (!box.current?.contains(e.target)) onClose(); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [onClose]);

  async function pick(id) {
    setBusy(true);
    setFailed(null);
    try {
      await onPick(id);
      onClose();
    } catch (e) {
      setFailed(e?.message ?? 'Not moved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className={styles.picker} role="dialog" aria-label="Move to a category">
      <span className={styles.findWrap}>
        <Icon name="IconSearch" className={styles.findIcon} />
        <input className={styles.find} autoFocus value={q} placeholder="Search categories, e.g. walking"
          onChange={(e) => setQ(e.target.value)} aria-label="Search categories"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
            if (e.key === 'Enter' && found[0] && !busy) pick(found[0].id);
          }} />
      </span>
      <ul className={styles.list}>
        {found.map((g) => (
          <li key={g.id}>
            <button type="button" className={styles.item} disabled={busy || g.id === current} onClick={() => pick(g.id)}>
              {g.path.split(' > ').map((part, i, all) => (
                <span key={`${part}-${i}`} className={i === all.length - 1 ? styles.last : styles.part}>
                  {part}{i < all.length - 1 && <span className={styles.sep} aria-hidden="true"> › </span>}
                </span>
              ))}
              {g.id === current && <span className={styles.here}>here now</span>}
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !found.length && !failed && <li className={styles.none}>No category by that name under your tabs</li>}
        {q.trim().length < 2 && <li className={styles.none}>Type two letters or more</li>}
      </ul>
      {failed && <p className={styles.failed} role="alert">{failed}</p>}
    </div>
  );
}
