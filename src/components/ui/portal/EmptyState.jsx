import { Link } from 'react-router';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/empty-state.module.css';

/*
 * A screen with no data still has a shape.
 *
 * The first version printed a dash in every cell, which read as a table that
 * had failed to load rather than one waiting to fill. This holds the shape of
 * a real row instead: a thumbnail, a title, and figures in the columns that
 * will carry them, drawn as the row itself rather than as punctuation.
 *
 * A caller that passes cells gets them, marked as an example so no figure on
 * the screen can be mistaken for hers.
 */
export function EmptyState({ eyebrow, title, icon, body, columns, rows, note, action }) {
  const sample = rows?.some((r) => r.cells?.some(Boolean));

  return (
    <div className={styles.page}>
      <div className={`card ${styles.card}`}>
        <header className={styles.head}>
          <span className={styles.badge}><Icon name={icon} className={styles.badgeIcon} /></span>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
          </div>
        </header>

        <p className={styles.body}>{body}</p>

        {action ? <Link to={action.to} className={styles.action}>{action.label}</Link> : null}
      </div>

      <div className={styles.preview} aria-hidden="true">
        <div className={styles.previewHead}>
          <span className={styles.previewLabel}>What appears here</span>
          {sample ? <span className={styles.tag}>Example</span> : null}
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.align === 'right' ? styles.right : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={row.rule ? styles.ruleRow : undefined}>
                {columns.map((c, j) => {
                  const cell = row.cells?.[j];
                  return (
                    <td key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                      {cell
                        ? <span className={styles.cell}>{cell}</span>
                        : <Waiting first={j === 0} step={i} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}

// The shape of the row that is coming: a picture and a title on the left, a
// figure on the right. Widths vary by row so it reads as content rather than
// as a loading bar that never finishes.
function Waiting({ first, step }) {
  const width = first ? [72, 58, 66, 50][step % 4] : [46, 38, 42, 34][step % 4];
  return (
    <span className={`${styles.waiting} ${first ? styles.waitingMain : ''}`}>
      {first ? <span className={styles.waitingThumb} /> : null}
      <span className={styles.waitingLine} style={{ width: `${width}%` }} />
    </span>
  );
}
