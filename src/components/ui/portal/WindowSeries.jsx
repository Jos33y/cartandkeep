import styles from '@styles/ui/portal/window-series.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function label(w) {
  const [y, m] = w.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

// The windows are not contiguous. Spacing them evenly would read as a steady
// decline over five months when it is two blocks a year apart.
export function WindowSeries({ series }) {
  const points = (series ?? []).filter((p) => p.units != null);
  if (points.length < 2) return null;

  const peak = Math.max(...points.map((p) => p.units)) || 1;
  const prices = points.map((p) => p.price).filter((p) => p != null);

  return (
    <div className={styles.wrap}>
      <p className="micro">Units sold per window</p>

      <div className={styles.plot}>
        {points.map((p, i) => {
          const gap = i > 0 ? monthsBetween(points[i - 1].window, p.window) : 1;
          return (
            <div key={p.window} className={styles.cell}>
              {gap > 1 && (
                <div className={styles.break} aria-hidden="true">
                  <span className={styles.breakLabel}>{gap - 1}m</span>
                </div>
              )}
              <div className={styles.column}>
                <p className={styles.units} data-num>{p.units}</p>
                <div className={styles.track}>
                  <div
                    className={styles.bar}
                    style={{ height: `${Math.max((p.units / peak) * 100, 2)}%` }}
                    title={p.price != null ? `${label(p.window)}, ${p.units} units at £${p.price.toFixed(2)}` : undefined}
                  />
                </div>
                <p className={styles.month}>{label(p.window)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {prices.length > 1 && (
        <p className={styles.price}>
          Price held between <span data-num>£{Math.min(...prices).toFixed(2)}</span> and{' '}
          <span data-num>£{Math.max(...prices).toFixed(2)}</span> across these windows
        </p>
      )}
    </div>
  );
}
