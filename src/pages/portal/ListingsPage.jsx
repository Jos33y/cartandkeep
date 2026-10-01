import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Icon } from '@components/ui/icons';
import { PAGE, conditions, useLiveListings } from '@hooks/useLiveListings';
import { supabase } from '@lib/supabase';
import { loadTenant } from '@lib/tenant';
import { PRODUCT_SELECT, blockers, isReady } from '@hooks/useCatalogue';
import { stepsFor, STEPS, isOpen } from '@lib/readiness';
import { formatGbp } from '@utils/formatGbp';
import { portalPath } from '@utils/constants';
import styles from '@styles/pages/portal/listings-page.module.css';

/*
 * What is live: eBay listings active today and shop products on sale, nothing else. A table, read a page at a time
 * from the live_listings view, sorted and filtered in the database so it reads the same at 450 listings or 5,000.
 */

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'channel', label: 'Where' },
  { key: 'price', label: 'Price', align: 'right' },
];
const ROWS = [{}, {}, {}, {}];

const TABS = [
  { id: 'all', label: 'All', count: 'all' },
  { id: 'both', label: 'On both', count: 'both' },
  { id: 'ebayOnly', label: 'eBay only', count: 'ebay_only' },
  { id: 'shopOnly', label: 'Shop only', count: 'shop_only' },
];

// One at a time, on top of the tab: the questions she asks of a long list.
const SHOWS = [
  { id: 'selling', label: 'Selling', count: 'selling' },
  { id: 'noShop', label: 'Not on your shop', count: 'no_shop' },
  { id: 'out', label: 'None left', count: 'out', tone: 'negative' },
  { id: 'low', label: '1 or 2 left', count: 'low', tone: 'warning' },
  { id: 'quiet', label: 'No views in 90 days', count: 'quiet' },
  { id: 'wanted', label: 'Wanted on your shop, not bought', count: 'wanted' },
];

const HEAD = [
  { id: 'title', label: 'Product', sortable: true, first: 'asc' },
  { id: 'price', label: 'Price', sortable: true, num: true, first: 'desc' },
  { id: 'available', label: 'Left', sortable: true, num: true, first: 'asc', tip: 'Left to sell on eBay, or your shop stock' },
  { id: 'sold', label: 'Sold', sortable: true, num: true, first: 'desc', tip: 'Units sold since the first sale, eBay and your shop' },
  { id: 'views', label: 'Opened', sub: '90 days', sortable: true, num: true, first: 'desc', tip: 'Times opened on eBay in the last 90 days, and how many of those opens bought' },
];

const London = { timeZone: 'Europe/London' };
const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...London }) : null);
const at = (iso) => (iso
  ? `${day(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, ...London }).replace(/\s/g, '')}`
  : null);
