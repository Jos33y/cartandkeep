import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { Icon } from '@components/ui/icons';
import { useListings } from '@hooks/useListings';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/listings-page.module.css';

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'channel', label: 'Where' },
  { key: 'listed', label: 'Listed' },
  { key: 'price', label: 'Price', align: 'right' },
];

const ROWS = [{}, {}, {}, {}];

const FILTERS = [
  { id: 'all', label: 'All', icon: 'IconLayers' },
  { id: 'ebay', label: 'On eBay', icon: 'IconTag' },
  { id: 'shop', label: 'On your shop', icon: 'IconShop' },
  { id: 'gap', label: 'eBay only', icon: 'IconInfo' },
];

const rel = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

function ago(iso) {
  if (!iso) return null;
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rel.format(Math.round(s / n), u);
  return 'just now';
}

const day = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  : null);

const slugify = (s) => String(s ?? '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Card fee only on her own shop, no eBay fee or ad rate.
function storeKeep(price, fees, goods, postage) {
  if (price == null || goods == null) return null;
  const pct = fees?.store?.pct ?? 0.015;
  const fixed = fees?.store?.fixed ?? 0.2;
  return Math.round((price - (price * pct + fixed) - goods - (postage ?? 0)) * 100) / 100;
}

function channelsOf(i) {
  return {
    ebay: Boolean(i.listingId),
    shopLive: i.shop?.status === 'live',
    shopDraft: i.shop?.status === 'draft',
  };
}

export function ListingsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const { status, items, window, error, addToShop, updateOnEbay, readLive } = useListings(tenant?.id);
  const [filter, setFilter] = useState('all');
  const [find, setFind] = useState('');

  const counts = useMemo(() => ({
    all: items.length,
    ebay: items.filter((i) => i.listingId).length,
    shop: items.filter((i) => i.shop).length,
    gap: items.filter((i) => i.listingId && !i.shop).length,
  }), [items]);

  const sold = items.reduce((s, i) => s + (i.traffic?.transactions ?? 0), 0);

  const shown = items
    .filter((i) => filter === 'all'
      || (filter === 'ebay' && i.listingId)
      || (filter === 'shop' && i.shop)
      || (filter === 'gap' && i.listingId && !i.shop))
    .filter((i) => !find.trim() || (i.title ?? '').toLowerCase().includes(find.trim().toLowerCase()));

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={5} />;

  if (status === 'error') {
    return <p className={styles.failed} role="alert">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        eyebrow="Listings"
        title="Nothing live yet"
        icon="IconTag"
        body="Everything published from Approved lands here, with where it is live, what it costs and how it is selling."
        columns={COLUMNS}
        rows={ROWS}
        note="Publish from Approved and the listing appears here straight away."
        action={{ to: portalPath('/approved'), label: 'Go to Approved' }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className="micro">Listings</p>
          <h1 className={styles.title}>What is live</h1>
        </div>

        <dl className={styles.stats}>
          <Stat icon="IconTag" label="On eBay" value={counts.ebay} />
          <Stat icon="IconShop" label="On your shop" value={counts.shop} />
          <Stat icon="IconBought" label="Sold" value={sold}
            foot={window ? `${day(window.window_start)} to ${day(window.window_end)}` : 'no traffic pulled yet'}
            tone={sold > 0 ? 'positive' : null} />
        </dl>
      </header>

      <div className={styles.bar} role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id}
            className={`${styles.tab} ${filter === f.id ? styles.tabOn : ''}`}
            onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} className={styles.tabIcon} />
            {f.label}
            <span className={styles.tabCount} data-num>{counts[f.id]}</span>
          </button>
        ))}

        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a listing" />
        </span>
      </div>

      {filter === 'gap' && counts.gap > 0 && (
        <p className={styles.hint}>
          <Icon name="IconInfo" className={styles.hintIcon} />
          Live on eBay and not on your shop. The shop keeps more of the same price, since there is no eBay fee.
        </p>
      )}

      <div className={styles.list}>
        {shown.map((i) => (
          <Listing key={i.key} item={i} fees={tenant?.fees} onShop={addToShop} onUpdate={updateOnEbay} onRead={readLive} />
        ))}
        {shown.length === 0 && <p className={styles.quiet}>Nothing here.</p>}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, foot, tone }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}><Icon name={icon} className={styles.statIcon} />{label}</dt>
      <dd className={`figure ${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</dd>
      {foot && <dd className={styles.statFoot}>{foot}</dd>}
    </div>
  );
}

function Listing({ item, fees, onShop, onUpdate, onRead }) {
  const [open, setOpen] = useState(false);
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const c = channelsOf(item);
  const price = item.ebay?.price ?? item.shop?.price ?? null;
  const t = item.traffic;

  const m = item.row?.margin ?? {};
  const goods = m.shelf?.price ?? m.landed_cost ?? null;
  const postage = Math.round(((m.postage ?? 0) + (m.packaging ?? 0) + (m.returns_allowance ?? 0)) * 100) / 100;
  const shopKeep = storeKeep(price, fees, goods, postage);

  async function toShop() {
    setBusy(true);
    setProblem(null);
    const r = item.row;
    try {
      await onShop(item, {
        slug: `${slugify(item.title)}-${String(item.candidateId).slice(0, 6)}`,
        title: item.title,
        description: r?.draft?.description ?? r?.listing?.description ?? null,
        price,
        image_url: item.image ?? null,
        images: r?.draft?.images ?? r?.listing?.images ?? [],
        brand: r?.listing?.brand ?? null,
        category: r?.listing?.shop_category ?? null,
        postage_band: m.headroom_band ?? null,
        landed_cost: goods,
        postage_cost: postage,
        cost_note: m.shelf?.shop ? `Shelf price at ${m.shelf.shop}` : null,
        cost_updated_at: new Date().toISOString(),
      });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
      <div className={styles.top} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}>
        {item.image
          ? <img className={styles.thumb} src={item.image} alt="" loading="lazy" />
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <h2 className={styles.name}>{item.title}</h2>
          <p className={styles.chips}>
            {c.ebay && (
              <span className={`${styles.chip} ${styles.chipEbay}`}>
                <span className={styles.dot} />eBay
              </span>
            )}
            {c.shopLive && (
              <span className={`${styles.chip} ${styles.chipLive}`}>
                <span className={styles.dot} />Shop
              </span>
            )}
            {c.shopDraft && (
              <span className={`${styles.chip} ${styles.chipDraft}`}>
                <span className={styles.dot} />Shop draft
              </span>
            )}
            <span className={styles.since}>
              {item.origin === 'existing' ? 'Listed before Cart & Keep' : `Listed ${ago(item.since)}`}
            </span>
          </p>
        </div>

        <Fig label="Price" value={formatGbp(price)} />
        <Fig label="Available" value={item.ebay?.quantity ?? '—'} />
        <Fig label="Sold" value={t ? t.transactions ?? 0 : '—'}
          tone={t?.transactions > 0 ? 'positive' : null} />

        <span className={styles.caret} data-open={open || undefined} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {open && (
        <div className={styles.work}>
          <div className={styles.deck}>
            <Card>
              <CardHead
                title="eBay"
                note={item.origin === 'portal'
                  ? `Published from here ${ago(item.since)}`
                  : item.origin === 'existing' ? 'Listed on eBay before Cart & Keep' : 'Not on eBay'}
                aside={item.listingId && (
                  <a className={styles.out} href={`https://www.ebay.co.uk/itm/${item.listingId}`}
                    target="_blank" rel="noreferrer noopener">
                    View <Icon name="IconOut" className={styles.outIcon} />
                  </a>
                )}
              />

              {item.listingId ? (
                <>
                  {/* Shown, opened, sold, drawn as a narrowing run so the drop
                      is the shape rather than a subtraction. */}
                  {t ? (
                    <div className={styles.funnel}>
                      <Step icon="IconImpression" label="Shown" value={t.impressions} max={t.impressions} />
                      <Step icon="IconOpened" label="Opened" value={t.views} max={t.impressions} />
                      <Step icon="IconBought" label="Sold" value={t.transactions} max={t.impressions} strong />
                    </div>
                  ) : (
                    <p className={styles.empty}>
                      <Icon name="IconChart" className={styles.emptyIcon} />
                      No traffic yet. Pulls cover up to yesterday, so a listing appears after its first full day.
                    </p>
                  )}

                  <dl className={styles.facts}>
                    {item.ebay?.category_name && <Fact label="Category" value={item.ebay.category_name} sub={`#${item.ebay.category_id}`} />}
                    <Fact label="Listing" value={item.listingId} mono />
                    {item.ebay?.sku && <Fact label="Code" value={item.ebay.sku} mono />}
                  </dl>

                  {item.origin === 'portal' && (
                    revising
                      ? <Revise item={item} onUpdate={onUpdate} onRead={onRead} onClose={() => setRevising(false)} />
                      : (
                        <button type="button" className={styles.revise} onClick={() => setRevising(true)}>
                          <Icon name="IconRefresh" className={styles.btnIcon} />
                          Update on eBay
                          {item.ebay?.revised_at && <span className={styles.revisedAt}>last {ago(item.ebay.revised_at)}</span>}
                        </button>
                      )
                  )}
                </>
              ) : (
                <p className={styles.empty}>Only on your shop.</p>
              )}
            </Card>

            <Card>
              <CardHead
                title="Your shop"
                note={item.shop
                  ? item.shop.status === 'live' ? 'Live on cartandkeep.com' : 'Draft, not on sale yet'
                  : 'Not on your shop'}
                aside={item.shop && (
                  <a className={styles.out} href={portalPath('/products')}>
                    Products <Icon name="IconOut" className={styles.outIcon} />
                  </a>
                )}
              />

              {item.shop ? (
                <div className={styles.shopState}>
                  <span className={`${styles.big} ${item.shop.status === 'live' ? styles.positive : ''}`}>
                    {item.shop.status === 'live' ? 'On sale' : 'Draft'}
                  </span>
                  <span className={styles.shopPrice} data-num>{formatGbp(item.shop.price)}</span>
                  {item.shop.status === 'draft' && (
                    <p className={styles.note}>Take it live from Products once its returns and hazard fields are confirmed.</p>
                  )}
                </div>
              ) : item.candidateId ? (
                <div className={styles.shopState}>
                  <p className={styles.note}>
                    Same price with no eBay fee or ad rate, so the shop keeps more of each sale.
                  </p>
                  {shopKeep != null && (
                    <p className={styles.keepLine}>
                      Keep <span className={`figure ${styles.positive}`}>{formatGbp(shopKeep)}</span> a sale at {formatGbp(price)}
                    </p>
                  )}
                  <button type="button" className={styles.primary} disabled={busy || goods == null} onClick={toShop}>
                    <Icon name="IconShop" className={styles.btnIcon} />
                    {busy ? 'Adding' : 'Add to your shop'}
                  </button>
                  {problem && <p className={styles.failed}>{problem}</p>}
                </div>
              ) : (
                <p className={styles.empty}>Not linked to a product the pipeline found.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </article>
  );
}

