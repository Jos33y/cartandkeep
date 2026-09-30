import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { PriceSetter } from '@components/ui/portal/PriceSetter';
import { TillRoll } from '@components/ui/portal/TillRoll';
import { CostTry } from '@components/ui/portal/CostTry';
import { BriefStrip } from '@components/ui/portal/CandidateBrief';
import { ShelfLabel } from '@components/ui/portal/CandidateRow';
import { REF_WORD } from '@components/ui/portal/GapRail';
import { STORE_OVER, assess, shopName } from '@lib/assess';
import { ListingComposer } from '@components/ui/portal/ListingComposer';
import { SearchTile } from '@components/ui/portal/SearchTile';
import { Icon } from '@components/ui/icons';
import { ChannelMarks } from '@components/ui/portal/ChannelMarks';
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

  const assessed = useMemo(() => rows.map((r) => ({ row: r, a: assess(r) })), [rows]);

  const counts = useMemo(() => ({
    ready: assessed.filter(({ a }) => a.ready).length,
    check: assessed.filter(({ a }) => !a.ready).length,
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
        title="Nothing approved yet"
        icon="IconCheck"
        body="What you have committed to, kept together so you can price it and write it before anything goes live."
        columns={COLUMNS}
        rows={ROWS}
        note="Approving a candidate brings it here with the price a small seller is being paid and the most the goods can cost, so nothing is worked out twice. Anything you approve on Candidates lands here."
        action={{ to: portalPath('/candidates'), label: 'Go to candidates' }}
      />
    );
  }

  const shown = assessed
    .filter(({ a }) => !only || (only === 'ready' ? a.ready : only === 'check' ? !a.ready : a.edited))
    .filter(({ a }) => !find.trim() || a.title.toLowerCase().includes(find.trim().toLowerCase()));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className="micro">Approved</p>
          <h1 className={styles.title}>Ready to list</h1>
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
          label="Ready to publish" count={counts.ready} tone="positive" />
        <StateTab id="check" only={only} setOnly={setOnly} icon="IconInfo"
          label="Needs a look" count={counts.check} tone="warning" />
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
        {shown.map(({ row, a }) => (
          <Pack
            key={row.id}
            row={row}
            base={a}
            tenantId={tenant.id}
            fees={tenant.fees}
            suppliers={suppliers}
            onList={async (opts) => {
              const out = await list({ candidateId: row.id, ...opts });
              if (!opts.dry && out?.listing_id) setListed({ ...out, title: opts.title ?? row.listing?.title ?? row.title });
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

// What stands between an approved card and going up, each said in full: the card's warnings, and a price over the
// market it lists against.
function checksOf(a) {
  const p = a.position;
  const out = [];
  if (p && !p.inMarket) {
    const word = REF_WORD[p.refName] ?? p.refName;
    out.push({ tone: a.store && p.pct > STORE_OVER ? 'negative' : 'warning', text: `${formatGbp(p.over)} over ${word} at ${formatGbp(p.ref)}` });
  }
  for (const w of a.warnings) out.push({ tone: /^Loses money/.test(w) ? 'negative' : 'info', text: w });
  // A shop card is never ready without its own photographs, so the reason is said. eBay takes the listing's.
  if (a.store && !(a.images ?? []).length) out.push({ tone: 'warning', text: 'No photographs yet, add them under The listing' });
  return out;
}

function Pack({ row, base, tenantId, fees, suppliers, onSource, onList, onShop }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [shopping, setShopping] = useState(false);
  const [trial, setTrial] = useState(null);
  const onTry = useCallback((cost, posted) => setTrial(cost == null ? null : { cost, posted }), []);
  const confirmRef = useRef(null);
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
  const hero = whole.images[0] ?? row.image_url;
  const status = base.ready ? 'ready' : 'check';
  const checks = checksOf(a);
  const closedChecks = checksOf(base);

  const inShop = (row.store_products ?? [])[0] ?? null;
  // Always the shop's own figures, whichever view is open: a store card already keeps them, an eBay card is re-costed here.
  const shopKeep = whole.store ? whole.keep : storeKeep(whole.price, fees, whole.goods, whole.postage);

  useEffect(() => {
    if (confirm) confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [confirm]);

  async function sendToShop() {
    setShopping(true);
    setProblem(null);
    try {
      await onShop({
        slug: `${slugify(whole.title)}-${String(row.id).slice(0, 6)}`,
        title: whole.title,
        description: draft.description ?? a.l?.description ?? null,
        price: whole.price,
        image_url: whole.images[0] ?? null,
        images: whole.images,
        brand: whole.l?.brand ?? null,
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
        price: a.price,
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

  const onEbayView = !a.store;
  const shopButton = (both && view === 'ebay') ? null : inShop ? (
    <span className={styles.inShop}>
      <Icon name="IconCheck" className={styles.btnIcon} />
      On your shop as a {inShop.status}
    </span>
  ) : (
    // On a shop card it is the main action, unless the price is far over what shoppers compare it with.
    <button type="button" className={onEbayView || checks.some((c) => c.tone === 'negative') ? styles.ghost : styles.primary} disabled={shopping || whole.goods == null}
      onClick={sendToShop}>
      <Icon name="IconShop" className={styles.btnIcon} />
      {shopping ? 'Adding' : shopKeep != null ? `Add to your shop, keep ${formatGbp(shopKeep)}` : 'Add to your shop'}
    </button>
  );

  const shelf = a.m?.shelf ?? null;
  const product = a.store ? a.m.cost_from?.product : a.costFrom?.basis === 'supplier' ? 'Your supplier' : shelf?.product;
  const labelState = a.costFrom?.basis === 'supplier' ? 'confirmed' : a.store ? 'page' : a.costConfirmed ? 'confirmed' : 'estimate';
  const alts = [...new Set((a.shops ?? a.m.shops ?? []).map(shopName))]
    .filter((n) => n && n !== 'eBay' && n !== shopName(a.best?.supplier));

  return (
    <article className={`${styles.pack} ${open ? styles.packOpen : ''}`} data-status={status}>
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
              <img src={base.images[0] ? hero : thumb(hero)} alt="" loading="lazy" />
            </button>
          )
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <h2 className={styles.name}>{base.title}</h2>
          <p className={styles.evidence}>
            {base.store
              ? <><Icon name="IconCheck" className={styles.evIcon} />{base.g.rank != null ? <>Google best seller <b data-num>#{base.g.rank.toLocaleString('en-GB')}</b></> : 'Sells on Google'}{base.onEbay && ', and on eBay'}</>
              : base.entry?.proved
                ? <><Icon name="IconCheck" className={styles.evIcon} />Small seller converting at <b data-num>{formatGbp(base.entry.price)}</b></>
                : <><Icon name="IconInfo" className={styles.evIconWarn} />No small seller converting</>}
          </p>
          <span className={styles.flags}>
            <ChannelMarks channels={base.channels} compact />
            {closedChecks[0] && (
              <span className={styles.flag} data-tone={closedChecks[0].tone} title={closedChecks[0].text}>
                <Icon name="IconFlag" className={styles.flagIcon} />{closedChecks[0].text}
                {closedChecks.length > 1 && <span className={styles.flagMore}>+{closedChecks.length - 1}</span>}
              </span>
            )}
            {edited && <span className={styles.editedTag}>Edited</span>}
          </span>
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>List at</span>
          <span className={styles.fig} data-num>{base.price != null ? formatGbp(base.price) : '--'}</span>
          {base.position && (
            <span className={styles.status} data-tone={base.position.inMarket ? 'positive' : 'warning'}>
              <i />{base.position.inMarket ? 'In the market' : <><span data-num>{formatGbp(base.position.over)}</span> over</>}
            </span>
          )}
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>You keep</span>
          <span className={`${styles.fig} ${styles.keepFig}`} data-tone={base.keep == null ? undefined : base.keep < 0 ? 'negative' : base.costConfirmed ? 'positive' : 'estimate'} data-num>
            {base.keep != null ? formatGbp(base.keep) : '--'}
          </span>
          <span className={styles.sub}>{base.keep == null ? 'no cost yet' : base.keep < 0 ? 'loses money' : base.costConfirmed ? 'confirmed' : 'estimate'}</span>
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
            tone={a.ready ? 'positive' : 'warning'}
            icon={a.ready ? 'IconCheck' : 'IconInfo'}
            kicker={<>{a.ready ? 'Ready to publish' : 'Needs a look'}{row.decision?.decided_at && <span className={styles.stripWhen}> · approved {when(row.decision.decided_at)}</span>}</>}
            checks={checks}
            action={!confirm && (
              <>
                {shopButton}
                {onEbayView && (
                  <button type="button" className={styles.primary} disabled={busy || a.keep == null || a.keep < 0} onClick={review}>
                    <Icon name="IconTag" className={styles.btnIcon} />
                    {busy ? 'Checking with eBay' : `Review and list at ${formatGbp(a.price)}`}
                  </button>
                )}
              </>
            )}>
            {a.ready
              ? <>Priced, costed and nothing outstanding. Check the listing below, then {onEbayView ? 'review it with eBay' : 'add it to your shop'}.</>
              : <>{checks.length ? `${['One thing', 'Two things', 'Three things', 'Four things', 'Five things'][checks.length - 1] ?? `${checks.length} things`}` : 'Something'} to settle before it goes up.</>}
            {row.reference_url && <> <a className={styles.reference} href={row.reference_url} target="_blank" rel="noreferrer noopener">See the listing this came from</a></>}
          </BriefStrip>

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
                  <ConfirmItem label="You keep" value={formatGbp(a.keep)} tone="positive" />
                </div>

                {/* eBay's tracked services price by parcel and refuse a listing without one. */}
                <div className={styles.parcel}>
                  <span className={styles.confirmLabel}>Parcel, as packed</span>
                  <div className={styles.parcelFields}>
                    {[['weight_kg', 'Weight', 'kg'], ['length_cm', 'Length', 'cm'], ['width_cm', 'Width', 'cm'], ['height_cm', 'Height', 'cm']].map(([k, label, unit]) => (
                      <label key={k} className={styles.parcelField}>
                        <span>{label}</span>
                        <span className={styles.parcelControl}>
                          <input inputMode="decimal" data-num
                            value={draft.package?.[k] ?? ''}
                            onChange={(e) => change({ package: { ...(draft.package ?? {}), [k]: e.target.value === '' ? '' : Number(e.target.value) } })} />
                          <span className={styles.parcelUnit}>{unit}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <p className={styles.confirmTitle}>{a.title}</p>

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
                      } catch (e) {
                        setProblem(e.message);
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
              <section className={styles.panel} aria-label="Price">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconTag" className={styles.panelIcon} />Price</span>
                  <span className={styles.panelNote}>{a.store ? 'Against Google\'s prices, where buyers compare' : 'Against what is selling, not the middle of the field'}</span>
                </header>
                <PriceSetter a={a} market={row.competition} listings={a.marketRead?.listings ?? []}
                  medianLabel={a.marketRead?.basis === 'selling' && a.marketRead.sellingSeen ? `median of ${a.marketRead.sellingSeen} selling` : 'median'}
                  onChange={setPrice} />
              </section>

              <Card>
                <CardHead
                  title="The listing"
                  note={[a.l?.brand, breadcrumb(row.ebay_category_path) || a.l?.shop_category, band(a.m.headroom_band)]
                    .filter(Boolean).join(' · ')}
                  aside={edited && (
                    <span className={styles.draftState}>
                      {saving ? 'Saving' : 'Saved'}
                      <button type="button" className={styles.revert} onClick={revert}>Reset to shop copy</button>
                    </span>
                  )}
                />
                <ListingComposer listing={a.l} draft={draft} onChange={change}
                  onGenerate={generate} onUpload={upload} />
              </Card>
            </div>

            <aside className={styles.side}>
              <TillRoll a={a} />

              <section className={styles.panel} aria-label="Where to buy it">
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
                <div className={styles.tryIn}>
                  <CostTry onTry={onTry} base={a} view={a} suppliers={suppliers} onSave={onSource} hideStep />
                </div>
                <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} compact canAdd={false}
                  keepOf={(src) => assess({ ...row, draft }, {
                    tryCost: Number(src.landed_unit_cost), tryPosted: src.fulfilment === 'stock' ? 'you' : 'supplier', holdPrice: true,
                  }).keep} />
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

              {onEbayView && (
                <section className={styles.panel} aria-label="In search results">
                  <header className={styles.panelHead}>
                    <span className={styles.panelTitle}><Icon name="IconSearch" className={styles.panelIcon} />In search results</span>
                    <span className={styles.panelNote}>All a buyer sees before opening it</span>
                  </header>
                  <SearchTile title={a.title} image={hero} price={a.price}
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
