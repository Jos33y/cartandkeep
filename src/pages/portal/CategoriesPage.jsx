import { useEffect, useMemo, useRef, useState } from 'react';
import { useCategoryNames } from '@hooks/useCategoryNames';
import { useCatalogue, CATEGORY_MIN, isLive, isArchived } from '@hooks/useCatalogue';
import { Card, Tip } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { loadTenant } from '@lib/tenant';
import { sectionOf } from '@utils/categories';
import styles from '@styles/pages/portal/categories-page.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Thumb({ product, className }) {
  const src = thumb(product.image_url);
  return src
    ? <img className={className} src={src} alt="" loading="lazy" />
    : <span className={`${className} ${styles.thumbEmpty}`} aria-hidden="true" />;
}

// How close a section is to showing, as the three places it needs.
function Threshold({ live, hidden }) {
  const shows = live >= CATEGORY_MIN && !hidden;
  return (
    <div className={styles.threshold}>
      <span className={styles.slots} aria-hidden="true">
        {Array.from({ length: CATEGORY_MIN }, (_, i) => <i key={i} data-on={i < live || undefined} />)}
      </span>
      <span className={styles.thresholdText} data-shows={shows || undefined}>
        {hidden ? 'Hidden from the shop'
          : shows ? 'On the shop'
            : `${CATEGORY_MIN - live} more live and it shows`}
      </span>
    </div>
  );
}