// Sends the portal's copy to the live listing. Anything changed on eBay since
// is replaced, so price and quantity are asked for rather than assumed.
function Revise({ item, onUpdate, onRead, onClose }) {
  const [price, setPrice] = useState(String(item.ebay?.price ?? ''));
  const [qty, setQty] = useState(String(item.ebay?.quantity ?? 1));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);
  const [live, setLive] = useState(null);
  const [reading, setReading] = useState(true);

  // Starts from what is live, so the update keeps any price set on eBay unless changed here.
  useEffect(() => {
    let on = true;
    onRead(item)
      .then((d) => {
        if (!on) return;
        setLive(d);
        if (d.price) setPrice(String(d.price));
        if (d.available) setQty(String(d.available));
      })
      .catch((e) => on && setFailed(e.message))
      .finally(() => on && setReading(false));
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.listingId]);

  const sending = item.row?.draft?.images ?? item.row?.listing?.images ?? [];

  async function send() {
    setBusy(true);
    setFailed(null);
    try {
      await onUpdate(item, { price, quantity: qty });
      setDone(true);
    } catch (e) {
      setFailed(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className={styles.revised}>
        <Icon name="IconCheck" className={styles.btnIcon} />
        Updated on eBay. The same listing, with its sales and watchers kept.
        <button type="button" className={styles.linkBtn} onClick={onClose}>Close</button>
      </p>
    );
  }

  return (
    <div className={styles.revisePanel}>
      {reading && <p className={styles.reviseNote}>Reading the listing from eBay…</p>}

      {live && (
        <dl className={styles.compare}>
          <div className={styles.compareHead}>
            <span />
            <span>On eBay now</span>
            <span>After update</span>
          </div>
          <Row label="Price" now={gbpOf(live.price)} next={gbpOf(Number(price))} />
          <Row label="Available" now={live.available} next={qty} />
          <Row label="Photos" now={live.photos.length} next={sending.length} />
          <Row label="Postage" now={live.postage.name ?? 'not set'}
            next={live.postage.matches_saved ? live.postage.name : 'your saved policy'}
            changes={!live.postage.matches_saved} />
          <Row label="Description" now="as on eBay" next="paragraphs and bullets" changes />
        </dl>
      )}

      <p className={styles.reviseWarn}>
        <Icon name="IconInfo" className={styles.btnIcon} />
        This replaces the title, description, photos, price and quantity on eBay with the portal's.
        Changes made in Seller Hub since will be overwritten.
      </p>
      <div className={styles.reviseFields}>
        <label className={styles.reviseField}>
          <span>Price</span>
          <span className={styles.reviseControl}>
            <span className={styles.affix}>£</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} data-num />
          </span>
        </label>
        <label className={styles.reviseField}>
          <span>Quantity</span>
          <span className={styles.reviseControl}>
            <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} data-num />
          </span>
        </label>
      </div>
      {failed && <p className={styles.failed}>{failed}</p>}
      <div className={styles.reviseActions}>
        <button type="button" className={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.primary}
          disabled={busy || !(Number(price) > 0) || !(Number(qty) >= 1)} onClick={send}>
          {busy ? 'Updating eBay' : 'Update listing'}
        </button>
      </div>
    </div>
  );
}

