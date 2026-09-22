import { useEffect, useMemo, useState } from 'react';
import { useNotes } from '@hooks/useNotes';
import { loadTenant } from '@lib/tenant';
import { Icon } from '@components/ui/icons';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import styles from '@styles/pages/portal/notes-page.module.css';

const MINUTE = 60000;

function edited(iso) {
  const gap = Date.now() - new Date(iso).getTime();
  if (gap < 2 * MINUTE) return 'just now';
  if (gap < 60 * MINUTE) return `${Math.round(gap / MINUTE)} minutes ago`;
  if (gap < 24 * 60 * MINUTE) {
    const h = Math.round(gap / (60 * MINUTE));
    return h === 1 ? 'an hour ago' : `${h} hours ago`;
  }
  if (gap < 7 * 24 * 60 * MINUTE) {
    const d = Math.round(gap / (24 * 60 * MINUTE));
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })
    .format(new Date(iso));
}

const preview = (body) => (body ?? '').split('\n').filter((l) => l.trim()).slice(1).join(' ').trim();
const headline = (note) => note.title?.trim() || (note.body ?? '').split('\n').find((l) => l.trim())?.trim() || 'Untitled note';

export function NotesPage() {
  const [tenant, setTenant] = useState(undefined);
  const [openId, setOpenId] = useState(null);
  const [find, setFind] = useState('');

  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, create, save, remove } = useNotes(tenant?.id);

  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.title ?? ''} ${r.body ?? ''}`.toLowerCase().includes(q));
  }, [rows, find]);

  const pinned = shown.filter((r) => r.pinned);
  const rest = shown.filter((r) => !r.pinned);

  async function addNote() {
    const id = await create();
    setOpenId(id);
  }

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={4} />;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Notes</p>
          <h1 className={styles.title}>Notebook</h1>
          <p className={styles.sub}>
            Shared with everyone who can open this portal. Suppliers, numbers, anything worth keeping.
          </p>
        </div>
        <button type="button" className={styles.add} onClick={addNote}>
          <Icon name="IconPlus" className={styles.addIcon} />
          New note
        </button>
      </header>

      {rows.length > 4 && (
        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find a note"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a note" />
        </span>
      )}

      {rows.length === 0 && (
        <div className={`card ${styles.empty}`}>
          <span className={styles.emptyIcon}><Icon name="IconNote" className={styles.emptyGlyph} /></span>
          <p className={styles.emptyTitle}>Nothing written down yet</p>
          <p className={styles.emptyBody}>A supplier phone number, a bundle idea, what to ask about next Monday.</p>
          <button type="button" className={styles.add} onClick={addNote}>Write the first one</button>
        </div>
      )}

      {shown.length === 0 && rows.length > 0 && <p className={styles.none}>No note matches that.</p>}

      {[{ key: 'pinned', label: 'Pinned', items: pinned }, { key: 'rest', label: 'Everything else', items: rest }]
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.key} className={styles.group}>
            {pinned.length > 0 && rest.length > 0 && <h2 className={styles.groupTitle}>{g.label}</h2>}
            <ul className={styles.list}>
              {g.items.map((note) => (
                <Note
                  key={note.id}
                  note={note}
                  open={openId === note.id}
                  onToggle={() => setOpenId((v) => (v === note.id ? null : note.id))}
                  onSave={(patch) => save(note.id, patch)}
                  onDelete={() => { remove(note.id); setOpenId(null); }}
                />
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function Note({ note, open, onToggle, onSave, onDelete }) {
  const [title, setTitle] = useState(note.title ?? '');
  const [body, setBody] = useState(note.body ?? '');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) { setTitle(note.title ?? ''); setBody(note.body ?? ''); setConfirming(false); }
  }, [open, note.title, note.body]);

  const dirty = title !== (note.title ?? '') || body !== (note.body ?? '');
  const keep = () => dirty && onSave({ title, body });

  return (
    <li className={`${styles.note} ${open ? styles.noteOpen : ''}`}>
      <div className={styles.row}>
        <button type="button" className={styles.rowMain} aria-expanded={open} onClick={onToggle}>
          <span className={styles.noteTitle}>{headline(note)}</span>
          <span className={styles.notePreview}>{preview(note.body) || 'No other lines'}</span>
        </button>

        <div className={styles.rowSide}>
          <span className={styles.stamp}>{edited(note.updated_at)}</span>
          <button type="button" className={`${styles.pin} ${note.pinned ? styles.pinOn : ''}`}
            aria-pressed={note.pinned} aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={() => onSave({ pinned: !note.pinned })}>
            <Icon name="IconPin" className={styles.pinIcon} />
          </button>
        </div>
      </div>

      {open && (
        <div className={styles.editor}>
          <input
            className={styles.input}
            value={title}
            placeholder="What is this about"
            aria-label="Title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={keep}
          />
          <textarea
            className={styles.textarea}
            rows={8}
            value={body}
            placeholder="Names, numbers, anything"
            aria-label="Note"
            onChange={(e) => setBody(e.target.value)}
            onBlur={keep}
          />

          <div className={styles.actions}>
            {confirming ? (
              <>
                <span className={styles.confirmText}>Delete this note?</span>
                <button type="button" className={styles.ghost} onClick={() => setConfirming(false)}>Keep it</button>
                <button type="button" className={styles.danger} onClick={onDelete}>Delete</button>
              </>
            ) : (
              <>
                <span className={styles.saved}>{dirty ? 'Unsaved' : 'Saved'}</span>
                <button type="button" className={styles.ghost} onClick={() => setConfirming(true)}>Delete</button>
                <button type="button" className={styles.primary} disabled={!dirty} onClick={keep}>Save</button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
