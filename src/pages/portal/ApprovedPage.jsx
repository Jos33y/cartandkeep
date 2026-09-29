import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { PriceScale } from '@components/ui/portal/PriceScale';
import { assess } from '@lib/assess';
import { ListingComposer } from '@components/ui/portal/ListingComposer';
import { SearchTile } from '@components/ui/portal/SearchTile';
import { Breakdown } from '@components/ui/portal/Breakdown';
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
        note="Approving a candidate brings it here with the price a small seller is being paid and the most the goods can cost, so nothing is worked out twice. Fourteen are waiting to review."
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

function Pack({ row, base, tenantId, fees, suppliers, onSource, onList, onShop }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [shopping, setShopping] = useState(false);
  // She buys after each sale, and the shop caps how many one order can take.
  const [qty, setQty] = useState(Math.min(5, row.listing?.max_qty ?? 5));

  const { draft, change, revert, generate, upload, saving, edited } = useDraft(row, tenantId);

  // Live while editing, from the same function the closed line uses.
  const whole = useMemo(() => assess({ ...row, draft }), [row, draft]);
  // A store card the gate also passed is listed in two places, each at its own price.
  const both = Boolean(whole.store && whole.ebay);
  const [view, setView] = useState('store');
  const a = both && view === 'ebay' ? whole.ebay : whole;
  const setPrice = (v) => change(both && view === 'ebay' ? { ebay_price: v } : { price: v });
  const hero = whole.images[0] ?? row.image_url;
  const status = a.ready ? 'ready' : 'check';

  const inShop = (row.store_products ?? [])[0] ?? null;
  // Always the shop's own figures, whichever view is open: a store card already keeps them, an eBay card is re-costed here.
  const shopKeep = whole.store ? whole.keep : storeKeep(whole.price, fees, whole.goods, whole.postage);

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

  return (
    <article className={`${styles.pack} ${open ? styles.packOpen : ''}`}>
      {zoomed && <ImageLightbox src={hero} alt={a.title} onClose={() => setZoomed(false)} />}

      <div className={styles.top} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}>
        <span className={`${styles.rail} ${styles[status]}`} aria-hidden="true" />

        {hero
          ? (
            <button className={styles.thumb} aria-label={`View ${a.title} larger`}
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}>
              <img src={a.images[0] ? hero : thumb(hero)} alt="" loading="lazy" />
            </button>
          )
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <span className={styles.nameRow}>
            <h2 className={styles.name}>{a.title}</h2>
            <ChannelMarks channels={whole.channels} />
          </span>
          <p className={styles.evidence}>
            {a.store
              ? <><Icon name="IconCheck" className={styles.evIcon} />{a.g.rank != null ? `Google best seller #${a.g.rank.toLocaleString('en-GB')}` : 'Sells on Google'}{a.onEbay && ', and on eBay'}</>
              : a.entry?.proved
                ? <><Icon name="IconCheck" className={styles.evIcon} />Converting at {formatGbp(a.entry.price)}</>
                : <><Icon name="IconInfo" className={styles.evIconWarn} />No small seller converting</>}
            {a.warnings.length > 0 && (
              <span className={styles.warnCount}>{a.warnings.length} to check</span>
            )}
            {edited && <span className={styles.editedTag}>Edited</span>}
          </p>
        </div>

        <div className={styles.figures}>
          <span className={styles.figLabel}>List at</span>
          <span className={styles.figPrice} data-num>{formatGbp(a.price)}</span>
          {a.position && <span className={`${styles.figLabel} ${styles[`pos_${a.position.tone}`] ?? ''}`}>{a.position.short}</span>}
        </div>

        <div className={styles.figures}>
          <span className={styles.figLabel}>You keep</span>
          <span className={`figure ${styles.figKeep} ${a.keep < 0 ? styles.loss : ''}`}>
            {a.keep != null ? formatGbp(a.keep) : 'Unknown'}{a.keep != null && a.costConfirmed === false && <span className={styles.figLabel}> est.</span>}
          </span>
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
          {!a.modelled && (
            <p className={styles.notice}>
              <Icon name="IconInfo" className={styles.noticeIcon} />
              Margin cannot move with the price on this row yet. Re-import its batch to add the cost model.
            </p>
          )}

          {a.store ? (
            <Card raised>
              <CardHead title="Price" note={`Cheapest cost${a.costFrom ? `, ${a.costFrom.from} ${formatGbp(a.costFrom.cost)}` : ''}, plus Royal Mail for its weight, the card fee and your profit${a.floor != null ? `. Floor ${formatGbp(a.floor)}` : ''}`} />
              <label className={styles.storePrice}>
                <span>List at</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" data-num
                  value={a.price ?? ''} onChange={(e) => setPrice(e.target.value === '' ? null : Number(e.target.value))} />
              </label>
              {a.position && <p className={`${styles.position} ${styles[`pos_${a.position.tone}`] ?? ''}`}>{a.position.text}</p>}
            </Card>
          ) : (
          <div className={styles.deck}>
            <Card raised>
              <CardHead title="Price" note="Against what is selling, not the middle of the field" />
              <PriceScale
                market={row.competition}
                entry={a.entry}
                price={a.price}
                goods={a.goods ?? a.assumed ?? null}
                goodsAssumed={a.costBasis === 'market'}
                margin={a.m}
                onChange={setPrice}
              />
            </Card>

            <Card>
              <CardHead title="In search results" note="All a buyer sees before deciding to open it" />
              <SearchTile
                title={a.title}
                image={hero}
                price={a.price}
                feedback={a.entry?.seller_feedback}
                compare={a.entry?.price}
              />
            </Card>
          </div>
          )}

          {/* The case for it, as evidence rather than a list of facts. */}
          <div className={styles.case}>
            <Card>
              <CardHead title="Why this one" />

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
                <Proof
                  icon="IconCheck"
                  tone={a.entry?.proved ? 'positive' : 'warning'}
                  value={a.entry?.proved ? `${a.entry.sold_lifetime} sold` : 'Unproven'}
                  label={a.entry?.proved
                    ? `in ${a.entry.age_days} days by a ${a.entry.seller_feedback} feedback seller`
                    : 'no small seller converting'}
                />
                <Proof
                  icon="IconChart"
                  value={a.month != null ? formatGbp(a.month) : 'Not proved'}
                  label="a month kept, at that seller's price and rate"
                />
                <Proof
                  icon="IconLayers"
                  value={row.active_listings ?? 'Unknown'}
                  label="listings competing on the same search"
                />
              </div>
              )}

              <div className={styles.divider} />

              <p className={styles.caseHead}>Where £{a.price?.toFixed(2)} goes</p>
              <Breakdown
                feeLabel={a.store ? 'Card fee' : undefined}
                price={a.price}
                fees={a.fees}
                postage={a.postage}
                goods={a.goods ?? a.assumed ?? null}
                goodsLabel={a.costBasis === 'market' ? 'Goods, at most' : 'Goods'}
                keep={a.keep}
              />

              {a.warnings.length > 0 && (
                <ul className={styles.warnings}>
                  {a.warnings.map((w) => (
                    <li key={w}><Icon name="IconInfo" className={styles.warnIcon} />{w}</li>
                  ))}
                </ul>
              )}

              {row.decision?.decided_at && (
                <p className={styles.decided}>Approved {when(row.decision.decided_at)}</p>
              )}
            </Card>

            <Card>
              <CardHead title="Where to buy it" note="Only once one sells" />

              {a.best && (
                <a className={styles.shop} href={a.best.url ?? undefined}
                  target="_blank" rel="noreferrer noopener">
                  <span className={styles.shopMain}>
                    <span className={styles.shopName}>
                      {a.best.supplier}
                      {a.best.url && <Icon name="IconOut" className={styles.shopOut} />}
                    </span>
                    <span className={styles.shopMeta}>
                      {a.l?.in_stock === 'yes' && (
                        <span className={styles.inStock}><span className={styles.dot} />In stock</span>
                      )}
                      {a.l?.in_stock === 'no' && (
                        <span className={styles.outStock}><span className={styles.dot} />Out of stock</span>
                      )}
                      {a.l?.max_qty != null && <span>Limit {a.l.max_qty} per order</span>}
                    </span>
                  </span>
                  <span className={styles.shopPrice} data-num>{formatGbp(a.best.landed_unit_cost)}</span>
                </a>
              )}

              {(a.shops ?? a.m.shops ?? []).length > 0 && (
                <div className={styles.alts}>
                  <span className={styles.altsLabel}>Also stocked by</span>
                  <span className={styles.altsList}>
                    {(a.shops ?? a.m.shops).map((s) => <span key={s} className={styles.alt}>{s}</span>)}
                  </span>
                </div>
              )}

              <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} compact
                keepOf={(s) => assess({ ...row, draft }, {
                  tryCost: Number(s.landed_unit_cost), tryPosted: s.fulfilment === 'stock' ? 'you' : 'supplier', holdPrice: true,
                }).keep} />
            </Card>
          </div>

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

          {problem && <p className={styles.problem} role="alert">{problem}</p>}

          {!confirm && (
            <div className={styles.bar}>
              <p className={styles.barNote}>
                {a.ready
                  ? 'Nothing outstanding.'
                  : `${a.warnings.length || 'Some'} thing${a.warnings.length === 1 ? '' : 's'} to check first.`}
                {row.reference_url && (
                  <a className={styles.reference} href={row.reference_url}
                    target="_blank" rel="noreferrer noopener">See the listing this came from</a>
                )}
              </p>

              {/* Same price, different arithmetic: no eBay fee or ad rate on her
                  own shop, only the card fee. */}
              {both && view === 'ebay' ? null : inShop ? (
                <span className={styles.inShop}>
                  <Icon name="IconCheck" className={styles.btnIcon} />
                  On your shop as a {inShop.status}
                </span>
              ) : (
                <button className={styles.ghost} disabled={shopping || whole.goods == null}
                  onClick={sendToShop}>
                  <Icon name="IconShop" className={styles.btnIcon} />
                  {shopping ? 'Adding' : shopKeep != null
                    ? `Add to your shop · keep ${formatGbp(shopKeep)}`
                    : 'Add to your shop'}
                </button>
              )}

              {!a.store && (
              <button className={styles.primary} disabled={busy || a.keep == null || a.keep < 0}
                onClick={async () => {
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
                }}>
                <Icon name="IconTag" className={styles.btnIcon} />
                {busy ? 'Checking with eBay' : `Review and list at ${formatGbp(a.price)}`}
              </button>
              )}
            </div>
          )}

          {confirm && (
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
                <button className={styles.ghost} onClick={() => setConfirm(null)}>Back</button>
                <button className={styles.primary} disabled={busy}
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
          )}
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
