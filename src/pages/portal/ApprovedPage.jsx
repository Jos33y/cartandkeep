import { useEffect, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead, Stat, Facts } from '@components/ui/portal/primitives';
import { PriceScale, keepAt } from '@components/ui/portal/PriceScale';
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

const ROWS = [{}, {}, {}, {}];

const band = (b) => (b ?? '').replace(/_/g, ' ');
const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const BLENDED = 10;

const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

// Shelf pack against market pack. Butcher's found a 24 tin case on eBay against
// a 6 tin shelf pack and the profit came out fourteen pounds high.
function packOf(name) {
  const t = String(name ?? '').toLowerCase();
  const m = t.match(/(\d+)\s?x\s?\d/)
    || t.match(/\bx\s?(\d+)\b/)
    || t.match(/(\d+)\s?(?:pack|pk|tins|trays|pouches|washes|tabs|tablets)\b/);
  return m ? Number(m[1]) : null;
}

export function ApprovedPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, rows, addSource, list } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const [find, setFind] = useState('');

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

  const shown = find.trim()
    ? rows.filter((r) => `${r.listing?.title ?? r.title}`.toLowerCase().includes(find.trim().toLowerCase()))
    : rows;

  const perSale = rows.reduce((a, r) => a + (r.margin?.net ?? 0), 0);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Approved</p>
          <h1 className={styles.title}>Ready to list</h1>
        </div>

        <div className={styles.headStats}>
          <Stat label="Waiting" value={rows.length} />
          <Stat label="One sale of each" value={formatGbp(perSale)} tone="positive" />
        </div>
      </header>

      {/* At four rows this is noise; at a hundred it is the only way in. */}
      {rows.length > 6 && (
        <div className={styles.tools}>
          <span className={styles.findWrap}>
            <Icon name="IconSearch" className={styles.findIcon} />
            <input className={styles.find} value={find} placeholder="Find a product"
              onChange={(e) => setFind(e.target.value)} aria-label="Find a product" />
          </span>
          <span className={styles.count}>
            <span data-num>{shown.length}</span> of <span data-num>{rows.length}</span>
          </span>
        </div>
      )}

      <div className={styles.list}>
        {shown.map((r) => (
          <Pack
            key={r.id}
            row={r}
            tenantId={tenant.id}
            suppliers={suppliers}
            onList={(opts) => list({ candidateId: r.id, ...opts })}
            onSource={async (fields) => {
              await addSource({ candidateId: r.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}

        {shown.length === 0 && <p className={styles.quiet}>Nothing matches that.</p>}
      </div>
    </div>
  );
}

function Pack({ row, tenantId, suppliers, onSource, onList }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const m = row.margin ?? {};
  const l = row.listing ?? null;
  const entry = row.entry ?? null;

  const { draft, change, revert, generate, saving, edited } = useDraft(row, tenantId);

  const title = draft.title ?? l?.title ?? row.title;
  const images = draft.images ?? l?.images ?? [];
  const hero = images[0] ?? row.image_url;

  // A shelf price is a cost: seen on a shelf rather than quoted, which makes it
  // more certain, not less.
  const quoted = (row.sources ?? []).find((s) => s.landed_unit_cost != null) ?? null;
  const shelf = m.shelf ?? null;
  const best = quoted ?? (shelf?.price != null
    ? { supplier: shelf.shop ?? 'the shelf', landed_unit_cost: shelf.price, url: shelf.url }
    : null);

  const goods = best?.landed_unit_cost ?? null;
  const price = draft.price ?? m.sale_price ?? row.avg_sold_price ?? null;
  const keep = draft.price != null ? keepAt(price, m, goods) : (m.net ?? null);
  const trusted = m.list_trusted === true;

  const shelfPack = packOf(l?.title);
  const marketPack = packOf(entry?.title);
  const mismatch = shelfPack && marketPack && shelfPack !== marketPack
    ? { shelf: shelfPack, market: marketPack } : null;

  const warnings = [
    mismatch && `The shelf pack holds ${mismatch.shelf}, the listing this price came from holds ${mismatch.market}. Two different products.`,
    !trusted && draft.price == null && 'Priced at the market median. No small seller has been paid this.',
    l?.in_stock === 'no' && 'Out of stock at the shop. An order you cannot fill is a defect.',
    row.variation_count >= BLENDED && `Sold in ${row.variation_count} variations, so the price is an average.`,
    row.bulky && 'Costed as a small parcel and this one is bulky.',
  ].filter(Boolean);

  return (
    <article className={`${styles.pack} ${open ? styles.packOpen : ''}`}>
      {zoomed && <ImageLightbox src={hero} alt={title} onClose={() => setZoomed(false)} />}

      <div className={styles.top} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}>
        {hero
          ? (
            <button className={styles.thumb} aria-label={`View ${title} larger`}
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}>
              <img src={images[0] ? hero : thumb(hero)} alt="" loading="lazy" />
            </button>
          )
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <h2 className={styles.name}>{title}</h2>
          <p className={styles.evidence}>
            {entry?.proved
              ? `A ${entry.seller_feedback} feedback seller has sold ${entry.sold_lifetime} of these in ${entry.age_days} days`
              : 'No small seller is proved to be selling this'}
            {warnings.length > 0 && (
              <>
                <span className={styles.sep} aria-hidden="true">·</span>
                <span className={styles.warnCount}>{warnings.length} to check</span>
              </>
            )}
            {edited && <span className={styles.editedTag}>edited</span>}
          </p>
        </div>

        <p className={styles.keep}>
          <span className={`figure ${keep != null && keep < 0 ? styles.loss : ''}`}>
            {keep != null ? formatGbp(keep) : formatGbp(m.max_goods_cost)}
          </span>
          <span className={styles.keepLabel}>
            {keep != null ? `a unit at ${formatGbp(price)}` : 'pay up to, before goods'}
          </span>
        </p>

        <span className={styles.caret} data-open={open || undefined} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {open && (
        <div className={styles.work}>
          {/* The two decisions, side by side. What she charges, and what that
              produces in front of a buyer. */}
          <div className={styles.deck}>
            <Card raised>
              <CardHead title="Price" note="Against what is selling, not the middle of the field" />
              <PriceScale
                market={row.competition}
                entry={entry}
                price={price}
                goods={goods}
                margin={m}
                onChange={(v) => change({ price: v })}
              />
            </Card>

            <Card>
              <CardHead title="In search results" note="A photograph, a title and a price is all a buyer sees" />
              <SearchTile
                title={title}
                image={hero}
                price={price}
                feedback={entry?.seller_feedback}
                compare={entry?.price}
              />
            </Card>
          </div>

          <Card>
            <CardHead
              title="The listing"
              note="Home Bargains writes for a shelf label"
              aside={edited && (
                <span className={styles.draftState}>
                  {saving ? 'Saving' : 'Edited'}
                  <button type="button" className={styles.revert} onClick={revert}>Reset</button>
                </span>
              )}
            />
            <ListingComposer listing={l} draft={draft} onChange={change} onGenerate={generate} />
          </Card>

          {/* Everything already decided, kept quiet. */}
          <Card className={styles.context}>
            <div className={styles.contextGrid}>
              <section>
                <p className={styles.contextHead}>Why this one</p>
                <Facts items={[
                  entry?.proved && {
                    label: 'Proved by',
                    value: `${entry.seller_feedback} feedback`,
                    sub: `${entry.sold_lifetime} in ${entry.age_days} days`,
                  },
                  row.monthly_headroom != null && {
                    label: 'At that rate',
                    value: `${formatGbp(row.monthly_headroom)} a month`,
                  },
                  row.active_listings != null && {
                    label: 'Competing',
                    value: row.active_listings,
                  },
                  row.decision?.decided_at && {
                    label: 'Approved',
                    value: when(row.decision.decided_at),
                  },
                ]} />

                <p className={styles.sum}>
                  <span data-num>{formatGbp(price)}</span> on eBay,
                  less <span data-num>{formatGbp(m.cost_to_sell ?? (
                    m.platform_fee != null
                      ? Math.round((Number(m.platform_fee) + Number(m.postage ?? 0) + Number(m.packaging ?? 0)) * 100) / 100
                      : null
                  ))}</span> to sell
                  {best && <> and <span data-num>{formatGbp(goods)}</span> for the goods</>}
                </p>

                {warnings.length > 0 && (
                  <ul className={styles.warnings}>
                    {warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
              </section>

              <section>
                <p className={styles.contextHead}>Where to buy it</p>
                {best && (
                  <p className={styles.source}>
                    {best.url
                      ? <a className={styles.sourceLink} href={best.url} target="_blank" rel="noreferrer noopener">
                        {best.supplier}, {formatGbp(best.landed_unit_cost)}
                      </a>
                      : <span className={styles.sourceLink}>{best.supplier}, {formatGbp(best.landed_unit_cost)}</span>}
                    {l?.in_stock === 'yes' && <span className={styles.inStock}>in stock</span>}
                    {l?.max_qty != null && <span className={styles.facts}>up to {l.max_qty} per order</span>}
                  </p>
                )}

                {(m.shops ?? []).length > 0 && (
                  <p className={styles.alsoTry}>Also stocked by {m.shops.join(', ')}</p>
                )}

                <Facts items={[
                  l?.brand && { label: 'Brand', value: l.brand },
                  { label: 'Category', value: breadcrumb(row.ebay_category_path) || l?.shop_category || 'chosen at publish' },
                  { label: 'Postage', value: band(m.headroom_band) || 'small parcel' },
                ]} />

                <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} />
              </section>
            </div>
          </Card>

          {/* One action, at the foot of the row, reachable at any scroll. */}
          <div className={styles.bar}>
            <div className={styles.barFigures}>
              <Stat label="List at" value={formatGbp(price)} />
              <Stat label="You keep" value={formatGbp(keep)} tone={keep < 0 ? 'negative' : 'positive'} />
            </div>

            <div className={styles.barActions}>
              {row.reference_url && (
                <a className={styles.reference} href={row.reference_url}
                  target="_blank" rel="noreferrer noopener">The listing this came from</a>
              )}
              <button className={styles.primary} disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setProblem(null);
                  try {
                    setConfirm(await onList({
                      price,
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
                {busy ? 'Checking' : 'List on eBay'}
              </button>
            </div>
          </div>

          {problem && <p className={styles.problem} role="alert">{problem}</p>}

          {confirm && (
            <Card raised className={styles.confirm}>
              <CardHead title="Ready to publish"
                note="eBay chose the category from the title. It is the one field nobody can check beforehand." />

              <Facts items={[
                { label: 'Category', value: confirm.category.name, sub: confirm.category.id },
                { label: 'Price', value: formatGbp(confirm.price) },
                { label: 'Quantity', value: confirm.quantity },
                { label: 'Photographs', value: confirm.images },
                { label: 'Code', value: confirm.sku },
              ]} />

              <p className={styles.confirmTitle}>{draft.title ?? title}</p>

              <div className={styles.confirmActions}>
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
                  {busy ? 'Publishing' : 'Publish it'}
                </button>
                <button className={styles.ghost} onClick={() => setConfirm(null)}>Cancel</button>
              </div>
            </Card>
          )}
        </div>
      )}
    </article>
  );
}
