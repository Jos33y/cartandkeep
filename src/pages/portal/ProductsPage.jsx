import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
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
  /*
   * The filter lives in the address, not only in state.
   *
   * Every line on the dashboard is a count with a destination, and a link that
   * lands on the default tab makes her filter again by hand, which is the work
   * the count was supposed to save. Unknown values fall back to ready rather
   * than showing an empty screen, because a typed address should not be able to
   * produce a page that looks broken.
   */
  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const filter = FILTERS.some((f) => f.key === requested) ? requested : 'ready';

  const setFilter = (key) => setParams(
    key === 'ready' ? {} : { filter: key },
    { replace: true },
  );
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [adding, setAdding] = useState(false);
  // null when nothing is running. A count while it is, so the bar can say where
  // it has got to rather than sitting on a spinner for four minutes.
  const [drafting, setDrafting] = useState(null);

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const {
    status, rows, counts, reload, publish, unpublish, confirmReturns, saveHazard,
    saveDescription, saveDetails, saveImages, removeImage, create, saveStock,
    saveRecord, saveCost, draftCopy, draftMany, discardDraft, acknowledgeChecks,
    addVariant, saveVariant, removeVariant,
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

  /*
   * Ticked rows that have no draft yet.
   *
   * Read off the rows rather than tracked separately, so it corrects itself
   * when the batch reloads the catalogue and needs nothing remembered between
   * a run and the screen.
   */
  const undrafted = useMemo(
    () => rows.filter((r) => picked.has(r.id) && !r.derived_fields?.draft),
    [rows, picked],
  );

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'live') return rows.filter(isLive);
    if (filter === 'blocked') return rows.filter(isBlocked);
    return rows.filter(isReady);
  }, [rows, filter]);

  /*
   * A selection carried in from the dashboard.
   *
   * "Draft all 69" is a count on another screen, so it arrives here with the
   * rows already ticked rather than asking her to find them again. Runs once
   * per arrival: the parameter is dropped immediately, so ticking something off
   * afterwards is not undone by a re-render.
   */
  useEffect(() => {
    if (params.get('select') !== 'nocopy' || rows.length === 0) return;
    setPicked(new Set(rows
      .filter((r) => !r.description?.trim() && !r.derived_fields?.draft)
      .map((r) => r.id)));
    setParams({ filter: 'all' }, { replace: true });
  }, [params, rows, setParams]);

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

  /*
   * Everything visible, live included.
   *
   * Live rows were excluded here and their tick box was disabled, so the Live
   * tab had no bar at all and pulling a batch of products off sale meant
   * opening every row. Taking something down is as much a bulk action as
   * putting it up, and it is the one you want most when something is wrong.
   */
  const selectable = visible;

  // Split at the point of acting rather than at the point of ticking, so a
  // mixed selection does the right thing with each half instead of refusing.
  const pickedLive = useMemo(
    () => rows.filter((r) => picked.has(r.id) && isLive(r)),
    [rows, picked],
  );
  const pickedDraft = useMemo(
    () => rows.filter((r) => picked.has(r.id) && !isLive(r)),
    [rows, picked],
  );
  const allPicked = selectable.length > 0 && selectable.every((p) => picked.has(p.id));

  /*
   * Drafting a selection, which is not shaped like the other bulk actions.
   *
   * `go` clears the selection on success and reports one failure. This runs for
   * minutes, partly succeeds by design, and the rows it worked on are worth
   * keeping ticked so she can go straight to reading them. So it keeps the
   * selection and reports the failures by product name.
   */
  async function runDrafts() {
    // Only the ones without a draft. Running over a row that already has one
    // would replace something she may have read, silently, and the button gave
    // no way to tell the two apart.
    const ids = undrafted.map((p) => p.id);
    setFailed(null);
    setDrafting({ done: 0, total: ids.length });

    try {
      const failures = await draftMany(ids, (done, total) => setDrafting({ done, total }));
      if (failures.length) {
        setFailed(`${failures.length} of ${ids.length} did not draft. ${failures.join(' · ')}`);
      }
    } catch (e) {
      setFailed(e?.message ?? 'The drafts did not run.');
    } finally {
      setDrafting(null);
    }
  }

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

          {/*
            * Drafting sits beside taking live rather than above it, and it is
            * the quieter of the two. Taking a product live is the decision this
            * screen exists for; asking for a draft is a step towards one.
            */}
          {/*
            * The label counts what is left to do, not what is ticked.
            *
            * It read "Draft copy for 3" after all three had drafted, which is
            * a button offering work that is already finished. Now it counts the
            * rows in the selection with no draft, and says so when there are
            * none rather than pretending there is something to press.
            */}
          <button
            type="button"
            className={styles.ghost}
            disabled={busy || drafting !== null || undrafted.length === 0}
            onClick={runDrafts}
          >
            {drafting
              ? `Drafting ${drafting.done} of ${drafting.total}`
              : undrafted.length === 0
                ? `${picked.size === 1 ? 'Drafted' : `All ${picked.size} drafted`}`
                : `Draft copy for ${undrafted.length}`}
          </button>

          {/* Only when there is something live in the selection. A button that
              is present and disabled on every draft row is furniture. */}
          {pickedLive.length > 0 && (
            <button
              type="button"
              className={styles.ghost}
              disabled={busy || drafting !== null}
              onClick={() => go(unpublish, pickedLive.map((p) => p.id))}
            >
              Take {pickedLive.length} back to draft
            </button>
          )}

          {/* Hidden when the selection is live only, rather than shown and
              disabled. A selection of live products has nothing to take live
              and a greyed button saying so is noise. It stays visible with
              nothing ticked, because it is the action this screen is for. */}
          {!(pickedLive.length > 0 && pickedDraft.length === 0) && (
            <button
              type="button"
              className={styles.primary}
              disabled={busy || drafting !== null || pickedDraft.length === 0}
              onClick={() => go(publish, pickedDraft.map((p) => p.id))}
            >
              {pickedDraft.length && pickedLive.length
                ? `Take ${pickedDraft.length} live`
                : 'Take live'}
            </button>
          )}

          {/*
            * Inside the bar, not under it.
            *
            * The bar is sticky and the error was not, so pressing Take live at
            * the bottom of a list of 78 put the refusal at the top of the page
            * where nobody was looking. The answer belongs where the button is.
            */}
          {failed && <p className={styles.barError} role="alert">{failed}</p>}
        </div>
      )}

      {/* Failures with nothing selected still need somewhere to go, because the
          bar only exists when there is something to act on. */}
      {failed && selectable.length === 0 && (
        <p className={styles.error} role="alert">{failed}</p>
      )}

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
            fees={tenant?.fees}
            onSaveCost={saveCost}
            tenantId={tenant?.id}
            onUnpublish={unpublish}
            onDraft={draftCopy}
            onDiscardDraft={discardDraft}
            onAcknowledgeChecks={acknowledgeChecks}
            onAddVariant={addVariant}
            onSaveVariant={saveVariant}
            onRemoveVariant={removeVariant}
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
