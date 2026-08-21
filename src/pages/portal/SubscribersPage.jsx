import { useEffect, useMemo, useState } from 'react';
import { useSubscribers } from '@hooks/useSubscribers';
import { toCsv, download, stamped } from '@hooks/useRequests';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/subscribers-page.module.css';

/*
 * The mailing list.
 *
 * A list and an export. There is no compose window and no send button, and
 * there should not be: sending is a job for a tool that handles bounces,
 * complaints and deliverability, and a homemade one would put her domain's
 * reputation at risk to save a subscription.
 *
 * What this screen is for is knowing who is on it, proving they agreed, and
 * being able to take the whole thing elsewhere.
 */

const FILTERS = [
  { key: 'on', label: 'On the list' },
  { key: 'off', label: 'Left' },
  { key: 'all', label: 'Everyone' },
];

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
};

/*
 * The consent record travels with the address.
 *
 * An export of emails alone is a list somebody else has to take on trust. With
 * the date, the page and the wording beside each one, it is a list that can be
 * loaded into anything and still be defensible.
 */
const COLUMNS = [
  { label: 'Email', value: (r) => r.email },
  { label: 'Name', value: (r) => r.name },
  { label: 'Joined', value: (r) => when(r.consented_at) },
  { label: 'From', value: (r) => r.source },
  { label: 'What they agreed to', value: (r) => r.wording },
  { label: 'Left', value: (r) => when(r.unsubscribed_at) },
];

export function SubscribersPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, error, counts, remove } = useSubscribers(tenant?.id);

  const [filter, setFilter] = useState('on');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => (filter === 'on' ? r.on : !r.on));
  }, [rows, filter]);

  async function take(id) {
    setBusy(true);
    setFailed(null);
    try { await remove(id); } catch (e) { setFailed(e?.message ?? 'That did not save.'); }
    finally { setBusy(false); }
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The list did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Mailing list</p>
          <h1 className={styles.title}>
            {counts.on === 0
              ? 'Nobody on the list yet'
              : `${counts.on} ${counts.on === 1 ? 'person' : 'people'} on the list`}
          </h1>
          {counts.off > 0 && (
            <p className={styles.sub}>
              {counts.off} {counts.off === 1 ? 'person has' : 'people have'} left. Kept on
              record, because that is the evidence they were taken off.
            </p>
          )}
        </div>

        {/* Everybody, not the filtered view. An export that quietly leaves out
            the people who unsubscribed is an export that would put them back
            on a list somewhere else. */}
        {counts.all > 0 && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => download(stamped('mailing-list'), toCsv(rows, COLUMNS))}
          >
            Export as a spreadsheet
          </button>
        )}
      </header>

      {counts.all > 0 && (
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={styles.filter}
              data-on={filter === f.key || undefined}
              onClick={() => setFilter(f.key)}
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
            ? 'The box in the shop footer adds people here. Nobody is added by buying something, because that is a different permission and it needs its own box at checkout.'
            : 'Nobody in this list.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visible.map((r) => (
            <li key={r.id} className={styles.person} data-off={!r.on || undefined}>
              <span className={styles.who}>
                <span className={styles.email}>{r.email}</span>
                {r.name && <span className={styles.name}>{r.name}</span>}
              </span>

              <span className={styles.meta}>{when(r.consented_at)}</span>
              {r.source && <span className={styles.meta}>{r.source}</span>}

              {r.on ? (
                <button
                  type="button"
                  className={styles.bare}
                  disabled={busy}
                  onClick={() => take(r.id)}
                >
                  Take off
                </button>
              ) : (
                <span className={styles.left}>left {when(r.unsubscribed_at)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Said once, at the bottom, rather than as a warning on a button. She is
          not going to send from here and the reason is worth stating rather
          than leaving as an absence she has to notice. */}
      {counts.on > 0 && (
        <p className={styles.aside}>
          There is nothing here that sends. Export the list into whatever you
          use to send, so bounces and complaints are handled by something built
          for it rather than by this shop's own domain.
        </p>
      )}
    </div>
  );
}
