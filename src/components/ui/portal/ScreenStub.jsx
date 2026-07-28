import styles from '@styles/ui/portal/screen-stub.module.css';

export function ScreenStub({ title, note = 'Not built yet.' }) {
  return (
    <div className={styles.stub}>
      <h1 className={styles.title}>{title.replace(/Page$/, '')}</h1>
      <p className={styles.note}>{note}</p>
    </div>
  );
}