const gbpOf = (v) => (v == null || Number.isNaN(v) ? '--'
  : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v));

function Row({ label, now, next, changes }) {
  const differs = changes ?? String(now) !== String(next);
  return (
    <div className={`${styles.compareRow} ${differs ? styles.compareChanged : ''}`}>
      <dt>{label}</dt>
      <dd data-num>{now}</dd>
      <dd data-num>{next}</dd>
    </div>
  );
}

function Fig({ label, value, tone }) {
  return (
    <div className={styles.fig}>
      <span className={styles.figLabel}>{label}</span>
      <span className={`${styles.figValue} ${tone ? styles[tone] : ''}`} data-num>{value}</span>
    </div>
  );
}

function Step({ icon, label, value, max, strong }) {
  const pct = max ? Math.max(1.5, ((value ?? 0) / max) * 100) : 0;
  return (
    <div className={`${styles.step} ${strong ? styles.stepStrong : ''}`}>
      <span className={styles.stepHead}><Icon name={icon} className={styles.stepIcon} />{label}</span>
      <span className={`figure ${styles.stepValue}`}>{Number(value ?? 0).toLocaleString('en-GB')}</span>
      <span className={styles.stepBar}><span style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

function Fact({ label, value, sub, mono }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={`${styles.factValue} ${mono ? styles.mono : ''}`}>
        {value}{sub && <span className={styles.factSub}>{sub}</span>}
      </dd>
    </div>
  );
}
