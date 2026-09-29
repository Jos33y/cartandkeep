import { EBAY_BANDS, STORE_BANDS } from '@lib/pricing';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/till-roll.module.css';

const STAMP = {
  confirmed: { tone: 'confirmed', top: 'Same pack', word: 'Confirmed' },
  page: { tone: 'confirmed', top: 'Page checked', word: 'Confirmed' },
  estimate: { tone: 'estimate', top: 'Pack not checked', word: 'Estimate' },
  market: { tone: 'estimate', top: 'No shop price', word: 'At most' },
  try: { tone: 'try', top: 'If it costs', word: null },
};

const pct = (v) => `${Math.round(v * 1000) / 10}%`;

// What a sale leaves her, as the shop's own till roll: every line from assess(), the stamp saying how sure the goods line is.
export function TillRoll({ a }) {
  if (a.price == null || a.keep == null) {
    return <p className={styles.empty}>Needs a price before there is anything to add up.</p>;
  }

  const m = a.m ?? {};
  const lines = a.store ? storeLines(a, m) : ebayLines(a, m);
  const kind = a.trying ? 'try' : a.costBasis === 'market' ? 'market' : !a.costConfirmed ? 'estimate' : a.store && a.costFrom?.basis !== 'supplier' ? 'page' : 'confirmed';
  const stamp = STAMP[kind];
  const loses = a.keep < 0;

  return (
    <div className={styles.roll} data-trying={a.trying || undefined}>
      <p className={styles.head}>One sale</p>
      <div className={styles.rule} />
      <dl className={styles.lines}>
        <div className={styles.sale}><dt>Sale</dt><dd data-num>{formatGbp(a.price)}</dd></div>
        {lines.map((l) => (
          <div key={l.key} data-key={l.key}>
            <dt>{l.label}{l.sub && <small>{l.sub}</small>}</dt>
            <dd data-num>{l.text ?? (l.value == null ? '--' : `-${formatGbp(l.value)}`)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.rule} />
      <dl className={styles.lines}>
        <div className={styles.keep} data-loses={loses || undefined} data-sure={(a.costConfirmed && !a.trying) || undefined} data-trying={a.trying || undefined}>
          <dt>{loses ? 'You lose' : 'You keep'}</dt>
          <dd data-num>{formatGbp(Math.abs(a.keep))}</dd>
        </div>
        {a.target != null && !loses && (
          <div className={styles.aside}>
            <dt>Profit at this price</dt>
            <dd data-num>{formatGbp(a.target)}</dd>
          </div>
        )}
        {a.month != null && !a.trying && (
          <div className={styles.aside}>
            <dt>At {formatGbp(a.entry?.price)} and their rate</dt>
            <dd data-num>{!a.costConfirmed && 'est. '}{formatGbp(a.month)} a month</dd>
          </div>
        )}
      </dl>
      <div className={styles.stampWrap}>
        <span className={styles.stamp} data-tone={stamp.tone}>
          <span className={styles.stampTop}>{stamp.top}</span>
          <span className={styles.stampWord}>{stamp.word ?? formatGbp(a.goods)}</span>
        </span>
      </div>
    </div>
  );
}

function ebayLines(a, m) {
  const band = m.band_label ?? EBAY_BANDS.find((b) => b.key === m.band)?.label ?? null;
  const r = m.rates;
  const goods = a.costBasis === 'market' ? a.assumed : a.goods;
  return [
    { key: 'fees', label: 'eBay fees', sub: r ? `${pct(r.fvf)}, ${pct(r.ad)} promoted, ${formatGbp(r.fixed)} an order` : null, value: a.fees },
    ...postLines(a, 'Postage', band, m),
    { key: 'returns', label: 'Returns allowance', value: Number(m.returns_allowance ?? 0) },
    { key: 'goods', label: goodsLabel(a), sub: goodsSub(a), value: goods },
  ];
}

function storeLines(a, m) {
  const band = a.postageBand?.basis === 'assumed' ? 'Small parcel, no weight on file'
    : a.postageBand?.label ?? STORE_BANDS.find((b) => b.key === a.postageBand?.key)?.label ?? null;
  return [
    { key: 'fees', label: 'Card fee', value: a.fees },
    ...postLines(a, 'Royal Mail', band, m),
    { key: 'returns', label: 'Returns allowance', value: Number(a.returns ?? 0) },
    { key: 'goods', label: goodsLabel(a), sub: goodsSub(a), value: a.goods },
  ];
}

// Her postage and packing, or one line saying the supplier posts it and its postage is in the goods.
function postLines(a, label, band, m) {
  if (a.postedBy === 'supplier') return [{ key: 'post', label: 'Postage and packing', sub: 'Your supplier posts it, in the goods', value: null, text: 'none' }];
  return [
    { key: 'post', label, sub: band, value: Number(m.postage ?? 0) },
    { key: 'pack', label: 'Packing', value: Number(m.packaging ?? 0) },
  ];
}

function goodsLabel(a) {
  if (a.trying) return 'Goods, your figure';
  if (a.costBasis === 'market') return 'Goods, the most allowed';
  if (a.costFrom?.basis === 'supplier') return `Goods, your supplier, ${a.costFrom.from}`;
  return `Goods, priced from ${a.costFrom?.from ?? 'where it was seen'}`;
}

function goodsSub(a) {
  if (a.trying) return 'Not saved';
  if (a.costBasis === 'market') return 'No shop price yet';
  if (a.costFrom?.basis === 'supplier') return a.costFrom.shelf != null ? `What you will pay; seen at £${a.costFrom.shelf.toFixed(2)}` : 'What you will pay';
  if (a.store) return 'Checked on the shop page';
  return a.costConfirmed ? 'Same pack as eBay' : 'Pack not confirmed';
}
