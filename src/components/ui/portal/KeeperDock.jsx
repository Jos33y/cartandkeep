import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/keeper-dock.module.css';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Pinned at the bottom of the screen so Keeper's progress is wherever she is; a page's own bar sits under it.
export function KeeperDock({ keeper, agent, titleOf, onOpen, onRetry, children }) {
  const summary = keeper?.summary;
  return (
    <div className={styles.dock}>
      {summary && (
        <KeeperStrip summary={summary} agent={agent} titleOf={titleOf}
          onOpen={onOpen} onDismiss={keeper.dismiss} onRetry={onRetry} />
      )}
      {children}
    </div>
  );
}

// Any other long job on the page (bringing listings over from eBay) reports in the same place and the same voice.
export function DockNote({ line, note, progress, onDismiss }) {
  return (
    <section className={styles.keeper} data-running={progress !== undefined || undefined} aria-live="polite">
      <div className={styles.keeperText}>
        <p className={styles.keeperLine}>{line}</p>
        {note && <p className={styles.keeperNote}>{note}</p>}
        {progress !== undefined && (
          <span className={styles.keeperTrack} aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></span>
        )}
      </div>
      {onDismiss && (
        <div className={styles.keeperActions}>
          <button type="button" className={styles.keeperClose} aria-label="Dismiss" onClick={onDismiss}>
            <Icon name="IconX" width="14" height="14" />
          </button>
        </div>
      )}
    </section>
  );
}

function KeeperStrip({ summary, agent, titleOf, onOpen, onDismiss, onRetry }) {
  const { total, finished, running, done, failed, withQuestions } = summary;
  const firstQuestion = withQuestions[0];
  return (
    <section className={styles.keeper} data-running={running || undefined} aria-live="polite">
      <div className={styles.keeperText}>
        {running ? (
          <>
            <p className={styles.keeperLine}>
              {agent} is filling in <b data-num>{Math.min(finished + 1, total)}</b> of <b data-num>{total}</b>
            </p>
            <p className={styles.keeperNote}>Carries on if you close the portal.</p>
          </>
        ) : (
          <>
            <p className={styles.keeperLine}>
              {agent} filled in <b data-num>{done}</b>{total > 1 ? ` of ${total}` : ''}.
              {withQuestions.length > 0 && <> {plural(withQuestions.length, 'has a question', 'have a question')} for you.</>}
              {withQuestions.length === 0 && done > 0 && ' Nothing to ask you.'}
            </p>
            {failed.length > 0 && (
              <p className={styles.keeperNote}>
                Could not fill in {failed.map((j) => titleOf(j.product_id) ?? 'a product').join(', ')}: {failed[0].error}
              </p>
            )}
          </>
        )}
        <span className={styles.keeperTrack} aria-hidden="true"><i style={{ width: `${(finished / total) * 100}%` }} /></span>
      </div>
      {!running && (
        <div className={styles.keeperActions}>
          {failed.length > 0 && onRetry && (
            <button type="button" className={styles.keeperButton} onClick={() => onRetry(failed.map((j) => j.product_id))}>Try again</button>
          )}
          {firstQuestion && onOpen && (
            <button type="button" className={styles.keeperButton} onClick={() => onOpen(firstQuestion)}>
              Answer {withQuestions.length === 1 ? 'it' : 'the first'}
            </button>
          )}
          <button type="button" className={styles.keeperClose} aria-label="Dismiss" onClick={onDismiss}>
            <Icon name="IconX" width="14" height="14" />
          </button>
        </div>
      )}
    </section>
  );
}
