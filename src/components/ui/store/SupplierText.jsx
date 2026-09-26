import { useState } from 'react';
import styles from '@styles/ui/store/supplier-text.module.css';

const CUTOFF = 8;

// Line breaks only, never a changed word: at each circled number, and before a "Label:" glued to a word of two or more letters in front of it.
export function supplierLines(text) {
  return String(text ?? '')
    .replace(/\s*([\u2460-\u2473])\s*/g, '\n$1 ')
    .replace(/(?<=[A-Za-z0-9%]{2}|\))([A-Z][A-Za-z ]{1,30}:)/g, '\n$1')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function Line({ text }) {
  const labelled = /^([^:\u2460-\u2473]{2,40}):\s*(.+)$/.exec(text);
  if (!labelled) return <li>{text}</li>;
  return <li><span className={styles.key}>{labelled[1]}:</span> {labelled[2]}</li>;
}

// Supplier and marketplace text, kept apart from hers and marked as not ours.
export function SupplierText({ text }) {
  const [open, setOpen] = useState(false);
  const lines = supplierLines(text);
  if (lines.length === 0) return null;

  const long = lines.length > CUTOFF + 2;
  const shown = open || !long ? lines : lines.slice(0, CUTOFF);

  return (
    <section className={styles.section}>
      <h3 className={styles.head}>From the supplier&rsquo;s listing</h3>
      <ul className={styles.lines}>
        {shown.map((line, i) => <Line key={i} text={line} />)}
      </ul>
      {long && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Show less' : 'Read all of it'}
        </button>
      )}
      <p className={styles.note}>Written by whoever supplied the product, not by us.</p>
    </section>
  );
}
