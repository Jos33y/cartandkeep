import { useState } from 'react';
import { CATEGORY_MIN } from '@hooks/useCatalogue';
import styles from '@styles/ui/portal/new-product.module.css';

/*
 * Something she has at home, going on the shop.
 *
 * Three fields and nothing else. Everything a product eventually needs, a
 * description, a returns class, photographs, is on the row once it exists, and
 * asking for all of it here would make adding a product feel like filing a
 * form rather than putting something on a shelf.
 *
 * It cannot go live from here either. It is created as a draft and lands in
 * Blocked, missing a photograph, which is the correct verdict and reaches her
 * through the same gate as everything else rather than through a special case.
 */
export function NewProduct({ categories, onCreate, onCancel }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [categoryPath, setCategoryPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const chosen = categories.find((c) => c.path === categoryPath);

  async function submit() {
    setBusy(true);
    setFailed(null);
    try {
      await onCreate({ title: title.trim(), price, categoryPath });
    } catch (e) {
      setFailed(e?.message ?? 'That did not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Add something you have</h2>
      <p className={styles.body}>
        Title and price now. Photographs and the rest once it is on the list.
      </p>

      <label className={styles.field}>
        <span className={styles.label}>What is it</span>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Cast Iron Casserole Dish 4.7 Litre"
          autoComplete="off"
        />
        <span className={styles.hint}>
          Write it the way somebody would search for it. Size and quantity earn their place,
          adjectives do not.
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Price</span>
        <input
          className={styles.input}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="34.99"
          autoComplete="off"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Where it sits</span>
        <select
          className={styles.input}
          value={categoryPath}
          onChange={(e) => setCategoryPath(e.target.value)}
        >
          <option value="">Everything else</option>
          {categories.map((c) => (
            <option key={c.path} value={c.path}>{c.label} · {c.count}</option>
          ))}
        </select>

        {/*
          * The grouping folds anything under three products into Everything
          * else, so a new department with two products in it produces no
          * department. Correct behaviour with invisible reasoning, which is the
          * only reason it is said out loud.
          */}
        <span className={styles.hint}>
          {chosen && chosen.count + 1 < CATEGORY_MIN
            ? `${chosen.label} would have ${chosen.count + 1}. A section needs ${CATEGORY_MIN}, so until then it shows under Everything else.`
            : 'Sections come from the catalogue rather than from a list, so this can change later.'}
        </span>
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !title.trim() || !price.trim()}
          onClick={submit}
        >
          Add it
        </button>
        <button type="button" className={styles.ghost} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {failed && <p className={styles.error} role="alert">{failed}</p>}
    </section>
  );
}
