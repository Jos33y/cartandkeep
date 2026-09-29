import { useState } from 'react';
import { Card, CardHead, Tip } from './primitives';
import { MarketBand } from './MarketBand';
import { SellerGauge } from './SellerGauge';
import { ImageLightbox } from './ImageLightbox';
import { SourceList } from './SourceList';
import { ChannelMarks } from './ChannelMarks';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { shopName } from '@lib/assess';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/ui/portal/candidate-row.module.css';

const VERDICT = { approve: 'Approved', reject: 'Rejected', defer: 'Saved for later' };
const TONE = { approve: 'positive', reject: 'negative', defer: 'warning' };

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

// eBay's composite id is v1|287502604374|0 and the /itm/ path wants the middle part.
const itmUrl = (id) => `https://www.ebay.co.uk/itm/${String(id).split('|')[1] ?? id}`;

// Known shops get their own search page; anything else a site-scoped Google search.
const SHOP_SEARCH = {
  'Amazon': (q) => `https://www.amazon.co.uk/s?k=${q}`,
  'Argos': (q) => `https://www.argos.co.uk/search/${q}/`,
  'The Range': (q) => `https://www.therange.co.uk/search/?q=${q}`,
  'Screwfix': (q) => `https://www.screwfix.com/search?search=${q}`,
  'Wickes': (q) => `https://www.wickes.co.uk/search?text=${q}`,
  'Home Bargains': (q) => `https://home.bargains/search?q=${q}`,
  'B&M': (q) => `https://www.bmstores.co.uk/search?q=${q}`,
  'Wilko': (q) => `https://www.wilko.com/search?q=${q}`,
  'Tesco': (q) => `https://www.tesco.com/groceries/en-GB/search?query=${q}`,
  'Asda': (q) => `https://groceries.asda.com/search/${q}`,
  'Sainsbury\'s': (q) => `https://www.sainsburys.co.uk/gol-ui/SearchResults/${q}`,
  'Morrisons': (q) => `https://groceries.morrisons.com/search?entry=${q}`,
  'Savers': (q) => `https://www.savers.co.uk/search?q=${q}`,
  'Superdrug': (q) => `https://www.superdrug.com/search?text=${q}`,
  'Boots': (q) => `https://www.boots.com/sitesearch?searchTerm=${q}`,
  'Poundland': (q) => `https://www.poundland.co.uk/catalogsearch/result/?q=${q}`,
  'Pets at Home': (q) => `https://www.petsathome.com/search?q=${q}`,
  'Zooplus': (q) => `https://www.zooplus.co.uk/search?q=${q}`,
  'Dunelm': (q) => `https://www.dunelm.com/search?q=${q}`,
  'Robert Dyas': (q) => `https://www.robertdyas.co.uk/catalogsearch/result?q=${q}`,
  'Toolstation': (q) => `https://www.toolstation.com/search?q=${q}`,
};

const searchUrlFor = (name, q) => SHOP_SEARCH[name]?.(q)
  ?? `https://www.google.com/search?q=${q}+${encodeURIComponent(name)}+uk`;

const rate = (n) => (n == null ? null : `at ${n.toLocaleString('en-GB', { maximumFractionDigits: 1 })} sales a month`);
const fb = (n) => (n == null ? null : `${n.toLocaleString('en-GB')} feedback`);

const NEED_LABEL = { part: 'Part or refill', pest: 'Pest', damp: 'Damp and mould', 'clean-fix': 'Fix', safety: 'Safety', plumbing: 'Plumbing part', care: 'Care aid', winter: 'Winter need' };

function storeEvidence(a) {
  const g = a.g;
  if (g.rank == null) return { icon: 'IconInfo', tone: 'muted', text: 'Sells on Google' };
  const months = g.periods?.length ? `, in ${g.months} of the months checked` : '';
  return { icon: 'IconCheck', tone: 'positive', text: `Google best seller #${g.rank.toLocaleString('en-GB')}${months}` };
}

