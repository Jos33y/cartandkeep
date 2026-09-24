import { useState } from 'react';
import { Card, CardHead, Tip } from './primitives';
import { MarketBand } from './MarketBand';
import { SellerGauge } from './SellerGauge';
import { ImageLightbox } from './ImageLightbox';
import { SourceList } from './SourceList';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
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

function evidenceOf(a) {
  const e = a.entry;
  if (!e) return { icon: 'IconInfo', tone: 'muted', text: 'No recent seller in the sample' };
  if (a.entryLoses) {
    return { icon: 'IconInfo', tone: 'warning', text: `A ${fb(e.seller_feedback)} seller is at ${formatGbp(e.price)}, where this loses money` };
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
            aria-label={`View ${a.title} larger`}>
            <img src={thumb(c.image_url)} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <button type="button" className={styles.subject} onClick={onToggle} aria-expanded={open}>
          <span className={styles.name}>{a.title}</span>
          <span className={styles.evidence}>
            <span className={`${styles.ev} ${styles[ev.tone]}`}>
              <Icon name={ev.icon} className={styles.evIcon} />
              {ev.text}
            </span>
            {a.packCheck && <span className="pill pill-warning">Check pack size</span>}
            {pill && <span className={`pill pill-${pill.tone}`}>{pill.text}</span>}
            {c.routes === 'branded' && <span className="pill pill-quiet">Branded</span>}
            {c.routes === 'china' && <span className="pill pill-quiet">Open market</span>}
            {(shelf?.price != null || shelf?.url) && (
              <span className={styles.shelf}>
                {a.shelfIsCost ? '' : 'Seen at '}{shelf.shop ?? 'Shelf'}{shelf.price != null && <> <span data-num>{formatGbp(shelf.price)}</span></>}
              </span>
            )}
          </span>
        </button>

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
              <span className={`${styles.none} ${styles.loses}`}>Loses money</span>
              <span className={styles.figFoot}>at <span data-num>{formatGbp(a.entry.price)}</span></span>
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
            <CardHead title="Where to buy it" />
            {shelf?.url && (
              <a className={styles.seen} href={shelf.url} target="_blank" rel="noreferrer noopener">
                <span className={styles.seenShop}>{shelf.shop ?? 'The shop'}</span>
                <span className={styles.seenProduct}>{shelf.product}</span>
                {shelf.price != null && <span className={`figure ${styles.seenPrice}`}>{formatGbp(shelf.price)}</span>}
              </a>
            )}
            {a.m.shops?.length > 0 && (
              <p className={styles.shops}>
                <span className={styles.shopsLabel}>Also try</span>
                {a.m.shops.map((name) => (
                  <a key={name} href={searchUrlFor(name, search)} target="_blank" rel="noreferrer noopener">{name}</a>
                ))}
              </p>
            )}
            <SourceList candidate={c} onAdd={onSource} suppliers={suppliers} compact />
          </Card>

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
    { key: 'keep', label: 'You keep', value: Math.max(0, keep) },
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
            <dt><i className={styles[`seg_${p.key}`]} />{p.label}</dt>
            <dd data-num className={p.key === 'keep' ? styles.splitKeep : undefined}>{formatGbp(p.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
