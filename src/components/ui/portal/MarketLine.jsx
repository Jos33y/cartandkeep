import styles from '@styles/ui/portal/market-line.module.css';

/*
 * Who else is selling this, and at what.
 *
 * A ledger, not a chart. Four attempts at a chart here all failed the same
 * way: the space is a row in a list, the two figures that matter are a range
 * and a point, and every encoding that fits either made the cheaper product
 * look bigger or split one axis across two tracks. The cost breakdown directly
 * above reads cleanly with label left and figure right, so this uses that
 * rather than inventing a second language beside it.
 *
 * The units chart stays a chart because it compares two months, which is a
 * shape. A price against a range is two numbers and a verdict.
 */

// Of any price increase, eBay takes 12.8% and promoted listings 6%, so this is
// what actually reaches headroom.
const KEPT = 1 - 0.128 - 0.06;

const CONVERGED = 0.15;
const ENTRENCHED = 0.7;

const money = (n) => `£${Number(n).toFixed(2)}`;
const round = (n) => `£${Number(n).toFixed(0)}`;

function read(candidate) {
  const c = candidate.competition ?? {};
  if (!c.usable) return null;

  const price = candidate.margin?.sale_price ?? candidate.avg_sold_price;
  const { median, band, low, high } = c;
  const iqr = band * median;
  const q1 = median - iqr / 2;
  const q3 = median + iqr / 2;

  return {
    price,
    q1,
    q3,
    low,
    high,
    listings: candidate.active_listings,
    where: price == null ? null : price < q1 ? 'under' : price > q3 ? 'over' : 'with',

    /*
     * What the gap is worth. Pricing up to the bottom of the field is the one
     * lever here that costs nothing to pull, and it is the thing no research
     * tool shows: they report the market, not what the market is worth to you.
     *
     * eBay takes 12.8% and promoted listings 6%, so only about 81p in the
     * pound of any increase reaches headroom. Costing it at the full gap would
     * overstate it by a fifth.
     */
    gap: price != null && price < q1 ? q1 - price : null,
    units: candidate.sold_30d ?? null,
    converged: band < CONVERGED,
    held: candidate.seller_concentration >= ENTRENCHED,
  };
}

// One line, in the row.
export function MarketSummary({ candidate }) {
  const m = read(candidate);
  if (!m) return <p className={styles.absent}>Market not read</p>;

  return (
    <p className={styles.summary}>
      <span className={styles.summaryNum} data-num>{m.listings}</span> others selling this
      {m.where === 'under' && <>, <span className={styles.flag}>you are cheaper</span></>}
      {m.where === 'over' && <>, you charge more</>}
      {m.where === 'with' && <>, priced with them</>}
      {m.converged && <>, <span className={styles.flag}>all one price</span></>}
    </p>
  );
}

export function MarketScale({ candidate }) {
  const m = read(candidate);
  if (!m) return null;

  const verdict = m.where === 'under' ? 'cheaper than most of them'
    : m.where === 'over' ? 'dearer than most of them'
      : 'priced with them';

  return (
    <div className={styles.wrap}>
      <p className="micro">The competition</p>

      <dl className={styles.ledger}>
        <Line label="Live listings competing" value={m.listings} />
        <Line label="Most of them sell at" value={`${round(m.q1)} to ${round(m.q3)}`} />
        <Line
          label="This one sells at"
          value={money(m.price)}
          note={verdict}
          flag={m.where !== 'with'}
          strong
        />
      </dl>

      {m.gap != null && m.gap >= 0.5 && (
        <p className={styles.upside}>
          <span className={styles.upsideNum} data-num>{money(m.gap * KEPT)}</span>
          <span className={styles.upsideText}>
            a unit left on the table, pricing up to what the cheapest of them charge
            {m.units ? (
              <>
                . At <span data-num>{m.units}</span> a month that is{' '}
                <span data-num>{money(m.gap * KEPT * m.units)}</span>
              </>
            ) : null}
          </span>
        </p>
      )}

      <p className={styles.note}>
        Across every listing the lowest is <span data-num>{round(m.low)}</span> and
        the highest <span data-num>{round(m.high)}</span>, but both are single
        listings rather than the market.
        {m.converged && ' Sellers have converged on one price, so presentation will not win the sale here.'}
        {m.held && ' Three sellers hold most of the listings, and a new listing cannot match their feedback history.'}
      </p>
    </div>
  );
}

function Line({ label, value, note, flag, strong }) {
  return (
    <div className={`${styles.line} ${strong ? styles.lineStrong : ''}`}>
      <dt>
        {label}
        {note && <span className={`${styles.sub} ${flag ? styles.flag : ''}`}> {note}</span>}
      </dt>
      <dd data-num>{value}</dd>
    </div>
  );
}
