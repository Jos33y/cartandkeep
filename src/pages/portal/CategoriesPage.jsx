import { useEffect, useState } from 'react';
import { useCategoryNames } from '@hooks/useCategoryNames';
import { loadTenant } from '@lib/tenant';
import styles from '@styles/pages/portal/categories-page.module.css';

/*
 * The words on her shop front.
 *
 * The departments in the navigation come from eBay's taxonomy, which is why
 * they read "Vehicle Parts & Accessories" rather than anything a shopkeeper
 * would write. This is where she takes those words back.
 *
 * A rename, not a move. Products keep their eBay path so the Google feed is
 * untouched, and a section she has not renamed shows exactly what it shows
 * today. That is what makes this safe to use on a live catalogue an hour
 * before opening.
 */

function Section({ section, tenantId, busy, run, saved, onSave, onHidden, nested }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: section.name ?? '',
    slug: section.slug ?? '',
    blurb: section.blurb ?? '',
    position: section.position ?? '',
  });

  const shown = section.name || section.ebay_name;
  const dirty = form.name.trim() !== (section.name ?? '')
    || form.slug.trim() !== (section.slug ?? '')
    || form.blurb.trim() !== (section.blurb ?? '')
    || String(form.position) !== String(section.position ?? '');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <li className={nested ? styles.shelf : styles.department} data-hidden={section.hidden || undefined}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.opener}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.shownName}>{shown}</span>

          {/* Her word or eBay's, said plainly. Without it she cannot tell
              which sections she has already been through. */}
          {section.name
            ? <span className={styles.yours}>yours</span>
            : <span className={styles.theirs}>{section.ebay_name}</span>}
        </button>

        <span className={styles.count}>
          <span data-num>{section.live}</span> live of <span data-num>{section.products}</span>
        </span>

        {/* On the row, because taking a section off the navigation is the one
            thing she might want to do without renaming anything. */}
        <button
          type="button"
          className={styles.bare}
          disabled={busy}
          onClick={() => run(() => onHidden({
            tenantId, path: section.path, name: shown, hidden: !section.hidden,
          }))}
        >
          {section.hidden ? 'Show it' : 'Hide it'}
        </button>
      </div>

      {open && (
        <div className={styles.editor}>
          <p className={styles.path}>{section.path}</p>

          <label className={styles.field}>
            <span className={styles.label}>What customers see</span>
            <input className={styles.input} value={form.name} onChange={set('name')} placeholder={section.ebay_name} />
            <span className={styles.hint}>
              Leave it empty to go back to {section.ebay_name}.
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>A line under the heading, optional</span>
            <input className={styles.input} value={form.blurb} onChange={set('blurb')} placeholder="Everything for keeping a house running" />
          </label>

          <div className={styles.pair}>
            <label className={styles.field}>
              <span className={styles.label}>Web address, optional</span>
              <input className={styles.input} value={form.slug} onChange={set('slug')} placeholder="around-the-house" />
              {/* The one field on this screen that can break something
                  outside it, so it says so rather than being quietly risky. */}
              <span className={styles.hint}>
                Changing this changes a link somebody may have saved. Leave it
                empty and the shop keeps the address it already uses.
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Order, optional</span>
              <input className={styles.input} value={form.position} onChange={set('position')} inputMode="numeric" placeholder="1" />
              <span className={styles.hint}>Lower comes first. Empty goes last.</span>
            </label>
          </div>

          <button
            type="button"
            className={styles.primary}
            disabled={busy || !dirty}
            onClick={() => run(() => onSave({
              tenantId, path: section.path, hidden: section.hidden, ...form,
            }), section.path)}
          >
            {saved && !dirty ? 'Saved' : 'Save'}
          </button>
        </div>
      )}

      {section.shelves?.length > 0 && (
        <ul className={styles.shelves}>
          {section.shelves.map((sh) => (
            <Section
              key={sh.path}
              section={sh}
              tenantId={tenantId}
              busy={busy}
              run={run}
              saved={saved === sh.path}
              onSave={onSave}
              onHidden={onHidden}
              nested
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, departments, error, counts, save, setHidden } = useCategoryNames(tenant?.id);

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

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <h1 className={styles.emptyTitle}>The sections did not load</h1>
        <p className={styles.emptyBody}>{error?.message ?? 'Reload the page.'}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Sections</p>
        <h1 className={styles.title}>
          {counts.named
            ? `${counts.named} of ${counts.all} in your words`
            : 'Every section still uses eBay\u2019s words'}
        </h1>
        <p className={styles.sub}>
          These are the department names customers see. They came from the
          eBay categories your products were listed under, so they read like a
          marketplace rather than a shop. Rename any of them and nothing else
          changes: the products stay where they are and Google still sees the
          original.
        </p>
      </header>

      {failed && <p className={styles.error} role="alert">{failed}</p>}

      {departments.length === 0 ? (
        <p className={styles.empty}>
          Nothing to rename yet. Sections appear here once products have
          categories on them.
        </p>
      ) : (
        <ul className={styles.list}>
          {departments.map((d) => (
            <Section
              key={d.path}
              section={d}
              tenantId={tenant?.id}
              busy={busy}
              run={run}
              saved={saved === d.path}
              onSave={save}
              onHidden={setHidden}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
