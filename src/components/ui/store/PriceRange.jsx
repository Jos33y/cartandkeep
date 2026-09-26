import { useEffect, useState } from 'react';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/store/price-range.module.css';

// Prices as a shape: twelve bars for how many products sit at each price, with the chosen range lit and two handles to move it.
export function PriceRange({ price, min, max, onCommit }) {
  const lo = Math.floor(Number(price?.min ?? 0));
  const hi = Math.ceil(Number(price?.max ?? 0));
  const [range, setRange] = useState([min ?? lo, max ?? hi]);
  useEffect(() => { setRange([min ?? lo, max ?? hi]); }, [min, max, lo, hi]);

  if (!price || !(hi > lo)) return null;

  const buckets = Array.from({ length: 12 }, (_, i) => price.buckets?.find((b) => b.band === i + 1)?.count ?? 0);
  const tallest = Math.max(1, ...buckets);
  const step = hi - lo > 60 ? 5 : 1;
  const width = (hi - lo) / 12;
  const commit = ([a, b]) => onCommit({ min: a > lo ? a : null, max: b < hi ? b : null });

  return (
    <div className={styles.range}>
      <div className={styles.bars} aria-hidden="true">
        {buckets.map((n, i) => {
          const start = lo + i * width;
          const lit = start + width >= range[0] && start <= range[1];
          return <span key={i} className={styles.bar} data-lit={lit || undefined} style={{ '--h': `${Math.max(6, (n / tallest) * 100)}%` }} />;
        })}
      </div>

      <div className={styles.track} style={{ '--a': (range[0] - lo) / (hi - lo), '--b': (range[1] - lo) / (hi - lo) }}>
        <input
          type="range" min={lo} max={hi} step={step} value={range[0]}
          aria-label="Lowest price"
          onChange={(e) => setRange(([, b]) => [Math.min(Number(e.target.value), b - step), b])}
          onPointerUp={() => commit(range)} onKeyUp={() => commit(range)}
        />
        <input
          type="range" min={lo} max={hi} step={step} value={range[1]}
          aria-label="Highest price"
          onChange={(e) => setRange(([a]) => [a, Math.max(Number(e.target.value), a + step)])}
          onPointerUp={() => commit(range)} onKeyUp={() => commit(range)}
        />
      </div>

      <p className={styles.values}>
        <span data-price>{formatGbp(range[0])}</span>
        <span className={styles.to}>to</span>
        <span data-price>{formatGbp(range[1])}</span>
      </p>
    </div>
  );
}