function evidenceOf(a) {
  if (a.store) return storeEvidence(a);
  const e = a.entry;
  if (!e) return { icon: 'IconInfo', tone: 'muted', text: 'No recent seller in the sample' };
  if (a.entryLoses) {
    // Losing at the small seller's price is half the answer; the other half is where it starts to pay.
    const pays = a.floor != null ? `, and pays from ${formatGbp(a.floor)}` : '';
    return { icon: 'IconInfo', tone: 'warning', text: `A ${fb(e.seller_feedback)} seller is at ${formatGbp(e.price)}, where this loses money${pays}` };
  }
  if (e.proved && a.trusted) {
    return { icon: 'IconCheck', tone: 'positive', text: `A ${fb(e.seller_feedback)} seller is converting at ${formatGbp(e.price)}` };
  }
  if (e.proved) {
    return { icon: 'IconCheck', tone: 'warning', text: `A ${fb(e.seller_feedback)} seller is converting at ${formatGbp(e.price)}, listed at the median` };
  }
  if (a.entryThin) {
    return { icon: 'IconInfo', tone: 'warning', text: `A ${fb(e.seller_feedback)} seller has sold ${e.sold_lifetime ?? 'a few'} in ${e.age_days} days, not yet one a month` };
  }
  return { icon: 'IconInfo', tone: 'warning', text: `Only large accounts selling, smallest ${fb(e.seller_feedback)}` };
}

// How the shelf product compares with the listing proving the market.
function matchPill(match) {
  if (!match) return null;
  if (match.level === 'same_product_same_pack') return { tone: 'positive', text: 'Same pack as eBay' };
  if (match.level === 'same_product_different_pack' && match.shelf && match.ebay) {
    return { tone: 'warning', text: `Shelf ${match.shelf.n}, eBay ${match.ebay.n}` };
  }
  if (match.level === 'different_product') return { tone: 'warning', text: 'Different product on eBay' };
  return null;
}

