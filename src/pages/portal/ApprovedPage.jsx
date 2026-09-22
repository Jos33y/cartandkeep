import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { PriceScale, keepAt } from '@components/ui/portal/PriceScale';
import { ListingComposer } from '@components/ui/portal/ListingComposer';
import { SearchTile } from '@components/ui/portal/SearchTile';
import { Breakdown } from '@components/ui/portal/Breakdown';
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

const ROWS = [{}, {}, {}, {}];

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
const BLENDED = 10;

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Butcher's found a 24 tin case on eBay against a 6 tin shelf pack.
function packOf(name) {
  const t = String(name ?? '').toLowerCase();
  const m = t.match(/(\d+)\s?x\s?\d/)
    || t.match(/\bx\s?(\d+)\b/)
    || t.match(/(\d+)\s?(?:pack|pk|tins|trays|pouches|washes|tabs|tablets)\b/);
  return m ? Number(m[1]) : null;
}

// Everything a row needs to say about itself, computed once so the closed line
// and the open panel can never disagree.
function assess(row) {
  const m = row.margin ?? {};
  const l = row.listing ?? null;
  const entry = row.entry ?? null;
  const d = row.draft ?? {};

  const quoted = (row.sources ?? []).find((s) => s.landed_unit_cost != null) ?? null;
  const shelf = m.shelf ?? null;
  const best = quoted ?? (shelf?.price != null
    ? { supplier: shelf.shop ?? 'the shelf', landed_unit_cost: shelf.price, url: shelf.url }
    : null);

  const goods = best?.landed_unit_cost ?? null;
  const price = d.price ?? m.sale_price ?? row.avg_sold_price ?? null;
  const modelled = Boolean(m.rates);
  const keep = modelled ? keepAt(price, m, goods) : (d.price == null ? m.net ?? null : null);

  const fees = modelled && price != null
    ? Math.round((price * (m.rates.fvf + m.rates.ad) + m.rates.fixed) * 100) / 100
    : (m.platform_fee ?? null);
  const postage = Math.round(((m.postage ?? 0) + (m.packaging ?? 0) + (m.returns_allowance ?? 0)) * 100) / 100;

  const trusted = m.list_trusted === true;
  const shelfPack = packOf(l?.title);
  const marketPack = packOf(entry?.title);

  const warnings = [
    shelfPack && marketPack && shelfPack !== marketPack
      && `Shelf pack holds ${shelfPack}, the listing this price came from holds ${marketPack}.`,
    !trusted && d.price == null && 'Priced at the market median, which no small seller has been paid.',
    l?.in_stock === 'no' && 'Out of stock at the shop.',
    row.variation_count >= BLENDED && `Sold in ${row.variation_count} variations, so the price is an average.`,
    row.bulky && 'Costed as a small parcel and this one is bulky.',
    keep != null && keep < 0 && 'Loses money at this price.',
  ].filter(Boolean);

  return {
    m, l, entry, d, best, goods, price, keep, fees, postage, modelled, trusted, warnings,
    ready: warnings.length === 0 && entry?.proved === true && keep != null && keep > 0,
    title: d.title ?? l?.title ?? row.title,
    images: d.images ?? l?.images ?? [],
    edited: Object.keys(d).length > 0,
  };
}

