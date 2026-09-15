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
  { key: 'score', label: 'Score' },
  { key: 'product', label: 'Product' },
  { key: 'margin', label: 'Headroom', align: 'right' },
];

const ROWS = [{}, {}, {}, {}];

const band = (b) => (b ?? '').replace(/_/g, ' ');

const thumb = (url) => (url ? url.replace(/\/s-l\d+\./, '/s-l225.') : null);

const BLENDED = 10;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function windowName(row) {
  const w = row.window_series?.at(-1)?.window
    ?? (row.window_start ? row.window_start.slice(0, 7) : null);
  if (!w) return null;
  return MONTHS[Number(w.split('-')[1]) - 1] ?? null;
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
        body="What you have committed to, kept together so you can see it before anything is ordered or listed."
        columns={COLUMNS}
        rows={ROWS}
        note="Approve a few from the candidate queue and they appear here straight away."
        action={{ to: portalPath('/candidates'), label: 'Go to candidates' }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Approved</p>
          <h1 className={styles.title}>Ready to list</h1>
        </div>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt className="micro">Products</dt>
            <dd className={`figure ${styles.statValue}`}>{rows.length}</dd>
          </div>
        </dl>
      </header>

      <p className={styles.lead}>
        Everything needed to put these on eBay. List at the price shown, and buy
        the goods only once one sells. Repack it before it goes out, never in the
        shop's own packaging and never with their receipt inside.
      </p>

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
  const m = row.margin ?? {};
  const month = windowName(row);

  // Cheapest source that has actually been priced. A sourcing request with no
  // answer is not a cost. A shelf price is an answer: it is a price seen on a
  // shelf, which is more certain than a quote, so it counts as one.
  const quoted = (row.sources ?? []).find((s) => s.landed_unit_cost != null) ?? null;
  const shelf = m.shelf ?? null;
  const best = quoted ?? (shelf?.price != null
    ? { supplier: shelf.shop ?? 'the shelf', landed_unit_cost: shelf.price, fulfilment: 'stock', url: shelf.url }
    : null);

  // She posts everything herself, so postage always comes off. It only came
  // back on for a dropship quote, which this model does not use.
  const net = m.net != null
    ? m.net
    : (best && row.headroom != null
      ? Math.round((
        Number(row.headroom)
        + (best.fulfilment === 'dropship' ? Number(m.postage ?? 0) : 0)
        - Number(best.landed_unit_cost)
      ) * 100) / 100
      : null);

  // Fees, postage and packaging, which the importer now writes individually.
  const costToSell = m.cost_to_sell ?? (
    m.platform_fee != null
      ? Math.round((Number(m.platform_fee) + Number(m.postage ?? 0) + Number(m.packaging ?? 0)) * 100) / 100
      : null);

  const entry = row.entry ?? null;
  const trusted = m.list_trusted === true;

  async function copyTitle() {
    try {
      await navigator.clipboard.writeText(row.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={styles.pack}>
      {zoomed && (
        <ImageLightbox src={row.image_url} alt={row.title} onClose={() => setZoomed(false)} />
      )}

      <div className={styles.packHead}>
        {row.image_url ? (
          <button className={styles.thumb} onClick={() => setZoomed(true)}
            aria-label={`View ${row.title} larger`}>
            <img src={thumb(row.image_url)} alt="" loading="lazy" />
            <span className={styles.zoom} aria-hidden="true">View</span>
          </button>
        ) : (
          <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />
        )}

        <div className={styles.packTitle}>
          <h2 className={styles.name}>{row.title}</h2>
          {/* Why this is worth listing, which is who is selling it and how fast.
              Score sat here and is null on every row by design, so it read as a
              zero next to a product she had just committed to. */}
          <p className={styles.meta}>
            {entry?.proved ? (
              <>
                <span data-num>{entry.seller_feedback}</span> feedback seller sold{' '}
                <span data-num>{entry.sold_lifetime}</span> in{' '}
                <span data-num>{entry.age_days}</span> days
                {' · '}
              </>
            ) : null}
            <span data-num>{row.sold_30d ?? 0}</span> sold{month ? ` in ${month}` : ''}
            {row.same_sku_sellers != null && (
              <> · <span data-num>{row.same_sku_sellers}</span> seller{row.same_sku_sellers === 1 ? '' : 's'} on this product</>
            )}
            {row.variation_count > 1 && (
              <> · <span data-num>{row.variation_count}</span> variations</>
            )}
            {row.classification && row.classification !== 'unknown' && <> · {row.classification}</>}
          </p>
        </div>
        <button className={styles.copy} onClick={copyTitle}>
          {copied ? 'Copied' : 'Copy title'}
        </button>
      </div>

      <dl className={styles.figures}>
        <Fig label="List at" value={formatGbp(m.sale_price ?? row.avg_sold_price)} strong
          foot={trusted ? 'what a small seller is getting' : 'market median, check this one'} />
        <Fig label="Cost to sell"
          value={costToSell != null ? `- ${formatGbp(costToSell)}` : 'not computed'}
          foot="fees, postage, packaging" />
        {best ? (
          <Fig label="Goods" value={`- ${formatGbp(best.landed_unit_cost)}`}
            foot={best.supplier} />
        ) : (
          <Fig label="Headroom" value={formatGbp(row.headroom)} strong
            foot="before goods, not yet quoted" />
        )}
        {best && net != null && (
          <Fig label="You keep" value={formatGbp(net)} strong
            foot={`a unit, after everything${trusted ? '' : ', at an unchecked price'}`} />
        )}
      </dl>

      <dl className={styles.details}>
        <Detail label="Postage band" value={band(m.headroom_band) || 'small parcel'} />
        <Detail label="eBay category"
          value={breadcrumb(row.ebay_category_path) || 'not known'}
          sub={row.ebay_category_id} />
        <Detail label="Channels" value={(row.recommended_channels ?? []).join(', ') || 'ebay'} />
      </dl>

      {/* The model, on the page where it gets done. Nothing here is obvious to
          somebody holding a phone in an aisle three weeks from now. */}
      {best && (
        <ol className={styles.steps}>
          <li>List it at {formatGbp(m.sale_price ?? row.avg_sold_price)}. Buy nothing yet.</li>
          <li>
            When it sells, buy it
            {best.url
              ? <> at <a href={best.url} target="_blank" rel="noreferrer noopener">{best.supplier}</a></>
              : <> at {best.supplier}</>} for {formatGbp(best.landed_unit_cost)}.
          </li>
          <li>Repack it. Not the shop's bag, and no receipt inside.</li>
          <li>Post it yourself, {band(m.headroom_band) || 'small parcel'}.</li>
          <li>Check the shelf price again before you relist.</li>
        </ol>
      )}

      {!trusted && (
        <p className={styles.flag}>
          This price is the market median, not a price anybody her size has been paid.
          Open the listing below and check it against what is actually selling before
          you list at it.
        </p>
      )}

      {row.variation_count >= BLENDED && (
        <p className={styles.flag}>
          This one is sold in {row.variation_count} variations, so the price above is an
          average across whichever of them sold. Price your own listing per size rather
          than taking the figure straight across.
        </p>
      )}

      {row.bulky && (
        <p className={styles.flag}>
          Costed as a small parcel. This one is bulky, so confirm the real band with
          the supplier before listing at this price.
        </p>
      )}

      <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} />

      {row.reference_url && (
        <p className={styles.reference}>
          <a href={row.reference_url} target="_blank" rel="noreferrer noopener">
            The listing these figures came from
          </a>
        </p>
      )}
    </article>
  );
}

function Fig({ label, value, strong, foot }) {
  return (
    <div className={`${styles.fig} ${strong ? styles.figStrong : ''}`}>
      <dt className={styles.figLabel}>{label}</dt>
      <dd className={styles.figValue} data-num>{value}</dd>
      {foot && <dd className={styles.figFoot}>{foot}</dd>}
    </div>
  );
}

function Detail({ label, value, sub }) {
  return (
    <div className={styles.detail}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>
        {value}
        {sub && <span className={styles.detailSub} data-num>{sub}</span>}
      </dd>
    </div>
  );
}
