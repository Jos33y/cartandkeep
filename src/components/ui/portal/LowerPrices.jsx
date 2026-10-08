import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@lib/supabase';
import { pricesFor } from '@lib/repricing';
import { buyersSee } from '@lib/ebayAccount';
import { formatGbp } from '@utils/formatGbp';
import styles from '@styles/ui/portal/lower-prices.module.css';

/*
 * Live listings brought down to the lowest price that keeps her profit (Joseey, 8 October 2026: "lets do this").
 * They were priced as a business seller on Evri, with 12.8% plus 30p off every sale; as a private seller on Royal
 * Mail the same profit comes at a lower price, and a lower price is what sells.
 *
 * Only listings published from the portal, since only those have a card with a cost. Only ones that come down:
 * nothing is raised here. Each is the card's own floor (pricesFor, the figure Change price offers as "Lowest with
 * your profit"). A cost she has confirmed is ticked; one priced from the shelf is shown unticked, for her to choose.
 * eBay only: the shop keeps its price. Every change goes through price-change and is kept in price_changes.
 */

const CARD = 'id, title, draft, ebay, margin, entry, competition, sources:candidate_sources(id, supplier, fulfilment, url, unit_cost, landed_unit_cost, matched_on, note)';
const AT_ONCE = 3;
const r2 = (v) => Math.round(v * 100) / 100;

// The listings that come down, worked out once when the list is in, and again when asked (after a run). Not on every
// change to the list: each price changed changes it.
export function useLowerable(tenantId, rows, ready) {
  const [found, setFound] = useState(null);
  const latest = useRef(rows);
  latest.current = rows;

  const work = useCallback(async () => {
    if (!tenantId) return;
    const rows = latest.current;
    const ours = rows.filter((r) => r.listed_here && r.on_ebay && r.candidate_id && Number(r.price) > 0);
    const cards = new Map();
    const ids = [...new Set(ours.map((r) => r.candidate_id))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('candidates').select(CARD).eq('tenant_id', tenantId).in('id', ids.slice(i, i + 200));
      if (error) { setFound({ error: error.message, items: [] }); return; }
      for (const c of data ?? []) cards.set(c.id, c);
    }
    const items = [];
    let noCost = 0;
    for (const r of ours) {
      const card = cards.get(r.candidate_id);
      const m = card ? pricesFor(card).ebay : null;
      if (!m || m.floor == null) { noCost += 1; continue; }
      const now = Number(r.price);
      if (m.floor >= now - 0.005) continue;
      items.push({
        r,
        now,
        to: m.floor,
        cost: m.cost,
        from: m.from,
        confirmed: m.confirmed,
        keepNow: m.keepAt(now),
        keepNew: m.keepAt(m.floor),
      });
    }
    // Biggest drop first: the furthest over is the furthest from selling.
    items.sort((a, b) => (b.now - b.to) / b.now - (a.now - a.to) / a.now);
    setFound({ items, noCost, checked: ours.length });
  }, [tenantId]);

  const once = useRef(false);
  useEffect(() => {
    if (!ready || once.current) return;
    once.current = true;
    work();
  }, [ready, work]);
  return { found, recheck: work };
}