export function CandidateRow({
  candidate: c, a, active, open, rejecting,
  onActivate, onToggle, onReject, onDecide, onClear, onNote, onSource, suppliers,
}) {
  const [zoomed, setZoomed] = useState(false);
  const [note, setNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const decision = c.decision;
  const ev = evidenceOf(a);
  const search = encodeURIComponent(c.title);
  const shelf = a.m.shelf ?? null;
  const pill = matchPill(a.match);
  // Sourced from outside the UK and held as stock: the import route, labelled until it earns its own lane.
  const from = String(a.best?.ships_from ?? '').trim().toUpperCase();
  const imported = Boolean(from) && from !== 'GB' && from !== 'UK';

  async function run(fn) {
    setBusy(true);
    setFailed(null);
    try {
      await fn();
    } catch (e) {
      setFailed(e?.message ?? 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const decide = (action, extra = {}) => run(() => onDecide({ action, ...extra }));

  return (
    <article
      className={`${styles.row} ${open ? styles.open : ''} ${active ? styles.active : ''}`}
      data-lane={decision ? `decided-${decision.action}` : a.lane}
      data-candidate={c.id}
      onPointerDown={onActivate}
    >
      {zoomed && <ImageLightbox src={c.image_url} alt={a.title} onClose={() => setZoomed(false)} />}

      <span className={styles.rail} aria-hidden="true" />

      <div className={styles.top}>
        {c.image_url ? (
          <button type="button" className={styles.thumb} onClick={() => setZoomed(true)}
            aria-label={`View ${a.title} larger`}
            title={a.store ? 'Photo from where it was seen, to recognise it. Not for your shop.' : undefined}>
            <img src={thumb(c.image_url)} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <button type="button" className={styles.subject} onClick={onToggle} aria-expanded={open}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{a.title}</span>
            <ChannelMarks channels={a.channels} />
          </span>
          <span className={styles.evidence}>
            <span className={`${styles.ev} ${styles[ev.tone]}`}>
              <Icon name={ev.icon} className={styles.evIcon} />
              {ev.text}
            </span>
            {a.store && c.cluster && c.cluster !== 'All year' && <span className="pill pill-quiet">{c.cluster}</span>}
            {a.store && a.m.need && <span className="pill pill-quiet">{NEED_LABEL[a.m.need] ?? a.m.need}</span>}
            {a.packCheck && <span className="pill pill-warning">Check pack size</span>}
            {pill && <span className={`pill pill-${pill.tone}`}>{pill.text}</span>}
            {imported && <span className="pill pill-quiet">Import, from {from}</span>}
            {c.routes === 'branded' && <span className="pill pill-quiet">Branded</span>}
            {c.routes === 'china' && <span className="pill pill-quiet">Open market</span>}
            {a.store && a.shops.length > 0 && (
              <span className={styles.shelf}>
                Seen at {a.shops.slice(0, 2).join(', ')}{a.shops.length > 2 && ` and ${a.shops.length - 2} more`}
                {a.cost != null && <> <span data-num>{formatGbp(a.cost)}</span></>}
              </span>
            )}
            {!a.store && (shelf?.price != null || shelf?.url) && (
              <span className={styles.shelf}>
                {a.shelfIsCost ? '' : 'Seen at '}{shelf.shop ?? 'Shelf'}{shelf.price != null && <> <span data-num>{formatGbp(shelf.price)}</span></>}
              </span>
            )}
          </span>
        </button>

        {a.store ? (
          <>
            <div className={`${styles.cellFig} ${styles.cellMarket}`}>
              {a.g.rank != null ? (
                <>
                  <span className={styles.market} data-num>#{a.g.rank.toLocaleString('en-GB')}</span>
                  <span className={styles.figFoot}>{a.g.months != null ? `${a.g.months} ${a.g.months === 1 ? 'month' : 'months'}` : 'on Google'}</span>
                </>
              ) : (
                <span className={styles.none}>Not ranked</span>
              )}
            </div>

            <div className={`${styles.cellFig} ${styles.cellKeep}`}>
              {a.price != null ? (
                <>
                  <span className={`figure ${styles.keep}`}>{formatGbp(a.price)}</span>
                  <span className={styles.figFoot}>
                    {a.floor != null && a.price !== a.floor ? <>floor <span data-num>{formatGbp(a.floor)}</span></> : 'at your floor'}
                  </span>
                </>
              ) : (
                <span className={styles.none}>Needs a price</span>
              )}
            </div>

            <div className={`${styles.cellFig} ${styles.cellMonth}`}>
              {a.keep != null ? (
                <>
                  <span className={`figure ${styles.month} ${a.keep < 0 ? styles.loses : ''}`}>{formatGbp(a.keep)}</span>
                  <span className={styles.figFoot}>a sale</span>
                </>
              ) : (
                <span className={styles.none}>Needs a price</span>
              )}
            </div>
          </>
        ) : (
          <>
          <div className={`${styles.cellFig} ${styles.cellMarket}`}>
            {c.sold_30d != null ? (
              <>
                <span className={styles.market}>{c.sold_30d.toLocaleString('en-GB')}</span>
                <span className={styles.figFoot}>in the market</span>
              </>
            ) : (
              <span className={styles.none}>Not read</span>
            )}
          </div>

          <div className={`${styles.cellFig} ${styles.cellKeep}`}>
            {a.keep != null ? (
              <>
                <span className={`figure ${styles.keep} ${a.lane === 'short' ? styles.short : ''}`}>{formatGbp(a.keep)}</span>
                <span className={styles.figFoot}>at <span data-num>{formatGbp(a.price)}</span></span>
              </>
            ) : (
              <>
                <span className={styles.none}>No cost yet</span>
                {a.maxGoods != null && (
                  <span className={styles.figFoot}>buy under <span data-num>{formatGbp(a.maxGoods)}</span></span>
                )}
              </>
            )}
          </div>

          <div className={`${styles.cellFig} ${styles.cellMonth}`}>
            {a.month != null ? (
              <>
                <span className={`figure ${styles.month}`}>{formatGbp(a.month)}</span>
                <span className={styles.figFoot}>{rate(a.perMonth)}</span>
              </>
            ) : a.packCheck ? (
              <span className={styles.none}>Check pack first</span>
            ) : a.entryLoses ? (
              <>
                {a.floor != null
                  ? <span className={styles.none}>Pays from <span data-num>{formatGbp(a.floor)}</span></span>
                  : <span className={`${styles.none} ${styles.loses}`}>Loses money</span>}
                <span className={styles.figFoot}>loses at <span data-num>{formatGbp(a.entry.price)}</span></span>
              </>
            ) : a.entry?.proved && a.goods == null ? (
              <>
                <span className={styles.none}>Needs a cost</span>
                {a.perMonth != null && <span className={styles.figFoot}>{rate(a.perMonth)}</span>}
              </>
            ) : (
              <span className={styles.none}>Not proved</span>
            )}
          </div>
          </>
        )}

        <div className={styles.actions}>
          {decision ? (
            <>
              <span className={`pill pill-${TONE[decision.action]}`} role="status">
                {VERDICT[decision.action]}
              </span>
              <button type="button" className={styles.quiet} disabled={busy} onClick={() => run(onClear)}>
                Undo<span className="visually-hidden"> decision on {a.title}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.icon} disabled={busy}
                onClick={() => decide('defer')} title="Later (L)" aria-label={`Later, ${a.title}`}>
                <Icon name="IconClock" className={styles.btnIcon} />
              </button>
              <button type="button" className={`${styles.icon} ${rejecting ? styles.iconOn : ''}`} disabled={busy}
                onClick={onReject} title="Reject (R)" aria-label={`Reject, ${a.title}`} aria-expanded={rejecting}>
                <Icon name="IconX" className={styles.btnIcon} />
              </button>
              <button type="button" className={styles.approve} disabled={busy}
                onClick={() => decide('approve')} title="Approve (A)">
                Approve<span className="visually-hidden"> {a.title}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {rejecting && !decision && (
        <div className={styles.reasons} role="group" aria-label={`Why reject ${a.title}`}>
          <span className={styles.reasonsLabel}>Why</span>
          {REJECTION_REASONS.map((r, i) => (
            <button key={r.value} type="button" className={styles.reason} disabled={busy}
              onClick={() => decide('reject', { reason: r.value, note: note.trim() || null })}>
              <kbd className={styles.kbd}>{i + 1}</kbd>{r.label}
            </button>
          ))}
          <input className={styles.reasonNote} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note, optional" aria-label="Note, optional" />
          <button type="button" className={styles.quiet} onClick={onReject}>Cancel</button>
        </div>
      )}

      {failed && <p className={styles.failed} role="alert">{failed}</p>}

      {open && (
        <div className={styles.work}>
          {a.warnings.length > 0 && (
            <ul className={styles.warnings}>
              {a.warnings.map((w) => (
                <li key={w}><Icon name="IconInfo" className={styles.warnIcon} />{w}</li>
              ))}
            </ul>
          )}

          {a.store ? <StoreWork c={c} a={a} onSource={onSource} suppliers={suppliers} /> : (<>
          <Card raised className={styles.wide}>
            <CardHead title="Where it sells, and where it pays"
              aside={<Tip side="end">The top rail is the market: half of listings sit in the shaded band, the tick is the median, the ring is the smallest seller who is converting. The bottom rail is the same prices after fees, postage and the goods, and the dot is where your price lands.</Tip>} />
            <MarketBand market={c.competition} entry={a.entry} price={a.price} keep={a.keep}
              breakEven={a.breakEven} floor={a.floor} target={a.target} />
          </Card>

          <Card>
            <CardHead title="Who is selling it"
              aside={<Tip side="end">A seller small enough to be starting out, selling this on a listing under 90 days old, is proof a new account can get in. A large account selling proves demand, not entry.</Tip>} />
            <SellerGauge entry={a.entry} ceiling={a.ceiling} />
            {a.entry ? (
              <dl className={styles.proofs}>
                <Proof value={a.entry.seller_feedback.toLocaleString('en-GB')} label="feedback" />
                <Proof value={a.entry.sold_lifetime ?? 'Unknown'} label={`sold in ${a.entry.age_days} days`} />
                <Proof value={a.perMonth != null ? a.perMonth.toLocaleString('en-GB') : 'Too new'} label="a month" />
                <Proof value={(c.active_listings ?? c.competition?.competitors ?? 'Unknown').toLocaleString('en-GB')} label="listings competing" />
              </dl>
            ) : (
              <p className={styles.quietText}>Nobody in the sample has listed this recently, so entry is untested.</p>
            )}
            {a.entry?.item_id && (
              <a className={styles.out} href={itmUrl(a.entry.item_id)} target="_blank" rel="noreferrer noopener">
                Open that listing <Icon name="IconOut" className={styles.outIcon} />
              </a>
            )}
          </Card>

          <Card>
            <CardHead title="Where the money goes" note={a.price != null ? `On a ${formatGbp(a.price)} sale` : null} />
            <Split a={a} />
          </Card>

          <Card>
            <CardHead title="Where it was seen" />
            {shelf?.url && (
              <a className={styles.seen} href={shelf.url} target="_blank" rel="noreferrer noopener">
                <span className={styles.seenShop}>{shelf.shop ?? 'The shop'}</span>
                <span className={styles.seenProduct}>{shelf.product}</span>
                {shelf.price != null && <span className={`figure ${styles.seenPrice}`}>{formatGbp(shelf.price)}</span>}
              </a>
            )}
            {/* A lead, not an instruction: say plainly when the price seen cannot work here. */}
            {shelf?.price != null && a.maxGoods != null && shelf.price > a.maxGoods && (
              <p className={styles.quietText}>
                <span data-num>{formatGbp(shelf.price - a.maxGoods)}</span> over what the goods can cost at{' '}
                <span data-num>{formatGbp(a.price)}</span>. Only works found cheaper, or listed higher.
              </p>
            )}
            {a.m.shops?.length > 0 && (
              <p className={styles.shops}>
                <span className={styles.shopsLabel}>Also look at</span>
                {a.m.shops.map((name) => (
                  <a key={name} href={searchUrlFor(name, search)} target="_blank" rel="noreferrer noopener">{name}</a>
                ))}
              </p>
            )}
            <SourceList candidate={c} onAdd={onSource} suppliers={suppliers} compact />
          </Card>
          </>)}

          <Card>
            <CardHead title="Notes" />
            {(c.notes ?? []).map((n) => (
              <p key={n.id} className={styles.noteItem}>
                <span className={styles.noteWhen} data-num>
                  {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })
                    .format(new Date(n.created_at))}
                </span>
                {n.body}
              </p>
            ))}
            <div className={styles.noteAdd}>
              <input className={styles.noteInput} value={noteDraft}
                aria-label={`Add a note about ${a.title}`}
                placeholder="Supplier lead, a size question, something to check"
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && noteDraft.trim()) {
                    e.preventDefault();
                    run(async () => { await onNote(noteDraft); setNoteDraft(''); });
                  }
                }} />
              <button type="button" className={styles.quiet} disabled={!noteDraft.trim() || busy}
                onClick={() => run(async () => { await onNote(noteDraft); setNoteDraft(''); })}>
                Add
              </button>
            </div>
          </Card>
        </div>
      )}
    </article>
  );
}

function Proof({ value, label }) {
  return (
    <div className={styles.proof}>
      <dt className={styles.proofLabel}>{label}</dt>
      <dd className={`figure ${styles.proofValue}`}>{value}</dd>
    </div>
  );
}

function Split({ a }) {
  if (a.price == null || a.fees == null) {
    return <p className={styles.quietText}>Needs a price.</p>;
  }
  // With no cost yet, the split is drawn at the most the goods can cost.
  const costed = a.goods != null && a.keep != null;
  if (!costed && a.maxGoods == null) {
    return <p className={styles.quietText}>Needs a goods cost.</p>;
  }
  const goods = costed ? a.goods : Math.max(0, a.maxGoods);
  const keep = costed ? a.keep : Math.round((a.price - a.fees - a.postage - goods) * 100) / 100;

  const parts = [
    { key: 'fees', label: 'eBay fees', value: a.fees },
    { key: 'post', label: 'Postage, packing, returns', value: a.postage },
    { key: 'goods', label: costed ? 'Goods' : 'Goods, at most', value: goods },
    // The bar cannot draw a loss, but the figure must say it: this read £0.00 on a £12.63 loss.
    { key: 'keep', label: keep < 0 ? 'You lose' : 'You keep', value: Math.max(0, keep), shown: Math.abs(keep) },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <div className={styles.split}>
      <div className={styles.splitBar}>
        {parts.map((p) => (
          <span key={p.key} className={styles[`seg_${p.key}`]} style={{ flexBasis: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <dl className={styles.splitKey}>
        {parts.map((p) => (
          <div key={p.key} className={styles.splitItem}>
            <dt><i className={styles[p.key === 'keep' && keep < 0 ? 'seg_lose' : `seg_${p.key}`]} />{p.label}</dt>
            <dd data-num className={p.key === 'keep' ? (keep < 0 ? styles.splitLoses : styles.splitKeep) : undefined}>
              {formatGbp(p.shown ?? p.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The opened store card: what Google shows it selling for, how her price is built, and where it was seen.
function StoreWork({ c, a, onSource, suppliers }) {
  const g = a.g;
  const from = a.m.cost_from ?? {};
  const parts = a.price != null && a.cost != null ? [
    { key: 'goods', label: 'Cost where seen', value: a.cost },
    { key: 'post', label: a.postageBand?.basis === 'weight' ? `${a.postageBand.key === 'rm-small' ? 'Royal Mail small parcel' : `Royal Mail medium parcel, ${(a.postageBand.grams / 1000).toFixed(1)}kg`}, packing and returns` : 'Royal Mail, packing and returns', value: a.postage },
    { key: 'fees', label: 'Card fee', value: a.fees },
    { key: 'keep', label: a.keep < 0 ? 'You lose' : 'You keep', value: Math.max(0, a.keep), shown: Math.abs(a.keep) },
  ] : null;
  const total = parts ? parts.reduce((s, p) => s + p.value, 0) || 1 : 1;

  return (
    <>
      <Card raised className={styles.wide}>
        <CardHead title="Where it sells on Google, and where it pays"
          aside={<Tip side="end">The top rail is what shops charge for it on Google, lowest to highest. The bottom rail is the same prices after the cost, Royal Mail, packing, returns and the card fee: red loses money, amber keeps less than your profit, green keeps your profit. The dot is your price.</Tip>} />
        <MarketBand
          market={g.min != null ? { p25: g.min, p75: g.max ?? g.min, low: g.min, high: g.max } : null}
          price={a.price} keep={a.keep} breakEven={a.breakEven} floor={a.floor} target={a.target}
          sellsLabel="On Google" bodyLabel="Google's price range" />
        <dl className={styles.proofs}>
          <Proof value={g.rank != null ? `#${g.rank.toLocaleString('en-GB')}` : 'Unknown'} label={`best seller, ${g.category ?? 'this category'}`} />
          <Proof value={g.months ?? 'Unknown'} label={g.months === 1 ? 'month ranked' : 'months ranked'} />
          <Proof value={a.shops.length} label={a.shops.length === 1 ? 'UK shop stocks it' : 'UK shops stock it'} />
          <Proof value={a.floor != null ? formatGbp(a.floor) : 'No cost yet'} label="your floor" />
        </dl>
      </Card>

      <Card>
        <CardHead title="Your price" note={a.price != null ? `Listed at ${formatGbp(a.price)}` : null} />
        {parts ? (
          <div className={styles.split}>
            <div className={styles.splitBar}>
              {parts.map((p) => (
                <span key={p.key} className={styles[`seg_${p.key}`]} style={{ flexBasis: `${(p.value / total) * 100}%` }} />
              ))}
            </div>
            <dl className={styles.splitKey}>
              {parts.map((p) => (
                <div key={p.key} className={styles.splitItem}>
                  <dt><i className={styles[p.key === 'keep' && a.keep < 0 ? 'seg_lose' : `seg_${p.key}`]} />{p.label}</dt>
                  <dd data-num className={p.key === 'keep' ? (a.keep < 0 ? styles.splitLoses : styles.splitKeep) : undefined}>
                    {formatGbp(p.shown ?? p.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className={styles.quietText}>Needs the price it is sold at where it was seen.</p>
        )}
      </Card>

      <Card>
        <CardHead title="Where it was seen" aside={<Tip side="end">Proof it can be bought in the UK. You buy wherever is cheapest once an order comes in.</Tip>} />
        {from.url && (
          <a className={styles.seen} href={from.url} target="_blank" rel="noreferrer noopener">
            <span className={styles.seenShop}>{shopName(from.shop) ?? 'The shop'}</span>
            <span className={styles.seenProduct}>{from.product ?? c.title}</span>
            {from.price != null && <span className={`figure ${styles.seenPrice}`}>{formatGbp(from.price)}</span>}
          </a>
        )}
        {a.shops.length > 1 && (
          <p className={styles.shops}>
            <span className={styles.shopsLabel}>Also stocked at</span>
            {a.shops.slice(1).map((name) => (
              <a key={name} href={searchUrlFor(name, encodeURIComponent(c.title))} target="_blank" rel="noreferrer noopener">{name}</a>
            ))}
          </p>
        )}
        <SourceList candidate={c} onAdd={onSource} suppliers={suppliers} compact />
      </Card>

      {a.entry && (
        <Card>
          <CardHead title="On eBay" aside={<Tip side="end">The gate found this selling on eBay too. A seller your size converting is proof a new account can get in.</Tip>} />
          <SellerGauge entry={a.entry} ceiling={a.entry.ceiling ?? 1000} />
          {a.ebay && (
            <dl className={styles.proofs}>
              <Proof value={a.ebay.price != null ? formatGbp(a.ebay.price) : 'Unknown'} label="eBay price" />
              <Proof value={a.ebay.keep != null ? formatGbp(a.ebay.keep) : 'No cost yet'} label="you keep on eBay" />
              <Proof value={a.ebay.perMonth != null ? a.ebay.perMonth.toLocaleString('en-GB') : 'Too new'} label="sales a month" />
              <Proof value={(a.ebay.m?.competition?.competitors ?? 'Unknown').toLocaleString('en-GB')} label="listings competing" />
            </dl>
          )}
          {a.entry.item_id && (
            <a className={styles.out} href={itmUrl(a.entry.item_id)} target="_blank" rel="noreferrer noopener">
              Open that listing <Icon name="IconOut" className={styles.outIcon} />
            </a>
          )}
        </Card>
      )}
    </>
  );
}
