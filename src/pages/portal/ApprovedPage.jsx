import { useEffect, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { useApproved } from '@hooks/useApproved';
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
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
};

/*
 * How many units are in the pack, read off a product name.
 *
 * The shelf price and the market price have to be for the same pack or the
 * margin is arithmetic on two different products. Butcher's proved it: the
 * query found a 24 tin case on eBay, the shelf row was the 6 tin pack at
 * £5.49, and the profit came out fourteen pounds too high.
 */
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

  const { status, rows, addSource } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);

  if (tenant === undefined || status === 'loading') {
    return <p className={styles.status} role="status" aria-live="polite">Loading</p>;
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Approved"
        title="Nothing approved yet"
        icon="IconCheck"
        body="What you have committed to, kept together so you can see it before anything is listed."
        columns={COLUMNS}
        rows={ROWS}
        note="Approve a few from the candidate queue and they appear here straight away."
        action={{ to: portalPath('/candidates'), label: 'Go to candidates' }}
      />
    );
  }

  // What she would keep if each of them sold once. An arithmetic total, said as
  // one, not a forecast.
  const perSale = rows.reduce((a, r) => a + (r.margin?.net ?? 0), 0);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Ready to list</h1>
          <p className={styles.lead}>
            List these at the price shown. Buy the goods only when one sells, repack
            them, and post them yourself.
          </p>
        </div>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Products</dt>
            <dd className={`figure ${styles.statValue}`}>{rows.length}</dd>
          </div>
          <div className={styles.stat}>
            <dt>One sale of each</dt>
            <dd className={`figure ${styles.statValue}`}>{formatGbp(perSale)}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.list}>
        {rows.map((r) => (
          <Pack
            key={r.id}
            row={r}
            suppliers={suppliers}
            onSource={async (fields) => {
              await addSource({ candidateId: r.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Pack({ row, suppliers, onSource }) {
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [open, setOpen] = useState(false);

  const m = row.margin ?? {};
  const l = row.listing ?? null;
  const entry = row.entry ?? null;

  // The shop's own name for the product. row.title is the gate query, which is
  // what was searched for and not what anybody would list.
  const listingTitle = l?.title ?? row.title;
  const hero = l?.images?.[0] ?? row.image_url;
  const images = l?.images ?? [];

  // A shelf price is a cost. It is a price seen on a shelf rather than a quote,
  // which makes it more certain, not less.
  const quoted = (row.sources ?? []).find((s) => s.landed_unit_cost != null) ?? null;
  const shelf = m.shelf ?? null;
  const best = quoted ?? (shelf?.price != null
    ? { supplier: shelf.shop ?? 'the shelf', landed_unit_cost: shelf.price, url: shelf.url }
    : null);

  const listPrice = m.sale_price ?? row.avg_sold_price ?? null;
  const net = m.net ?? null;
  const costToSell = m.cost_to_sell ?? (
    m.platform_fee != null
      ? Math.round((Number(m.platform_fee) + Number(m.postage ?? 0) + Number(m.packaging ?? 0)) * 100) / 100
      : null);

  const trusted = m.list_trusted === true;

  const shelfPack = packOf(l?.title);
  const marketPack = packOf(entry?.title);
  const packMismatch = shelfPack && marketPack && shelfPack !== marketPack
    ? { shelf: shelfPack, market: marketPack }
    : null;

  const warnings = [
    packMismatch && `The shelf pack holds ${packMismatch.shelf}, the listing this price came from holds ${packMismatch.market}. Those are two different products, so the figures are not comparable.`,
    !trusted && 'Priced at the market median. No small seller has been paid this, so check it against what is actually selling.',
    l?.in_stock === 'no' && 'Out of stock at the shop. An order you cannot fill is a defect on the account.',
    row.variation_count >= BLENDED && `Sold in ${row.variation_count} variations, so the price is an average across whichever sold. Price yours per size.`,
    row.bulky && 'Costed as a small parcel and this one is bulky. Confirm the real band before listing.',
  ].filter(Boolean);

  async function copyTitle(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(listingTitle);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={`${styles.pack} ${open ? styles.packOpen : ''}`}>
      {zoomed && (
        <ImageLightbox src={hero} alt={listingTitle} onClose={() => setZoomed(false)} />
      )}

      <div className={styles.top} onClick={() => setOpen((v) => !v)} role="button"
        tabIndex={0} aria-expanded={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}>
        {hero ? (
          <button className={styles.thumb}
            onClick={(e) => { e.stopPropagation(); setZoomed(true); }}
            aria-label={`View ${listingTitle} larger`}>
            <img src={l?.images?.[0] ? hero : thumb(hero)} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <div className={styles.subject}>
          <h2 className={styles.name}>{listingTitle}</h2>
          <p className={styles.evidence}>
            {entry?.proved
              ? `A ${entry.seller_feedback} feedback seller has sold ${entry.sold_lifetime} of these in ${entry.age_days} days`
              : 'Nobody her size is proved to be selling this'}
            {warnings.length > 0 && (
              <span className={styles.warnCount}>
                {' '}{warnings.length} thing{warnings.length === 1 ? '' : 's'} to check
              </span>
            )}
          </p>
        </div>

        {/* The one number she is deciding on. The selling price sits under it as
            the context it is, not beside it as an equal. */}
        <p className={styles.keep}>
          <span className={`figure ${net != null && net < 0 ? styles.loss : ''}`}>
            {net != null ? formatGbp(net) : formatGbp(m.max_goods_cost)}
          </span>
          <span className={styles.keepLabel}>
            {net != null ? `a unit at ${formatGbp(listPrice)}` : 'pay up to, before goods'}
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
        <div className={styles.detail}>
          {/* Why this one, which is the whole case the candidate queue made and
              the reason she said yes. Without it the page three weeks from now
              is a list of products with no argument attached. */}
          <section className={styles.block}>
            <h3 className={styles.blockHead}>Why this one</h3>

            <dl className={styles.grid}>
              {entry?.proved && (
                <Cell label="Proved by"
                  value={`${entry.seller_feedback} feedback`}
                  foot={`${entry.sold_lifetime} sold in ${entry.age_days} days at ${formatGbp(entry.price_gbp ?? entry.priceGbp)}`} />
              )}
              {row.monthly_headroom != null && (
                <Cell label="At that rate" value={formatGbp(row.monthly_headroom)}
                  foot="a month, before goods" />
              )}
              {row.active_listings != null && (
                <Cell label="Competing" value={row.active_listings}
                  foot="live listings on this search" />
              )}
              {m.price_p25 != null && m.price_p75 != null && (
                <Cell label="Most sell at"
                  value={`${formatGbp(m.price_p25)} to ${formatGbp(m.price_p75)}`}
                  foot={trusted ? 'and hers sits inside that' : 'hers is the median of it'} />
              )}
            </dl>

            <p className={styles.sum}>
              <span className={styles.sumStrong} data-num>{formatGbp(listPrice)}</span> on eBay,
              less <span data-num>{formatGbp(costToSell)}</span> in fees, postage and packaging,
              {best
                ? <> less <span data-num>{formatGbp(best.landed_unit_cost)}</span> for the goods</>
                : <> and no goods cost yet</>}
              {net != null && <>, leaving <span className={styles.sumStrong} data-num>{formatGbp(net)}</span></>}
            </p>

            {row.decision?.decided_at && (
              <p className={styles.decided}>
                Approved {when(row.decision.decided_at)}
                {row.decision.note ? `. ${row.decision.note}` : ''}
              </p>
            )}

            {warnings.length > 0 && (
              <ul className={styles.warnings}>
                {warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </section>

          {/* Where to buy it when one sells. This is the page she opens standing
              in the shop, so the link and the price are the point of it. */}
          <section className={styles.block}>
            <h3 className={styles.blockHead}>Where to buy it</h3>

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
              <p className={styles.alsoTry}>
                Also stocked by {m.shops.join(', ')}
              </p>
            )}

            <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} />
          </section>

          {/* What goes up. */}
          <section className={styles.block}>
            <h3 className={styles.blockHead}>The listing</h3>

            {images.length > 0 && (
              <div className={styles.gallery}>
                {images.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer noopener" className={styles.shot}>
                    <img src={src} alt="" loading="lazy" />
                  </a>
                ))}
              </div>
            )}

            <p className={styles.facts}>
              {[l?.brand,
                breadcrumb(row.ebay_category_path) || l?.shop_category,
                band(m.headroom_band) || 'small parcel',
              ].filter(Boolean).join(', ')}
            </p>

            {l?.summary && <p className={styles.blurb}>{l.summary}</p>}
            {l?.description && <p className={styles.body}>{l.description}</p>}

            {(l?.features ?? []).length > 0 && (
              <ul className={styles.features}>
                {l.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}

            <div className={styles.actions}>
              <button className={styles.ghost} onClick={copyTitle}>
                {copied ? 'Copied' : `Copy title, ${listingTitle.length} of 80`}
              </button>
              {row.reference_url && (
                <a className={styles.reference} href={row.reference_url}
                  target="_blank" rel="noreferrer noopener">
                  The eBay listing these figures came from
                </a>
              )}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function Cell({ label, value, foot }) {
  return (
    <div className={styles.cell}>
      <dt className={styles.cellLabel}>{label}</dt>
      <dd className={styles.cellValue} data-num>{value}</dd>
      {foot && <dd className={styles.cellFoot}>{foot}</dd>}
    </div>
  );
}
