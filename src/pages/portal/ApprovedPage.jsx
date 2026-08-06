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
        Everything needed to put these on eBay. Copy the title, set the price, and
        check the postage band against what the supplier quotes before you commit.
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
  // answer is not a cost.
  const best = (row.sources ?? []).find((s) => s.landed_unit_cost != null) ?? null;

  // On a dropship order the supplier posts it, so the postage inside headroom
  // is not hers to pay.
  const net = best && row.headroom != null
    ? Math.round((
      Number(row.headroom)
      + (best.fulfilment === 'dropship' ? Number(m.postage ?? 0) : 0)
      - Number(best.landed_unit_cost)
    ) * 100) / 100
    : null;

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
          <p className={styles.meta}>
            <span className={styles.scoreLabel}>Score</span>
            <span className={styles.scoreValue} data-num>{row.score ?? 0}</span>
            {' · '}
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
        <Fig label="List at" value={formatGbp(m.sale_price ?? row.avg_sold_price)} strong />
        <Fig label="Cost to sell"
          value={m.cost_to_sell != null ? `- ${formatGbp(m.cost_to_sell)}` : 'not computed'}
          foot="fees, postage, packaging" />
        <Fig
          label="Headroom"
          value={formatGbp(row.headroom)}
          strong={net == null}
          foot={best ? 'before goods' : 'before goods, not yet quoted'}
        />
        {best && (
          <Fig
            label="Net a unit"
            value={formatGbp(net)}
            strong
            foot={`${best.supplier} at ${formatGbp(best.landed_unit_cost)} landed`}
          />
        )}
      </dl>

      <dl className={styles.details}>
        <Detail label="Postage band" value={band(m.headroom_band) || 'small parcel'} />
        <Detail label="eBay category"
          value={breadcrumb(row.ebay_category_path) || 'not known'}
          sub={row.ebay_category_id} />
        <Detail label="Channels" value={(row.recommended_channels ?? []).join(', ') || 'ebay'} />
      </dl>

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
