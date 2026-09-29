import { useCallback, useMemo, useState } from 'react';
import { Tip } from './primitives';
import { MarketBand } from './MarketBand';
import { SellerGauge } from './SellerGauge';
import { ImageLightbox } from './ImageLightbox';
import { SourceList } from './SourceList';
import { ChannelMarks } from './ChannelMarks';
import { GapFigure, GapRail, REF_WORD } from './GapRail';
import { TillRoll } from './TillRoll';
import { CostTry } from './CostTry';
import { CategoryPicker } from './CategoryPicker';
import { HOW_SET, categoryPath } from '@lib/categories';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { assess, shopName } from '@lib/assess';
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

const fb = (n) => (n == null ? 'unknown' : Number(n).toLocaleString('en-GB'));

const NEED_LABEL = { part: 'Part or refill', pest: 'Pest', damp: 'Damp and mould', 'clean-fix': 'Fix', safety: 'Safety', plumbing: 'Plumbing part', care: 'Care aid', winter: 'Winter need' };

function storeEvidence(a) {
  const g = a.g;
  if (g.rank == null) return { icon: 'IconInfo', tone: 'muted', text: 'Sells on Google' };
  const months = g.periods?.length ? `, in ${g.months} of the months checked` : '';
  return { icon: 'IconCheck', tone: 'positive', text: `Google best seller #${g.rank.toLocaleString('en-GB')}${months}` };
}

