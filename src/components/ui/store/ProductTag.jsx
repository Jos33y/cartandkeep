import { tagFacts } from '@utils/specs';
import styles from '@styles/ui/store/product-tag.module.css';

// The label on the box: up to four of her details that decide a purchase, on a drawn paper tag.
export function ProductTag({ specifications }) {
  const facts = tagFacts(specifications);
  if (facts.length === 0) return null;

  return (
    <div className={styles.tag}>
      <div className={styles.card}>
        <span className={styles.hole} aria-hidden="true" />
        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
