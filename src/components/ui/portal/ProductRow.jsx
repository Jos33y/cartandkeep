import { formatGbp } from '@utils/formatGbp';
import { blockers, isLive, isArchived } from '@hooks/useCatalogue';
import { stepsFor } from '@lib/readiness';
import { StepMark, StepBar, STATE_WORD } from '@components/ui/portal/product/StepMark';
import styles from '@styles/ui/portal/product-row.module.css';

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);
const leaf = (path) => String(path ?? '').split('|').pop()?.trim() || null;

export function stateOf(product) {
  if (isArchived(product)) return 'archived';
  if (isLive(product)) return 'live';
  return blockers(product).length ? 'blocked' : 'ready';
}

const STATE_LABEL = { live: 'Live', ready: 'Ready', blocked: 'Blocked', archived: 'Archived' };

export function ProductRow({ product, columns, selected, onSelect, onOpen, index = 0, where }) {
  const steps = stepsFor(product, columns);
  const gate = steps.filter((s) => s.gate);
  const rest = steps.filter((s) => !s.gate);
  const counted = steps.filter((s) => s.state !== 'none');
  const done = counted.filter((s) => s.state === 'done').length;
  const state = stateOf(product);

  const cell = (s, i, group) => (s.state === 'none' ? (
    <span key={s.key} className={styles.cell} data-idle="">
      <StepMark state="none" />
    </span>
  ) : (
    <button
      key={s.key}
      type="button"
      className={styles.cell}
      onClick={() => onOpen(product.id, s.key)}
      aria-label={`${s.label}: ${STATE_WORD[s.state] ?? 'Not needed'}. ${s.note}`}
    >
      <StepMark state={s.state} />
      <span role="tooltip" className={styles.tip} data-end={group === 'rest' && i >= rest.length - 2 ? '' : undefined}>
        <strong>{s.label}</strong>
        {s.note}
      </span>
    </button>
  ));

  return (
    <article
      className={styles.row}
      data-state={state}
      data-selected={selected || undefined}
      style={{ '--gate': gate.length, '--rest': rest.length, animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <label className={styles.pick}>
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(product.id, e.target.checked)} />
        <span className="visually-hidden">Select {product.title}</span>
      </label>

      <button type="button" className={styles.opener} onClick={() => onOpen(product.id)}>
        {product.image_url
          ? <img className={styles.thumb} src={thumb(product.image_url)} alt="" loading="lazy" />
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}
        <span className={styles.text}>
          <span className={styles.title}>{product.title}</span>
          <span className={styles.meta}>
            <span className={styles.state}><i aria-hidden="true" />{STATE_LABEL[state]}</span>
            <span className={styles.where}>{where ?? leaf(product.category_path) ?? 'Everything else'}</span>
            <span className={styles.score} data-num>{done}/{counted.length}</span>
          </span>
        </span>
      </button>

      <span className={`${styles.price}`} data-num>{formatGbp(product.price)}</span>

      {gate.map((s, i) => cell(s, i, 'gate'))}
      <span className={styles.divider} aria-hidden="true" />
      {rest.map((s, i) => cell(s, i, 'rest'))}

      <span className={styles.strip} aria-hidden="true">
        {steps.filter((s) => s.state !== 'none').map((s) => (
          <span key={s.key} className={styles.stripStep} data-open={s.state !== 'done' || undefined}>
            <StepBar state={s.state} />
            {s.short ?? s.label}
          </span>
        ))}
      </span>
    </article>
  );
}
