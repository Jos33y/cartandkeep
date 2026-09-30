import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { PriceSetter } from '@components/ui/portal/PriceSetter';
import { TillRoll } from '@components/ui/portal/TillRoll';
import { CostTry } from '@components/ui/portal/CostTry';
import { BriefStrip, ComparePanel } from '@components/ui/portal/CandidateBrief';
import { ShelfLabel, confirmSource } from '@components/ui/portal/CandidateRow';
import { assess, shopName } from '@lib/assess';
import { STATE_WORD, goLive, parcelFor, viewsOf } from '@lib/golive';
import { ListingComposer } from '@components/ui/portal/ListingComposer';
import { SearchTile } from '@components/ui/portal/SearchTile';
import { Icon } from '@components/ui/icons';
import { useApproved } from '@hooks/useApproved';
import { useDraft } from '@hooks/useDraft';
import { useSuppliers } from '@hooks/useSuppliers';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { breadcrumb } from '@utils/category';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/approved-page.module.css';

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'list', label: 'List at', align: 'right' },
  { key: 'keep', label: 'You keep', align: 'right' },
];

/*
 * What an approved row reads like, taken from products the gate has actually
 * passed rather than invented. Marked as an example on the screen, because a
 * figure she cannot tell from her own is worse than no figure.
 */
const ROWS = [
  { cells: ['Fairy Non Bio Washing Powder 4kg', '£32.31', '£8.60'] },
  { cells: ['Body Fuel Whey Protein 1kg', '£28.93', '£8.75'] },
  { cells: ['Sunrise Alarm Clock, wake up light', '£19.99', '£4.29'] },
  { cells: [] },
];

const band = (b) => (b ?? '').replace(/_/g, ' ');

const slugify = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

// Stripe rather than eBay. Same shape as store_product_margin, tenant rates
// first and the defaults it falls back to otherwise.
function storeKeep(price, fees, goods, postage) {
  if (price == null || goods == null) return null;
  const pct = fees?.store?.pct ?? 0.015;
  const fixed = fees?.store?.fixed ?? 0.2;
  return Math.round((price - (price * pct + fixed) - goods - (postage ?? 0)) * 100) / 100;
}
const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export function ApprovedPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, addSource, list, addToShop } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const [find, setFind] = useState('');
  const [only, setOnly] = useState(null);
  const [listed, setListed] = useState(null);

  useEffect(() => {
    if (!listed) return undefined;
    const t = setTimeout(() => setListed(null), 12000);
    return () => clearTimeout(t);
  }, [listed]);

  // Each card read once, with where it stands on each channel, from her saved draft.
  const assessed = useMemo(() => rows.map((r) => {
    const a = assess(r);
    return { row: r, a, gl: goLive(viewsOf(a), r, r.draft ?? {}) };
  }), [rows]);

  const counts = useMemo(() => ({
    ready: assessed.filter(({ gl }) => gl.ready).length,
    check: assessed.filter(({ gl }) => !gl.ready).length,
    half: assessed.filter(({ gl }) => gl.started.length > 0).length,
    edited: assessed.filter(({ a }) => a.edited).length,
  }), [assessed]);

  // After goods, at the proving seller's own price and rate. monthly_headroom is
  // before goods, which is how this header overstated what a month keeps.
  const monthly = assessed.reduce((s, { a }) => s + (a.month ?? 0), 0);

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={4} />;

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Approved"
        title="Nothing waiting to go live"
        icon="IconCheck"
        body="What you have approved, kept here until it is live on every channel it is meant for."
        columns={COLUMNS}
        rows={ROWS}
        note="Approving a candidate brings it here with the price a small seller is being paid and the most the goods can cost, so nothing is worked out twice. Anything you approve on Candidates lands here."
        action={{ to: portalPath('/candidates'), label: 'Go to candidates' }}
      />
    );
  }

  const match = ({ gl, a }) => !only || (only === 'ready' ? gl.ready : only === 'check' ? !gl.ready : only === 'half' ? gl.started.length > 0 : a.edited);
  const shown = assessed
    .filter(match)
    .filter(({ a }) => !find.trim() || a.title.toLowerCase().includes(find.trim().toLowerCase()));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className="micro">Approved</p>
          <h1 className={styles.title}>Going live</h1>
        </div>

        {monthly > 0 && (
          <div className={styles.worth}>
            <span className={styles.worthLabel}>At proven rates</span>
            <span className={`figure ${styles.worthValue}`}>{formatGbp(monthly)}</span>
            <span className={styles.worthFoot}>a month, where a seller is converting</span>
          </div>
        )}
      </header>

      {/* The state of the queue, and the way into it. At four rows it is a
          summary; at a hundred it is the only way to find anything. */}
      <div className={styles.states} role="tablist" aria-label="Filter">
        <StateTab id={null} only={only} setOnly={setOnly} icon="IconLayers"
          label="All" count={rows.length} />
        <StateTab id="ready" only={only} setOnly={setOnly} icon="IconCheck"
          label="Ready to go live" count={counts.ready} tone="positive" />
        <StateTab id="check" only={only} setOnly={setOnly} icon="IconInfo"
          label="Needs a look" count={counts.check} tone="warning" />
        {counts.half > 0 && (
          <StateTab id="half" only={only} setOnly={setOnly} icon="IconShop"
            label="One channel left" count={counts.half} />
        )}
        {counts.edited > 0 && (
          <StateTab id="edited" only={only} setOnly={setOnly} icon="IconNote"
            label="Edited" count={counts.edited} />
        )}

        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a product" />
        </span>
      </div>

      <div className={styles.list}>
        {shown.map(({ row, a, gl }) => (
          <Pack
            key={row.id}
            row={row}
            base={a}
            baseGl={gl}
            tenantId={tenant.id}
            fees={tenant.fees}
            suppliers={suppliers}
            onList={async (opts) => {
              const out = await list({ candidateId: row.id, ...opts });
              if (!opts.dry && out?.listing_id) setListed({ ...out, title: opts.title ?? row.title });
              return out;
            }}
            onShop={(product) => addToShop({ candidateId: row.id, product })}
            onSource={async (fields) => {
              await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}

        {shown.length === 0 && <p className={styles.quiet}>Nothing here.</p>}
      </div>

      {listed && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastIcon}><Icon name="IconCheck" className={styles.btnIcon} /></span>
          <div className={styles.toastText}>
            <strong>Live on eBay</strong>
            <span>{listed.title} · {formatGbp(listed.price)} · {listed.quantity} available</span>
          </div>
          <a className={styles.toastLink} href={`https://www.ebay.co.uk/itm/${listed.listing_id}`}
            target="_blank" rel="noreferrer noopener">
            View listing
            <Icon name="IconOut" className={styles.toastOut} />
          </a>
          <button type="button" className={styles.toastClose} aria-label="Dismiss"
            onClick={() => setListed(null)}>
            <Icon name="IconX" className={styles.toastOut} />
          </button>
        </div>
      )}
    </div>
  );
}