function Picker({ dept, products, labels, busy, onMove, onClose }) {
  const [picked, setPicked] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);

  const list = products
    .filter((p) => sectionOf(p) !== dept.path)
    .filter((p) => !query.trim() || p.title.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <div className={styles.picker}>
      <div className={styles.pickerHead}>
        <input ref={first} className={styles.search} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a product" aria-label="Find a product" />
        {list.length > 1 && (
          <label className={styles.pickAll}>
            <input type="checkbox" checked={list.every((p) => picked.has(p.id))}
              onChange={(e) => setPicked((s) => {
                const n = new Set(s);
                for (const p of list) { if (e.target.checked) n.add(p.id); else n.delete(p.id); }
                return n;
              })} />
            All <span data-num>{list.length}</span> shown
          </label>
        )}
      </div>
      {list.length === 0 ? (
        <p className={styles.pickerEmpty}>{query ? 'Nothing matches that.' : 'Every product is already in here.'}</p>
      ) : (
        <ul className={styles.pickList}>
          {list.map((p) => (
            <li key={p.id}>
              <label className={styles.pickRow} data-on={picked.has(p.id) || undefined}>
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                <Thumb product={p} className={styles.pickThumb} />
                <span className={styles.pickText}>
                  <span className={styles.pickTitle}>{p.title}</span>
                  <span className={styles.pickFrom}>Now in {labels.get(sectionOf(p)) ?? 'Everything else'}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.pickerFoot}>
        <button type="button" className={styles.quiet} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.go} disabled={busy || picked.size === 0}
          onClick={() => onMove([...picked])}>
          {picked.size ? `Move ${plural(picked.size, 'product')} here` : 'Pick products to move'}
        </button>
      </div>
    </div>
  );
}

function Section({ dept, index, total, products, labels, busy, run, actions }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dept.name ?? '');
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [all, setAll] = useState(false);
  const inside = products.filter((p) => sectionOf(p) === dept.path);

  const saveName = () => run(async () => {
    await actions.rename(dept, name);
    setEditing(false);
  }, dept.own || name.trim() ? 'Renamed' : 'Back to the eBay name');

  return (
    <Card className={styles.section} data-hidden={dept.hidden || undefined} data-own={dept.own || undefined}
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <header className={styles.sectionHead}>
        {editing ? (
          <form className={styles.renameForm} onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <input className={styles.renameInput} value={name} autoFocus onChange={(e) => setName(e.target.value)}
              placeholder={dept.ebay_name ?? 'Section name'} aria-label="Section name"
              onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setName(dept.name ?? ''); } }} />
            <button type="submit" className={styles.go} disabled={busy}>Save</button>
            <button type="button" className={styles.quiet} onClick={() => { setEditing(false); setName(dept.name ?? ''); }}>Cancel</button>
          </form>
        ) : (
          <button type="button" className={styles.name} onClick={() => setEditing(true)} title="Rename">
            <span>{dept.label}</span>
            <Icon name="IconNote" width="14" height="14" className={styles.pen} />
          </button>
        )}
        <div className={styles.order}>
          <button type="button" className={styles.icon} disabled={busy || index === 0} aria-label="Move up"
            onClick={() => run(() => actions.shift(index, -1))}>
            <Icon name="IconCaret" width="14" height="14" className={styles.up} />
          </button>
          <button type="button" className={styles.icon} disabled={busy || index === total - 1} aria-label="Move down"
            onClick={() => run(() => actions.shift(index, 1))}>
            <Icon name="IconCaret" width="14" height="14" />
          </button>
        </div>
      </header>

      <p className={styles.origin}>
        {dept.own ? 'Made by you' : dept.name ? `From eBay, originally ${dept.ebay_name}` : 'From eBay'}
        <span aria-hidden="true"> </span>
        <span data-num>{plural(dept.products, 'product')}</span>
      </p>

      <Threshold live={dept.live} hidden={dept.hidden} />

      <ul className={styles.items}>
        {(all ? inside : inside.slice(0, 8)).map((p) => (
          <li key={p.id} className={styles.item}>
            <button type="button" className={styles.itemButton} aria-pressed={chosen?.id === p.id}
              onClick={() => setChosen((c) => (c?.id === p.id ? null : p))}>
              <Thumb product={p} className={styles.itemThumb} />
              <span className={styles.itemTip}>{p.title}</span>
              {!isLive(p) && <span className={styles.draftDot} title="Not live yet" />}
            </button>
          </li>
        ))}
        {inside.length > 8 && (
          <li>
            <button type="button" className={styles.more} onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Fewer' : <span data-num>+{inside.length - 8}</span>}
            </button>
          </li>
        )}
        <li>
          <button type="button" className={styles.add} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            <Icon name="IconPlus" width="16" height="16" />
            <span className="visually-hidden">Move products into {dept.label}</span>
          </button>
        </li>
      </ul>

      {chosen && inside.some((p) => p.id === chosen.id) && (
        <div className={styles.chosen}>
          <span className={styles.chosenTitle}>{chosen.title}</span>
          {chosen.section ? (
            <button type="button" className={styles.quiet} disabled={busy}
              onClick={() => run(async () => { await actions.move([chosen.id], null); setChosen(null); return 'products'; }, 'Moved back')}>
              Send back to {labels.get(chosen.category_path?.split('|')[0]) ?? 'its eBay department'}
            </button>
          ) : <span className={styles.hint}>Its eBay department. Move it with the + on another section.</span>}
        </div>
      )}

      {adding && (
        <Picker dept={dept} products={products} labels={labels} busy={busy} onClose={() => setAdding(false)}
          onMove={(ids) => run(async () => { await actions.move(ids, dept.path); setAdding(false); return 'products'; }, `Moved ${plural(ids.length, 'product')}`)} />
      )}

      <footer className={styles.sectionFoot}>
        <button type="button" className={styles.link} disabled={busy}
          onClick={() => run(() => actions.setHidden(dept, !dept.hidden), dept.hidden ? 'Shown' : 'Hidden')}>
          {dept.hidden ? 'Show on the shop' : 'Hide from the shop'}
        </button>
        {dept.own && (confirming ? (
          <span className={styles.confirm}>
            {inside.length ? `Its ${plural(inside.length, 'product')} go back to their eBay departments.` : 'It is empty.'}
            <button type="button" className={styles.danger} disabled={busy}
              onClick={() => run(() => actions.remove(dept), 'Deleted')}>Delete it</button>
            <button type="button" className={styles.link} onClick={() => setConfirming(false)}>Keep it</button>
          </span>
        ) : (
          <button type="button" className={styles.linkDanger} onClick={() => setConfirming(true)}>Delete</button>
        ))}
      </footer>
    </Card>
  );
}

