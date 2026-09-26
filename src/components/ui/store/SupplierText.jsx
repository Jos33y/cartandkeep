import { useState } from 'react';
import styles from '@styles/ui/store/supplier-text.module.css';

const CUTOFF = 10;

// Line breaks only, never a changed word: at each circled number, and before a "Label:" glued to a word of two or more letters in front of it.
export function supplierLines(text) {
  return String(text ?? '')
    .replace(/\s*([\u2460-\u2473])\s*/g, '\n$1 ')
    .replace(/(?<=[A-Za-z0-9%]{2}|\))([A-Z][A-Za-z ]{1,30}:)/g, '\n$1')
    .split(/\n+/)
    .map((line) => line.trim())
    // A supplier that pasted its bullets twice: a repeated sentence goes. Short lines stay, since a value like "Carbon Steel" legitimately appears under two labels.
    .filter((line, i, all) => line && (line.length < 40 || all.indexOf(line) === i));
}

const CIRCLED = /^([\u2460-\u2473])\s*/;
const SPEC_WORDS = /\b(brand|name|country|origin|material|dimensions?|weight|colou?r|size|model|number|manufacturer|type|capacity|components|included|instructions|care|power|voltage|length|width|height|style|features?|pattern|finish)\b/i;
const isLabel = (l) => l.length <= 40 && !/[:.]$|:/.test(l) && /^[A-Z]/.test(l) && l.split(/\s+/).length <= 6 && !CIRCLED.test(l);
const isValue = (l) => l.length <= 140 && !CIRCLED.test(l);

// Circled numbers become one numbered list; runs of label and value lines become a two-column table.
export function supplierBlocks(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length;) {
    if (CIRCLED.test(lines[i])) {
      const items = [];
      while (i < lines.length && CIRCLED.test(lines[i])) { items.push(lines[i].replace(CIRCLED, '')); i += 1; }
      blocks.push({ type: 'list', items });
      continue;
    }
    const pairs = [];
    let j = i;
    // Every label in the run has to read like a specification, or a plain list of features would pair up by accident.
    while (j + 1 < lines.length && isLabel(lines[j]) && SPEC_WORDS.test(lines[j]) && isValue(lines[j + 1])) { pairs.push([lines[j], lines[j + 1]]); j += 2; }
    if (pairs.length >= 3) {
      blocks.push({ type: 'table', items: pairs });
      i = j;
      continue;
    }
    blocks.push({ type: 'line', items: [lines[i]] });
    i += 1;
  }
  return blocks;
}

function Line({ text }) {
  const labelled = /^([^:]{2,40}):\s*(.+)$/.exec(text);
  if (!labelled) return <p className={styles.line}>{text}</p>;
  return <p className={styles.line}><span className={styles.key}>{labelled[1]}:</span> {labelled[2]}</p>;
}

// Shows whole blocks up to the limit, cutting only the last one, so a list is never split mid item without the toggle.
function limit(blocks, rows) {
  const out = [];
  let left = rows;
  for (const b of blocks) {
    if (left <= 0) break;
    out.push(b.items.length > left ? { ...b, items: b.items.slice(0, left) } : b);
    left -= b.items.length;
  }
  return out;
}

// Supplier and marketplace text, kept apart from hers and marked as not ours.
export function SupplierText({ text }) {
  const [open, setOpen] = useState(false);
  const blocks = supplierBlocks(supplierLines(text));
  if (blocks.length === 0) return null;

  const rows = blocks.reduce((n, b) => n + b.items.length, 0);
  const long = rows > CUTOFF + 2;
  const shown = open || !long ? blocks : limit(blocks, CUTOFF);

  return (
    <section className={styles.section}>
      <h3 className={styles.head}>From the supplier&rsquo;s listing</h3>
      <div className={styles.body}>
        {shown.map((b, i) => {
          if (b.type === 'list') {
            return <ol key={i} className={styles.list}>{b.items.map((t, k) => <li key={k}>{t}</li>)}</ol>;
          }
          if (b.type === 'table') {
            return (
              <dl key={i} className={styles.table}>
                {b.items.map(([k, v], n) => <div key={n} className={styles.pairRow}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            );
          }
          return <Line key={i} text={b.items[0]} />;
        })}
      </div>
      {long && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Show less' : 'Read all of it'}
        </button>
      )}
      <p className={styles.note}>Written by whoever supplied the product, not by us.</p>
    </section>
  );
}
