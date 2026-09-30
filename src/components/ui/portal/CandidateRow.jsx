import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarketBand } from './MarketBand';
import { SellerGauge } from './SellerGauge';
import { ImageLightbox } from './ImageLightbox';
import { SourceList } from './SourceList';
import { ChannelMarks } from './ChannelMarks';
import { REF_WORD } from './GapRail';
import { TillRoll } from './TillRoll';
import { CostTry } from './CostTry';
import { CategoryPicker } from './CategoryPicker';
import { BriefTabs, ComparePanel, DecisionStrip, EntryPanel, GapPanel, ShortPanel, SlowPanel, goodsUnder } from './CandidateBrief';
import { HOW_SET, categoryPath } from '@lib/categories';
import { Icon } from '@components/ui/icons';
import { formatGbp } from '@utils/formatGbp';
import { READY_MIN_SOLD, assess, shopName } from '@lib/assess';
import { REJECTION_REASONS } from '@utils/constants';
import styles from '@styles/ui/portal/candidate-row.module.css';

const VERDICT = { approve: 'Approved', reject: 'Rejected', defer: 'Later' };
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

const NEED_LABEL = {
  part: 'Part or refill', pest: 'Pest', damp: 'Damp and mould', 'clean-fix': 'Fix', safety: 'Safety', plumbing: 'Plumbing part',
  care: 'Care aid', winter: 'Winter need', pain: 'Pain relief', monitor: 'Monitor',
};
// A need with no label yet reads with a capital, never as the raw tag.
const needLabel = (k) => NEED_LABEL[k] ?? String(k).replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// A store card's rank sits in its own cell, so the line says what Google charges and where it is stocked.
function storeEvidence(a) {
  const g = a.g;
  // A store card keeps its shop in cost_from; the shelf is only the fallback.
  const shop = a.m?.cost_from?.shop ?? a.m?.shelf?.shop;
  const price = a.m?.cost ?? a.m?.shelf?.price;
  const where = shop ? `${shopName(shop) ?? shop}${price != null ? ` ${formatGbp(price)}` : ''}` : 'no UK shop yet';
  if (g.min == null) return { icon: 'IconInfo', tone: 'muted', text: `Sells on Google · ${where}` };
  return { icon: 'IconCheck', tone: 'positive', lead: formatGbp(g.min), text: `Google low · ${where}` };
}