const monthOf = (ym) => new Date(`${String(ym).slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const n = (v) => Number(v ?? 0).toLocaleString('en-GB');

const ebayUrl = (id) => `https://www.ebay.co.uk/itm/${id}`;
// Her shop's product page. In development the shop is the same host with ?shop.
const shopUrl = (slug) => (import.meta.env.DEV ? `/p/${slug}?shop` : `https://cartandkeep.com/p/${slug}`);
const productUrl = (id, step) => portalPath(`/products?open=${id}${step ? `&step=${step}` : ''}`);

// Her eBay averages over the same 90 days, from the counts: what a listing's own rates are read against.
function averagesOf(counts) {
  const views = Number(counts?.ebay_views ?? 0);
  const shown = Number(counts?.ebay_impressions ?? 0);
  const orders = Number(counts?.ebay_orders ?? 0);
  return { open: shown ? views / shown : null, order: views ? orders / views : null };
}
const pct = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
// "1 in 20": how many opens it takes for one order.
const oneIn = (opens, orders) => (orders > 0 && opens > 0 ? `1 in ${Math.max(1, Math.round(opens / orders))}` : null);

/*
 * What the same sale keeps on her shop over eBay, at the same price: eBay's fee and its fixed charge against the
 * card fee. The tenant's own rates, with the defaults the profit view uses.
 */
function shopGain(price, fees) {
  if (price == null) return null;
  const e = fees?.ebay ?? {};
  const st = fees?.store ?? {};
  const ebay = price * Number(e.pct ?? 0.128) + Number(e.fixed ?? 0.3);
  const shop = price * Number(st.pct ?? 0.015) + Number(st.fixed ?? 0.2);
  return Math.round((ebay - shop) * 100) / 100;
}

/*
 * What her shop's mark says on a row: views, in words, and the one signal worth seeing at a glance on a long list,
 * someone wanting it and not buying.
 */
function shopSays(r) {
  if (r.shop_adds > 0 && !r.shop_sold) return { tone: 'warning', text: `${n(r.shop_adds)} ${r.shop_adds === 1 ? 'basket' : 'baskets'}, no sale` };
  if (!r.shop_views) return { tone: null, text: 'no views yet' };
  return { tone: null, text: `${n(r.shop_views)} ${r.shop_views === 1 ? 'view' : 'views'}` };
}

function readUrl() {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  return {
    tab: TABS.some((t) => t.id === q.get('tab')) ? q.get('tab') : 'all',
    show: SHOWS.some((s) => s.id === q.get('show')) ? q.get('show') : null,
  };
}

export function ListingsPage() {
  const [tenant, setTenant] = useState(undefined);
  useEffect(() => { loadTenant().then((t) => setTenant(t ?? null)); }, []);

  const start = useMemo(readUrl, []);
  const [tab, setTab] = useState(start.tab ?? 'all');
  const [show, setShow] = useState(start.show ?? null);
  const [find, setFind] = useState('');
  const [sort, setSort] = useState({ by: 'sold', dir: 'desc' });
  const [open, setOpen] = useState(() => new Set());
  const [picked, setPicked] = useState(() => new Map());
  const [adding, setAdding] = useState(null);
  const [notice, setNotice] = useState(null);

  const list = useLiveListings(tenant?.id, { tab, show, find, sort: sort.by, dir: sort.dir });
  const { rows, total, counts, facets, sold, status } = list;

  // The tab and filter in the address, so the Overview can send her straight to a list and a reload keeps it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (tab === 'all') q.delete('tab'); else q.set('tab', tab);
    if (!show) q.delete('show'); else q.set('show', show);
    const s = q.toString().replace(/=(&|$)/g, '$1');
    window.history.replaceState(null, '', `${window.location.pathname}${s ? `?${s}` : ''}`);
  }, [tab, show]);

  // The tabs and filters stay in reach down a long list, with the table's head sticking under them.
  const pageRef = useRef(null);
  const toolbar = useRef(null);
  useEffect(() => {
    const el = toolbar.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => pageRef.current?.style.setProperty('--toolbar-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  });

  // A new list starts closed and unticked.
  useEffect(() => { setOpen(new Set()); }, [tab, show, find, sort.by, sort.dir]);

  // The next page as the end of the list comes into view.
  const sentinel = useRef(null);
  const { loadMore } = list;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !list.more) return undefined;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) loadMore(); }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.more, loadMore, rows.length]);

  const toggleOpen = useCallback((key) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), []);
  const togglePick = useCallback((r) => setPicked((m) => {
    const next = new Map(m);
    if (next.has(r.key)) next.delete(r.key); else next.set(r.key, r);
    return next;
  }), []);
  const sortBy = (h) => setSort((s) => (s.by === h.id ? { by: h.id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { by: h.id, dir: h.first }));

  /*
   * Put drafts on sale from here, as Products does: the release guard run again on the product as saved, then live.
   * A product with anything left is refused with what it is.
   */
  const onSale = useCallback(async (products) => {
    const ids = [];
    for (let i = 0; i < products.length; i += 200) {
      const part = products.slice(i, i + 200).map((x) => x.id);
      const { data, error } = await supabase.from('store_products').select(PRODUCT_SELECT).in('id', part);
      if (error) throw new Error(error.message);
      for (const fresh of data ?? []) {
        const left = blockers(fresh);
        if (left.length && products.length === 1) throw new Error(`Not yet: ${left.join(', ').toLowerCase()}.`);
        if (!left.length) ids.push(fresh.id);
      }
    }
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('store_products').update({ status: 'live', is_sample: false }).in('id', ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
    list.reload();
    // One put on sale from its row: the row moves as the list re-sorts, so the page says it happened.
    if (products.length === 1 && ids.length) {
      setNotice({ tone: 'positive', text: `${products[0].title} is on sale on your shop now.`, to: null });
    }
    return ids.length;
  }, [list]);

  /*
   * Drafts of live eBay listings, read once: which can go on sale now, and what the rest wait on, counted by reason.
   * The case for the bulk action is the number; the reasons say what to do about the others.
   */
  const [drafts, setDrafts] = useState(null);
  const loadDrafts = useCallback(async () => {
    if (!tenant?.id || !counts?.drafts) { setDrafts(null); return; }
    const ids = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase.from('live_listings').select('product_id')
        .eq('tenant_id', tenant.id).eq('on_ebay', true).eq('shop_state', 'draft').order('key').range(from, from + 999);
      if (error) return;
      ids.push(...(data ?? []).map((x) => x.product_id).filter(Boolean));
      if ((data ?? []).length < 1000) break;
    }
    const rows = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('store_products').select(PRODUCT_SELECT).in('id', ids.slice(i, i + 200));
      if (error) return;
      rows.push(...(data ?? []));
    }
    const readyRows = rows.filter(isReady);
    const why = new Map();
    for (const x of rows) {
      const first = blockers(x)[0];
      if (first) why.set(first, (why.get(first) ?? 0) + 1);
    }
    setDrafts({ ready: readyRows, waiting: rows.length - readyRows.length, why: [...why.entries()].sort((a, b) => b[1] - a[1]) });
  }, [tenant?.id, counts?.drafts]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);
  // The banner's counts follow the list: a draft put on sale anywhere leaves them.
  useEffect(() => { loadDrafts(); }, [counts?.shop]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sellReady() {
    setNotice(null);
    setAdding({ done: 0, total: drafts.ready.length, verb: 'Putting on sale' });
    try {
      const done = await onSale(drafts.ready);
      setNotice({ tone: 'positive', text: `${n(done)} on sale on your shop now.` });
      loadDrafts();
    } catch (e) {
      setNotice({ tone: 'warning', text: e.message });
    } finally {
      setAdding(null);
    }
  }

  // Add eBay listings to her shop as drafts. `ids` given, or every listing the current filter holds that has none.
  async function addToShop(ids, label) {
    setNotice(null);
    setAdding({ done: 0, total: ids.length });
    try {
      const { added, skipped } = await list.addToShop(ids, (done, all) => setAdding({ done, total: all }));
      setPicked(new Map());
      list.reload();
      setNotice({
        tone: skipped.length && !added.length ? 'warning' : 'positive',
        text: `${added.length ? `${n(added.length)} added to your shop as drafts. They go on sale from Products once returns and labels are confirmed.` : 'Nothing added.'}${skipped.length ? ` ${n(skipped.length)} not added: ${skipped[0].reason}.` : ''}`,
        to: added.length ? portalPath('/products') : null,
        label,
      });
    } catch (e) {
      setNotice({ tone: 'warning', text: e.message });
    } finally {
      setAdding(null);
    }
  }
  async function addEveryNoShop() {
    // Every listing with no shop product under this tab and search, read in pages: the list on screen may hold fewer.
    const ids = [];
    for (let from = 0; from < 20000; from += 1000) {
      let q = supabase.from('live_listings').select('listing_id').eq('tenant_id', tenant.id);
      for (const [op, col, val] of conditions({ tab, show: 'noShop', find })) q = op === 'or' ? q.or(col) : q[op](col, val);
      const { data, error } = await q.order('key').range(from, from + 999);
      if (error) { setNotice({ tone: 'warning', text: error.message }); return; }
      ids.push(...(data ?? []).map((r) => r.listing_id).filter(Boolean));
      if ((data ?? []).length < 1000) break;
    }
    if (ids.length) addToShop(ids, 'all');
  }

  if (tenant === undefined || (status === 'loading' && !counts)) return <PageSkeleton rows={6} />;

  if (status === 'error') return <p className={styles.failed} role="alert">{list.error}</p>;

  if (counts && counts.all === 0) {
    return (
      <EmptyState
        eyebrow="Listings"
        title="Nothing live yet"
        icon="IconTag"
        body="Every eBay listing that is active and every product on sale on your shop lands here, with what is left and how it sells."
        columns={COLUMNS}
        rows={ROWS}
        note="Pull eBay on the Traffic page, or publish from Approved."
        action={{ to: portalPath('/approved'), label: 'Go to Approved' }}
      />
    );
  }

  const addable = [...picked.values()].filter((r) => r.on_ebay && !r.shop_state);
  const avg = averagesOf(counts);
  const filtered = Boolean(show || find.trim());
  // Until the counts under the current choice arrive, the whole list's counts stand in only when nothing narrows it.
  const tabCount = (t) => facets?.tab[t.id] ?? (filtered ? null : counts?.[t.count] ?? null);
  const showCount = (s) => facets?.show[s.id] ?? (filtered || tab !== 'all' ? null : counts?.[s.count] ?? null);

  return (
    <div className={styles.page} ref={pageRef}>
      <header className={styles.head}>
        <div>
          <p className="micro">Listings</p>
          <h1 className={styles.title}>What is live</h1>
        </div>
        <dl className={styles.stats}>
          <Stat icon="IconTag" label="On eBay" value={counts ? n(counts.ebay) : '--'}
            foot={counts?.pulled_at ? `active, checked ${at(counts.pulled_at)}` : 'pull eBay on Traffic to see them'} />
          <Stat icon="IconShop" label="On your shop" value={counts ? n(counts.shop) : '--'} foot="on sale" />
          <Stat icon="IconBought" label="Sold" value={sold ? n(sold.units) : '--'}
            foot={sold?.since ? `units since ${monthOf(sold.since)}` : 'no sales yet'} tone={sold?.units > 0 ? 'positive' : null} />
        </dl>
      </header>

      <div className={styles.toolbar} ref={toolbar}>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label="Where it is live">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              <span className={styles.tabCount} data-num>{tabCount(t) != null ? n(tabCount(t)) : ''}</span>
            </button>
          ))}
        </div>
        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find a title or item number" type="search"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a listing" />
        </span>
      </div>

      <div className={styles.filters} role="group" aria-label="Show only">
        {SHOWS.map((s) => {
          const c = showCount(s);
          return (
            <button key={s.id} type="button" aria-pressed={show === s.id} disabled={c === 0 && show !== s.id}
              className={styles.filter} data-tone={s.tone} onClick={() => setShow((v) => (v === s.id ? null : s.id))}>
              {s.label}
              <span className={styles.filterCount} data-num>{c != null ? n(c) : ''}</span>
            </button>
          );
        })}
        {filtered && (
          <button type="button" className={styles.clear} onClick={() => { setShow(null); setFind(''); }}>Clear</button>
        )}
      </div>
      </div>

      {show === 'noShop' && total > 0 && !adding && (
        <p className={styles.hint}>
          <Icon name="IconInfo" className={styles.hintIcon} />
          <span>Live on eBay with nothing on your shop. Added, each becomes a draft in Products with eBay's title, photos and price; it goes on sale there.</span>
          <button type="button" className={styles.hintAction} onClick={addEveryNoShop}>Add all {n(total)} to your shop</button>
        </p>
      )}
      {drafts && (drafts.ready.length > 0 || drafts.waiting > 0) && !adding && !show && (
        <div className={styles.drafts} role="note">
          <Icon name="IconShop" className={styles.draftsIcon} />
          <p className={styles.draftsText}>
            {drafts.ready.length > 0 && <><b data-num>{n(drafts.ready.length)}</b> {drafts.ready.length === 1 ? 'draft is' : 'drafts are'} ready for your shop, nothing left to check. </>}
            {drafts.waiting > 0 && (
              <>
                <b data-num>{n(drafts.waiting)}</b> {drafts.waiting === 1 ? 'waits' : 'wait'} on you
                {drafts.why.length > 0 && <>: {drafts.why.slice(0, 2).map(([w, c]) => `${n(c)} ${w.toLowerCase()}`).join(', ')}</>}.
              </>
            )}
          </p>
          <span className={styles.draftsActions}>
            {drafts.ready.length > 0 && (
              <button type="button" className={styles.primary} onClick={sellReady}>Put {n(drafts.ready.length)} on sale</button>
            )}
            {drafts.waiting > 0 && <a className={styles.out} href={portalPath('/products')}>Work through them in Products</a>}
          </span>
        </div>
      )}
      {adding && (
        <p className={styles.hint} role="status">
          <Icon name="IconShop" className={styles.hintIcon} />
          {adding.verb ? `${adding.verb}, ${n(adding.total)}.` : `Adding to your shop, ${n(adding.done)} of ${n(adding.total)}.`} Keep this page open.
        </p>
      )}
      {notice && (
        <p className={styles.notice} data-tone={notice.tone} role="status">
          {notice.text}
          {notice.to && <a href={notice.to} className={styles.hintAction}>Open Products</a>}
          <button type="button" className={styles.dismiss} onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      <section className={styles.tableWrap} aria-busy={status === 'refreshing' || undefined} aria-label="Live listings">
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cCheck} scope="col"><span className="visually-hidden">Select</span></th>
              {HEAD.map((h) => (
                <th key={h.id} scope="col" className={`${h.num ? styles.num : ''} ${styles[`c_${h.id}`] ?? ''}`}
                  aria-sort={sort.by === h.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={h.tip}>
                  <button type="button" className={styles.sortBtn} onClick={() => sortBy(h)} data-on={sort.by === h.id || undefined}>
                    <span className={styles.thText}>{h.label}{h.sub && <span className={styles.thSub}>{h.sub}</span>}</span>
                    <span className={styles.sortMark} aria-hidden="true" data-dir={sort.by === h.id ? sort.dir : undefined} />
                  </button>
                </th>
              ))}
              <th className={styles.cCaret} scope="col"><span className="visually-hidden">Open</span></th>
            </tr>
          </thead>
          {rows.map((r) => (
            <ListingRow key={r.key} r={r} avg={avg} fees={tenant?.fees} onSale={onSale} open={open.has(r.key)} picked={picked.has(r.key)}
              onOpen={() => toggleOpen(r.key)} onPick={() => togglePick(r)}
              onAdd={() => addToShop([r.listing_id], r.title)} busy={Boolean(adding)} list={list} />
          ))}
        </table>

        {rows.length === 0 && status !== 'loading' && (
          <p className={styles.none}>
            Nothing {filtered ? 'matches' : 'here'}.
            {filtered && <button type="button" className={styles.clear} onClick={() => { setShow(null); setFind(''); }}>Clear the filter</button>}
          </p>
        )}

        <div className={styles.foot}>
          <span data-num>Showing {n(rows.length)} of {n(total)}</span>
          {list.more && (
            <button type="button" className={styles.more} onClick={loadMore} disabled={status === 'more'}>
              {status === 'more' ? 'Loading' : `Show ${Math.min(PAGE, total - rows.length)} more`}
            </button>
          )}
          <span ref={sentinel} aria-hidden="true" />
        </div>
      </section>

      {picked.size > 0 && (
        <div className={styles.bulk} role="region" aria-label="Selected listings">
          <span className={styles.bulkCount} data-num>{n(picked.size)} selected</span>
          {addable.length > 0
            ? (
              <button type="button" className={styles.primary} disabled={Boolean(adding)} onClick={() => addToShop(addable.map((r) => r.listing_id))}>
                <Icon name="IconShop" className={styles.btnIcon} />Add {n(addable.length)} to your shop
              </button>
            )
            : <span className={styles.bulkNote}>All on your shop already, or waiting in Products.</span>}
          {addable.length > 0 && addable.length < picked.size && (
            <span className={styles.bulkNote}>{n(picked.size - addable.length)} already on your shop or in Products</span>
          )}
          <button type="button" className={styles.ghostBtn} onClick={() => setPicked(new Map())}>Clear</button>
        </div>
      )}
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

function ListingRow({ r, avg, fees, onSale, open, picked, onOpen, onPick, onAdd, busy, list }) {
  const left = r.available;
  const leftTone = left === 0 ? 'negative' : left != null && left <= 2 ? 'warning' : null;
  const shopPriceDiffers = r.on_shop && r.on_ebay && r.shop_price != null && r.price != null && Math.abs(r.shop_price - r.price) >= 0.01;
  return (
    <tbody className={styles.group} data-open={open || undefined} data-picked={picked || undefined}>
      <tr className={styles.row} onClick={(e) => { if (!e.target.closest('a, button, input, label')) onOpen(); }}>
        <td className={styles.cCheck}>
          <label className={styles.check}>
            <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Select ${r.title}`} />
          </label>
        </td>
        <td className={styles.c_title}>
          <div className={styles.product}>
            {r.image_url
              ? <img className={styles.thumb} src={r.image_url} alt="" loading="lazy" decoding="async" width="40" height="40" />
              : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}
            <div className={styles.subject}>
              <button type="button" className={styles.name} onClick={onOpen} aria-expanded={open} title={r.title}>{r.title}</button>
              <span className={styles.marks}>
                {r.on_ebay && (
                  <a className={`${styles.mark} ${styles.markEbay}`} href={ebayUrl(r.listing_id)} target="_blank" rel="noreferrer noopener"
                    aria-label={`Open on eBay, ${r.title}`}>
                    <span className={styles.dot} />eBay<Icon name="IconOut" className={styles.markOut} />
                  </a>
                )}
                {r.on_shop && r.shop_slug && (() => {
                  const says = shopSays(r);
                  return (
                    <a className={`${styles.mark} ${styles.markShop}`} data-tone={says.tone ?? undefined} href={shopUrl(r.shop_slug)} target="_blank" rel="noreferrer noopener"
                      aria-label={`Open on your shop, ${r.title}. ${says.text} since it went on sale`} title="On your shop, since it went on sale">
                      <span className={styles.dot} />Shop<span className={styles.markSays}>{says.text}</span><Icon name="IconOut" className={styles.markOut} />
                    </a>
                  );
                })()}
                {r.on_ebay && r.shop_state === 'draft' && <span className={`${styles.mark} ${styles.markDraft}`}>Draft in Products</span>}
              </span>
            </div>
          </div>
        </td>
        <td className={`${styles.num} ${styles.c_price}`}>
          <span className={styles.cellLabel}>Price</span>
          <span data-num>{formatGbp(r.price)}</span>
          {shopPriceDiffers && <span className={styles.sub} data-num>shop {formatGbp(r.shop_price)}</span>}
        </td>
        <td className={`${styles.num} ${styles.c_available}`}>
          <span className={styles.cellLabel}>Left</span>
          <span data-num className={leftTone ? styles[leftTone] : ''} title={left === 0 ? 'None left to sell' : left == null ? 'Not read from eBay yet' : undefined}>{left ?? '--'}</span>
        </td>
        <td className={`${styles.num} ${styles.c_sold}`}>
          <span className={styles.cellLabel}>Sold</span>
          <span data-num className={r.sold > 0 ? styles.positive : styles.zero}>{n(r.sold)}</span>
          {r.refunded > 0 && <span className={styles.sub} data-num>{n(r.refunded)} refunded</span>}
        </td>
        <td className={`${styles.num} ${styles.c_views}`}>
          <span className={styles.cellLabel}>Opened, 90 days</span>
          {r.on_ebay ? (
            <>
              <span data-num className={r.views ? '' : styles.zero}>{n(r.views)}</span>
              {oneIn(r.views, r.orders_window) && (
                <span className={`${styles.sub} ${avg?.order != null && r.orders_window / r.views >= avg.order ? styles.positive : ''}`} data-num
                  title={avg?.order ? `Your average is ${oneIn(1, avg.order)} across eBay` : undefined}>
                  {oneIn(r.views, r.orders_window)} bought
                </span>
              )}
            </>
          ) : <span data-num className={styles.zero} title="Not on eBay">--</span>}
        </td>
        <td className={styles.cCaret}>
          <span className={styles.caret} data-open={open || undefined} aria-hidden="true">
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </td>
      </tr>
      {open && (
        <tr className={styles.detailRow}>
          <td colSpan={7}>
            <Detail r={r} avg={avg} fees={fees} onSale={onSale} onAdd={onAdd} busy={busy} list={list} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

function Detail({ r, avg, fees, onSale, onAdd, busy, list }) {
  const [card, setCard] = useState(null);
  const [revising, setRevising] = useState(false);
  const [problem, setProblem] = useState(null);
  const { cardOf } = list;
  useEffect(() => {
    if (!r.candidate_id) return;
    cardOf(r.candidate_id).then(setCard).catch((e) => setProblem(e.message));
  }, [r.candidate_id, cardOf]);
  const window90 = r.window_start ? `${day(r.window_start)} to ${day(r.window_end)}` : null;
  // Sold on eBay alone: the row's Sold counts her shop's sales of the same product too.
  const ebaySold = Math.max(0, Number(r.sold ?? 0) - (r.on_shop ? Number(r.shop_sold ?? 0) : 0));
  const openRate = r.impressions ? r.views / r.impressions : null;
  const orderRate = r.views ? r.orders_window / r.views : null;

  return (
    <div className={styles.deck}>
      <section className={styles.panel} aria-label="eBay">
        <header className={styles.panelHead}>
          <span className={styles.panelTitle}>eBay</span>
          {r.on_ebay
            ? <span className={styles.state} data-tone="positive"><span className={styles.dot} />Live</span>
            : <span className={styles.state}>Not on eBay</span>}
          {r.on_ebay && (
            <a className={styles.out} href={ebayUrl(r.listing_id)} target="_blank" rel="noreferrer noopener">
              View on eBay <Icon name="IconOut" className={styles.outIcon} />
            </a>
          )}
        </header>
        {r.on_ebay ? (
          <>
            {r.views != null ? (
              <>
                <p className={styles.window}>{window90 ? `Last 90 days, ${window90}` : 'Last 90 days'}</p>
                {/* The count, then what it is as a rate, against her own average. A rate says whether the
                    listing works; a bar of 16 against 385 said nothing. */}
                <div className={styles.rates}>
                  <Rate label="Shown" value={n(r.impressions)} line="in search and browse" />
                  <Rate label="Opened" value={n(r.views)}
                    line={openRate != null ? `${pct(openRate)} of times shown` : null}
                    against={avg?.open != null && openRate != null ? { mine: openRate, avg: avg.open, text: `your average ${pct(avg.open)}` } : null} />
                  <Rate label="Orders" value={n(r.orders_window)}
                    line={orderRate ? `${oneIn(r.views, r.orders_window)} opens` : r.views ? 'none from these opens' : null}
                    against={avg?.order != null && orderRate != null && r.orders_window > 0 ? { mine: orderRate, avg: avg.order, text: `your average ${oneIn(1, avg.order)}` } : null} />
                </div>
              </>
            ) : (
              <p className={styles.empty}>
                <Icon name="IconChart" className={styles.emptyIcon} />
                Published since eBay was last read. Its views arrive with the next morning's pull.
              </p>
            )}
            <dl className={styles.facts}>
              <Fact label="Item number" value={r.listing_id} mono />
              <Fact label="Left to sell" value={r.available ?? '--'} sub={r.available == null ? 'read on the next pull' : null} />
              <Fact label="Sold on eBay" value={`${n(ebaySold)}${r.refunded ? `, ${n(r.refunded)} refunded` : ''}`} sub="all time" />
            </dl>
            {card?.ebay && (
              revising
                ? <Revise card={card} listingId={r.listing_id} onUpdate={(v) => list.updateOnEbay(card.id, v).then((d) => { list.reload(); return d; })}
                    onRead={() => list.readLive(r.listing_id)} onClose={() => setRevising(false)} />
                : (
                  <button type="button" className={styles.revise} onClick={() => setRevising(true)}>
                    <Icon name="IconRefresh" className={styles.btnIcon} />Update on eBay
                    {card.ebay?.revised_at && <span className={styles.revisedAt}>last {day(card.ebay.revised_at)}</span>}
                  </button>
                )
            )}
            {problem && <p className={styles.failed}>{problem}</p>}
          </>
        ) : (
          <p className={styles.empty}>Only on your shop.</p>
        )}
      </section>

      {r.on_shop ? <ShopLive r={r} />
        : r.shop_state === 'draft' ? <ShopDraft r={r} fees={fees} onSale={onSale} />
          : <ShopNone r={r} fees={fees} onAdd={onAdd} busy={busy} />}
    </div>
  );
}

function Rate({ label, value, line, against }) {
  const above = against ? against.mine >= against.avg : null;
  return (
    <div className={styles.rate}>
      <span className={styles.rateLabel}>{label}</span>
      <span className={`figure ${styles.rateValue}`}>{value}</span>
      {line && <span className={styles.rateLine}>{line}</span>}
      {against && <span className={styles.rateAvg} data-tone={above ? 'positive' : 'below'}>{above ? 'Above' : 'Below'} {against.text}</span>}
    </div>
  );
}

// On sale: her shop's own funnel since it went on sale, each step against the largest.
function ShopLive({ r }) {
  const steps = [
    { icon: 'IconOpened', label: 'Viewed', value: r.shop_views ?? 0 },
    { icon: 'IconHeart', label: 'Saved', value: r.shop_saves ?? 0 },
    { icon: 'IconBox', label: 'In a basket', value: r.shop_adds ?? 0 },
    { icon: 'IconUndo', label: 'Taken out', value: r.shop_removes ?? 0, warn: (r.shop_removes ?? 0) > 0 },
    { icon: 'IconBought', label: 'Bought', value: r.shop_sold ?? 0, strong: (r.shop_sold ?? 0) > 0 },
  ];
  const max = Math.max(1, ...steps.map((x) => x.value));
  return (
    <section className={styles.panel} aria-label="Your shop">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>Your shop</span>
        <span className={styles.state} data-tone="positive"><span className={styles.dot} />On sale</span>
        <span className={styles.panelLinks}>
          <a className={styles.out} href={portalPath('/interest')}>Interest</a>
          {r.shop_slug && (
            <a className={styles.out} href={shopUrl(r.shop_slug)} target="_blank" rel="noreferrer noopener">
              View on your shop <Icon name="IconOut" className={styles.outIcon} />
            </a>
          )}
        </span>
      </header>
      <p className={styles.window}>Since it went on your shop</p>
      <div className={`${styles.funnel} ${styles.funnelShop}`}>
        {steps.map((x) => <Step key={x.label} icon={x.icon} label={x.label} value={x.value} max={max} warn={x.warn} strong={x.strong} />)}
      </div>
      {(r.shop_sold ?? 0) > (r.shop_views ?? 0) && (
        <p className={styles.aside}>More bought than viewed: some buyers checked out without opening this page, from a list or their basket.</p>
      )}
      <dl className={styles.facts}>
        <Fact label="Price on your shop" value={formatGbp(r.shop_price)} mono />
        {r.on_ebay && r.price != null && <Fact label="On eBay" value={formatGbp(r.price)} mono />}
        {!r.on_ebay && <Fact label="Stock" value={r.available ?? 'not tracked'} />}
      </dl>
    </section>
  );
}

/*
 * A draft waiting in Products: why it is not on sale, in her words, each gap a link to the very step in the product
 * sheet, the case for it in money and in eBay's demand, and Put on sale here when nothing is left.
 */
function ShopDraft({ r, fees, onSale }) {
  const [p, setP] = useState(null);
  const [failed, setFailed] = useState(null);
  const [selling, setSelling] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let on = true;
    supabase.from('store_products').select(PRODUCT_SELECT).eq('id', r.product_id).maybeSingle()
      .then(({ data, error }) => { if (on) { if (error) setFailed(error.message); else setP(data); } });
    return () => { on = false; };
  }, [r.product_id]);

  const gaps = p ? stepsFor(p, STEPS.filter((x) => x.gate)).filter((x) => isOpen(x.state)) : [];
  const ready = p ? isReady(p) : false;
  const gain = shopGain(r.price, fees);

  async function sell() {
    setSelling(true);
    setFailed(null);
    try {
      await onSale([p]);
      setDone(true);
    } catch (e) {
      setFailed(e.message);
    } finally {
      setSelling(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="Your shop">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>Your shop</span>
        <span className={styles.state} data-tone={done ? 'positive' : 'draft'}><span className={styles.dot} />{done ? 'On sale' : 'Draft'}</span>
      </header>

      {(gain > 0 || r.views > 0) && (
        <p className={styles.case}>
          {gain > 0 && <>On your shop it keeps <b data-num>{formatGbp(gain)}</b> more a sale, with no eBay fee.</>}
          {r.views > 0 && <> eBay buyers opened it <b data-num>{n(r.views)}</b> times in 90 days.</>}
        </p>
      )}

      {done ? (
        <p className={styles.aside}>On sale now. It joins the list as on both once the page reloads.</p>
      ) : !p ? (
        failed ? <p className={styles.failed}>{failed}</p> : <p className={styles.aside}>Reading the draft</p>
      ) : (
        <>
          {gaps.length > 0 ? (
            <ul className={styles.gaps} aria-label="Before it goes on sale">
              {gaps.map((g) => (
                <li key={g.key} data-state={g.state}>
                  <span className={styles.gapMark} aria-hidden="true" />
                  <span className={styles.gapText}><b>{g.label}</b> {g.note}</span>
                  <a className={styles.gapFix} href={productUrl(p.id, g.key)}>{FIX[g.key] ?? 'Open'}</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.aside}>Nothing left to check. Photos, price, returns and label are all in.</p>
          )}
          <div className={styles.shopActions}>
            <button type="button" className={styles.primary} disabled={!ready || selling} onClick={sell}>
              <Icon name="IconShop" className={styles.btnIcon} />{selling ? 'Putting it on sale' : 'Put on sale'}
            </button>
            {!ready && <span className={styles.aside}>{gaps.length === 1 ? 'One thing first' : `${gaps.length} things first`}</span>}
            <a className={styles.out} href={productUrl(p.id)}>Edit the product</a>
          </div>
          {failed && <p className={styles.failed}>{failed}</p>}
        </>
      )}
    </section>
  );
}

// What each gap's link says: the action, not the step.
const FIX = {
  photo: 'Add a photo',
  price: 'Set a price',
  returns: 'Confirm returns',
  checks: 'Answer',
  hazard: 'Copy the label',
  stock: 'Set stock',
};

function ShopNone({ r, fees, onAdd, busy }) {
  const gain = shopGain(r.price, fees);
  return (
    <section className={styles.panel} aria-label="Your shop">
      <header className={styles.panelHead}>
        <span className={styles.panelTitle}>Your shop</span>
        <span className={styles.state}>Not on your shop</span>
      </header>
      <p className={styles.case}>
        {gain > 0 ? <>At the same price it keeps <b data-num>{formatGbp(gain)}</b> more a sale on your shop, with no eBay fee.</> : 'The same price keeps more on your shop, with no eBay fee.'}
        {r.views > 0 && <> eBay buyers opened it <b data-num>{n(r.views)}</b> times in 90 days.</>}
      </p>
      <p className={styles.aside}>Added, it becomes a draft in Products with eBay's title, photos and price, and goes on sale once its returns and label are checked.</p>
      <div className={styles.shopActions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={onAdd}>
          <Icon name="IconShop" className={styles.btnIcon} />{busy ? 'Adding' : 'Add to your shop'}
        </button>
      </div>
    </section>
  );
}

// Sends the portal's copy to the live listing. Anything changed on eBay since
// is replaced, so price and quantity are asked for rather than assumed.
function Revise({ card, listingId, onUpdate, onRead, onClose }) {
  const [price, setPrice] = useState(String(card.ebay?.price ?? ''));
  const [qty, setQty] = useState(String(card.ebay?.quantity ?? 1));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);
  const [live, setLive] = useState(null);
  const [reading, setReading] = useState(true);
  const saved = card.ebay?.package ?? card.draft?.package ?? {};
  const [parcel, setParcel] = useState({
    weight_kg: saved.weight_kg ?? '',
    length_cm: saved.length_cm ?? '',
    width_cm: saved.width_cm ?? '',
    height_cm: saved.height_cm ?? '',
  });
  const set = (k) => (e) => setParcel((p) => ({ ...p, [k]: e.target.value }));
  const parcelOk = Number(parcel.weight_kg) > 0
    && ['length_cm', 'width_cm', 'height_cm'].every((k) => Number(parcel[k]) > 0);

  // Starts from what is live, so the update keeps any price set on eBay unless changed here.
  useEffect(() => {
    let on = true;
    onRead()
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
  }, [listingId]);

  const sending = card.draft?.images ?? card.listing?.images ?? [];

  async function send() {
    setBusy(true);
    setFailed(null);
    try {
      await onUpdate({
        price,
        quantity: qty,
        parcel: Object.fromEntries(Object.entries(parcel).map(([k, v]) => [k, Number(v)])),
      });
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
          <Row label="Photos" now={(live.photos ?? []).length} next={sending.length} />
          <Row label="Postage" now={live.postage?.name ?? 'not set'}
            next={live.postage?.matches_saved ? live.postage.name : 'your saved policy'}
            changes={!live.postage?.matches_saved} />
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
      {/* eBay's tracked and Click & Collect services price by parcel and refuse without one. */}
      <div className={styles.parcel}>
        <span className={styles.parcelLabel}>Parcel, as packed</span>
        <div className={styles.parcelFields}>
          <label className={styles.reviseField}>
            <span>Weight</span>
            <span className={styles.reviseControl}>
              <input inputMode="decimal" value={parcel.weight_kg} onChange={set('weight_kg')} data-num />
              <span className={styles.affix}>kg</span>
            </span>
          </label>
          {[['length_cm', 'Length'], ['width_cm', 'Width'], ['height_cm', 'Height']].map(([k, label]) => (
            <label key={k} className={styles.reviseField}>
              <span>{label}</span>
              <span className={styles.reviseControl}>
                <input inputMode="decimal" value={parcel[k]} onChange={set(k)} data-num />
                <span className={styles.affix}>cm</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {failed && <p className={styles.failed}>{failed}</p>}
      <div className={styles.reviseActions}>
        <button type="button" className={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.primary}
          disabled={busy || !(Number(price) > 0) || !(Number(qty) >= 1) || !parcelOk} onClick={send}>
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

function Step({ icon, label, value, max, strong, warn }) {
  const pct = max ? Math.max(1.5, ((value ?? 0) / max) * 100) : 0;
  return (
    <div className={`${styles.step} ${strong ? styles.stepStrong : ''} ${warn ? styles.stepWarn : ''}`}>
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
