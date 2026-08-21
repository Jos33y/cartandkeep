import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useRequests, toCsv, download, stamped } from '@hooks/useRequests';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/pages/portal/requests-page.module.css';

/*
 * What people asked her to stock.
 *
 * The most valuable screen in this portal per line of code, because every row
 * is somebody saying unprompted what they would buy. The research pipeline
 * pays for demand signal; this arrives free, from her own visitors, with a
 * price attached.
 *
 * Asked twice sits at the top, because that is the only thing on the page that
 * is a decision rather than a record. Two people asking is a coincidence. Four
 * is a product.
 */

const FILTERS = [
  { key: 'new', label: 'New' },
  { key: 'looking', label: 'Looking' },
  { key: 'sourced', label: 'Stocked' },
  { key: 'declined', label: 'Not for us' },
  { key: 'all', label: 'All' },
];

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
};

const COLUMNS = [
  { label: 'Asked', value: (r) => when(r.created_at) },
  { label: 'What they want', value: (r) => r.wanted },
  { label: 'They pay now', value: (r) => (r.paying == null ? '' : Number(r.paying).toFixed(2)) },
  { label: 'Where they buy it', value: (r) => r.seen_at },
  { label: 'Name', value: (r) => r.name },
  { label: 'Email', value: (r) => r.email },
  { label: 'Asked from', value: (r) => r.source },
  { label: 'Status', value: (r) => r.status },
  { label: 'Your note', value: (r) => r.note },
];

function Request({ request, busy, run, saved, onStatus, onNote }) {
  const [note, setNote] = useState(request.note ?? '');
  const dirty = note.trim() !== (request.note ?? '').trim();

  return (
    <li className={styles.request} data-status={request.status}>
      <p className={styles.wanted}>{request.wanted}</p>

      {/* The two facts that turn a wish into something she can price, on the
          row rather than behind an expand. Without them she has to open a
          supplier tab to find out whether it is even worth looking. */}
      <p className={styles.facts}>
        {request.paying != null && (
          <span className={styles.pays}>
            They pay <span data-num>{formatGbp(request.paying)}</span>
          </span>
        )}
        {request.seen_at && <span className={styles.where}>at {request.seen_at}</span>}
        <span className={styles.meta}>{when(request.created_at)}</span>
        {request.source && <span className={styles.meta}>from {request.source}</span>}
      </p>

      {/* Only when they left one. Somebody who did not can still be answered
          by the thing appearing, and a row that says "no email" on most of the
          list is a column of nothing. */}
      {request.email && (
        <p className={styles.who}>
          <a href={`mailto:${request.email}`}>{request.name || request.email}</a>
        </p>
      )}

      <div className={styles.actions}>
        {FILTERS.filter((f) => f.key !== 'all').map((f) => (
          <button
            key={f.key}
            type="button"
            className={styles.state}
            data-on={request.status === f.key || undefined}
            disabled={busy}
            onClick={() => run(() => onStatus(request.id, f.key))}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.noteBox}>
        <label className={styles.field}>
          <span className={styles.label}>Your note, never shown to them</span>
          <input
            className={styles.input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Aidapt do one at £18 trade"
          />
        </label>
        <button
          type="button"
          className={styles.ghost}
          disabled={busy || !dirty}
          onClick={() => run(() => onNote({ id: request.id, note }), request.id)}
        >
          {saved && !dirty ? 'Saved' : 'Save note'}
        </button>
      </div>
    </li>
  );
}

export function RequestsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, demand, error, counts, setStatus, saveNote } = useRequests(tenant?.id);

  const [params, setParams] = useSearchParams();
  const requested = params.get('filter');
  const filter = FILTERS.some((f) => f.key === requested) ? requested : 'new';

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [saved, setSaved] = useState(null);

  async function run(fn, key = null) {
    setBusy(true);
    setFailed(null);
    setSaved(null);
    try {
      await fn();
      if (key) {
        setSaved(key);
        setTimeout(() => setSaved((k) => (k === key ? null : k)), 4000);
      }
    } catch (e) {
      setFailed(e?.message ?? 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The requests did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Requests</p>
          <h1 className={styles.title}>
            {counts.new
              ? `${counts.new} new`
              : counts.all ? 'Nothing new' : 'No requests yet'}
          </h1>
        </div>

        {counts.all > 0 && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => download(stamped('requests'), toCsv(rows, COLUMNS))}
          >
            Export as a spreadsheet
          </button>
        )}
      </header>

      {/* Above the list, because it is the only thing on this page that is a
          decision rather than a record. */}
      {demand.length > 0 && (
        <section className={styles.demand}>
          <h2 className="micro">Asked more than once</h2>
          <ul className={styles.demandList}>
            {demand.map((d) => (
              <li key={d.wanted} className={styles.demandRow}>
                <span className={`figure ${styles.asks}`} data-num>{d.asks}</span>
                <span className={styles.demandWanted}>{d.wanted}</span>
                {d.paying != null && (
                  <span className={styles.demandPays} data-num>
                    {formatGbp(d.paying)} avg
                  </span>
                )}
                {d.unanswered > 0 && (
                  <span className={styles.demandOpen}>{d.unanswered} unanswered</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {counts.all > 0 && (
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={styles.filter}
              data-on={filter === f.key || undefined}
              onClick={() => setParams(f.key === 'new' ? {} : { filter: f.key }, { replace: true })}
            >
              {f.label}
              <span className={styles.filterCount} data-num>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      )}

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      {visible.length === 0 ? (
        <p className={styles.empty}>
          {counts.all === 0
            ? 'Nothing yet. Every request comes from somebody on the shop who could not find what they were after, so this list is the cheapest research you will get: they tell you what they want and what they already pay for it.'
            : filter === 'new'
              ? 'Nothing new. Everything asked for has been dealt with.'
              : 'Nothing here.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((r) => (
            <Request
              key={r.id}
              request={r}
              busy={busy}
              run={run}
              saved={saved === r.id}
              onStatus={setStatus}
              onNote={saveNote}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
