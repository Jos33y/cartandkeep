import { useState } from 'react';
import styles from '@styles/ui/portal/product-row.module.css';

/*
 * The description, and the draft that suggests one.
 *
 * Two rules from the decisions file shape everything here.
 *
 * The model drafts and she ships. So `Use this` puts the text in the box and
 * saves nothing. She reads it, edits it, then presses Save description like any
 * other edit. Two taps rather than one, and the second one is a person deciding
 * that a statement about goods is true.
 *
 * And it may only use what it is given. The flags are how that rule reports
 * itself: they are the model saying two fields disagree and it refused to pick.
 * They sit above the draft rather than below it, because a draft written around
 * a contradiction is only worth reading if you have read the contradiction
 * first.
 */
export function DescriptionPanel({
  product, busy, run, saved, onSave, onDraft, onDiscardDraft, onUseTitle,
}) {
  const [description, setDescription] = useState(product.description ?? '');
  const [drafting, setDrafting] = useState(false);
  const [failed, setFailed] = useState(null);

  const draft = product.derived_fields?.draft ?? null;
  const dirty = description !== (product.description ?? '');

  /*
   * Local busy, not the row's.
   *
   * A draft takes several seconds and `run` disables every panel on the row
   * while it works. That is right for a save, which is over in a moment, and
   * wrong for this: she should be able to carry on typing in the box while the
   * model reads the photograph.
   */
  async function ask() {
    setDrafting(true);
    setFailed(null);
    try {
      await onDraft(product.id);
    } catch (e) {
      setFailed(e?.message ?? 'The draft did not come back.');
    } finally {
      setDrafting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h4 className="micro">Description</h4>

      {/*
        * Hers, above the supplier's. A description written from a feed title is
        * the feed title with more words.
        */}
      <label className={styles.field}>
        <span className={styles.label}>
          What would you tell somebody in a shop who picked this up
        </span>
        <textarea
          className={styles.textarea}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Two or three sentences. What it is, who it suits, anything the photograph does not show."
        />
      </label>

      <div className={styles.split}>
        {/*
          * The button says what happened.
          *
          * It disables both when a save has just landed and when there is
          * nothing to save, so without the label those two states are the same
          * grey rectangle. An action keeps its name through the flow: Save
          * description produces Saved.
          */}
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !dirty}
          onClick={() => run(() => onSave({ id: product.id, description }))}
        >
          {saved && !dirty ? 'Saved' : 'Save description'}
        </button>
        <span className={styles.count} data-num>{description.trim().length}</span>
      </div>

      {/*
        * The draft, kept out of the box on purpose.
        *
        * Writing straight into the textarea would mean a reload could not tell
        * her words from the model's, and the one thing this screen has to keep
        * straight is which of the two a person has actually read.
        */}
      {draft ? (
        <div className={styles.draft}>
          <p className="micro">Drafted, not published</p>

          {/* The flags used to render here. They live in Things to check now,
              because they are findings about the product rather than about the
              writing, and they have to outlive this draft being discarded. */}
          <p className={styles.draftBody}>{draft.description}</p>

          <div className={styles.split}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || drafting}
              onClick={() => setDescription(draft.description)}
            >
              Use this
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy || drafting}
              onClick={() => run(() => onDiscardDraft(product.id))}
            >
              Discard
            </button>
          </div>

          {/*
            * The title lives in the panel above, so this fills that box rather
            * than saving. Same two steps as the description, and she sees the
            * new title beside the price and the web address before committing
            * to it. Hidden when the model returned the title it was given,
            * which happens on the rows whose titles are already fine.
            */}
          {draft.title && draft.title !== product.title && (
            <div className={styles.draftTitle}>
              <p className={styles.label}>Suggested title</p>
              <p className={styles.draftBody}>{draft.title}</p>
              <button
                type="button"
                className={styles.ghost}
                disabled={busy || drafting}
                onClick={() => onUseTitle(draft.title)}
              >
                Put this in the title box
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={styles.ghost}
          disabled={busy || drafting}
          onClick={ask}
        >
          {drafting ? 'Reading the photograph' : 'Draft one for me'}
        </button>
      )}

      {failed && <p className={styles.error}>{failed}</p>}

      {product.source_description && (
        <details className={styles.supplier}>
          <summary>What the supplier wrote</summary>
          <p>{product.source_description}</p>
        </details>
      )}
    </section>
  );
}