export function LowerPrices({ found, change, onDone, onClose }) {
  // Held as it opened: the list behind it changes with every price lowered.
  const [items] = useState(found.items);
  const [pick, setPick] = useState(() => new Set(items.filter((x) => x.confirmed).map((x) => x.r.key)));
  const [run, setRun] = useState(null);

  const chosen = items.filter((x) => pick.has(x.r.key));
  const off = r2(chosen.reduce((n, x) => n + (x.now - x.to), 0));
  const estimates = items.filter((x) => !x.confirmed).length;
  const all = chosen.length === items.length;

  const flip = (key) => setPick((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  async function go() {
    const queue = [...chosen];
    const failed = [];
    let done = 0;
    setRun({ done: 0, total: queue.length, failed });
    const worker = async () => {
      for (let x = queue.shift(); x; x = queue.shift()) {
        try {
          const res = await change(x.r, { ebay: x.to, cost: x.cost, ebayChoice: 'floor' });
          if (!res?.ebay?.ok) failed.push({ x, why: res?.ebay?.error ?? 'eBay did not take it' });
        } catch (e) {
          failed.push({ x, why: e.message });
        }
        done += 1;
        setRun({ done, total: chosen.length, failed: [...failed] });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
    setRun({ done, total: chosen.length, failed: [...failed], finished: true });
    onDone?.();
  }

  const working = run && !run.finished;

  return (
    <section className={styles.panel} aria-label="Lower prices to your new floor">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Lower to your new floor</h2>
          <p className={styles.note}>
            The lowest price that still keeps your profit, now you sell as a private seller and post by Royal Mail. eBay only; your shop keeps its prices.
          </p>
        </div>
        {!working && <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>}
      </header>

      {run?.finished ? (
        <div className={styles.result} role="status">
          <p className={styles.resultLine}>
            <b data-num>{run.total - run.failed.length}</b> {run.total - run.failed.length === 1 ? 'price' : 'prices'} lowered on eBay.
            {run.failed.length > 0 && <> <b data-num>{run.failed.length}</b> not changed.</>}
          </p>
          {run.failed.length > 0 && (
            <ul className={styles.failed}>
              {run.failed.map(({ x, why }) => <li key={x.r.key}><span>{x.r.title}</span><small>{why}</small></li>)}
            </ul>
          )}
          <div className={styles.foot}>
            <button type="button" className={styles.ghost} onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.table} role="table" aria-label="Listings to lower">
            <div className={styles.row} data-head role="row">
              <span role="columnheader">
                <input type="checkbox" checked={all} disabled={working}
                  onChange={() => setPick(all ? new Set() : new Set(items.map((x) => x.r.key)))} aria-label="Select all" />
              </span>
              <span role="columnheader">Listing</span>
              <span role="columnheader" className={styles.num}>Sold</span>
              <span role="columnheader" className={styles.num}>Now</span>
              <span role="columnheader" className={styles.num}>New</span>
              <span role="columnheader" className={styles.num}>You keep</span>
            </div>
            {items.map((x) => {
              const on = pick.has(x.r.key);
              const buyers = buyersSee(x.to);
              return (
                <label key={x.r.key} className={styles.row} data-off={!on || undefined} role="row">
                  <span role="cell"><input type="checkbox" checked={on} disabled={working} onChange={() => flip(x.r.key)} /></span>
                  <span role="cell" className={styles.name}>
                    <span className={styles.titleText}>{x.r.title}</span>
                    <small data-tone={x.confirmed ? undefined : 'estimate'}>
                      {x.confirmed ? `Cost ${formatGbp(x.cost)}, ${x.from ?? 'your supplier'}` : `Cost ${formatGbp(x.cost)} from ${x.from ?? 'the shelf'}, not confirmed`}
                    </small>
                  </span>
                  <span role="cell" className={styles.num} data-num>{x.r.sold || '--'}</span>
                  <span role="cell" className={`${styles.num} ${styles.was}`} data-num>{formatGbp(x.now)}</span>
                  <span role="cell" className={`${styles.num} ${styles.to}`} data-num>
                    {formatGbp(x.to)}
                    <small title={buyers != null ? `Buyers see ${formatGbp(buyers)} with eBay's protection fee` : undefined}>{formatGbp(x.now - x.to)} off</small>
                  </span>
                  <span role="cell" className={styles.num} data-num>
                    {formatGbp(x.keepNew)}
                    <small>was {formatGbp(x.keepNow)}</small>
                  </span>
                </label>
              );
            })}
          </div>

          <div className={styles.foot}>
            <span className={styles.sum}>
              {working
                ? <>Lowering {run.done} of {run.total}. Keep this page open.</>
                : <><b data-num>{chosen.length}</b> of {items.length} chosen, <b data-num>{formatGbp(off)}</b> off in all.{estimates > 0 && ` ${estimates} with a cost not confirmed ${estimates === 1 ? 'is' : 'are'} left unticked.`}</>}
            </span>
            {!working && <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>}
            <button type="button" className={styles.primary} disabled={working || chosen.length === 0} onClick={go}>
              {working ? 'Lowering' : `Lower ${chosen.length} ${chosen.length === 1 ? 'price' : 'prices'}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// The line above the list that says how many can come down, and opens the panel.
export function LowerBanner({ found, onOpen }) {
  const count = found?.items?.length ?? 0;
  const off = useMemo(() => r2((found?.items ?? []).reduce((n, x) => n + (x.now - x.to), 0)), [found]);
  if (!count) return null;
  return (
    <div className={styles.banner} role="note">
      <svg viewBox="0 0 16 16" className={styles.bannerIcon} aria-hidden="true"><path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" /></svg>
      <p className={styles.bannerText}>
        <b data-num>{count}</b> {count === 1 ? 'listing is' : 'listings are'} priced above your new floor, <b data-num>{formatGbp(off)}</b> over in all.
        They were priced with eBay&apos;s 12.8% and Evri postage; they keep the same profit lower down.
      </p>
      <button type="button" className={styles.primary} onClick={onOpen}>Review prices</button>
    </div>
  );
}

/*
 * Her shop priced above her own eBay listing of the same product (Joseey, 9 October 2026). A shop sale pays no eBay
 * fee, and an eBay buyer pays the Buyer Protection fee on top, so the shop should never ask more than eBay: the shop
 * price is brought to eBay's. What she keeps is the shop's own sum (card fee, her cost and postage), worked out where
 * the product has a cost; one that would lose money at eBay's price is shown unticked. Her shop only: eBay keeps its
 * price. Read from the list already on the page, so it follows every eBay price change as it happens.
 */
export function useShopAbove(tenantId, rows, ready, fees) {
  const [costs, setCosts] = useState(null);
  const above = useMemo(() => rows.filter((r) => r.on_ebay && r.product_id && (r.shop_state === 'live' || r.shop_state === 'draft')
    && Number(r.price) > 0 && Number(r.shop_price) > Number(r.price) + 0.004), [rows]);
  const ids = useMemo(() => above.map((r) => r.product_id).sort().join(','), [above]);

  useEffect(() => {
    if (!tenantId || !ready || !ids) { setCosts(new Map()); return undefined; }
    let live = true;
    (async () => {
      const list = ids.split(',');
      const out = new Map();
      for (let i = 0; i < list.length; i += 200) {
        const { data } = await supabase.from('store_products').select('id, landed_cost, postage_cost').in('id', list.slice(i, i + 200));
        for (const p of data ?? []) out.set(p.id, p);
      }
      if (live) setCosts(out);
    })();
    return () => { live = false; };
  }, [tenantId, ready, ids]);

  return useMemo(() => {
    if (!ready || !costs) return null;
    const pct = Number(fees?.store?.pct ?? 0.015);
    const fixed = Number(fees?.store?.fixed ?? 0.2);
    const keepAt = (price, p) => (p?.landed_cost == null ? null
      : r2(price - (price * pct + fixed) - Number(p.landed_cost) - Number(p.postage_cost ?? 0)));
    const items = above.map((r) => {
      const p = costs.get(r.product_id);
      const now = Number(r.shop_price);
      const to = Number(r.price);
      return { r, now, to, keepNow: keepAt(now, p), keepNew: keepAt(to, p), known: p?.landed_cost != null };
    }).sort((a, b) => (b.now - b.to) - (a.now - a.to));
    return { items };
  }, [ready, costs, above, fees]);
}

export function MatchShop({ found, change, onClose }) {
  const [items] = useState(found.items);
  // A product that would lose money at eBay's price is left for her to look at.
  const [pick, setPick] = useState(() => new Set(items.filter((x) => x.keepNew == null || x.keepNew >= 0).map((x) => x.r.key)));
  const [run, setRun] = useState(null);

  const chosen = items.filter((x) => pick.has(x.r.key));
  const off = r2(chosen.reduce((n, x) => n + (x.now - x.to), 0));
  const losing = items.filter((x) => x.keepNew != null && x.keepNew < 0).length;
  const all = chosen.length === items.length;
  const flip = (key) => setPick((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  async function go() {
    const queue = [...chosen];
    const failed = [];
    let done = 0;
    setRun({ done: 0, total: queue.length, failed });
    const worker = async () => {
      for (let x = queue.shift(); x; x = queue.shift()) {
        try {
          const res = await change(x.r, { shop: x.to, shopChoice: 'typed' });
          if (!res?.shop?.ok) failed.push({ x, why: res?.shop?.error ?? 'The shop did not take it' });
        } catch (e) {
          failed.push({ x, why: e.message });
        }
        done += 1;
        setRun({ done, total: chosen.length, failed: [...failed] });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
    setRun({ done, total: chosen.length, failed: [...failed], finished: true });
  }

  const working = run && !run.finished;

  return (
    <section className={styles.panel} aria-label="Match your shop to eBay">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Match your shop to eBay</h2>
          <p className={styles.note}>
            Your shop asks more than your own eBay listing for these. A shop sale pays no eBay fee and an eBay buyer pays eBay&apos;s protection fee on top, so at eBay&apos;s price your shop is the cheaper place to buy. Your shop only; eBay keeps its prices.
          </p>
        </div>
        {!working && <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>}
      </header>

      {run?.finished ? (
        <div className={styles.result} role="status">
          <p className={styles.resultLine}>
            <b data-num>{run.total - run.failed.length}</b> shop {run.total - run.failed.length === 1 ? 'price' : 'prices'} matched to eBay.
            {run.failed.length > 0 && <> <b data-num>{run.failed.length}</b> not changed.</>}
          </p>
          {run.failed.length > 0 && (
            <ul className={styles.failed}>
              {run.failed.map(({ x, why }) => <li key={x.r.key}><span>{x.r.title}</span><small>{why}</small></li>)}
            </ul>
          )}
          <div className={styles.foot}>
            <button type="button" className={styles.ghost} onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.table} role="table" aria-label="Shop prices to match">
            <div className={styles.row} data-head role="row">
              <span role="columnheader">
                <input type="checkbox" checked={all} disabled={working}
                  onChange={() => setPick(all ? new Set() : new Set(items.map((x) => x.r.key)))} aria-label="Select all" />
              </span>
              <span role="columnheader">Product</span>
              <span role="columnheader" className={styles.num}>Sold</span>
              <span role="columnheader" className={styles.num}>Shop now</span>
              <span role="columnheader" className={styles.num}>eBay price</span>
              <span role="columnheader" className={styles.num}>Shop keeps</span>
            </div>
            {items.map((x) => {
              const on = pick.has(x.r.key);
              const loses = x.keepNew != null && x.keepNew < 0;
              return (
                <label key={x.r.key} className={styles.row} data-off={!on || undefined} role="row">
                  <span role="cell"><input type="checkbox" checked={on} disabled={working} onChange={() => flip(x.r.key)} /></span>
                  <span role="cell" className={styles.name}>
                    <span className={styles.titleText}>{x.r.title}</span>
                    <small data-tone={loses ? 'estimate' : undefined}>
                      {loses ? 'Loses money at the eBay price; check its cost' : x.r.shop_state === 'draft' ? 'Draft on your shop' : 'On sale on your shop'}
                    </small>
                  </span>
                  <span role="cell" className={styles.num} data-num>{x.r.sold || '--'}</span>
                  <span role="cell" className={`${styles.num} ${styles.was}`} data-num>{formatGbp(x.now)}</span>
                  <span role="cell" className={`${styles.num} ${styles.to}`} data-num>
                    {formatGbp(x.to)}
                    <small>{formatGbp(x.now - x.to)} off</small>
                  </span>
                  <span role="cell" className={styles.num} data-num>
                    {x.keepNew != null ? formatGbp(x.keepNew) : '--'}
                    <small>{x.known ? `was ${formatGbp(x.keepNow)}` : 'no cost yet'}</small>
                  </span>
                </label>
              );
            })}
          </div>

          <div className={styles.foot}>
            <span className={styles.sum}>
              {working
                ? <>Matching {run.done} of {run.total}. Keep this page open.</>
                : <><b data-num>{chosen.length}</b> of {items.length} chosen, <b data-num>{formatGbp(off)}</b> off in all.{losing > 0 && ` ${losing} that would lose money ${losing === 1 ? 'is' : 'are'} left unticked.`}</>}
            </span>
            {!working && <button type="button" className={styles.ghost} onClick={onClose}>Cancel</button>}
            <button type="button" className={styles.primary} disabled={working || chosen.length === 0} onClick={go}>
              {working ? 'Matching' : `Match ${chosen.length} to eBay`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function MatchBanner({ found, onOpen }) {
  const count = found?.items?.length ?? 0;
  const over = useMemo(() => r2((found?.items ?? []).reduce((n, x) => n + (x.now - x.to), 0)), [found]);
  if (!count) return null;
  return (
    <div className={styles.banner} role="note">
      <svg viewBox="0 0 16 16" className={styles.bannerIcon} aria-hidden="true"><path d="M3 6h10M3 10h10" /></svg>
      <p className={styles.bannerText}>
        <b data-num>{count}</b> shop {count === 1 ? 'price is' : 'prices are'} above your own eBay listing, <b data-num>{formatGbp(over)}</b> over in all.
        Your shop pays no eBay fee, so it should never ask more.
      </p>
      <button type="button" className={styles.primary} onClick={onOpen}>Match to eBay</button>
    </div>
  );
}