// Who proves the market, in one line. The price leads and is never the part cut off; the words give way first.
function evidenceOf(a) {
  if (a.store) return storeEvidence(a);
  const e = a.entry;
  if (!e) return { icon: 'IconInfo', tone: 'muted', text: 'No recent seller in the sample' };
  const lead = e.price != null ? formatGbp(e.price) : null;
  if (a.entryLoses) {
    return { icon: 'IconInfo', tone: 'warning', lead, text: `small seller, ${fb(e.seller_feedback)} feedback`, note: 'Price loses money' };
  }
  if (e.proved && a.trusted) {
    return { icon: 'IconCheck', tone: 'positive', lead, text: `small seller, ${fb(e.seller_feedback)} feedback` };
  }
  if (e.proved) {
    return { icon: 'IconInfo', tone: 'warning', lead, text: `small seller, ${fb(e.seller_feedback)} feedback`, note: 'Outside search range' };
  }
  if (a.entryThin) {
    return { icon: 'IconInfo', tone: 'warning', lead, text: `small seller, sold ${e.sold_lifetime ?? 'a few'} in ${e.age_days} days` };
  }
  return { icon: 'IconInfo', tone: 'warning', text: `Large sellers only, smallest ${fb(e.seller_feedback)} feedback` };
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

// The row's flags in two kinds: what asks something of her (amber, with a flag), and plain facts (quiet words).
function flagsOf(c, a, note = null) {
  const from = String(a.best?.ships_from ?? '').trim().toUpperCase();
  const pill = matchPill(a.match);
  const act = [
    c.category_flag === 'check_same_product' && 'Check it is the same product',
    a.packCheck && 'Check pack size',
    !a.store && !a.packCheck && a.costBasis === 'seen' && !a.costConfirmed && 'Check pack',
    pill?.tone === 'warning' && pill.text,
  ].filter(Boolean);
  const facts = [
    note && { kind: 'caution', text: note },
    pill?.tone === 'positive' && { kind: 'match', text: pill.text },
    c.routes === 'branded' && { kind: 'branded', text: 'Branded' },
    c.routes === 'china' && { kind: 'open', text: 'Open market' },
    Boolean(from) && from !== 'GB' && from !== 'UK' && { kind: 'import', text: `Import, from ${from}` },
    a.store && a.m.need && { kind: 'need', text: needLabel(a.m.need) },
    a.store && c.cluster && c.cluster !== 'All year' && { kind: 'season', text: c.cluster },
  ].filter(Boolean);
  return { act: act[0] ?? null, more: act.length - 1, acts: act, facts };
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

export function CandidateRow({
  candidate: c, a: base, active, open, rejecting, selected = false, soldMax = 0,
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
  const flags = flagsOf(c, base, ev.note);
  const [peek, setPeek] = useState(null);
  const [seed, setSeed] = useState(null);
  // A scroll moves the row out from under the peek without a pointer leave, so the peek closes on scroll.
  useEffect(() => {
    if (!peek) return undefined;
    const close = () => setPeek(null);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [peek]);
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

  // The one action the brief's strip offers for this lane. Its key shows on hover, as on the row.
  const [tab, setTab] = useState(null);
  const rowRef = useRef(null);
  // The cost field lives on the Market tab, or in the gap panel on an over card; another tab open, it opens Market.
  const focusTry = useCallback(() => {
    const field = () => rowRef.current?.querySelector('[data-try]');
    if (field()) { field().focus(); return; }
    setTab('market');
    requestAnimationFrame(() => field()?.focus());
  }, []);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return undefined;
    el.addEventListener('ck:try', focusTry);
    return () => el.removeEventListener('ck:try', focusTry);
  }, [focusTry]);
  function briefAction() {
    if (decision) return null;
    const pack = confirmSource(c, base);
    if (base.lane === 'pack' && pack) {
      // Far apart in price, the likelier answer is a different pack, so confirming steps down to a quiet button and
      // the other answer sits beside it at the same weight.
      const wary = base.packCheck;
      return (
        <>
          {wary && (
            <button type="button" className={styles.briefDiff} onClick={focusTry} data-tip="Add the cost of the right pack">
              <Icon name="IconX" className={styles.confirmIcon} />Different pack
            </button>
          )}
          <button type="button" className={`${styles.confirm} ${wary ? styles.confirmWary : ''}`} disabled={busy}
            onClick={() => run(() => onSource(pack))} data-tip="Confirm  C">
            <Icon name="IconCheck" className={styles.confirmIcon} />
            Same item and pack, confirm <span data-num>{formatGbp(shelf.price)}</span>
          </button>
        </>
      );
    }
    if (base.lane === 'over' || base.lane === 'short' || base.lane === 'dear') {
      return (
        <>
          {base.lane === 'dear' && (
            <a className={styles.briefOut} href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(c.title)}`}
              target="_blank" rel="noreferrer noopener">
              See Google&apos;s prices <Icon name="IconOut" className={styles.confirmIcon} />
            </a>
          )}
        <button type="button" className={styles.briefTry} onClick={focusTry} data-tip="Try a cost  T">
          <Icon name="IconTag" className={styles.confirmIcon} />Try a cost
        </button>
        </>
      );
    }
    if (base.lane === 'price' && base.entry?.item_id) {
      return (
        <a className={styles.briefOut} href={itmUrl(base.entry.item_id)} target="_blank" rel="noreferrer noopener">
          Open their listing <Icon name="IconOut" className={styles.confirmIcon} />
        </a>
      );
    }
    // Untested: the listing of whoever is selling, to see who they are. Sells slowly: everything checks, so Approve,
    // outlined, since the pace is her call.
    if (base.lane === 'untested' && base.entry?.item_id) {
      return (
        <a className={styles.briefOut} data-tone="slate" href={itmUrl(base.entry.item_id)} target="_blank" rel="noreferrer noopener">
          Open their listing <Icon name="IconOut" className={styles.confirmIcon} />
        </a>
      );
    }
    if (base.lane === 'slow') {
      return (
        <button type="button" className={styles.briefApproveQuiet} disabled={busy} onClick={() => decide('approve')} data-tip="Approve  A">
          <Icon name="IconCheck" className={styles.confirmIcon} />Approve
        </button>
      );
    }
    if (base.lane === 'ready' || base.lane === 'store') {
      return (
        <button type="button" className={styles.briefApprove} disabled={busy} onClick={() => decide('approve')} data-tip="Approve  A">
          <Icon name="IconCheck" className={styles.confirmIcon} />Approve
        </button>
      );
    }
    return null;
  }

  // Everything that asks for a look, in full, once, under the strip: the row's flags and the card's warnings. What
  // the strip's own sentence already says is left out, and a short flag gives way to the warning that says it in full.
  const said = {
    pack: (t) => /^Check pack/.test(t) || /^Converting at/.test(t),
    price: (t) => t === 'Outside search range' || /^Priced at the median/.test(t),
    // Only when the strip's sentence is the one about the small seller losing money, which it is in the market.
    over: (t) => base.entryLoses && base.position?.inMarket && t === 'Price loses money',
  }[base.lane] ?? (() => false);
  const checks = [
    ...flags.acts.filter((t) => !said(t) && !(base.packCheck && t === 'Check pack size')).map((text) => ({ tone: 'warning', text })),
    ...flags.facts.filter((f) => f.kind === 'caution' && !said(f.text))
      .map((f) => ({ tone: base.entryLoses ? 'negative' : 'warning', text: longCaution(f.text) })),
    ...base.warnings.filter((t) => !said(t)).map((text) => ({ tone: /^Loses money/.test(text) ? 'negative' : 'info', text })),
  ];

  return (
    <article
      ref={rowRef}
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
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') { const r = e.currentTarget.getBoundingClientRect(); setPeek({ x: r.right + 12, y: r.top + r.height / 2 }); } }}
            onPointerLeave={() => setPeek(null)}>
            <img src={thumb(c.image_url)} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        {/* Hovering the photo shows it at a size that can be recognised. Fixed, so the lane's clipping cannot cut it. */}
        {peek && (
          <span className={styles.peek} style={{ left: peek.x, top: peek.y }} aria-hidden="true">
            <img src={c.image_url} alt="" />
          </span>
        )}

        <button type="button" className={styles.subject} onClick={onToggle} aria-expanded={open}>
          <span className={styles.nameRow}>
            <span className={styles.name}>{base.title}</span>
          </span>
          <span className={`${styles.ev} ${styles[ev.tone]}`}>
            <Icon name={ev.icon} className={styles.evIcon} />
            {ev.lead && <span className={styles.evLead} data-num>{ev.lead}</span>}
            <span className={styles.evText}>{ev.text}</span>
          </span>
          <span className={styles.flags}>
              <ChannelMarks channels={base.channels} compact />
              {flags.act && (
                <span className={styles.flag} title={flags.act}>
                  <Icon name="IconFlag" className={styles.flagIcon} />{flags.act}
                  {flags.more > 0 && <span className={styles.flagMore}>+{flags.more}</span>}
                </span>
              )}
              {flags.facts.map((f) => (
                <span key={f.text} className={styles.fact} data-kind={f.kind} title={f.text}>{f.text}</span>
              ))}
          </span>
        </button>

        <div className={`${styles.cell} ${styles.cellMarket}`}>
          {base.store ? (
            <>
              <span className={styles.cellLabel}>On Google</span>
              {base.g.rank != null ? (
                <>
                  <span className={styles.fig} data-num>#{base.g.rank.toLocaleString('en-GB')}</span>
                  <Months n={base.g.months} />
                </>
              ) : <span className={styles.none}>Not ranked</span>}
            </>
          ) : (
            <>
              <span className={styles.cellLabel}>Sells</span>
              {c.sold_30d != null ? <SoldCell sold={c.sold_30d} max={soldMax} /> : <span className={styles.none}>Not read</span>}
            </>
          )}
        </div>

        <div className={`${styles.cell} ${styles.cellPrice}`}>
          <span className={styles.cellLabel}>Your price</span>
          {a.price != null ? (
            <>
              <span className={styles.fig} data-num>{formatGbp(a.price)}</span>
              <MarketStatus position={a.position} />
            </>
          ) : <span className={styles.none}>No price yet</span>}
        </div>

        <div className={`${styles.cell} ${styles.cellKeep}`}>
          <span className={styles.cellLabel}>You keep</span>
          {a.keep != null ? (
            <KeepCell keep={a.keep} short={!a.trying && base.lane === 'short'} confirmed={a.costConfirmed && !a.trying}
              trying={a.trying} market={a.costBasis === 'market'} pending={!a.trying && base.packCheck} />
          ) : (
            <span className={styles.none}>No cost</span>
          )}
        </div>

        <div className={styles.actions}>
          {decision ? (
            <>
              <span className={styles.decided} data-tone={TONE[decision.action]}>
                <span className={styles.verdict} role="status"><i aria-hidden="true" />{VERDICT[decision.action]}</span>
                <button type="button" className={styles.undo} disabled={busy} onClick={() => run(onClear)} data-tip="Undo  U">
                  <Icon name="IconUndo" className={styles.undoIcon} />
                  Undo<span className="visually-hidden"> decision on {base.title}</span>
                </button>
              </span>
            </>
          ) : (
            <>
              <button type="button" className={`${styles.act} ${styles.later}`} disabled={busy} data-tip="Later  L"
                onClick={() => decide('defer')} aria-label={`Later, ${base.title}`}>
                <Icon name="IconClock" className={styles.btnIcon} />
              </button>
              <button type="button" className={`${styles.act} ${styles.reject} ${rejecting ? styles.actOn : ''}`} disabled={busy}
                data-tip="Reject  R" onClick={onReject} aria-label={`Reject, ${base.title}`} aria-expanded={rejecting}>
                <Icon name="IconX" className={styles.btnIcon} />
              </button>
              <button type="button" className={styles.approve} disabled={busy} data-tip="Approve  A"
                onClick={() => decide('approve')}>
                <svg className={styles.approveTick} viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
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
          <DecisionStrip base={base} decision={decision} readyMin={READY_MIN_SOLD} action={briefAction()} checks={decision ? [] : checks} />

          <div className={styles.main}>
            {base.lane === 'pack' && !decision && base.m?.shelf && (
              <div className={styles.lanePanel}>
                <ComparePanel base={base} image={c.image_url} />
              </div>
            )}

            {base.lane === 'untested' && !decision && (
              <div className={styles.lanePanel}><EntryPanel base={base} competing={c.active_listings ?? c.competition?.competitors} /></div>
            )}
            {base.lane === 'slow' && !decision && (
              <div className={styles.lanePanel}><SlowPanel base={base} /></div>
            )}
            {base.lane === 'short' && !decision && (
              <div className={styles.lanePanel}>
                <ShortPanel a={a} base={base} onFill={(v) => setSeed({ value: v })}>
                  <CostTry onTry={onTry} base={base} view={a} suppliers={suppliers} onSave={(fields) => onSource(fields)} seed={seed} hideStep />
                </ShortPanel>
              </div>
            )}

            {(base.lane === 'over' || base.lane === 'dear') && !decision && (
              <div className={styles.lanePanel}>
                <GapPanel a={a} base={base} onFill={(v) => setSeed({ value: v })} title={base.lane === 'dear' ? 'Gap to Google\'s lowest' : undefined}>
                  <CostTry onTry={onTry} base={base} view={a} suppliers={suppliers} onSave={(fields) => onSource(fields)} seed={seed} hideStep />
                </GapPanel>
              </div>
            )}

            <BriefTabs value={tab ?? (['over', 'dear', 'short'].includes(base.lane) && !decision ? 'sources' : 'market')} onChange={setTab} tabs={[
              {
                key: 'market', label: 'Market', icon: 'IconChart',
                body: (
                  <div className={styles.marketPanel}>
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
                      scale={[base.entry?.price, base.price, base.position?.ref]}
                      ghost={!a.trying && base.position && !base.position.inMarket && base.landsUnder != null
                        ? { price: base.position.ref, note: base.postedBy === 'you' && goodsUnder(base) > 0 ? `goods under ${formatGbp(goodsUnder(base))}` : `under ${formatGbp(base.landsUnder)} posted` }
                        : null} />
                    {base.store ? <GoogleStrip base={base} /> : <SellerStrip base={base} c={c} />}
                    {(!['over', 'dear', 'short'].includes(base.lane) || decision) && (
                      <>
                        <div className={styles.tryRule} />
                        <CostTry onTry={onTry} base={base} view={a} suppliers={suppliers} onSave={(fields) => onSource(fields)} hideStep />
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: 'sources', label: 'Where it was seen', icon: 'IconShop', count: (c.sources ?? []).length || null,
                body: (
                  <div className={styles.seenPanel}>
                    {base.store ? (
                      <ShelfLabel shop={shopName(base.m.cost_from?.shop) ?? 'The shop'} product={base.m.cost_from?.product ?? c.title}
                        price={base.m.cost} url={base.m.cost_from?.url} state="page" />
                    ) : (shelf?.price != null || shelf?.url) ? (
                      <ShelfLabel shop={shopName(shelf.shop) ?? 'The shop'} product={shelf.product} price={shelf.price} url={shelf.url}
                        state={base.costFrom?.basis === 'supplier' ? 'aside' : base.shelfIsCost ? 'confirmed' : 'estimate'} />
                    ) : (
                      <p className={styles.quietText}>Not seen in a UK shop yet. The price is built on the most the eBay price allows the goods to cost.</p>
                    )}
                    <p className={styles.quietText}>Proof it can be bought in the UK. The photo and wording are the shop&apos;s, so never used on your listings.</p>
                    <AlsoLook names={base.store ? base.shops.slice(1) : (base.m.shops ?? [])} seen={base.store ? shopName(base.m.cost_from?.shop) : shopName(shelf?.shop)}
                      label={base.store ? 'Also stocked at' : 'Also look at'} q={encodeURIComponent(c.title)} />
                    <SourceList candidate={c} onAdd={onSource} suppliers={suppliers} compact canAdd={false} keepOf={keepOf} />
                  </div>
                ),
              },
              {
                key: 'notes', label: 'Notes', icon: 'IconNote', count: (c.notes ?? []).length || null,
                body: (
                  <div className={styles.notesBody}>
                    {!(c.notes ?? []).length && (
                      <p className={styles.notesEmpty}>
                        <Icon name="IconNote" className={styles.notesEmptyIcon} />
                        No notes yet. Supplier leads and size questions go here, seen by you and the studio.
                      </p>
                    )}
                    {(c.notes ?? []).map((note) => (
                      <p key={note.id} className={styles.noteItem}>
                        <span className={styles.noteWhen} data-num>
                          {new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })
                            .format(new Date(note.created_at))}
                        </span>
                        {note.body}
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
                ),
              },
            ]} />
          </div>

          <aside className={styles.side}>
            <section className={styles.moneyPanel} aria-label="Where the money goes">
              <TillRoll a={a} />
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
      <div className={styles.categoryTop}>
        <span className={styles.crumbs}>
          {path
            ? path.split(' > ').map((part, i, all) => (
              <span key={`${part}-${i}`} className={i === all.length - 1 ? styles.crumbLast : undefined}>
                {part}{i < all.length - 1 && <span className={styles.crumbSep} aria-hidden="true">›</span>}
              </span>
            ))
            : <span className={styles.crumbNone}>No category yet</span>}
        </span>
        {onMove && (
          <span className={styles.moveWrap}>
            <button type="button" className={styles.move} aria-expanded={moving} onClick={() => setMoving((v) => !v)}>
              Move to
              <Icon name="IconCaret" className={styles.moveCaret} />
            </button>
            {moving && <CategoryPicker current={c.category_id} onPick={onMove} onClose={() => setMoving(false)} />}
          </span>
        )}
      </div>
      <div className={styles.labels}>
        {how && <span className={styles.how} data-source={c.category_source}>{how}</span>}
        <ChannelMarks channels={channels} compact />
        {[...new Set((c.source_labels ?? []).map((l) => shopName(l) ?? l))].map((l) => <span key={l} className={styles.sourceLabel}>{l}</span>)}
      </div>
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
// Who is selling, on one line under the rails.
function SellerStrip({ base, c }) {
  const e = base.entry;
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}><Icon name="IconPeople" className={styles.stripIcon} />Who is selling</span>
      {e ? (
        <>
          <span className={styles.stripGauge}>
            <SellerGauge entry={e} ceiling={base.ceiling} compact />
          </span>
          <span className={styles.stripFacts}>
            <span><b data-num>{e.sold_lifetime ?? '?'}</b> sold in {e.age_days} days</span>
            <span><b data-num>{base.perMonth != null ? base.perMonth.toLocaleString('en-GB') : 'too new'}</b> a month</span>
            <span><b data-num>{(c.active_listings ?? c.competition?.competitors ?? 0).toLocaleString('en-GB')}</b> competing</span>
            {e.item_id && <ListingLink id={e.item_id} />}
          </span>
        </>
      ) : (
        <span className={styles.stripNone}>
          <b>Nobody your size selling.</b> No small seller in the sample has listed it recently.
        </span>
      )}
    </div>
  );
}

// A caution chip on the row is cut short; under the strip it is said in full.
function longCaution(text) {
  if (text === 'Price loses money') return "The small seller's price loses money at your cost";
  if (text === 'Outside search range') return "The small seller's price is outside this search's range";
  return text;
}

function GoogleStrip({ base }) {
  const g = base.g;
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}><Icon name="IconSearch" className={styles.stripIcon} />On Google</span>
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
export function ShelfLabel({ shop, product, price, url, state }) {
  const Tag = url ? 'a' : 'div';
  const word = { confirmed: 'Same pack', page: 'Page checked', estimate: 'Pack not checked', aside: 'Your supplier\'s cost is used' }[state];
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

// What she keeps a sale, and in words how sure that is. Green only on a confirmed cost. A card whose pack is not
// confirmed shows the estimate faded, since the flag on the row asks the question.
function KeepCell({ keep, confirmed, short = false, trying = false, market = false, pending = false }) {
  const tone = keep < 0 ? styles.loses : short ? styles.short : trying ? styles.keepTry : confirmed ? styles.keepSure : styles.keepEst;
  const word = keep < 0 ? 'loses money' : trying ? 'if you pay that' : confirmed ? 'confirmed' : pending ? 'pack to confirm' : market ? 'at the most goods can cost' : 'estimate';
  return (
    <>
      <span className={`${styles.fig} ${styles.keepFig} ${tone}`} data-pending={pending || undefined} data-num>{formatGbp(keep)}</span>
      <span className={styles.sub} data-tone={keep < 0 ? 'negative' : confirmed && !trying ? 'positive' : trying ? 'info' : 'warning'}>{word}</span>
    </>
  );
}

// Sold a month over a bar on a square-root scale shared by every row on screen: the busy markets stand out as the
// eye runs down the column, and the quiet ones still register.
function SoldCell({ sold, max }) {
  const share = max > 0 ? Math.sqrt(Math.max(0, sold) / max) : 0;
  return (
    <>
      <span className={styles.figLine}>
        <span className={styles.fig} data-num>{sold.toLocaleString('en-GB')}</span>
        <span className={styles.unit}>a month</span>
      </span>
      <span className={styles.soldBar} aria-hidden="true"><span style={{ width: `${Math.max(sold > 0 ? 4 : 0, share * 100)}%` }} /></span>
    </>
  );
}

// The months a store card ranked in, as dots: four exported periods so far.
function Months({ n }) {
  const total = Math.max(4, n ?? 0);
  return (
    <span className={styles.months} title={n != null ? `Ranked in ${n} of the months exported` : undefined}>
      {Array.from({ length: total }, (_, i) => <i key={i} data-on={i < (n ?? 0) || undefined} />)}
      <span className={styles.unit}>{n ?? 0} of {total} months</span>
    </span>
  );
}

// Where her price sits against the market, in words: in it, or how far over and over what.
function MarketStatus({ position }) {
  if (!position) return <span className={styles.sub}>no market price</span>;
  const word = REF_WORD[position.refName] ?? position.refName;
  if (position.inMarket) {
    return <span className={styles.status} data-tone="positive" title={`At or under ${word} at ${formatGbp(position.ref)}`}><i />In the market</span>;
  }
  return (
    <span className={styles.status} data-tone="warning" title={`Over ${word} at ${formatGbp(position.ref)}`}>
      <i /><span data-num>{formatGbp(position.over)}</span> over <span data-num>{formatGbp(position.ref)}</span>
    </span>
  );
}
