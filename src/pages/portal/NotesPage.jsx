import { useEffect, useState } from 'react';
import { useNotes } from '@hooks/useNotes';
import { loadTenant } from '@lib/tenant';
import { Icon } from '@components/ui/icons';
import styles from '@styles/pages/portal/notes-page.module.css';

const when = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));

const preview = (body) => body.split('\n').find((l) => l.trim()) ?? '';

export function NotesPage() {
  const [tenant, setTenant] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { loadTenant().then(setTenant); }, []);

  const { status, rows, create, save, remove } = useNotes(tenant?.id);

  async function addNote() {
    const id = await create();
    setOpenId(id);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Notes</p>
          <h1 className={styles.title}>Your notebook</h1>
          <p className={styles.sub}>Only you can read these. Suppliers, numbers, anything worth keeping.</p>
        </div>
        <button type="button" className={styles.add} onClick={addNote}>New note</button>
      </header>

      {status === 'loading' && <p className={styles.state} role="status">Loading</p>}

      {status === 'ready' && rows.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing written down yet</p>
          <p className={styles.emptyBody}>
            A supplier phone number, a bundle idea, what to ask about next Monday.
          </p>
          <button type="button" className={styles.add} onClick={addNote}>Write the first one</button>
        </div>
      )}

      <ul className={styles.list}>
        {rows.map((note) => (
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
    </div>
  );
}

function Note({ note, open, onToggle, onSave, onDelete }) {
  const [title, setTitle] = useState(note.title ?? '');
  const [body, setBody] = useState(note.body ?? '');
  const [confirming, setConfirming] = useState(false);

  // A note edited in another tab should not be overwritten by stale local state.
  useEffect(() => {
    if (!open) { setTitle(note.title ?? ''); setBody(note.body ?? ''); setConfirming(false); }
  }, [open, note.title, note.body]);

  const dirty = title !== (note.title ?? '') || body !== (note.body ?? '');

  return (
    <li className={`${styles.note} ${note.pinned ? styles.pinnedNote : ''}`}>
      <div className={styles.row}>
        <button type="button" className={styles.rowMain} aria-expanded={open} onClick={onToggle}>
          <span className={styles.noteTitle}>{note.title?.trim() || 'Untitled note'}</span>
          <span className={styles.notePreview}>{preview(note.body) || 'Empty'}</span>
        </button>

        <div className={styles.rowSide}>
          <button
            type="button"
            className={styles.pin}
            aria-pressed={note.pinned}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={() => onSave({ pinned: !note.pinned })}
          >
            <Icon name="IconPin" className={styles.pinIcon} />
          </button>
          <span className={styles.stamp}>{when(note.updated_at)}</span>
        </div>
      </div>

      {open && (
        <div className={styles.editor}>
          <label className={styles.label} htmlFor={`t-${note.id}`}>Title</label>
          <input
            id={`t-${note.id}`}
            className={styles.input}
            value={title}
            placeholder="What is this about"
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className={styles.label} htmlFor={`b-${note.id}`}>Note</label>
          <textarea
            id={`b-${note.id}`}
            className={styles.textarea}
            rows={8}
            value={body}
            placeholder="Names, numbers, anything"
            onChange={(e) => setBody(e.target.value)}
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
                <button type="button" className={styles.ghost} onClick={() => setConfirming(true)}>Delete</button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!dirty}
                  onClick={() => onSave({ title, body })}
                >
                  {dirty ? 'Save' : 'Saved'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
