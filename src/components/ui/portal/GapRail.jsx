import { PriceTag } from './PriceTag';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/gap-rail.module.css';

// One scale on every row: from 30% under the reference to twice it. A tag further right is further over, on any card.
const LOW = -0.3;
const HIGH = 1;
const at = (share) => ((Math.max(LOW, Math.min(HIGH, share)) - LOW) / (HIGH - LOW)) * 100;

export const REF_WORD = {
  "Google's lowest": "Google's lowest",
  'the cheapest seller who is selling': 'the seller',
  'the eBay median': 'the median',
};

// Her price on the market in one line: the middle of the field, the reference, and the tag sitting on the rail.
export function GapRail({ price, position, band = null }) {
  if (price == null) return <span className={styles.none}>No price yet</span>;
  if (!position) return <span className={styles.lone}><PriceTag price={price} size="small" /></span>;

  const { ref, pct, inMarket, over, refName } = position;
  const x = at(pct);
  const word = REF_WORD[refName] ?? refName;
  const body = band?.low != null && band?.high != null && ref > 0
    ? { left: at(band.low / ref - 1), right: at(band.high / ref - 1) }
    : null;
  const read = inMarket
    ? `${formatGbp(price)}, in the market, at or under ${word} at ${formatGbp(ref)}`
    : `${formatGbp(price)}, ${formatGbp(over)} over ${word} at ${formatGbp(ref)}`;

  return (
    <span className={styles.gap} data-tone={inMarket ? 'in' : 'over'} role="img" aria-label={read}>
      <span className={styles.track} aria-hidden="true">
        {body && <span className={styles.body} style={{ left: `${body.left}%`, width: `${Math.max(1, body.right - body.left)}%` }} />}
        {!inMarket && <span className={styles.string} style={{ left: `${at(0)}%`, width: `${x - at(0)}%` }} />}
        <span className={styles.ref} data-kind={refName === 'the cheapest seller who is selling' ? 'seller' : 'median'} style={{ left: `${at(0)}%` }} />
        <span className={styles.hang} style={{ left: `${x}%` }}><PriceTag price={price} size="small" /></span>
        {pct > HIGH && <span className={styles.beyond} />}
      </span>
    </span>
  );
}

// The gap as a figure for its own column: amber over, a green tick in the market.
export function GapFigure({ position }) {
  if (!position) return <span className={styles.gapNone}>--</span>;
  const word = REF_WORD[position.refName] ?? position.refName;
  if (position.inMarket) {
    return (
      <span className={styles.gapIn} title={`In the market, at or under ${word} at ${formatGbp(position.ref)}`}>
        <Icon name="IconCheck" className={styles.gapIcon} /><span className="visually-hidden">In the market</span>
      </span>
    );
  }
  return (
    <span className={styles.gapOver} title={`Over ${word} at ${formatGbp(position.ref)}`} data-num>
      +{formatGbp(position.over)}
    </span>
  );
}
