import styles from '@styles/ui/portal/skeleton.module.css';

/*
 * What is coming, in the shape it will arrive in.
 *
 * A word saying "Loading" tells her nothing is there. A skeleton tells her what
 * is about to be there, and because it holds the same geometry the real content
 * does, nothing jumps when it lands. The jump is what makes an interface feel
 * assembled rather than built.
 */

export function Line({ w = '100%', h }) {
  return <span className={`skeleton skeleton-line ${styles.line}`} style={{ width: w, height: h }} />;
}

export function Block({ w = '100%', h = 48, r }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, display: 'block' }} />;
}

/* A figure and its label, which is most of what a dashboard is made of. */
export function StatSkeleton() {
  return (
    <div className={styles.stat}>
      <Line w="52px" h="9px" />
      <Line w="104px" h="26px" />
      <Line w="80px" h="9px" />
    </div>
  );
}

export function RowSkeleton({ i = 0 }) {
  return (
    <div className={styles.row} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <Block w="44px" h={44} r="var(--r-sm)" />
      <div className={styles.rowText}>
        <Line w={`${52 + ((i * 13) % 34)}%`} h="12px" />
        <Line w="84px" h="9px" />
      </div>
      <Line w="56px" h="10px" />
      <Line w="40px" h="10px" />
      <Line w="48px" h="10px" />
    </div>
  );
}

/*
 * The whole screen, for a route that has not loaded its code yet. The router
 * used a null fallback, so a route change showed the previous page frozen and
 * then replaced it without warning.
 */
export function PageSkeleton({ rows = 6 }) {
  return (
    <div className={styles.page} role="status" aria-label="Loading">
      <div className={styles.head}>
        <Line w="72px" h="9px" />
        <Line w="240px" h="30px" />
        <Line w="46ch" h="12px" />
      </div>

      <div className={`card ${styles.card}`}>
        <div className={styles.stats}>
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </div>

      <div className={`card ${styles.card}`}>
        {Array.from({ length: rows }, (_, i) => <RowSkeleton key={i} i={i} />)}
      </div>
    </div>
  );
}