export function CategoriesPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const sections = useCategoryNames(tenant?.id);
  const catalogue = useCatalogue(tenant?.id);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const products = useMemo(() => catalogue.rows.filter((p) => !isArchived(p)), [catalogue.rows]);
  const labels = useMemo(() => new Map(sections.departments.map((d) => [d.path, d.label])), [sections.departments]);
  const unplaced = products.filter((p) => !sectionOf(p));
  const showing = sections.departments.filter((d) => d.live >= CATEGORY_MIN && !d.hidden);
  const folded = products.filter((p) => isLive(p)
    && !showing.some((d) => d.path === sectionOf(p)));

  async function run(fn, done) {
    setBusy(true);
    setNote(null);
    try {
      const moved = await fn();
      if (moved === 'products') await catalogue.reload();
      if (done) {
        setNote({ ok: true, text: done });
        setTimeout(() => setNote(null), 3000);
      }
    } catch (e) {
      setNote({ ok: false, text: e?.message ?? 'That did not save. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    rename: sections.rename,
    setHidden: sections.setHidden,
    remove: async (d) => { await sections.remove(d); return 'products'; },
    move: async (ids, path) => { await sections.move(ids, path); return 'products'; },
    shift: (index, by) => {
      const paths = sections.departments.map((d) => d.path);
      const [moved] = paths.splice(index, 1);
      paths.splice(index + by, 0, moved);
      return sections.reorder(paths);
    },
  };

  if (tenant === undefined || sections.status === 'loading') return <PageSkeleton />;

  if (sections.status === 'error') {
    return (
      <div className={styles.failure}>
        <h1 className={styles.failureTitle}>The sections did not load</h1>
        <p className={styles.failureBody}>{sections.error?.message ?? 'Reload the page. If it happens again, send me a note.'}</p>
        <button type="button" className={styles.quiet} onClick={sections.reload}>Try again</button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Sections</h1>
          <p className={styles.sub}>
            {showing.length === 0
              ? <>No section shows on the shop yet. Each needs {CATEGORY_MIN} live products, so everything sits in Everything else for now.</>
              : showing.length === sections.departments.length
                ? <>All <span data-num>{showing.length}</span> sections show on the shop.</>
                : <><span data-num>{showing.length}</span> of <span data-num>{sections.departments.length}</span> show on the shop. The rest fold into Everything else until they have {CATEGORY_MIN} live products.</>}
          </p>
        </div>
        <span className={styles.headActions}>
          <Tip side="end">
            Sections are the departments across the top of the shop. Moving a product here changes only where the
            shop shows it; its eBay category, and so Google, stay as they are.
          </Tip>
          <button type="button" className={styles.go} onClick={() => setCreating(true)}>
            <Icon name="IconPlus" width="16" height="16" />New section
          </button>
        </span>
      </header>

      {note && <p className={styles.note} data-ok={note.ok || undefined} role={note.ok ? 'status' : 'alert'}>{note.text}</p>}

      {creating && (
        <Card className={styles.create}>
          <form className={styles.renameForm} onSubmit={async (e) => {
            e.preventDefault();
            await run(async () => { await sections.create(newName); setNewName(''); setCreating(false); }, 'Section made. Move products into it with the + button.');
          }}>
            <input className={styles.renameInput} value={newName} autoFocus onChange={(e) => setNewName(e.target.value)}
              placeholder="Mobility aids" aria-label="New section name"
              onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }} />
            <button type="submit" className={styles.go} disabled={busy || !newName.trim()}>Make it</button>
            <button type="button" className={styles.quiet} onClick={() => setCreating(false)}>Cancel</button>
          </form>
          <p className={styles.hint}>Name it the way a customer would look for it. It shows once it has {CATEGORY_MIN} live products.</p>
        </Card>
      )}

      <div className={styles.grid}>
        {sections.departments.map((d, i) => (
          <Section key={d.path} dept={d} index={i} total={sections.departments.length}
            products={products} labels={labels} busy={busy} run={run} actions={actions} />
        ))}
      </div>

      <Card className={styles.everything}>
        <div className={styles.everythingHead}>
          <h2 className={styles.everythingTitle}>Everything else</h2>
          <p className={styles.origin}>
            Where the shop puts anything not in a section that shows. <span data-num>{plural(folded.length, 'live product')}</span> there now.
          </p>
        </div>
        {unplaced.length > 0 && (
          <p className={styles.unplaced}>
            <b data-num>{unplaced.length}</b> {unplaced.length === 1 ? 'has' : 'have'} no section at all: {unplaced.map((p) => p.title).slice(0, 2).join(', ')}
            {unplaced.length > 2 ? ` and ${unplaced.length - 2} more` : ''}. Use the + on a section to place {unplaced.length === 1 ? 'it' : 'them'}.
          </p>
        )}
        <ul className={styles.items}>
          {folded.slice(0, 16).map((p) => (
            <li key={p.id} className={styles.item}>
              <Thumb product={p} className={styles.itemThumb} />
              <span className={styles.itemTip}>{p.title}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