export function ApprovedPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, addSource, list, addToShop } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const [find, setFind] = useState('');
  const [only, setOnly] = useState(null);

  const assessed = useMemo(() => rows.map((r) => ({ row: r, a: assess(r) })), [rows]);

  const counts = useMemo(() => ({
    ready: assessed.filter(({ a }) => a.ready).length,
    check: assessed.filter(({ a }) => !a.ready).length,
    edited: assessed.filter(({ a }) => a.edited).length,
  }), [assessed]);

  // Only rows with a proven rate. A month's worth on the untrusted ones would
  // be arithmetic on a price nobody has been paid.
  const monthly = assessed.reduce((s, { row }) => s + (row.monthly_headroom ?? 0), 0);

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
        note="Approve a few from the candidate queue and they appear here straight away."
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
            onList={(opts) => list({ candidateId: row.id, ...opts })}
            onShop={(product) => addToShop({ candidateId: row.id, product })}
            onSource={async (fields) => {
              await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}

        {shown.length === 0 && <p className={styles.quiet}>Nothing here.</p>}
      </div>
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

  const { draft, change, revert, generate, upload, saving, edited } = useDraft(row, tenantId);

  // Live while editing, from the same function the closed line uses.
  const a = useMemo(() => assess({ ...row, draft }), [row, draft]);
  const hero = a.images[0] ?? row.image_url;
  const status = a.ready ? 'ready' : 'check';

  const inShop = (row.store_products ?? [])[0] ?? null;
  const shopKeep = storeKeep(a.price, fees, a.goods, a.postage);

  async function sendToShop() {
    setShopping(true);
    setProblem(null);
    try {
      await onShop({
        slug: `${slugify(a.title)}-${String(row.id).slice(0, 6)}`,
        title: a.title,
        description: draft.description ?? a.l?.description ?? null,
        price: a.price,
        image_url: a.images[0] ?? null,
        images: a.images,
        brand: a.l?.brand ?? null,
        category: a.l?.shop_category ?? null,
        postage_band: a.m.headroom_band ?? null,
        landed_cost: a.goods,
        postage_cost: a.postage,
        cost_note: a.best ? `Shelf price at ${a.best.supplier}` : null,
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
          <h2 className={styles.name}>{a.title}</h2>
          <p className={styles.evidence}>
            {a.entry?.proved
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
        </div>

        <div className={styles.figures}>
          <span className={styles.figLabel}>You keep</span>
          <span className={`figure ${styles.figKeep} ${a.keep < 0 ? styles.loss : ''}`}>
            {a.keep != null ? formatGbp(a.keep) : '—'}
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
          {!a.modelled && (
            <p className={styles.notice}>
              <Icon name="IconInfo" className={styles.noticeIcon} />
              Margin cannot move with the price on this row yet. Re-import its batch to add the cost model.
            </p>
          )}

          <div className={styles.deck}>
            <Card raised>
              <CardHead title="Price" note="Against what is selling, not the middle of the field" />
              <PriceScale
                market={row.competition}
                entry={a.entry}
                price={a.price}
                goods={a.goods}
                margin={a.m}
                onChange={(v) => change({ price: v })}
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

          {/* The case for it, as evidence rather than a list of facts. */}
          <div className={styles.case}>
            <Card>
              <CardHead title="Why this one" />

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
                  value={row.monthly_headroom != null ? formatGbp(row.monthly_headroom) : '—'}
                  label="a month at that seller's rate, before goods"
                />
                <Proof
                  icon="IconLayers"
                  value={row.active_listings ?? '—'}
                  label="listings competing on the same search"
                />
              </div>

              <div className={styles.divider} />

              <p className={styles.caseHead}>Where £{a.price?.toFixed(2)} goes</p>
              <Breakdown
                price={a.price}
                fees={a.fees}
                postage={a.postage}
                goods={a.goods}
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

              {(a.m.shops ?? []).length > 0 && (
                <div className={styles.alts}>
                  <span className={styles.altsLabel}>Also stocked by</span>
                  <span className={styles.altsList}>
                    {a.m.shops.map((s) => <span key={s} className={styles.alt}>{s}</span>)}
                  </span>
                </div>
              )}

              <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} compact />
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
              {inShop ? (
                <span className={styles.inShop}>
                  <Icon name="IconCheck" className={styles.btnIcon} />
                  On your shop as a {inShop.status}
                </span>
              ) : (
                <button className={styles.ghost} disabled={shopping || a.goods == null}
                  onClick={sendToShop}>
                  <Icon name="IconShop" className={styles.btnIcon} />
                  {shopping ? 'Adding' : shopKeep != null
                    ? `Add to your shop · keep ${formatGbp(shopKeep)}`
                    : 'Add to your shop'}
                </button>
              )}

              <button className={styles.primary} disabled={busy || a.keep == null || a.keep < 0}
                onClick={async () => {
                  setBusy(true);
                  setProblem(null);
                  try {
                    setConfirm(await onList({
                      price: a.price,
                      quantity: draft.quantity ?? 1,
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
            </div>
          )}

          {confirm && (
            <Card raised className={styles.confirm}>
              <CardHead title="Publish to eBay"
                note="eBay chose the category from the title. It is the one field nobody can check in advance." />

              <div className={styles.confirmGrid}>
                <ConfirmItem label="Category" value={confirm.category.name} sub={`#${confirm.category.id}`} />
                <ConfirmItem label="Price" value={formatGbp(confirm.price)} />
                <ConfirmItem label="Quantity" value={confirm.quantity} />
                <ConfirmItem label="Photographs" value={confirm.images} />
                <ConfirmItem label="You keep" value={formatGbp(a.keep)} tone="positive" />
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
                        quantity: confirm.quantity,
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
