import { useEffect, useRef } from 'react';
import { Menu } from '@components/ui/portal/Menu';
import styles from '@styles/ui/portal/category-tabs.module.css';

/*
 * The categories as a drawer's divider tabs, the shop's card index. One line however many there are: the strip
 * scrolls sideways, and the Categories menu lists every one with a search box, so ten or twenty never wrap.
 */
export function CategoryTabs({ groups, current, onPick }) {
  const strip = useRef(null);

  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const pick = (key) => onPick(key);

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
        <div className={styles.menuWrap}>
          <Menu label="Categories" icon="IconLayers" value={current} quiet wide empty="No category by that name"
            button={<span className={styles.allText}>Categories <span className={styles.allCount} data-num>{groups.length - 1}</span></span>}
            options={groups.map((g) => ({ value: g.key, label: g.label, count: g.count, rule: g.key === 'all' }))}
            onChange={onPick} />
        </div>
      )}
    </div>
  );
}