function StateTab({ id, only, setOnly, icon, label, count, tone }) {
  const on = only === id;
  return (
    <button type="button" role="tab" aria-selected={on}
      className={`${styles.state} ${on ? styles.stateOn : ''} ${tone ? styles[tone] : ''}`}
      onClick={() => setOnly(on ? null : id)}>
      <Icon name={icon} className={styles.stateIcon} />
      <span>{label}</span>
      <span className={styles.stateCount} data-num>{count}</span>
    </button>
  );
}

const CHANNEL = { ebay: { label: 'eBay', icon: 'IconTag' }, shop: { label: 'Your shop', icon: 'IconShop' } };

// One mark per channel the card is meant for, saying where it stands: to do, working, live, draft or on sale.
function ChannelStates({ gl, working }) {
  return (
    <span className={styles.channels}>
      {gl.wants.map((c) => {
        const st = working === c ? 'working' : gl.state[c];
        return (
          <span key={c} className={styles.channel} data-state={st}>
            <i aria-hidden="true" />{c === 'ebay' ? 'eBay' : 'Shop'} <b>{st === 'working' ? (c === 'ebay' ? 'Publishing' : 'Adding') : STATE_WORD[c][st]}</b>
          </span>
        );
      })}
    </span>
  );
}

// The fix words, joined as she would say them: "add photos, write the description and set the parcel".
const joinFixes = (xs) => {
  const words = [...new Set(xs.map((x) => x.fix).filter(Boolean))].map((w) => w.charAt(0).toLowerCase() + w.slice(1));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0] ?? '';
};

