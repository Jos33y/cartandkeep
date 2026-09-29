import { useEffect, useRef, useState } from 'react';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/category-tabs.module.css';

/*
 * The categories as a drawer's divider tabs, the shop's card index. One line however many there are: the strip
 * scrolls sideways, and "All categories" lists every one with a search box, so ten or twenty never wrap.
 */
export function CategoryTabs({ groups, current, onPick }) {
  const strip = useRef(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);

  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const pick = (key) => { onPick(key); setMenu(false); setQ(''); };
  const found = groups.filter((g) => g.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className={styles.index}>
      <div ref={strip} className={styles.strip} role="tablist" aria-label="Categories">
        {groups.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={g.key === current}
            className={styles.tab} onClick={() => pick(g.key)}>
            <span className={styles.name}>{g.label}</span>
            <span className={styles.count} data-num>{g.count.toLocaleString('en-GB')}</span>
          </button>
        ))}
      </div>

      {groups.length > 5 && (
        <div ref={box} className={styles.menuWrap}>
          <button type="button" className={styles.all} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <Icon name="IconLayers" className={styles.allIcon} />
            Categories <span data-num>{groups.length - 1}</span>
          </button>
          {menu && (
            <div className={styles.menu} role="dialog" aria-label="Every category">
              <input className={styles.find} autoFocus placeholder="Find a category" value={q}
                onChange={(e) => setQ(e.target.value)} aria-label="Find a category"
                onKeyDown={(e) => { if (e.key === 'Enter' && found[0]) pick(found[0].key); }} />
              <ul className={styles.list}>
                {found.map((g) => (
                  <li key={g.key}>
                    <button type="button" className={styles.item} aria-current={g.key === current || undefined} onClick={() => pick(g.key)}>
                      <span>{g.label}</span>
                      <span className={styles.count} data-num>{g.count.toLocaleString('en-GB')}</span>
                    </button>
                  </li>
                ))}
                {!found.length && <li className={styles.none}>No category by that name</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
