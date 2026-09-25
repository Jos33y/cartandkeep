import { Link } from 'react-router';
import { SectionGlyph, glyphFor } from '@components/ui/store/SectionGlyph';
import { STORE_ROUTES } from '@utils/constants';
import styles from '@styles/ui/store/shelf-unit.module.css';

const categoryPath = (slug) => STORE_ROUTES.CATEGORY.replace(':slug', slug);

// What a general store's shelves hold before her sections exist: drawn, so it never promises a department.
const GENERAL = [
  ['bottle', 'mirror', 'spray', 'tap'],
  ['drill', 'plug', 'box'],
  ['bowl', 'rail', 'leaf', 'shirt'],
];

// A section's shelf shows its own object first, then a spread of neighbours so no shelf is three of the same thing.
const KINDS = ['bottle', 'spray', 'drill', 'plug', 'bowl', 'leaf', 'rail', 'tap', 'shirt', 'mirror', 'box'];
function objectsFor(name, row) {
  const own = glyphFor(name);
  const rest = KINDS.filter((k) => k !== own);
  return [own, rest[(row * 3) % rest.length], rest[(row * 3 + 1) % rest.length]];
}

function Shelf({ kinds, row, label, count, to }) {
  const goods = kinds.map((kind, i) => (
    <span key={`${kind}-${i}`} className={styles.object} style={{ '--d': `${row * 140 + i * 90}ms` }}>
      <SectionGlyph kind={kind} size={56} className={styles.glyph} />
      <i className={styles.shadow} aria-hidden="true" />
    </span>
  ));

  if (!to) return <div className={styles.shelf}>{goods}</div>;
  return (
    <Link to={to} className={`${styles.shelf} ${styles.shelfLink}`}>
      <span className={styles.tag}>{label}<b>{count}</b></span>
      {goods}
    </Link>
  );
}

export function ShelfUnit({ sections }) {
  const real = sections.length >= 2;
  const rows = real ? sections.slice(0, 3) : GENERAL;

  const unit = (
    <div className={styles.unit}>
      <span className={styles.top} aria-hidden="true" />
      <div className={styles.carcass}>
        {rows.map((row, r) => (real
          ? <Shelf key={row.slug} row={r} kinds={objectsFor(row.name, r)} label={row.name} count={row.items.length} to={categoryPath(row.slug)} />
          : <Shelf key={r} row={r} kinds={row} />))}
      </div>
      <span className={styles.feet} aria-hidden="true"><i /><i /></span>
    </div>
  );

  return (
    <figure className={styles.figure} aria-label={real ? 'Shelves by section' : 'The shop'}>
      {real ? unit : (
        <Link to={STORE_ROUTES.SHOP} className={styles.whole}>
          {unit}
          <span className={styles.plate}>Open the shop</span>
        </Link>
      )}
    </figure>
  );
}
