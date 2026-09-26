import styles from '@styles/ui/store/prose.module.css';

const BULLET = /^\s*[-\u2022*]\s+/;

// Her own text as she typed it: blank lines make paragraphs, lines starting with a hyphen or a bullet make a list. No word is changed.
export function Prose({ text }) {
  const paragraphs = String(text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;

  return (
    <div className={styles.prose}>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => BULLET.test(l))) {
          return <ul key={i} className={styles.list}>{lines.map((l, k) => <li key={k}>{l.replace(BULLET, '')}</li>)}</ul>;
        }
        return <p key={i}>{lines.join('\n')}</p>;
      })}
    </div>
  );
}
