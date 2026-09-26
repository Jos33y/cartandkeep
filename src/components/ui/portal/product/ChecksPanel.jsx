import row from '@styles/ui/portal/product-row.module.css';
import styles from '@styles/ui/portal/product-sheet.module.css';

// Only true decisions reach her, as taps. What the agent settled itself is listed, never asked.
export function ChecksPanel({ checks, answers, onAnswer, agent }) {
  const decide = checks?.decide ?? [];
  const done = checks?.done ?? [];

  return (
    <div className={row.panel}>
      {decide.length > 0 && (
        <ol className={styles.decide}>
          {decide.map((q) => {
            const picked = answers[q.id] ?? q.answer ?? null;
            return (
              <li key={q.id} className={styles.question} data-answered={picked ? true : undefined}>
                <p className={styles.questionText}>{q.question}</p>
                <div className={styles.options} role="group" aria-label={q.question}>
                  {q.options.map((o) => (
                    <button key={o} type="button" className={styles.option} aria-pressed={picked === o}
                      onClick={() => onAnswer(q, o)}>
                      {o}
                    </button>
                  ))}
                </div>
                {q.detail && <p className={row.hint}>Fills {q.detail} in the details.</p>}
              </li>
            );
          })}
        </ol>
      )}

      {done.length > 0 && (
        <details className={styles.done} open={decide.length === 0}>
          <summary>
            {agent} sorted <span data-num>{done.length}</span> {done.length === 1 ? 'thing' : 'things'} for you
          </summary>
          <ul>
            {done.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