// Who proves the market, in one line with the numbers first.
function evidenceOf(a) {
  if (a.store) return storeEvidence(a);
  const e = a.entry;
  if (!e) return { icon: 'IconInfo', tone: 'muted', text: 'No recent seller in the sample' };
  if (a.entryLoses) {
    return { icon: 'IconInfo', tone: 'warning', text: `Small seller, ${fb(e.seller_feedback)} feedback, sells at ${formatGbp(e.price)}, where this loses money` };
  }
  if (e.proved && a.trusted) {
    return { icon: 'IconCheck', tone: 'positive', text: `Small seller, ${fb(e.seller_feedback)} feedback, sells at ${formatGbp(e.price)}` };
  }
  if (e.proved) {
    return { icon: 'IconInfo', tone: 'warning', text: `Small seller at ${formatGbp(e.price)}, outside this search's prices` };
  }
  if (a.entryThin) {
    return { icon: 'IconInfo', tone: 'warning', text: `Small seller, ${fb(e.seller_feedback)} feedback, sold ${e.sold_lifetime ?? 'a few'} in ${e.age_days} days` };
  }
  return { icon: 'IconInfo', tone: 'warning', text: `Only large accounts selling, smallest ${fb(e.seller_feedback)} feedback` };
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

// One pill on the row, the one that asks something of her first; the rest are on the card.
function pillsOf(c, a) {
  const from = String(a.best?.ships_from ?? '').trim().toUpperCase();
  const pill = matchPill(a.match);
  return [
    c.category_flag === 'check_same_product' && { tone: 'warning', text: 'Check it is the same product' },
    a.packCheck && { tone: 'warning', text: 'Check pack size' },
    !a.store && !a.packCheck && a.costBasis === 'seen' && !a.costConfirmed && { tone: 'warning', text: 'Check pack' },
    pill,
    a.store && c.cluster && c.cluster !== 'All year' && { tone: 'quiet', text: c.cluster },
    a.store && a.m.need && { tone: 'quiet', text: NEED_LABEL[a.m.need] ?? a.m.need },
    Boolean(from) && from !== 'GB' && from !== 'UK' && { tone: 'quiet', text: `Import, from ${from}` },
    c.routes === 'branded' && { tone: 'quiet', text: 'Branded' },
    c.routes === 'china' && { tone: 'quiet', text: 'Open market' },
  ].filter(Boolean).slice(0, 1);
}

// Marks the shelf price as the same pack as eBay. Saved as a pack check, never as a supplier, so a supplier she adds
// later still sets the cost. Shared with the C key on the page.
export function confirmSource(c, a) {
  const shelf = a.m?.shelf ?? null;
  if (a.store || a.costBasis !== 'seen' || a.shelfIsCost || shelf?.price == null) return null;
  return {
    supplier: shopName(shelf.shop) ?? 'Where it was seen',
    fulfilment: 'dropship',
    supplier_kind: 'retailer',
    unit_cost: shelf.price,
    price_at_moq: shelf.price,
    url: shelf.url ?? null,
    note: 'Same item and pack as the eBay seller, checked by eye',
    matched_on: 'shelf',
    confirmed: true,
    confirmed_at: new Date().toISOString(),
    status: 'quoted',
    quoted_on: new Date().toISOString().slice(0, 10),
  };
}

// The middle of the market on the row's rail: eBay's quartiles, or Google's lowest to highest.
function bandOf(c, a) {
  if (a.store) return a.g?.min != null ? { low: Number(a.g.min), high: Number(a.g.max ?? a.g.min) } : null;
  const comp = c.competition ?? {};
  return comp.p25 != null && comp.p75 != null ? { low: comp.p25, high: comp.p75 } : null;
}

export function CandidateRow({
  candidate: c, a: base, active, open, rejecting, selected = false,
  onActivate, onToggle, onReject, onDecide, onClear, onNote, onSource, onSelect, onMove, suppliers,
}) {
  const [zoomed, setZoomed] = useState(false);
  const [note, setNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);
  const [trial, setTrial] = useState(null);
  const onTry = useCallback((cost, posted) => setTrial(cost == null ? null : { cost, posted }), []);

  // A cost she is trying moves every figure on the card, from the same assess() the page uses. The lane stays put.
  const a = useMemo(() => (open && trial ? assess(c, { tryCost: trial.cost, tryPosted: trial.posted }) : base), [c, base, trial, open]);

  const decision = c.decision;
  const ev = evidenceOf(base);
  const pill = pillsOf(c, base)[0] ?? null;
  const shelf = base.m.shelf ?? null;

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
  // Each supplier's keep at the card's own price, so the lines compare like for like.
  const keepOf = (s) => (s.landed_unit_cost == null || base.price == null ? null
    : assess({ ...c, draft: { ...(c.draft ?? {}), price: base.price } }, {
      tryCost: Number(s.landed_unit_cost), tryPosted: s.fulfilment === 'stock' ? 'you' : 'supplier', holdPrice: true,
    }).keep);

  return (
    <article
      className={`${styles.row} ${open ? styles.open : ''} ${active ? styles.active : ''}`}
      data-lane={decision ? `decided-${decision.action}` : base.lane}
      data-selected={selected || undefined}
      data-candidate={c.id}
      onPointerDown={onActivate}
    >
      {zoomed && <ImageLightbox src={c.image_url} alt={base.title} onClose={() => setZoomed(false)} />}

      <div className={styles.top}>
        <label className={styles.check}>
          <input type="checkbox" checked={selected} readOnly
            onClick={(e) => onSelect?.(e.shiftKey)} aria-label={`Select ${base.title}`} />
        </label>

        {c.image_url ? (
          <button type="button" className={styles.thumb} onClick={() => setZoomed(true)}
            aria-label={`View ${base.title} larger`}
            title="Photo from where it was seen, to recognise it. Not for your shop or eBay.">
            <img src={thumb(c.image_url)} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <button type="button" className={styles.subject} onClick={onToggle} aria-expanded={open}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{base.title}</span>
            <ChannelMarks channels={base.channels} />
          </span>
          <span className={`${styles.ev} ${styles[ev.tone]}`}>
            <Icon name={ev.icon} className={styles.evIcon} />
            <span className={styles.evText}>{ev.text}</span>
            {pill && <span className={`pill pill-${pill.tone} ${styles.pill}`}>{pill.text}</span>}
          </span>
        </button>

        <div className={styles.cellMarket}>
          {base.store ? (
            base.g.rank != null
              ? <span className={styles.market} data-num title={base.g.months != null ? `${base.g.months} of the months checked` : undefined}>#{base.g.rank.toLocaleString('en-GB')}</span>
              : <span className={styles.none}>Not ranked</span>
          ) : c.sold_30d != null
            ? <span className={styles.market} data-num>{c.sold_30d.toLocaleString('en-GB')}</span>
            : <span className={styles.none}>Not read</span>}
        </div>

        <div className={styles.cellPrice}>
          <GapRail price={a.price} position={a.position} band={bandOf(c, base)} />
        </div>

        <div className={styles.cellGap}><GapFigure position={a.position} /></div>

        <div className={styles.cellKeep}>
          {!a.trying && base.packCheck ? (
            <span className={styles.none} title="The converting listing may be a bigger pack than the shelf one">Pack?</span>
          ) : a.keep != null ? (
            <KeepCell keep={a.keep} short={!a.trying && base.lane === 'short'} confirmed={a.costConfirmed && !a.trying}
              trying={a.trying} market={a.costBasis === 'market'} />
          ) : (
            <span className={styles.none}>--</span>
          )}
        </div>

        <div className={styles.actions}>
          {decision ? (
            <>
              <span className={`pill pill-${TONE[decision.action]}`} role="status">
                {VERDICT[decision.action]}
              </span>
              <button type="button" className={styles.quiet} disabled={busy} onClick={() => run(onClear)}>
                Undo<span className="visually-hidden"> decision on {base.title}</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.act} disabled={busy}
                onClick={() => decide('defer')} title="Later (L)" aria-label={`Later, ${base.title}`}>
                <Icon name="IconClock" className={styles.btnIcon} />
              </button>
              <button type="button" className={`${styles.act} ${styles.reject} ${rejecting ? styles.actOn : ''}`} disabled={busy}
                onClick={onReject} title="Reject (R)" aria-label={`Reject, ${base.title}`} aria-expanded={rejecting}>
                <Icon name="IconX" className={styles.btnIcon} />
              </button>
              <button type="button" className={styles.approve} disabled={busy}
                onClick={() => decide('approve')} title="Approve (A)">
                Approve<span className="visually-hidden"> {base.title}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {rejecting && !decision && (
        <div className={styles.reasons} role="group" aria-label={`Why reject ${base.title}`}>
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
          {base.warnings.length > 0 && (
            <ul className={styles.warnings}>
              {base.warnings.map((w) => (
                <li key={w}><Icon name="IconInfo" className={styles.warnIcon} />{w}</li>
              ))}
            </ul>
          )}

          <div className={styles.main}>
          <section className={styles.marketPanel} aria-label="Where it sells, and where it pays">
            <PriceHead a={a} base={base} />
            <CategoryLine c={c} channels={base.channels} onMove={onMove} />
            <MarketBand
              {...(base.store
                ? {
                  market: base.g.min != null ? { p25: base.g.min, p75: base.g.max ?? base.g.min, low: base.g.min, high: base.g.max } : null,
                  sellsLabel: 'On Google', bodyLabel: "Google's price range",
                }
                : {
                  market: c.competition, entry: base.entry,
                  listings: base.marketRead?.listings ?? [],
                  medianLabel: medianLabelOf(base.marketRead),
                  medianListed: base.marketRead?.basis === 'selling' ? base.marketRead.medianListed : null,
                })}
              price={a.price} keep={a.keep} breakEven={a.breakEven} floor={a.floor} target={a.target}
              scale={[base.entry?.price, base.price, base.breakEven, base.floor, base.position?.ref]}
              ghost={!a.trying && base.position && !base.position.inMarket && base.landsUnder != null
                ? { price: base.position.ref, note: `goods ${formatGbp(base.landsUnder)}` }
                : null} />
            {base.store ? <GoogleStrip base={base} /> : <SellerStrip base={base} c={c} />}
            <div className={styles.tryRule} />
            <CostTry onTry={onTry} base={base} view={a} suppliers={suppliers} onSave={(fields) => onSource(fields)} />
          </section>
            <section className={styles.notes} aria-label="Notes">
              <h3 className={styles.panelTitle}>Notes</h3>
              <div className={styles.notesBody}>
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
                    aria-label={`Add a note about ${base.title}`}
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
              </div>
            </section>
          </div>

          <aside className={styles.side}>
            <section className={styles.moneyPanel} aria-label="Where the money goes">
              <TillRoll a={a} />
            </section>

            <section className={styles.seenPanel} aria-label="Where it was seen">
              <h3 className={styles.panelTitle}>
                Where it was seen
                <Tip side="end">Proof it can be bought in the UK. The photo and wording are the shop&apos;s, so never used on your listings.</Tip>
              </h3>
              {base.store ? (
                <ShelfLabel shop={shopName(base.m.cost_from?.shop) ?? 'The shop'} product={base.m.cost_from?.product ?? c.title}
                  price={base.m.cost} url={base.m.cost_from?.url} state="confirmed" />
              ) : (shelf?.price != null || shelf?.url) ? (
                <ShelfLabel shop={shopName(shelf.shop) ?? 'The shop'} product={shelf.product} price={shelf.price} url={shelf.url}
                  state={base.costFrom?.basis === 'supplier' ? 'aside' : base.shelfIsCost ? 'confirmed' : 'estimate'} />
              ) : (
                <p className={styles.quietText}>Not seen in a UK shop yet. The price is built on the most the eBay price allows the goods to cost.</p>
              )}

              {confirmSource(c, base) && (
                <button type="button" className={styles.confirm} disabled={busy}
                  onClick={() => run(() => onSource(confirmSource(c, base)))}>
                  <Icon name="IconCheck" className={styles.confirmIcon} />
                  Same item and pack, confirm <span data-num>{formatGbp(shelf.price)}</span>
                  <kbd className={styles.kbd}>C</kbd>
                </button>
              )}

              <AlsoLook names={base.store ? base.shops.slice(1) : (base.m.shops ?? [])} seen={base.store ? shopName(base.m.cost_from?.shop) : shopName(shelf?.shop)}
                label={base.store ? 'Also stocked at' : 'Also look at'} q={encodeURIComponent(c.title)} />

              <SourceList candidate={c} onAdd={onSource} suppliers={suppliers} compact canAdd={false} keepOf={keepOf} />
            </section>
          </aside>

        </div>
      )}
    </article>
  );
}

// Where the card sits in Google's taxonomy, how that was decided, where it came from, and the one way to move it.
function CategoryLine({ c, channels, onMove }) {
  const [moving, setMoving] = useState(false);
  const path = categoryPath(c.category_id);
  const how = HOW_SET[c.category_source];
  return (
    <div className={styles.category}>
      <span className={styles.crumbs}>
        {path
          ? path.split(' > ').map((part, i, all) => (
            <span key={`${part}-${i}`} className={i === all.length - 1 ? styles.crumbLast : undefined}>
              {part}{i < all.length - 1 && <span className={styles.crumbSep} aria-hidden="true">›</span>}
            </span>
          ))
          : <span className={styles.crumbNone}>No category yet</span>}
      </span>
      {how && <span className={styles.how} data-source={c.category_source}>{how}</span>}
      <span className={styles.labels}>
        <ChannelMarks channels={channels} />
        {(c.source_labels ?? []).map((l) => <span key={l} className={styles.sourceLabel}>{l}</span>)}
      </span>
      {onMove && (
        <span className={styles.moveWrap}>
          <button type="button" className={styles.move} aria-expanded={moving} onClick={() => setMoving((v) => !v)}>
            Move to…
          </button>
          {moving && <CategoryPicker current={c.category_id} onPick={onMove} onClose={() => setMoving(false)} />}
        </span>
      )}
    </div>
  );
}

// What the median was taken from, so a figure from three listings says so.
function medianLabelOf(read) {
  if (read?.basis === 'selling' && read.sellingSeen) return `median of ${read.sellingSeen} selling`;
  if (read?.basis === 'listed') return 'median of all listed, too few selling';
  return 'median';
}

// The headline over the rails: her price, where it sits, and whether that is a cost she is only trying.
function PriceHead({ a, base }) {
  const p = a.position;
  const word = p ? REF_WORD[p.refName] ?? p.refName : null;
  return (
    <header className={styles.priceHead}>
      <p className={styles.headline}>
        <span className={styles.headLabel}>List at</span>
        <span className={styles.headPrice} data-num>{formatGbp(a.price)}</span>
        {p && (p.inMarket
          ? <span className={styles.headIn}>in the market, level with {word} at <span data-num>{formatGbp(p.ref)}</span></span>
          : <span className={styles.headOver}><span data-num>+{formatGbp(p.over)}</span> over {word} at <span data-num>{formatGbp(p.ref)}</span></span>)}
        {a.trying && <span className={styles.headIf}>if the goods cost <span data-num>{formatGbp(a.goods)}</span></span>}
      </p>
      <Tip side="end">
        {base.store
          ? 'The top rail is what shops charge for it on Google, lowest to highest. The bottom rail is what you keep at each of those prices. The tag is your price.'
          : 'The top rail is the market: the shaded band is the middle half of what is listed, each dot a listing the check opened (filled if it has sold), the tick the median, the ring the small seller. The bottom rail is what you keep at each of those prices. The tag is your price.'}
      </Tip>
    </header>
  );
}

// Who is selling, on one line under the rails.
function SellerStrip({ base, c }) {
  const e = base.entry;
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>Who is selling</span>
      <span className={styles.stripGauge}><SellerGauge entry={e} ceiling={base.ceiling} compact /></span>
      {e ? (
        <span className={styles.stripFacts}>
          <span><b data-num>{e.sold_lifetime ?? '?'}</b> sold in {e.age_days} days</span>
          <span><b data-num>{base.perMonth != null ? base.perMonth.toLocaleString('en-GB') : 'too new'}</b> a month</span>
          <span><b data-num>{(c.active_listings ?? c.competition?.competitors ?? 0).toLocaleString('en-GB')}</b> competing</span>
          {e.item_id && <ListingLink id={e.item_id} />}
        </span>
      ) : (
        <span className={styles.stripFacts}>Untested: nobody in the sample has listed this recently.</span>
      )}
    </div>
  );
}

function GoogleStrip({ base }) {
  const g = base.g;
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>On Google</span>
      <span className={styles.stripFacts}>
        <span><b data-num>{g.rank != null ? `#${g.rank.toLocaleString('en-GB')}` : '?'}</b> in {g.category ?? 'its category'}</span>
        <span><b data-num>{g.months ?? '?'}</b> {g.months === 1 ? 'month' : 'months'} ranked</span>
        <span><b data-num>{base.shops.length}</b> UK {base.shops.length === 1 ? 'shop' : 'shops'}</span>
        <span>floor <b data-num>{base.floor != null ? formatGbp(base.floor) : '--'}</b></span>
        {base.ebay && <span>on eBay <b data-num>{formatGbp(base.ebay.price)}</b>, keeps <b data-num>{formatGbp(base.ebay.keep)}</b></span>}
      </span>
    </div>
  );
}

// A shelf edge ticket: the shop, what it called the product, the price, and how sure the price is as her cost.
function ShelfLabel({ shop, product, price, url, state }) {
  const Tag = url ? 'a' : 'div';
  const word = { confirmed: 'Same pack', estimate: 'Pack not checked', aside: 'Your supplier\'s cost is used' }[state];
  return (
    <Tag className={styles.label} data-state={state} {...(url ? { href: url, target: '_blank', rel: 'noreferrer noopener' } : {})}>
      <span className={styles.labelShop}>{shop}{url && <Icon name="IconOut" className={styles.labelOut} />}</span>
      <span className={styles.labelProduct}>{product}</span>
      <span className={styles.labelPrice} data-num>{price != null ? formatGbp(price) : 'No price'}</span>
      <span className={styles.labelState}>{word}</span>
    </Tag>
  );
}

function AlsoLook({ names, seen, label, q }) {
  const list = [...new Set(names.map(shopName))].filter((n) => n && n !== 'eBay' && n !== seen);
  if (!list.length) return null;
  return (
    <p className={styles.shops}>
      <span className={styles.shopsLabel}>{label}</span>
      {list.map((name) => (
        <a key={name} href={searchUrlFor(name, q)} target="_blank" rel="noreferrer noopener">{name}</a>
      ))}
    </p>
  );
}

function ListingLink({ id }) {
  return (
    <a className={styles.out} href={itmUrl(id)} target="_blank" rel="noreferrer noopener">
      Open listing <Icon name="IconOut" className={styles.outIcon} />
    </a>
  );
}

// What she keeps a sale, on one line. Green only when the cost is confirmed; est. in amber when it is not.
function KeepCell({ keep, confirmed, short = false, trying = false, market = false }) {
  const tone = keep < 0 ? styles.loses : short ? styles.short : trying ? styles.keepTry : confirmed ? styles.keepSure : styles.keepEst;
  return (
    <span className={styles.keepLine}>
      <span className={`${styles.keepFig} ${tone}`} data-num>{formatGbp(keep)}</span>
      {trying ? <b className={styles.ifMark}>if</b>
        : !confirmed && <b className={styles.est} title={market ? 'No shop price: the goods at the most the eBay price allows' : 'Pack not confirmed'}>est</b>}
    </span>
  );
}