function Pack({ row, base, baseGl, tenantId, fees, suppliers, onSource, onList, onShop }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [shopping, setShopping] = useState(false);
  const [writing, setWriting] = useState(false);
  const [cheaper, setCheaper] = useState(false);
  const [trial, setTrial] = useState(null);
  const onTry = useCallback((cost, posted) => setTrial(cost == null ? null : { cost, posted }), []);
  const confirmRef = useRef(null);
  const cardRef = useRef(null);
  // She buys after each sale, and the shop caps how many one order can take.
  const [qty, setQty] = useState(Math.min(5, row.listing?.max_qty ?? 5));

  const { draft, change, revert, generate, upload, saving, edited } = useDraft(row, tenantId);

  // Live while editing, from the same function the closed line uses. A cost she is trying holds her price and moves
  // what she keeps.
  const whole = useMemo(() => assess({ ...row, draft }, trial ? { tryCost: trial.cost, tryPosted: trial.posted, holdPrice: true } : {}),
    [row, draft, trial]);
  // A store card the gate also passed is listed in two places, each at its own price.
  const both = Boolean(whole.store && whole.ebay);
  const [view, setView] = useState('store');
  const a = both && view === 'ebay' ? whole.ebay : whole;
  const setPrice = (v) => change(both && view === 'ebay' ? { ebay_price: v } : { price: v });
  const hero = (draft.images ?? [])[0] ?? row.image_url;
  // The closed row reads the saved draft; the open card reads the one she is typing.
  const gl = useMemo(() => (open ? goLive(viewsOf(whole), row, draft) : baseGl), [open, whole, row, draft, baseGl]);
  const status = gl.ready ? 'ready' : 'check';
  const working = busy ? 'ebay' : shopping ? 'shop' : null;

  const inShop = (row.store_products ?? [])[0] ?? null;
  // Always the shop's own figures, whichever view is open: a store card already keeps them, an eBay card is re-costed here.
  const shopKeep = whole.store ? whole.keep : storeKeep(whole.price, fees, whole.goods, whole.postage);
  const eView = viewsOf(whole).ebay;

  useEffect(() => {
    if (confirm) confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [confirm]);

  const goTo = (part) => {
    if (part === 'buy') setCheaper(true);
    requestAnimationFrame(() => cardRef.current?.querySelector(`[data-part="${part}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  async function sendToShop() {
    setShopping(true);
    setProblem(null);
    try {
      // Her copy and her photos only; the checklist has already refused the shop's.
      await onShop({
        slug: `${slugify(whole.title)}-${String(row.id).slice(0, 6)}`,
        title: draft.title ?? whole.title,
        description: draft.description ?? null,
        price: whole.price,
        image_url: (draft.images ?? [])[0] ?? null,
        images: draft.images ?? [],
        brand: whole.l?.brand ?? row.listing?.brand ?? null,
        category: whole.l?.shop_category ?? null,
        postage_band: whole.store ? whole.m.postage_band?.key ?? null : whole.m.headroom_band ?? null,
        landed_cost: whole.goods,
        postage_cost: whole.postage,
        cost_note: whole.best ? `${whole.store ? 'Price' : 'Shelf price'} at ${whole.best.supplier}` : null,
        cost_updated_at: new Date().toISOString(),
        source_ref: row.id,
      });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setShopping(false);
    }
  }

  // eBay checks the listing first and says which category it chose from the title; nothing goes up until Publish.
  async function review() {
    setBusy(true);
    setProblem(null);
    try {
      setConfirm(await onList({
        price: eView.price,
        quantity: qty,
        package: draft.package,
        title: draft.title,
        description: draft.description,
        images: draft.images,
        dry: true,
      }));
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Write for eBay from the checklist, without scrolling to the description first.
  async function writeWords() {
    setWriting(true);
    setProblem(null);
    try {
      change({ description: await generate('description') });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setWriting(false);
    }
  }

  const parcel = parcelFor(eView);
  const firstBlock = (c) => gl.checks[c]?.find((x) => x.hard && !x.ok) ?? null;
  const lockNote = working === 'ebay' ? 'eBay is publishing. Your shop waits until it is done.'
    : working === 'shop' ? 'Adding to your shop. eBay waits until it is done.' : null;

  const ebayLeft = gl.left.includes('ebay');
  const shopLeft = gl.left.includes('shop');
  const shopFirst = shopLeft && !ebayLeft;
  const shopButton = shopLeft && !(both && view === 'ebay') ? (
    <button type="button" className={shopFirst ? styles.primary : styles.ghost}
      disabled={shopping || busy || whole.goods == null || !gl.can.shop}
      title={busy ? lockNote : !gl.can.shop ? `Before your shop: ${firstBlock('shop')?.text ?? 'a check fails'}` : undefined}
      onClick={sendToShop}>
      <Icon name="IconShop" className={styles.btnIcon} />
      {shopping ? 'Adding' : shopKeep != null ? `Add to your shop, keep ${formatGbp(shopKeep)}` : 'Add to your shop'}
    </button>
  ) : null;
  const ebayButton = ebayLeft && (!both || view === 'ebay') ? (
    <button type="button" className={styles.primary}
      disabled={busy || shopping || eView.keep == null || eView.keep < 0 || !gl.can.ebay}
      title={shopping ? lockNote : !gl.can.ebay ? `Before eBay: ${firstBlock('ebay')?.text ?? 'a check fails'}` : undefined}
      onClick={review}>
      <Icon name="IconTag" className={styles.btnIcon} />
      {busy ? 'Checking with eBay' : `List on eBay at ${formatGbp(eView.price)}`}
    </button>
  ) : null;

  // The sentence under the kicker: what is left, in the order it matters.
  const sentence = (() => {
    const done = gl.started.map((c) => (c === 'ebay' ? `live on eBay${row.ebay?.published_at ? ` since ${when(row.ebay.published_at)}` : ''}` : `on your shop as a ${gl.state.shop === 'onSale' ? 'product on sale' : 'draft'}`));
    const lead = done.length ? `${done.join(' and ').replace(/^./, (x) => x.toUpperCase())}. ` : '';
    if (gl.ready) return `${lead}Everything checks for ${gl.left.map((c) => (c === 'ebay' ? 'eBay' : 'your shop')).join(' and ')}.`;
    const parts = gl.left.map((c) => {
      const hard = gl.checks[c].filter((x) => x.hard && !x.ok);
      const soft = gl.checks[c].filter((x) => !x.hard && !x.ok);
      if (hard.length) return `Before ${c === 'ebay' ? 'eBay' : 'your shop'}: ${joinFixes(hard)}.`;
      if (soft.length) return `${c === 'ebay' ? 'eBay' : 'Your shop'} can go now, with ${soft.length === 1 ? 'one thing' : `${soft.length} things`} to weigh.`;
      return `${c === 'ebay' ? 'eBay' : 'Your shop'} is ready.`;
    });
    return `${lead}${parts.join(' ')}`;
  })();

  const packOpen = !eView.store && !(eView.costConfirmed && !eView.packCheck) && eView.m?.shelf && ebayLeft;
  const pack = packOpen ? confirmSource(row, eView) : null;
  const shelf = a.m?.shelf ?? null;
  const product = a.store ? a.m.cost_from?.product : a.costFrom?.basis === 'supplier' ? 'Your supplier' : shelf?.product;
  const labelState = a.costFrom?.basis === 'supplier' ? 'confirmed' : a.store ? 'page' : a.costConfirmed ? 'confirmed' : 'estimate';
  const alts = [...new Set((a.shops ?? a.m.shops ?? []).map(shopName))]
    .filter((n) => n && n !== 'eBay' && n !== shopName(a.best?.supplier));
  const others = (row.sources ?? []).filter((src) => src.matched_on !== 'shelf');
  const notMine = [...new Set([...(row.listing?.images ?? []), row.image_url].filter(Boolean))];

  return (
    <article ref={cardRef} className={`${styles.pack} ${open ? styles.packOpen : ''}`} data-status={status}>
      {zoomed && <ImageLightbox src={hero} alt={a.title} onClose={() => setZoomed(false)} />}

      <div className={styles.top} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}>
        {hero
          ? (
            <button type="button" className={styles.thumb} aria-label={`View ${base.title} larger`}
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}>
              <img src={(draft.images ?? [])[0] ? hero : thumb(hero)} alt="" loading="lazy" />
            </button>
          )
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <h2 className={styles.name}>{draft.title || base.title}</h2>
          <p className={styles.evidence}>
            {base.store
              ? <><Icon name="IconCheck" className={styles.evIcon} />{base.g.rank != null ? <>Google best seller <b data-num>#{base.g.rank.toLocaleString('en-GB')}</b></> : 'Sells on Google'}{base.onEbay && ', and on eBay'}</>
              : base.entry?.proved
                ? <><Icon name="IconCheck" className={styles.evIcon} />Small seller converting at <b data-num>{formatGbp(base.entry.price)}</b></>
                : <><Icon name="IconInfo" className={styles.evIconWarn} />No small seller converting</>}
          </p>
          <span className={styles.flags}>
            <ChannelStates gl={gl} working={working} />
            {gl.first && (
              <span className={styles.flag} data-tone={gl.first.hard ? 'block' : 'warning'} title={`${CHANNEL[gl.first.channel].label}: ${gl.first.text}`}>
                <Icon name="IconFlag" className={styles.flagIcon} />{gl.first.text}
                {gl.open.length > 1 && <span className={styles.flagMore}>+{gl.open.length - 1}</span>}
              </span>
            )}
            {edited && <span className={styles.editedTag}>Edited</span>}
          </span>
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>List at</span>
          <span className={styles.fig} data-num>{a.price != null ? formatGbp(a.price) : '--'}</span>
          {a.position && (
            <span className={styles.status} data-tone={a.position.inMarket ? 'positive' : 'warning'}>
              <i />{a.position.inMarket ? 'In the market' : <><span data-num>{formatGbp(a.position.over)}</span> over</>}
            </span>
          )}
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>You keep</span>
          <span className={`${styles.fig} ${styles.keepFig}`} data-tone={a.keep == null ? undefined : a.keep < 0 ? 'negative' : a.target != null && a.keep < a.target ? 'short' : a.costConfirmed ? 'positive' : 'estimate'} data-num>
            {a.keep != null ? formatGbp(a.keep) : '--'}
          </span>
          <span className={styles.sub}>{a.keep == null ? 'no cost yet' : a.keep < 0 ? 'loses money' : a.target != null && a.keep < a.target ? `under your ${formatGbp(a.target)}` : a.costConfirmed ? 'confirmed' : 'estimate'}</span>
        </div>

        <span className={styles.caret} data-open={open || undefined} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {open && (
        <div className={styles.work}>
          {both && (
            <div className={styles.channelSwitch} role="tablist" aria-label="Where to list it">
              {[
                { key: 'store', label: 'Your shop', icon: 'IconShop', at: whole.price },
                { key: 'ebay', label: 'eBay', icon: 'IconTag', at: whole.ebay.price },
              ].map((o) => (
                <button key={o.key} type="button" role="tab" aria-selected={view === o.key}
                  className={`${styles.channelOption} ${view === o.key ? styles.channelOn : ''}`}
                  onClick={() => setView(o.key)}>
                  <Icon name={o.icon} className={styles.channelIcon} />
                  {o.label}
                  {o.at != null && <span className={styles.channelPrice} data-num>{formatGbp(o.at)}</span>}
                </button>
              ))}
            </div>
          )}

          <BriefStrip
            tone={gl.ready ? 'positive' : 'warning'}
            icon={gl.ready ? 'IconCheck' : 'IconInfo'}
            kicker={<>{gl.ready ? 'Ready to go live' : 'Needs a look'}{row.decision?.decided_at && <span className={styles.stripWhen}> · approved {when(row.decision.decided_at)}</span>}</>}
            checks={a.warnings.map((w) => ({ tone: /^Loses money/.test(w) ? 'negative' : 'info', text: w }))}
            action={!confirm && (
              <span className={styles.actions}>
                {shopButton}
                {ebayButton}
                {lockNote && <span className={styles.lockNote}>{lockNote}</span>}
              </span>
            )}>
            {sentence}
            {row.reference_url && <> <a className={styles.reference} href={row.reference_url} target="_blank" rel="noreferrer noopener">See the listing this came from</a></>}
          </BriefStrip>

          <GoLiveList gl={gl} row={row} onGo={goTo} parcel={parcel} onParcel={(box) => change({ package: box })}
            onWrite={writeWords} writing={writing} onPrice={setPrice} eView={eView} />

          {problem && <p className={styles.problem} role="alert">{problem}</p>}
          {!a.modelled && (
            <p className={styles.notice}>
              <Icon name="IconInfo" className={styles.noticeIcon} />
              Margin cannot move with the price on this row yet. Re-import its batch to add the cost model.
            </p>
          )}

          {confirm && (
            <div ref={confirmRef}>
              <Card raised className={styles.confirm}>
                <CardHead title="Publish to eBay"
                  note="eBay chose the category from the title. It is the one field nobody can check in advance." />

                <div className={styles.confirmGrid}>
                  <ConfirmItem label="Category" value={confirm.category.name} sub={`#${confirm.category.id}`} />
                  <ConfirmItem label="Price" value={formatGbp(confirm.price)} />
                  <div className={styles.confirmItem}>
                    <span className={styles.confirmLabel}>Quantity</span>
                    <span className={styles.qty}>
                      <button type="button" className={styles.qtyStep} aria-label="One fewer"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                      <span className={styles.confirmValue} data-num>{qty}</span>
                      <button type="button" className={styles.qtyStep} aria-label="One more"
                        onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
                    </span>
                    {a.l?.max_qty != null && qty > a.l.max_qty && (
                      <span className={styles.confirmWarn}>Shop limit is {a.l.max_qty} per order</span>
                    )}
                  </div>
                  <ConfirmItem label="Photographs" value={confirm.images} />
                  <ConfirmItem label="You keep" value={formatGbp(eView.keep)} tone="positive" />
                  <ConfirmItem label="Parcel" value={draft.package?.weight_kg ? `${draft.package.weight_kg}kg` : '--'}
                    sub={draft.package?.length_cm ? `${draft.package.length_cm} x ${draft.package.width_cm} x ${draft.package.height_cm}cm` : null} />
                </div>

                <p className={styles.confirmTitle}>{confirm.title ?? draft.title}</p>

                <div className={styles.confirmActions}>
                  <button type="button" className={styles.ghost} onClick={() => setConfirm(null)}>Back</button>
                  <button type="button" className={styles.primary} disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setProblem(null);
                      try {
                        await onList({
                          price: confirm.price,
                          quantity: qty,
                          package: draft.package,
                          title: draft.title,
                          description: draft.description,
                          images: draft.images,
                        });
                        setConfirm(null);
                      } catch (e) {
                        setProblem(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}>
                    {busy ? 'Publishing' : 'Publish'}
                  </button>
                </div>
              </Card>
            </div>
          )}

          <div className={styles.body}>
            <div className={styles.main}>
              {packOpen && (
                <div data-part="pack" className={styles.packPanel}>
                  <ComparePanel base={eView} image={row.image_url} />
                  {pack && (
                    <div className={styles.packActions}>
                      <button type="button" className={styles.ghost} onClick={() => goTo('buy')}>
                        <Icon name="IconX" className={styles.btnIcon} />Different pack, find the right one
                      </button>
                      <button type="button" className={eView.packCheck ? styles.ghost : styles.primary}
                        onClick={() => onSource(pack)}>
                        <Icon name="IconCheck" className={styles.btnIcon} />Same item and pack, confirm {formatGbp(pack.unit_cost)}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <section className={styles.panel} aria-label="Price" data-part="price">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconTag" className={styles.panelIcon} />Price</span>
                  <span className={styles.panelNote}>{a.store ? 'Against Google\'s prices, where buyers compare' : 'Against what is selling, not the middle of the field'}</span>
                </header>
                <PriceSetter a={a} market={row.competition} listings={a.marketRead?.listings ?? []}
                  medianLabel={a.marketRead?.basis === 'selling' && a.marketRead.sellingSeen ? `median of ${a.marketRead.sellingSeen} selling` : 'median'}
                  onChange={setPrice} />
              </section>

              <section className={styles.panel} aria-label="The listing" data-part="listing">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconNote" className={styles.panelIcon} />The listing</span>
                  <span className={styles.panelNote}>
                    {[a.l?.brand, breadcrumb(row.ebay_category_path) || a.l?.shop_category, band(a.m.headroom_band)].filter(Boolean).join(' · ')}
                    {edited && (
                      <span className={styles.draftState}>
                        {saving ? 'Saving' : 'Saved'}
                        <button type="button" className={styles.revert} onClick={revert}>Clear my edits</button>
                      </span>
                    )}
                  </span>
                </header>
                <ListingComposer listing={a.l ?? row.listing} draft={draft} onChange={change}
                  onGenerate={generate} onUpload={upload} notMine={notMine} />
                <Parcel box={draft.package} suggest={parcel} onChange={(box) => change({ package: box })} />
              </section>
            </div>

            <aside className={styles.side}>
              <TillRoll a={a} />

              <section className={styles.panel} aria-label="Where to buy it" data-part="buy">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconShop" className={styles.panelIcon} />Where to buy it</span>
                  <span className={styles.panelNote}>Only once one sells</span>
                </header>
                {a.best && (
                  <ShelfLabel shop={shopName(a.best.supplier) ?? a.best.supplier} product={product ?? a.title}
                    price={a.best.landed_unit_cost} url={a.best.url} state={labelState} />
                )}
                {(a.l?.in_stock || a.l?.max_qty != null) && (
                  <p className={styles.shopMeta}>
                    {a.l?.in_stock === 'yes' && <span className={styles.inStock}><span className={styles.dot} />In stock</span>}
                    {a.l?.in_stock === 'no' && <span className={styles.outStock}><span className={styles.dot} />Out of stock</span>}
                    {a.l?.max_qty != null && <span>Limit {a.l.max_qty} per order</span>}
                  </p>
                )}
                {alts.length > 0 && (
                  <p className={styles.alts}>
                    <span className={styles.altsLabel}>Also stocked by</span>
                    {alts.map((n) => <span key={n} className={styles.alt}>{n}</span>)}
                  </p>
                )}
                {others.length > 1 && (
                  <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} compact canAdd={false}
                    keepOf={(src) => assess({ ...row, draft }, {
                      tryCost: Number(src.landed_unit_cost), tryPosted: src.fulfilment === 'stock' ? 'you' : 'supplier', holdPrice: true,
                    }).keep} />
                )}
                {cheaper ? (
                  <div className={styles.tryIn}>
                    <CostTry onTry={onTry} base={a} view={a} suppliers={suppliers} onSave={onSource} hideStep />
                  </div>
                ) : (
                  <button type="button" className={styles.cheaper} onClick={() => setCheaper(true)}>
                    <Icon name="IconPlus" className={styles.btnIcon} />Found it cheaper?
                  </button>
                )}
              </section>

              <section className={styles.panel} aria-label="Why this one">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconSpark" className={styles.panelIcon} />Why this one</span>
                </header>
                {a.store ? (
                  <div className={styles.proofs}>
                    <Proof icon="IconCheck" tone="positive"
                      value={a.g.rank != null ? `#${a.g.rank.toLocaleString('en-GB')}` : 'Ranked'}
                      label={`among Google's UK best sellers${a.g.months ? `, in ${a.g.months} of the months checked` : ''}`} />
                    <Proof icon="IconChart"
                      value={a.g.min != null ? `${formatGbp(a.g.min)} to ${formatGbp(a.g.max)}` : 'Unknown'}
                      label="what shops charge for it on Google" />
                    <Proof icon="IconLayers" value={a.shops.length} label={a.shops.length === 1 ? 'UK shop stocks it' : 'UK shops stock it'} />
                  </div>
                ) : (
                  <div className={styles.proofs}>
                    <Proof icon="IconCheck" tone={a.entry?.proved ? 'positive' : 'warning'}
                      value={a.entry?.proved ? `${a.entry.sold_lifetime} sold` : 'Unproven'}
                      label={a.entry?.proved
                        ? `in ${a.entry.age_days} days by a ${Number(a.entry.seller_feedback).toLocaleString('en-GB')} feedback seller`
                        : 'no small seller converting'} />
                    <Proof icon="IconChart" value={a.month != null ? formatGbp(a.month) : 'Not proved'}
                      label="a month kept, at that seller's price and rate" />
                    <Proof icon="IconLayers" value={row.active_listings ?? 'Unknown'}
                      label="listings competing on the same search" />
                  </div>
                )}
              </section>

              {!a.store && (
                <section className={styles.panel} aria-label="In search results">
                  <header className={styles.panelHead}>
                    <span className={styles.panelTitle}><Icon name="IconSearch" className={styles.panelIcon} />In search results</span>
                    <span className={styles.panelNote}>All a buyer sees before opening it</span>
                  </header>
                  <SearchTile title={draft.title || a.title} image={(draft.images ?? [])[0] ?? null} price={a.price}
                    feedback={a.entry?.seller_feedback} compare={a.entry?.price} />
                </section>
              )}
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

// The go-live checklist: one column per channel the card is meant for. A channel already started says so; one
// still to do lists its checks, green when met, amber when it is hers to weigh, red when it holds the button, each
// with the one thing that fixes it.
function GoLiveList({ gl, row, onGo, parcel, onParcel, onWrite, writing, onPrice, eView }) {
  return (
    <section className={styles.golive} aria-label="Going live">
      {gl.wants.map((c) => (
        <div key={c} className={styles.goCol} data-channel={c}>
          <header className={styles.goHead}>
            <Icon name={CHANNEL[c].icon} className={styles.goIcon} />
            <span className={styles.goName}>{CHANNEL[c].label}</span>
            <span className={styles.goState} data-state={gl.state[c]}>{STATE_WORD[c][gl.state[c]]}</span>
            {gl.checks[c] && (
              <span className={styles.goCount} data-num>{gl.checks[c].filter((x) => x.ok).length} of {gl.checks[c].length}</span>
            )}
          </header>
          {gl.state[c] !== 'todo' ? (
            <p className={styles.goDone}>
              {c === 'ebay'
                ? <>Live at <b data-num>{formatGbp(row.ebay?.price)}</b>. {row.ebay?.listing_id && <a href={`https://www.ebay.co.uk/itm/${row.ebay.listing_id}`} target="_blank" rel="noreferrer noopener">View listing</a>} Revise it from Listings.</>
                : gl.state.shop === 'draft'
                  ? <>A draft on your shop. It goes on sale from <a href={portalPath('/products')}>Products</a> once its returns and hazard details are confirmed.</>
                  : <>On sale on your shop.</>}
            </p>
          ) : (
            <ul className={styles.goList}>
              {gl.checks[c].map((x) => (
                <li key={x.key} className={styles.goItem} data-ok={x.ok || undefined} data-hard={(!x.ok && x.hard) || undefined}>
                  <span className={styles.goMark} aria-hidden="true">
                    {x.ok
                      ? <svg viewBox="0 0 12 12"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" /></svg>
                      : x.hard ? <svg viewBox="0 0 12 12"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" /></svg> : <i />}
                  </span>
                  <span className={styles.goText}>{x.text}</span>
                  {!x.ok && x.fix && (
                    x.key === 'parcel' && parcel?.weight_kg ? (
                      <button type="button" className={styles.goFix} onClick={() => onParcel({ weight_kg: parcel.weight_kg, length_cm: parcel.length_cm, width_cm: parcel.width_cm, height_cm: parcel.height_cm })}>
                        Use {parcel.weight_kg}kg, {parcel.label}
                      </button>
                    ) : x.write ? (
                      <button type="button" className={styles.goFix} disabled={writing} onClick={onWrite}>{writing ? 'Writing' : 'Write it'}</button>
                    ) : x.key === 'price' && c === 'ebay' && eView.position && !eView.position.inMarket ? (
                      <button type="button" className={styles.goFix} onClick={() => onPrice(eView.position.ref)}>Match £{eView.position.ref.toFixed(2)}</button>
                    ) : (
                      <button type="button" className={styles.goFix} onClick={() => onGo(x.to)}>{x.fix}</button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

// The parcel as packed, which eBay's tracked services price by. Filled from the card's postage band when she agrees.
function Parcel({ box = {}, suggest, onChange }) {
  const v = box ?? {};
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  return (
    <div className={styles.parcel} data-part="parcel">
      <span className={styles.parcelHead}>
        <span className={styles.parcelTitle}>Parcel, as packed</span>
        {suggest && (
          <button type="button" className={styles.goFix}
            onClick={() => onChange({ ...v, ...Object.fromEntries(Object.entries(suggest).filter(([k]) => k !== 'label')) })}>
            Use the {suggest.label}{suggest.weight_kg ? `, ${suggest.weight_kg}kg` : ''}
          </button>
        )}
      </span>
      <div className={styles.parcelFields}>
        {[['weight_kg', 'Weight', 'kg'], ['length_cm', 'Length', 'cm'], ['width_cm', 'Width', 'cm'], ['height_cm', 'Height', 'cm']].map(([k, label, unit]) => (
          <label key={k} className={styles.parcelField}>
            <span>{label}</span>
            <span className={styles.parcelControl}>
              <input inputMode="decimal" data-num value={v[k] ?? ''} onChange={set(k)}
                placeholder={suggest?.[k] != null ? String(suggest[k]) : ''} />
              <span className={styles.parcelUnit}>{unit}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Proof({ icon, value, label, tone }) {
  return (
    <div className={styles.proof}>
      <span className={`${styles.proofIcon} ${tone ? styles[tone] : ''}`}>
        <Icon name={icon} className={styles.proofGlyph} />
      </span>
      <span className={`figure ${styles.proofValue}`}>{value}</span>
      <span className={styles.proofLabel}>{label}</span>
    </div>
  );
}

function ConfirmItem({ label, value, sub, tone }) {
  return (
    <div className={styles.confirmItem}>
      <span className={styles.confirmLabel}>{label}</span>
      <span className={`${styles.confirmValue} ${tone ? styles[tone] : ''}`} data-num>{value}</span>
      {sub && <span className={styles.confirmSub}>{sub}</span>}
    </div>
  );
}
