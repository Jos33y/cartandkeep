import { useEffect, useMemo, useState } from 'react';
import { NewProduct } from '@components/ui/portal/NewProduct';
import { ProductRow } from '@components/ui/portal/ProductRow';
import {
  useCatalogue, categoryCounts, isLive, isReady, isBlocked,
} from '@hooks/useCatalogue';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/products-page.module.css';

const FILTERS = [
  { key: 'ready', label: 'Ready' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'live', label: 'Live' },
  { key: 'all', label: 'All' },
];

export function ProductsPage() {
  const [tenant, setTenant] = useState(undefined);
  const [filter, setFilter] = useState('ready');
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, rows, counts, reload, publish, unpublish, confirmReturns, saveHazard,
    saveDescription, saveDetails, saveImages, removeImage, create, saveStock,
    saveRecord,
  } = useCatalogue(tenant?.id);

  const byCategory = useMemo(() => categoryCounts(rows), [rows]);

  /*
   * The sections the catalogue actually has, rather than a list somebody typed.
   * Counted over everything rather than only what is live, because when she is
   * filing a new product what she wants to know is where its neighbours are.
   */
  const categories = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      const path = r.category_path;
      if (!path) continue;
      const label = String(path).split('|')[0].trim();
      const entry = seen.get(path) ?? { path, label, count: 0 };
      entry.count += 1;
      seen.set(path, entry);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'live') return rows.filter(isLive);
    if (filter === 'blocked') return rows.filter(isBlocked);
    return rows.filter(isReady);
  }, [rows, filter]);

  // Cleared on every filter change. A selection that survives a filter is a
  // selection that publishes something she cannot see.
  useEffect(() => { setPicked(new Set()); }, [filter]);

  function select(id, on) {
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  const selectable = visible.filter((p) => !isLive(p));
  const allPicked = selectable.length > 0 && selectable.every((p) => picked.has(p.id));

  async function go(fn, ids) {
    setBusy(true);
    setFailed(null);
    try {
      await fn(ids);
      setPicked(new Set());
    } catch (e) {
      setFailed(e?.message ?? 'That did not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (tenant === undefined) {
    return <p className={styles.status} role="status" aria-live="polite">Loading</p>;
  }

  if (status === 'error') {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>The catalogue did not load</h1>
        <p className={styles.emptyBody}>Reload the page. If it happens again, send me a note.</p>
        <button type="button" className={styles.retry} onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Your shop</p>
          <h1 className={styles.title}>Products</h1>
        </div>

        <div className={styles.headRight}>
          <dl className={styles.stats}>
            <Stat label="Live" value={counts.live} />
            <Stat label="Ready" value={counts.ready} />
            <Stat label="Blocked" value={counts.blocked} />
          </dl>

          <button type="button" className={styles.add} onClick={() => setAdding((v) => !v)}>
            {adding ? 'Close' : 'Add a product'}
          </button>
        </div>
      </header>

      {adding && (
        <NewProduct
          categories={categories}
          onCancel={() => setAdding(false)}
          onCreate={async (fields) => {
            await create(fields);
            setAdding(false);
            // Straight to where it landed, which is Blocked with no photograph.
            setFilter('blocked');
          }}
        />
      )}

      {counts.live === 0 && (
        <p className={styles.lead}>
          Nothing is public yet, so the shop is empty to anyone who is not signed in.
          Everything under Ready can go live now. Blocked means something on the product
          would be a claim we cannot stand behind, and the row says which.
        </p>
      )}

      <div className={styles.filters} role="group" aria-label="Filter products">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`}
            onClick={() => setFilter(f.key)}>
            {f.label}
            <span className={styles.chipCount} data-num>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Only when there is something to act on. A bar of disabled buttons is
          furniture on every other screen. */}
      {selectable.length > 0 && (
        <div className={styles.bar}>
          <label className={styles.all}>
            <input
              type="checkbox"
              checked={allPicked}
              onChange={(e) => setPicked(e.target.checked
                ? new Set(selectable.map((p) => p.id))
                : new Set())}
            />
            <span>{allPicked ? 'None' : 'All'}</span>
          </label>

          <span className={styles.chosen} data-num>{picked.size}</span>
          <span className={styles.chosenLabel}>selected</span>

          <button
            type="button"
            className={styles.primary}
            disabled={busy || picked.size === 0}
            onClick={() => go(publish, [...picked])}
          >
            Take live
          </button>
        </div>
      )}

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      <p className={styles.status} role="status" aria-live="polite">
        {status === 'loading' ? 'Loading the catalogue' : ''}
      </p>

      {status === 'ready' && visible.length === 0 && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {filter === 'blocked' ? 'Nothing is blocked'
              : filter === 'live' ? 'Nothing is live yet'
                : filter === 'ready' ? 'Nothing is ready'
                  : 'No products'}
          </h2>
          <p className={styles.emptyBody}>
            {filter === 'blocked' ? 'Everything either goes live or is already up.'
              : filter === 'live' ? 'Tick what is ready and take it live.'
                : filter === 'ready' ? 'Everything left is either live or blocked on something.'
                  : 'The catalogue is empty.'}
          </p>
        </div>
      )}

      <div className={styles.ledger}>
        {visible.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            selected={picked.has(product.id)}
            onSelect={select}
            categoryCount={byCategory.get(String(product.category_path ?? '').split('|')[0]?.trim()) ?? 0}
            onConfirmReturns={confirmReturns}
            onSaveHazard={saveHazard}
            onSaveDescription={saveDescription}
            onSaveDetails={saveDetails}
            onSaveImages={saveImages}
            onRemoveImage={removeImage}
            onSaveStock={saveStock}
            onSaveRecord={saveRecord}
            categories={categories}
            tenantId={tenant?.id}
            onUnpublish={unpublish}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className={styles.stat}>
      <dt className="micro">{label}</dt>
      <dd className={`figure ${styles.statValue}`}>{value}</dd>
    </div>
  );
}
