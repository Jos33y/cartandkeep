import { Link } from 'react-router';
import { Icon } from '@components/ui/icons';
import styles from '@styles/ui/portal/empty-state.module.css';

// A screen with no data still has a shape. Showing the real columns and line
// items with the values marked absent tells her what this becomes, which is
// more use than a blank panel and more honest than sample numbers.
export function EmptyState({ eyebrow, title, icon, body, columns, rows, note, action }) {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.badge}><Icon name={icon} className={styles.badgeIcon} /></span>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
        </div>
      </header>

      <p className={styles.body}>{body}</p>

      <div className={styles.preview}>
        <div className={styles.previewHead}>
          <span className={styles.previewLabel}>What appears here</span>
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
                      {cell ? <span className={styles.cell}>{cell}</span> : <Absent />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note ? <p className={styles.note}>{note}</p> : null}

      {action ? <Link to={action.to} className={styles.action}>{action.label}</Link> : null}
    </div>
  );
}

function Absent() {
  return <span className={styles.absent} aria-label="no value yet" />;
}
