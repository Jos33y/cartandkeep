import { GLYPH_KINDS, glyphFor, glyphPaths } from '@components/ui/store/SectionGlyph';
import { storeConfig } from '@lib/storeConfig';
import styles from '@styles/ui/store/note-cover.module.css';

/*
 * The cover of a note, drawn rather than photographed.
 *
 * A series design, like a publisher's: every cover shares the grid, the number
 * and the line of the shop's own drawn objects, and differs in colour, layout
 * and what is drawn. Colour and layout follow the issue number, so neighbours
 * never match; the objects come from the post's `cover` list, or from its title
 * and tags. Thirty notes need thirty covers and nobody has to make one.
 */

const WAYS = ['sage', 'kraft', 'ink', 'shelf', 'paper'];
const LAYOUTS = ['hero', 'shelf', 'pattern'];
const USABLE = GLYPH_KINDS.filter((k) => k !== 'door');

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Three objects: the ones the post names, else one that fits its words and two others picked steadily from its address.
export function coverObjects(post) {
  const named = (post.cover ?? []).filter((k) => USABLE.includes(k));
  const first = named[0] ?? glyphFor(`${post.title} ${(post.tags ?? []).join(' ')}`);
  const out = [first, ...named.slice(1)];
  let h = hash(post.slug);
  while (out.length < 3) {
    const k = USABLE[h % USABLE.length];
    if (!out.includes(k)) out.push(k);
    h = Math.floor(h / 7) + 13;
  }
  return out.slice(0, 3);
}

function Glyph({ kind, x, y, size, className }) {
  return <g className={className} transform={`translate(${x} ${y}) scale(${size / 48})`}>{glyphPaths(kind)}</g>;
}

function Hero({ objects }) {
  return (
    <>
      <Glyph kind={objects[0]} x={96} y={148} size={380} className={styles.big} />
      <Glyph kind={objects[1]} x={36} y={330} size={110} className={styles.small} />
    </>
  );
}

function Shelf({ objects }) {
  return (
    <>
      <rect className={styles.board} x="0" y="392" width="400" height="16" />
      {objects.map((k, i) => (
        <g key={k}>
          <ellipse className={styles.shade} cx={82 + i * 118} cy={392} rx={44} ry={5} />
          <Glyph kind={k} x={22 + i * 118} y={i === 1 ? 236 : 268} size={i === 1 ? 156 : 124} className={i === 1 ? styles.mid : styles.small} />
        </g>
      ))}
    </>
  );
}

// A wallpaper of one object, with the odd one out drawn in full: the thing you actually needed.
function Pattern({ objects, seed }) {
  const cols = 4;
  const rows = 4;
  const odd = seed % (cols * rows);
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      cells.push(
        <Glyph key={i} kind={i === odd ? objects[1] : objects[0]} x={26 + c * 90} y={132 + r * 90} size={64}
          className={i === odd ? styles.odd : styles.faint} />,
      );
    }
  }
  return <>{cells}</>;
}

export function NoteCover({ post, className = '' }) {
  const n = Number(post.no) || 1;
  const way = WAYS.includes(post.colour) ? post.colour : WAYS[(n * 2 - 1) % WAYS.length];
  const layout = LAYOUTS.includes(post.layout) ? post.layout : LAYOUTS[(n - 1) % LAYOUTS.length];
  const objects = coverObjects(post);
  const seed = hash(post.slug);

  return (
    <svg className={`${styles.cover} ${className}`} data-way={way} viewBox="0 0 400 500" role="img" aria-label={`Cover of note ${post.no}`} preserveAspectRatio="xMidYMid slice">
      <rect className={styles.bg} width="400" height="500" />
      <g className={styles.art} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {layout === 'hero' && <Hero objects={objects} />}
        {layout === 'shelf' && <Shelf objects={objects} />}
        {layout === 'pattern' && <Pattern objects={objects} seed={seed} />}
      </g>
      <text className={styles.no} x="30" y="78">No. {post.no}</text>
      <text className={styles.series} x="32" y="106">Notes from {storeConfig().shopName || 'the shop'}</text>
    </svg>
  );
}
