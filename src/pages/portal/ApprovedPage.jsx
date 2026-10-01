import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@components/ui/portal/EmptyState';
import { ImageLightbox } from '@components/ui/portal/ImageLightbox';
import { SourceList } from '@components/ui/portal/SourceList';
import { PageSkeleton } from '@components/ui/portal/Skeleton';
import { Card, CardHead } from '@components/ui/portal/primitives';
import { PriceSetter } from '@components/ui/portal/PriceSetter';
import { TillRoll } from '@components/ui/portal/TillRoll';
import { CostTry } from '@components/ui/portal/CostTry';
import { BriefStrip, ComparePanel } from '@components/ui/portal/CandidateBrief';
import { ShelfLabel, confirmSource } from '@components/ui/portal/CandidateRow';
import { assess, shopName } from '@lib/assess';
import { STATE_WORD, goLive, ownMarket, parcelFor, parcelOf, viewsOf } from '@lib/golive';
import { freshChecks, isHers, noShopPhotos, pageOf, photosToAdd, sourceOf } from '@lib/photos';
import { PRODUCT_FIELDS, sameListing } from '@lib/product';
import { bookmarkletFor, likelyCard, readSent } from '@lib/sendToCart';
import { KeeprSuggestion } from '@components/ui/portal/MarketListings';
import { ListingComposer } from '@components/ui/portal/ListingComposer';
import { BulkBar, ListSheet } from '@components/ui/portal/BulkListing';
import { ebayRequest, eligibility, fromEbayCheck, jobOpen, readyFor, shopProduct, startQuantity } from '@lib/bulk';
import { SearchTile } from '@components/ui/portal/SearchTile';
import { Icon } from '@components/ui/icons';
import { useApproved } from '@hooks/useApproved';
import { useDraft } from '@hooks/useDraft';
import { useSuppliers } from '@hooks/useSuppliers';
import { loadTenant } from '@lib/tenant';
import { formatGbp } from '@utils/formatGbp';
import { breadcrumb } from '@utils/category';
import { portalPath } from '@utils/constants';

// Her eBay selling limit, 30 September 2026: items a month, no money limit. The eBay function enforces it.
const EBAY_MONTHLY_LIMIT = 300;
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

// Somewhere she is typing, where Escape belongs to the field. A tick box is not.
const typing = (el) => Boolean(el?.closest?.('textarea, select, [contenteditable="true"]'))
  || (el?.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(el.type));

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

  const {
    status, rows, month, jobs, addSource, list, addToShop, queue, cancel, retry, noteDraft, noteListing, saveAspects, patchDraft, checkPhotos, compose, marketCheck, matchListing,
  } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const [find, setFind] = useState('');
  const [only, setOnly] = useState(null);
  const [listed, setListed] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const anchor = useRef(null);
  // The cards eBay is checking before they are queued; the cards it held back, to look at next.
  const [sheetFor, setSheetFor] = useState(null);
  const [held, setHeld] = useState(null);
  /*
   * A supplier page sent from her browser by the Send to Cart & Keep button: read off the address once, then she
   * picks the card it is for. Its details go in the card's supplier box; its photos go through the photo check.
   */
  const [sent, setSent] = useState(() => readSent(typeof window === 'undefined' ? '' : window.location.hash));
  const [sentFor, setSentFor] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    if (sent && window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [sent]);
  useEffect(() => {
    if (sent && !sentFor && rows.length) setSentFor(likelyCard(sent, rows) ?? '');
  }, [sent, sentFor, rows]);
  async function applySent() {
    const row = rows.find((r) => r.id === sentFor);
    if (!row) return;
    setSending(true);
    try {
      await patchDraft(row.id, { supplier_text: sent.text, supplier_url: sent.url });
      let added = 0;
      let passed = 0;
      if ((sent.images ?? []).length) {
        const pc = await checkPhotos(row.id, { supplied: sent });
        const mine = (pc.others ?? []).find((o) => o.url === sent.url);
        passed = (mine?.images ?? []).filter((i) => i.ok).length;
        const add = photosToAdd({ ...row, photo_checks: pc }, { ...(row.draft ?? {}), supplier_text: sent.text });
        if (add?.images) { await patchDraft(row.id, add); added = add.images.length; }
      }
      setNotice({
        title: `Sent from ${sent.shop || "your supplier's page"}`,
        body: `${row.draft?.title || row.title}: the product details are in, and ${sent.images?.length ? `${passed} of ${sent.images.length} photos passed the check${added ? `, ${added} added` : ''}` : 'no photos came with it'}. Get it ready writes from them.`,
        tone: 'positive',
        actionLabel: 'Show the card',
        onAction: () => { setHeld({ ids: new Set([row.id]), label: 'Just sent' }); setOnly('held'); setNotice(null); },
      });
      setSent(null);
    } catch (e) {
      setNotice({ title: 'Not added', body: e.message, tone: 'warning' });
    } finally {
      setSending(false);
    }
  }

  // Cards she has opened, or that are being written, stay in the list she is on until she changes it: an edit that
  // takes a card out of Ready should not make it vanish under her.
  const [stay, setStay] = useState(() => new Set());
  useEffect(() => { setStay(new Set()); }, [only]);
  // A bulk action running from the bar: adding to the shop, or finding photos. One at a time.
  const [busy, setBusy] = useState(null);
  const stopBusy = useRef(false);

  useEffect(() => {
    if (!listed && !notice) return undefined;
    const t = setTimeout(() => { setListed(null); setNotice(null); }, 12000);
    return () => clearTimeout(t);
  }, [listed, notice]);

  // Each card read once, with where it stands on each channel, from her saved draft.
  const assessed = useMemo(() => rows.map((r) => {
    const a = assess(r);
    return { row: r, a, gl: goLive(viewsOf(a), r, r.draft ?? {}) };
  }), [rows]);

  // Where the eBay queue has each card: waiting, publishing, or refused with eBay's words.
  const jobOf = useCallback((id) => jobs[id] ?? null, [jobs]);
  const refused = ({ row, gl }) => jobOf(row.id)?.state === 'failed' && gl.state.ebay === 'todo';

  const counts = useMemo(() => ({
    ready: assessed.filter(({ gl }) => gl.ready).length,
    check: assessed.filter(({ gl }) => !gl.ready).length,
    // Of the Ready ones, which channel each is ready for, for the tab's own count.
    readyShopAll: assessed.filter(({ gl }) => gl.readyOn.includes('shop')).length,
    readyEbayAll: assessed.filter(({ gl }) => gl.readyOn.includes('ebay')).length,
    half: assessed.filter(({ gl }) => gl.started.length > 0).length,
    edited: assessed.filter(({ a }) => a.edited).length,
    queued: assessed.filter(({ row }) => jobOpen(jobOf(row.id))).length,
    refused: assessed.filter((x) => refused(x)).length,
    readyEbay: assessed.filter(({ row, gl }) => readyFor(gl, 'ebay') && !jobOpen(jobOf(row.id))).length,
    readyShop: assessed.filter(({ row, gl, a }) => readyFor(gl, 'shop') && a.goods != null && !jobOpen(jobOf(row.id))).length,
  }), [assessed, jobOf]);

  // What the ticked cards can do on each channel, and why the rest cannot.
  const picked = useMemo(() => assessed.filter(({ row }) => selected.has(row.id)), [assessed, selected]);
  const split = useCallback((channel) => {
    const out = { in: [], out: [] };
    for (const x of picked) {
      const e = eligibility(x, channel, jobOf(x.row.id));
      if (e.ok) out.in.push(x); else out.out.push({ id: x.row.id, why: e.why });
    }
    return out;
  }, [picked, jobOf]);
  const forEbay = useMemo(() => split('ebay'), [split]);
  const forShop = useMemo(() => split('shop'), [split]);
  // Ticked cards missing something Get it ready can write or find: a title, the description, or photos.
  const photosFindable = (gl) => gl.left.some((c) => { const p = gl.checks[c]?.find((x) => x.key === 'photos'); return p && !p.ok && p.find; });
  const detailsOpen = (gl) => Boolean(gl.checks.ebay?.find((x) => x.key === 'details' && !x.ok));
  const needReady = useMemo(() => picked.filter(({ row, gl }) => !jobOpen(jobOf(row.id)) && !row.duplicate_of && (
    !(row.draft?.title ?? '').trim() || !(row.draft?.description ?? '').trim() || photosFindable(gl) || detailsOpen(gl)
  )), [picked, jobOf]);
  const waiting = Object.values(jobs).filter((j) => j.state === 'queued').length;
  const publishing = Object.values(jobs).filter((j) => j.state === 'working').length;

  // A card that went live, or left the page, is no longer selected.
  useEffect(() => {
    setSelected((cur) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...cur].filter((id) => ids.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [rows]);

  useEffect(() => {
    if (!selected.size || sheetFor) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy && !typing(e.target)) setSelected(new Set()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.size, sheetFor, busy]);

  // One by one, so each lands as her own draft, and she can stop part way.
  async function addAllToShop() {
    const items = forShop.in;
    stopBusy.current = false;
    setBusy({ kind: 'shop', done: 0, total: items.length });
    const failed = [];
    let done = 0;
    for (const { row, a } of items) {
      if (stopBusy.current) break;
      try {
        await addToShop({ candidateId: row.id, product: shopProduct(row, a, row.draft ?? {}) });
      } catch (e) {
        failed.push(`${row.draft?.title || a.title}: ${e.message}`);
      }
      done += 1;
      setBusy({ kind: 'shop', done, total: items.length });
    }
    setBusy(null);
    setSelected(new Set());
    const added = done - failed.length;
    setNotice({
      title: added ? `${added} added to your shop as ${added === 1 ? 'a draft' : 'drafts'}` : 'Nothing added to your shop',
      body: failed.length ? `${failed.length} did not save. ${failed[0]}` : 'Returns and label warnings are being checked. Anything for you to confirm waits in Products.',
      to: added ? portalPath('/products') : null,
      toLabel: 'Products',
      tone: failed.length ? 'warning' : 'positive',
    });
  }


  /*
   * Get it ready for every ticked card that needs it, three at a time: a title (the first suggestion), the
   * description, and photos, only where the card has none. What the sources disagree about, or a card with no
   * usable photos, is left for her, and the cards are listed after.
   */
  /*
   * Everything one card needs written or found: a title, the description, photos, then eBay's category and item
   * details. Only what is missing, never over what she has. Page level, so it finishes even when the card leaves
   * the list it was in (a move to another product clears it out of Ready).
   */
  async function readyOne({ row, gl, a }) {
    const d = row.draft ?? {};
    const why = (r) => (r.reason instanceof Error ? r.reason.message : String(r.reason ?? 'did not finish'));
    const want = { title: !(d.title ?? '').trim(), words: !(d.description ?? '').trim(), photos: photosFindable(gl) };
    const [t, w, ph] = await Promise.allSettled([
      want.title ? compose(row.id, 'title') : null,
      want.words ? compose(row.id, 'description') : null,
      want.photos ? (freshChecks(row, d) ?? checkPhotos(row.id)) : null,
    ]);
    const patch = {};
    const done = [];
    const short = [];
    if (want.title) {
      if (t.status === 'fulfilled' && t.value?.titles?.[0]) { patch.title = t.value.titles[0]; done.push('a title'); }
      else short.push(t.status === 'fulfilled' && t.value?.conflict ? `the sources disagree: ${t.value.conflict}` : `no title: ${t.status === 'rejected' ? why(t) : 'none came back'}`);
    }
    if (want.words) {
      if (w.status === 'fulfilled' && w.value?.description) { patch.description = w.value.description; done.push('the description'); }
      else short.push(w.status === 'fulfilled' && w.value?.conflict ? `the sources disagree: ${w.value.conflict}` : `no description: ${w.status === 'rejected' ? why(w) : 'none came back'}`);
    }
    if (want.photos) {
      const seen = ph.status === 'fulfilled' && ph.value ? { ...row, photo_checks: ph.value } : null;
      const add = seen ? photosToAdd(seen, d) : null;
      if (add) {
        Object.assign(patch, add);
        if (add.images) done.push(`${add.images.length} ${add.images.length === 1 ? 'photo' : 'photos'}`);
        if (add.catalogue) done.push('eBay\'s catalogue');
      } else short.push(seen ? (noShopPhotos(seen, d) ?? 'no photos to add, add your own') : `photos: ${why(ph)}`);
    }
    // eBay's category and the item details, once the title and words are in, for a card eBay is still to list.
    if (gl.left.includes('ebay') && (detailsOpen(gl) || patch.title)) {
      try {
        const next = { ...d, ...patch };
        const dry = await list({ candidateId: row.id, ...ebayRequest(a, next, { quantity: startQuantity(row) }), dry: true, fill: true });
        const found = fromEbayCheck(dry, next);
        if (found) {
          Object.assign(patch, found);
          done.push(`the eBay category (${found.ebay_category.name ?? found.ebay_category.id})`);
          const have = new Set(Object.entries(found.aspects).filter(([, v]) => v).map(([k]) => k.toLowerCase()));
          const still = found.ebay_category.required.filter((n) => !have.has(n.toLowerCase()));
          if (still.length) short.push(`eBay needs ${still.join(', ')}`);
        }
      } catch (e) {
        short.push(`eBay's check: ${e.message}`);
      }
    }
    try {
      if (Object.keys(patch).length) await patchDraft(row.id, patch);
    } catch (e) {
      short.push(`not saved: ${e.message}`);
    }
    return { patch, done, short };
  }

  async function readyAll() {
    const items = needReady;
    stopBusy.current = false;
    setBusy({ kind: 'ready', done: 0, total: items.length });
    const needYou = new Map();
    let full = 0;
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (!stopBusy.current && next < items.length) {
        const { short } = await readyOne(items[next++]);
        const { row } = items[next - 1];
        if (short.length) needYou.set(row.id, short); else full += 1;
        done += 1;
        setBusy({ kind: 'ready', done, total: items.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
    setBusy(null);
    setSelected(new Set());
    const ids = [...needYou.keys()];
    setNotice({
      title: `${full} of ${done} ready to check`,
      body: ids.length
        ? `${ids.length} still ${ids.length === 1 ? 'needs' : 'need'} you. ${[...new Set([...needYou.values()].map((x) => x[0]))].slice(0, 2).map((x) => `${x.charAt(0).toUpperCase()}${x.slice(1)}.`).join(' ')}`
        : 'Titles, descriptions and photos are in. Read them over, then list.',
      tone: ids.length ? 'warning' : 'positive',
      ...(ids.length ? { actionLabel: `Show the ${ids.length}`, onAction: () => { setHeld({ ids: new Set(ids), label: 'Need you' }); setOnly('held'); setNotice(null); } } : {}),
    });
  }

  /*
   * A card moved to another product's eBay listing is written again for it. The draft is passed in as saved, so the
   * work reads the card as it now is, not as the list last drew it. What it did lands on the card and in a notice.
   */
  const [rebuilding, setRebuilding] = useState(() => new Set());
  const [rebuilt, setRebuilt] = useState({});
  async function rebuild(row, draft, lead) {
    const r = { ...row, draft };
    const a = assess(r);
    const item = { row: r, a, gl: goLive(viewsOf(a), r, draft) };
    setRebuilding((x) => new Set(x).add(row.id));
    setStay((x) => new Set(x).add(row.id));
    try {
      const out = await readyOne(item);
      const note = { lead, done: out.done, short: out.short.map((x) => `${x.charAt(0).toUpperCase()}${x.slice(1)}.`), at: Date.now() };
      setRebuilt((m) => ({ ...m, [row.id]: note }));
      setNotice({
        title: out.short.length ? 'Written for the new product, with gaps' : 'Written for the new product',
        body: `${out.patch.title ?? draft.entry?.title ?? row.title}. ${out.short.length ? note.short[0] : 'Read it over before it goes live.'}`,
        tone: out.short.length ? 'warning' : 'positive',
      });
    } finally {
      setRebuilding((x) => { const n = new Set(x); n.delete(row.id); return n; });
    }
  }

  async function queueAll(items) {
    await queue(items);
    setSheetFor(null);
    setSelected(new Set());
    setNotice({
      title: `${items.length} queued for eBay`,
      body: 'They go up at your daily pace, strongest first. Each leaves this page as it goes live.',
      tone: 'positive',
    });
  }

  const select = useCallback((id, range, ids) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (range && anchor.current && ids.includes(anchor.current)) {
        const [from, to] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((p, q) => p - q);
        ids.slice(from, to + 1).forEach((x) => next.add(x));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = id;
  }, []);

  // After goods, at the proving seller's own price and rate. monthly_headroom is
  // before goods, which is how this header overstated what a month keeps.
  const monthly = assessed.reduce((s, { a }) => s + (a.month ?? 0), 0);

  if (tenant === undefined || status === 'loading') return <PageSkeleton rows={4} />;

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Approved"
        title="Nothing waiting to go live"
        icon="IconCheck"
        body="What you have approved, kept here until it is live on every channel it is meant for."
        columns={COLUMNS}
        rows={ROWS}
        note="Approving a candidate brings it here with the price a small seller is being paid and the most the goods can cost, so nothing is worked out twice. Anything you approve on Candidates lands here."
        action={{ to: portalPath('/candidates'), label: 'Go to candidates' }}
      />
    );
  }

  const match = (x) => {
    const { gl, a, row } = x;
    switch (only) {
      case null: return true;
      case 'ready': return gl.ready;
      case 'check': return !gl.ready;
      case 'half': return gl.started.length > 0;
      case 'edited': return a.edited;
      case 'queued': return jobOpen(jobOf(row.id));
      case 'refused': return refused(x);
      case 'held': return held?.ids.has(row.id);
      default: return true;
    }
  };
  const shown = assessed
    .filter((x) => match(x) || stay.has(x.row.id))
    .filter(({ a, row }) => !find.trim() || `${row.draft?.title ?? ''} ${a.title}`.toLowerCase().includes(find.trim().toLowerCase()));
  const shownIds = shown.map(({ row }) => row.id);
  const allShown = shown.length > 0 && shown.every(({ row }) => selected.has(row.id));
  const selectWhere = (test) => setSelected(new Set(assessed.filter(test).map(({ row }) => row.id)));

  return (
    <div className={styles.page} data-bulk={selected.size > 0 || undefined}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <p className="micro">Approved</p>
          <h1 className={styles.title}>Going live</h1>
        </div>

        <div className={styles.headSide}>
          {month != null && (
            <div className={styles.limit} data-tone={month >= EBAY_MONTHLY_LIMIT ? 'negative' : month >= EBAY_MONTHLY_LIMIT * 0.8 ? 'warning' : undefined}
              title="eBay lets this account list 300 items a month. The count starts again on the 1st.">
              <span className={styles.limitBar} aria-hidden="true"><i style={{ width: `${Math.min(100, (month / EBAY_MONTHLY_LIMIT) * 100)}%` }} /></span>
              <span className={styles.limitText}><b data-num>{month}</b> of <span data-num>{EBAY_MONTHLY_LIMIT}</span> listed on eBay this month</span>
            </div>
          )}
        {monthly > 0 && (
          <div className={styles.worth}>
            <span className={styles.worthLabel}>At proven rates</span>
            <span className={`figure ${styles.worthValue}`}>{formatGbp(monthly)}</span>
            <span className={styles.worthFoot}>a month, where a seller is converting</span>
          </div>
        )}
        </div>
      </header>

      {sent && (
        <section className={styles.sent} aria-label="Sent from your browser">
          {sent.images?.[0] && <img className={styles.sentShot} src={sent.images[0]} alt="" />}
          <div className={styles.sentText}>
            <p className={styles.sentHead}>From {sent.shop || "your supplier's page"}: {sent.title}</p>
            <p className={styles.sentMeta}>
              {[sent.bullets?.length && `${sent.bullets.length} bullet points`, sent.details?.length && `${sent.details.length} product details`, sent.images?.length && `${sent.images.length} photos`].filter(Boolean).join(', ') || 'Only the title came through'}
            </p>
            <label className={styles.sentPick}>
              <span>Add it to</span>
              <select value={sentFor} onChange={(e) => setSentFor(e.target.value)}>
                <option value="">Choose the card</option>
                {rows.map((r) => <option key={r.id} value={r.id}>{(r.draft?.title || r.draft?.entry?.title || r.title).slice(0, 90)}</option>)}
              </select>
            </label>
          </div>
          <span className={styles.sentActions}>
            <button type="button" className={styles.primary} disabled={!sentFor || sending} onClick={applySent}>
              {sending ? 'Checking the photos' : 'Add to this card'}
            </button>
            <button type="button" className={styles.revert} disabled={sending} onClick={() => setSent(null)}>Not now</button>
          </span>
        </section>
      )}

      {/* The state of the queue, and the way into it. At four rows it is a
          summary; at a hundred it is the only way to find anything. */}
      <div className={styles.states} role="tablist" aria-label="Filter">
        <StateTab id={null} only={only} setOnly={setOnly} icon="IconLayers"
          label="All" count={rows.length} />
        <StateTab id="ready" only={only} setOnly={setOnly} icon="IconCheck"
          label="Ready to go live" count={counts.ready} tone="positive"
          detail={counts.ready > 0 && counts.readyShopAll !== counts.readyEbayAll ? `Shop ${counts.readyShopAll} · eBay ${counts.readyEbayAll}` : null} />
        <StateTab id="check" only={only} setOnly={setOnly} icon="IconInfo"
          label="Needs a look" count={counts.check} tone="warning" />
        {counts.half > 0 && (
          <StateTab id="half" only={only} setOnly={setOnly} icon="IconShop"
            label="One channel left" count={counts.half} />
        )}
        {counts.edited > 0 && (
          <StateTab id="edited" only={only} setOnly={setOnly} icon="IconNote"
            label="Edited" count={counts.edited} />
        )}
        {counts.queued > 0 && (
          <StateTab id="queued" only={only} setOnly={setOnly} icon="IconClock"
            label="In the eBay queue" count={counts.queued} />
        )}
        {counts.refused > 0 && (
          <StateTab id="refused" only={only} setOnly={setOnly} icon="IconFlag"
            label="Refused by eBay" count={counts.refused} tone="negative" />
        )}
        {held?.ids.size > 0 && (
          <StateTab id="held" only={only} setOnly={setOnly} icon="IconInfo"
            label={held.label} count={assessed.filter(({ row }) => held.ids.has(row.id)).length} tone="warning" />
        )}

        <span className={styles.findWrap}>
          <Icon name="IconSearch" className={styles.findIcon} />
          <input className={styles.find} value={find} placeholder="Find"
            onChange={(e) => setFind(e.target.value)} aria-label="Find a product" />
        </span>
      </div>

      <div className={styles.list}>
        <div className={styles.picker}>
          <label className={styles.pickAll}>
            <input type="checkbox" checked={allShown}
              ref={(el) => { if (el) el.indeterminate = !allShown && shown.some(({ row }) => selected.has(row.id)); }}
              onChange={() => setSelected((cur) => {
                const next = new Set(cur);
                shownIds.forEach((id) => (allShown ? next.delete(id) : next.add(id)));
                return next;
              })} />
            <span>{allShown ? 'Clear these' : `Select ${only || find.trim() ? 'these' : 'all'}`} <span className={styles.pickCount} data-num>{shown.length}</span></span>
          </label>
          {counts.readyEbay > 0 && (
            <button type="button" className={styles.pickQuick}
              onClick={() => selectWhere(({ row, gl }) => readyFor(gl, 'ebay') && !jobOpen(jobOf(row.id)))}>
              <Icon name="IconTag" className={styles.pickIcon} />Ready for eBay <span data-num>{counts.readyEbay}</span>
            </button>
          )}
          {counts.readyShop > 0 && (
            <button type="button" className={styles.pickQuick}
              onClick={() => selectWhere(({ row, gl, a }) => readyFor(gl, 'shop') && a.goods != null && !jobOpen(jobOf(row.id)))}>
              <Icon name="IconShop" className={styles.pickIcon} />Ready for your shop <span data-num>{counts.readyShop}</span>
            </button>
          )}
          {(waiting > 0 || publishing > 0) && (
            <span className={styles.queueNote} role="status">
              <i aria-hidden="true" />
              <span>eBay queue: {waiting > 0 && <><b data-num>{waiting}</b> waiting</>}{waiting > 0 && publishing > 0 && ', '}{publishing > 0 && <><b data-num>{publishing}</b> publishing</>}. It carries on with the portal closed.</span>
            </span>
          )}
        </div>

        {shown.map(({ row, a, gl }) => (
          <Pack
            key={row.id}
            row={row}
            base={a}
            baseGl={gl}
            job={jobOf(row.id)}
            selected={selected.has(row.id)}
            onSelect={(range) => select(row.id, range, shownIds)}
            onCancelJob={cancel}
            onRetryJob={retry}
            onSaved={(d) => noteDraft(row.id, d)}
            onRead={(l) => noteListing(row.id, l)}
            tenantId={tenant.id}
            fees={tenant.fees}
            suppliers={suppliers}
            onList={async (opts) => {
              const out = await list({ candidateId: row.id, ...opts });
              if (!opts.dry && out?.listing_id) setListed({ ...out, title: opts.title ?? row.title });
              return out;
            }}
            onShop={(product) => addToShop({ candidateId: row.id, product })}
            onCheckPhotos={(opts) => checkPhotos(row.id, opts)}
            onMarket={() => marketCheck(row.id)}
            onMatch={(itemId) => matchListing(row.id, itemId)}
            onRebuild={(draft, lead) => rebuild(row, draft, lead)}
            rebuilding={rebuilding.has(row.id)}
            rebuilt={rebuilt[row.id] ?? null}
            onStay={() => setStay((x) => (x.has(row.id) ? x : new Set(x).add(row.id)))}
            onShowIds={(ids, label) => { setHeld({ ids: new Set(ids), label }); setOnly('held'); }}
            onSource={async (fields) => {
              await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}

        {shown.length === 0 && <p className={styles.quiet}>Nothing here.</p>}
      </div>

      {selected.size > 0 && !sheetFor && (
        <BulkBar count={selected.size} ebay={forEbay} shop={forShop} ready={needReady} busy={busy}
          onReady={readyAll}
          onEbay={() => setSheetFor(forEbay.in)}
          onShop={addAllToShop}
          onStop={() => { stopBusy.current = true; }}
          onClear={() => setSelected(new Set())} />
      )}

      {sheetFor && (
        <ListSheet items={sheetFor} ahead={waiting + publishing}
          check={(candidateId, request) => list({ candidateId, ...request, dry: true })}
          onAspects={saveAspects}
          onQueue={queueAll}
          onHeld={(ids) => { setHeld({ ids: new Set(ids), label: 'Held back' }); setOnly('held'); setSheetFor(null); }}
          onClose={() => setSheetFor(null)} />
      )}

      {notice && !listed && selected.size === 0 && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastIcon} data-tone={notice.tone}><Icon name={notice.tone === 'warning' ? 'IconInfo' : 'IconCheck'} className={styles.btnIcon} /></span>
          <div className={styles.toastText}>
            <strong>{notice.title}</strong>
            <span className={styles.toastBody}>{notice.body}</span>
          </div>
          {notice.to && <a className={styles.toastLink} href={notice.to}>{notice.toLabel}</a>}
          {notice.onAction && <button type="button" className={styles.toastLink} onClick={notice.onAction}>{notice.actionLabel}</button>}
          <button type="button" className={styles.toastClose} aria-label="Dismiss" onClick={() => setNotice(null)}>
            <Icon name="IconX" className={styles.toastOut} />
          </button>
        </div>
      )}

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

function StateTab({ id, only, setOnly, icon, label, count, tone, detail = null }) {
  const on = only === id;
  return (
    <button type="button" role="tab" aria-selected={on}
      className={`${styles.state} ${on ? styles.stateOn : ''} ${tone ? styles[tone] : ''}`}
      onClick={() => setOnly(on ? null : id)}>
      <Icon name={icon} className={styles.stateIcon} />
      <span>{label}</span>
      <span className={styles.stateCount} data-num>{count}</span>
      {detail && <span className={styles.stateDetail} data-num>{detail}</span>}
    </button>
  );
}

const CHANNEL = { ebay: { label: 'eBay', icon: 'IconTag' }, shop: { label: 'Your shop', icon: 'IconShop' } };

// One mark per channel the card is meant for, saying where it stands: to do, queued, working, live, draft or on
// sale. `queued` is a card waiting its turn in the eBay queue.
function ChannelStates({ gl, working, queued }) {
  return (
    <span className={styles.channels}>
      {gl.wants.map((c) => {
        const st = working === c ? 'working' : c === 'ebay' && queued && gl.state.ebay === 'todo' ? 'queued' : gl.state[c];
        const word = st === 'working' ? (c === 'ebay' ? 'Publishing' : 'Adding') : st === 'queued' ? 'Queued' : STATE_WORD[c][st];
        return (
          <span key={c} className={styles.channel} data-state={st} data-channel={c} title={`${c === 'ebay' ? 'eBay' : 'Your shop'}: ${word}`}>
            <span className={styles.channelTag}>{c === 'ebay' ? 'eBay' : 'Shop'}</span>
            <span className={styles.channelState}><i aria-hidden="true" /><b>{word}</b></span>
          </span>
        );
      })}
    </span>
  );
}

// The fix words, joined as she would say them: "add photos, write the description and set the parcel".
const joinFixes = (xs) => {
  const words = [...new Set(xs.map((x) => x.fix).filter(Boolean))].map((w) => w.charAt(0).toLowerCase() + w.slice(1));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0] ?? '';
};

function Pack({
  row, base, baseGl, job, selected, onSelect, onCancelJob, onRetryJob, onSaved, onRead,
  tenantId, fees, suppliers, onSource, onList, onShop, onCheckPhotos, onShowIds, onMarket, onMatch,
  onRebuild, rebuilding = false, rebuilt = null, onStay,
}) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [shopping, setShopping] = useState(false);
  const [writing, setWriting] = useState(false);
  const [cheaper, setCheaper] = useState(false);
  const [finding, setFinding] = useState(false);
  // Get it ready: running, and what it did and could not do, said once it finishes.
  const [readying, setReadying] = useState(false);
  const [readyNote, setReadyNote] = useState(null);
  // A category she picked over the card's, once eBay's suggestion disagreed with it.
  const [categoryChoice, setCategoryChoice] = useState(null);
  const [trial, setTrial] = useState(null);
  const onTry = useCallback((cost, posted) => setTrial(cost == null ? null : { cost, posted }), []);
  const confirmRef = useRef(null);
  const cardRef = useRef(null);
  const [qty, setQty] = useState(() => startQuantity(row));
  const [jobBusy, setJobBusy] = useState(false);

  const { draft, change, flush, revert, generate, upload, saving, edited } = useDraft(row, tenantId, { onSaved, onRead });

  // Live while editing, from the same function the closed line uses. A cost she is trying holds her price and moves
  // what she keeps.
  const whole = useMemo(() => assess({ ...row, draft }, trial ? { tryCost: trial.cost, tryPosted: trial.posted, holdPrice: true } : {}),
    [row, draft, trial]);
  // A store card the gate also passed is listed in two places, each at its own price.
  const both = Boolean(whole.store && whole.ebay);
  const [view, setView] = useState('store');
  const a = both && view === 'ebay' ? whole.ebay : whole;
  const setPrice = (v) => change(both && view === 'ebay' ? { ebay_price: v } : { price: v });
  // Moved to another product, its listing's photo stands in on the row until she has her own: shown here only.
  const hero = (draft.images ?? [])[0] ?? whole.moved?.image_url ?? row.image_url;
  // The closed row reads the saved draft; the open card reads the one she is typing.
  const gl = useMemo(() => (open ? goLive(viewsOf(whole), row, draft) : baseGl), [open, whole, row, draft, baseGl]);
  const status = gl.ready ? 'ready' : 'check';
  // In the eBay queue counts as working on eBay: one channel at a time, whichever way it was sent.
  const queued = jobOpen(job);
  const working = busy || job?.state === 'working' ? 'ebay' : shopping ? 'shop' : null;
  const refusedJob = job?.state === 'failed' && gl.state.ebay === 'todo' ? job : null;

  const inShop = (row.store_products ?? [])[0] ?? null;
  // Always the shop's own figures, whichever view is open: a store card already keeps them, an eBay card is re-costed here.
  const shopKeep = whole.store ? whole.keep : storeKeep(whole.price, fees, whole.goods, whole.postage);
  const eView = viewsOf(whole).ebay;

  useEffect(() => {
    if (confirm) confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [confirm]);

  const goTo = (part) => {
    if (part === 'buy') setCheaper(true);
    requestAnimationFrame(() => cardRef.current?.querySelector(`[data-part="${part}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  async function sendToShop() {
    setShopping(true);
    setProblem(null);
    try {
      await onShop(shopProduct(row, whole, draft));
    } catch (e) {
      setProblem(e.message);
    } finally {
      setShopping(false);
    }
  }

  // What goes to eBay, from her draft: the same fields for the check and for Publish.
  const listing = (extra = {}) => ({ ...ebayRequest(whole, draft, { quantity: qty, categoryId: categoryChoice }), ...extra });

  // A queued card taken back, or a refused one sent again with her fixes and the category she chose before.
  async function jobAct(fn) {
    setJobBusy(true);
    setProblem(null);
    try { await fn(); } catch (e) { setProblem(e.message); } finally { setJobBusy(false); }
  }
  const requeue = () => jobAct(() => onRetryJob(refusedJob, listing({
    ...(refusedJob.request?.category_id ? { category_id: refusedJob.request.category_id } : {}),
    ...(refusedJob.request?.quantity ? { quantity: refusedJob.request.quantity } : {}),
  })));

  // eBay checks the listing first: the category, the item details it needs, and anything that stops it.
  // Nothing goes up until Publish.
  async function review(extra = {}) {
    setBusy(true);
    setProblem(null);
    try {
      // Keepr fills what the category needs; the values go on her draft and eBay is asked once more with them.
      let dry = await onList(listing({ ...extra, dry: true, fill: true }));
      const found = fromEbayCheck(dry, draft);
      if (found) {
        change(found);
        if (Object.keys(dry.filled ?? {}).length && dry.missing?.length) {
          dry = await onList(listing({ ...extra, aspects: found.aspects, dry: true }));
        }
      }
      setConfirm(dry);
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  }

  // One press for what a listing needs that the card can write itself: a title, the description, photos (the
  // shop's once checked, and eBay's catalogue), and the eBay category with the item details it needs. Only what is
  // missing, never over what she has. It stops short on anything the sources disagree about, and says so.
  const missing = {
    title: !(draft.title ?? '').trim(),
    words: !(draft.description ?? '').trim(),
    photos: gl.left.some((c) => { const p = gl.checks[c]?.find((x) => x.key === 'photos'); return p && !p.ok && p.find; }),
    details: Boolean(gl.checks.ebay?.find((x) => x.key === 'details' && !x.ok)),
  };
  const canReady = missing.title || missing.words || missing.photos || missing.details;

  // eBay's check with Keepr filling the item details: the category it settles on and the values go on her draft.
  // `over` is the draft as it will be, so a title just written is the one eBay files by.
  async function ebayCheck(over = {}) {
    const next = { ...draft, ...over };
    const dry = await onList({ ...ebayRequest(whole, next, { quantity: qty, categoryId: categoryChoice }), dry: true, fill: true });
    return { dry, patch: fromEbayCheck(dry, next) };
  }
  const [checkingEbay, setCheckingEbay] = useState(false);
  async function checkWithEbay() {
    setCheckingEbay(true);
    setProblem(null);
    try {
      const { dry, patch } = await ebayCheck();
      if (patch) change(patch);
      if (dry.fill_error) setProblem(`Item details were not filled: ${dry.fill_error}`);
    } catch (e) {
      setProblem(e.message);
    } finally {
      setCheckingEbay(false);
    }
  }
  async function getReady(lead = null) {
    if (typeof lead !== 'string') lead = null;
    setReadying(true);
    setProblem(null);
    setReadyNote(lead ? { lead, done: [], short: [] } : null);
    const why = (r) => (r.reason instanceof Error ? r.reason.message : String(r.reason ?? 'did not finish'));
    const [t, d, ph] = await Promise.allSettled([
      missing.title ? generate('title') : null,
      missing.words ? generate('description') : null,
      missing.photos ? (freshChecks(row, draft) ?? onCheckPhotos()) : null,
    ]);
    const patch = {};
    const done = [];
    const short = [];
    if (missing.title) {
      if (t.status === 'fulfilled' && t.value?.[0]) { patch.title = t.value[0]; done.push('a title'); } else short.push(`Title: ${t.status === 'rejected' ? why(t) : 'no suggestion came back'}`);
    }
    if (missing.words) {
      if (d.status === 'fulfilled' && d.value) { patch.description = d.value; done.push('the description'); } else short.push(`Description: ${d.status === 'rejected' ? why(d) : 'nothing came back'}`);
    }
    if (missing.photos) {
      if (ph.status === 'fulfilled' && ph.value) {
        const seen = { ...row, photo_checks: ph.value };
        const add = photosToAdd(seen, draft);
        if (add) {
          Object.assign(patch, add);
          if (add.images) done.push(`${add.images.length} ${add.images.length === 1 ? 'photo' : 'photos'}`);
          if (add.catalogue) done.push('eBay\'s catalogue');
        } else short.push(`Photos: ${noShopPhotos(seen, draft) ?? 'none to add'}. Add your own.`);
      } else short.push(`Photos: ${why(ph)}`);
    }
    // Last, with the title and words in place: eBay's category and the item details, filled by Keepr.
    if (gl.left.includes('ebay') && (missing.details || patch.title)) {
      try {
        const { dry, patch: found } = await ebayCheck(patch);
        if (found) {
          Object.assign(patch, found);
          const have = new Set(Object.entries(found.aspects).filter(([, v]) => v).map(([k]) => k.toLowerCase()));
          const still = found.ebay_category.required.filter((n) => !have.has(n.toLowerCase()));
          done.push(`the eBay category (${found.ebay_category.name ?? found.ebay_category.id})`);
          if (Object.keys(dry.filled ?? {}).length) done.push(`${Object.keys(dry.filled).length} item ${Object.keys(dry.filled).length === 1 ? 'detail' : 'details'}`);
          if (still.length) short.push(`eBay still needs ${still.join(', ')}: the facts do not say, so choose it at the publish step.`);
        }
      } catch (e) {
        short.push(`eBay's check: ${e.message}`);
      }
    }
    if (Object.keys(patch).length) change(patch);
    setReadyNote({ lead, done, short });
    setReadying(false);
  }

  /*
   * The eBay listing the card prices from. She can choose any listing on the chart; Keepr can look for the one that
   * sells what she buys, and moves the card itself when it is 95% sure or more, else suggests it. When the listing
   * is another product, everything written or found for the old one goes (kept, for switching back) and the card
   * is written again for the new one. Her uploads stay hers, ready to add back.
   */
  const [using, setUsing] = useState(null);
  const [asking, setAsking] = useState(false);
  async function moveTo(found) {
    const other = Boolean(found.new_product);
    const patch = {
      entry: { ...found.entry, new_product: other, market: found.market ?? null, chosen_at: new Date().toISOString() },
      item_facts: found.facts ?? null,
      entry_suggestion: null,
    };
    if (other) {
      Object.assign(patch, {
        before: draft.before ?? Object.fromEntries(PRODUCT_FIELDS.map((k) => [k, draft[k] ?? null])),
        // Her photos too: they show the old product. They stay among her uploads, and come back on switching back.
        title: '', description: '', images: [],
        catalogue: null, ebay_category: null, aspects: {}, package: null, price: null, ebay_price: null, as_shelf: false, market: null,
      });
    }
    change(patch);
    // Saved before Keepr writes: the writing reads the card as saved.
    await flush();
    setCategoryChoice(null);
    setOwnMkt(null);
    setConfirm(null);
    return other ? { ...draft, ...patch } : null;
  }
  const pctOf = (sure) => (sure == null ? null : `${Math.round(sure * 100)}% sure`);
  async function afterMove(found, lead) {
    const moved = await moveTo(found);
    if (moved) {
      setReadyNote({ lead: 'Another product: writing the title, description and photos for it now.', done: [], short: [] });
      await onRebuild(moved, `${lead} It is another product, so the listing was written again for it.`);
    } else setReadyNote({ lead: `${lead} The same product, so your listing stays as it is.`, done: [], short: [] });
  }
  async function useListing(x) {
    setUsing(x.item_id);
    setProblem(null);
    try {
      const found = await onMatch(x.item_id);
      await afterMove(found, `Now pricing from ${found.entry.title}, ${formatGbp(found.entry.price)}.`);
    } catch (e) {
      setProblem(`That listing could not be read: ${e.message}`);
    } finally {
      setUsing(null);
    }
  }
  async function askKeepr({ quiet = false } = {}) {
    setAsking(true);
    if (!quiet) setProblem(null);
    try {
      const r = await onMatch(null);
      const best = r.best;
      const sure = best?.entry?.sure ?? 0;
      if (!best) {
        if (!quiet) setReadyNote({ done: [], short: [`Keepr looked at ${r.considered ?? 0} eBay listings and none sells ${r.product?.title ?? 'the product you buy'}.`] });
      } else if (r.already) {
        if (!quiet) setReadyNote({ lead: `Keepr agrees: the listing the card prices from is the product you buy, ${pctOf(sure)}.`, done: [], short: [] });
      } else if ((draft.entry_dismissed ?? []).some((id) => sameListing(id, best.entry.item_id))) {
        if (!quiet) setReadyNote({ done: [], short: [`Keepr's best match is ${best.entry.title}, which you turned down.`] });
      } else if (sure >= (r.auto ?? 0.95)) {
        await afterMove({ ...best, market: r.market }, `Keepr moved the card to ${best.entry.title}, ${pctOf(sure)}: ${best.entry.why ?? 'it matches what you buy'}`);
      } else {
        change({ entry_suggestion: { ...best, market: r.market ?? null, at: new Date().toISOString() } });
      }
    } catch (e) {
      setReadyNote({ done: [], short: [`Keepr could not check the eBay listings: ${e.message}`] });
    } finally {
      setAsking(false);
    }
  }
  function switchBack() {
    change({ ...(draft.before ?? {}), entry: null, item_facts: null, entry_suggestion: null, before: null });
    setCategoryChoice(null);
    setReadyNote({ lead: `Back to the research's listing${row.entry?.title ? `, ${row.entry.title}` : ''}.`, done: [], short: [] });
  }
  // What the page wrote after a move, shown on the card when it lands.
  useEffect(() => { if (rebuilt) setReadyNote(rebuilt); }, [rebuilt]);
  // Open is a card she is working on: it stays in the list she is on.
  useEffect(() => { if (open) onStay?.(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // The shelf product's own eBay market, for listing it as it is when it is not the product that proved the card.
  const [ownMkt, setOwnMkt] = useState(null);
  const [checkingMkt, setCheckingMkt] = useState(false);
  async function checkOwnMarket() {
    setCheckingMkt(true);
    setProblem(null);
    try {
      setOwnMkt((await onMarket()) ?? { n: 0, query: row.margin?.shelf?.product ?? a.title, listings: [] });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setCheckingMkt(false);
    }
  }
  // What she keeps on eBay at a price, from the same money model as everything else.
  const keepAt = (price) => viewsOf(assess({ ...row, draft: { ...draft, ...(both ? { ebay_price: price } : { price }) } })).ebay.keep ?? 0;
  function listAsShelf(price) {
    const { listings, ...m } = ownMkt;
    change({ as_shelf: true, market: { ...m, listings: listings.slice(0, 5) }, ...(both ? { ebay_price: price } : { price }) });
    setOwnMkt(null);
  }

  // Her supplier's page for the listing, or back to the card's own. What was written from the other product goes;
  // her own photos stay.
  const [pendingPage, setPendingPage] = useState(null);
  const [pasting, setPasting] = useState(false);
  function usePage(url) {
    change({
      page: url,
      title: '',
      description: '',
      images: (draft.images ?? []).filter((u) => isHers(u, draft)),
      catalogue: null,
      ebay_category: null,
      aspects: {},
    });
    setCategoryChoice(null);
    setPendingPage(null);
    setReadyNote({ done: [], short: [`The listing now comes from ${url ? host(url) : 'the card\'s own page'}. Get it ready writes it from there.`] });
    // Her supplier's product may not be the one the card prices from: Keepr checks, once the page is saved.
    if (url) flush().then(() => askKeepr({ quiet: true }));
  }

  // A supplier with a link: Keepr checks the card prices from the eBay listing for that product.
  async function addSupplier(fields) {
    await onSource(fields);
    if (/^https?:\/\//.test(fields?.url ?? '') && !draft.entry) askKeepr({ quiet: true });
  }

  // Keepr's photo check, then what passed into her draft, never over photos she already has: the shop's checked
  // photos, and eBay's catalogue entry for eBay. `again` looks afresh; otherwise an earlier check is used.
  async function findPhotos({ again = false, apply = true, wider = false } = {}) {
    setFinding(true);
    setProblem(null);
    try {
      const checks = !again && !wider && freshChecks(row, draft) ? freshChecks(row, draft) : await onCheckPhotos({ again, wider });
      if (!apply) return;
      const seen = { ...row, photo_checks: checks };
      const patch = photosToAdd(seen, draft);
      if (patch) change(patch);
      else if (!(draft.images ?? []).length) setProblem(noShopPhotos(seen, draft) ?? 'Nothing new to add. Add your own photos.');
    } catch (e) {
      setProblem(e.message);
    } finally {
      setFinding(false);
    }
  }

  // Write for eBay from the checklist, without scrolling to the description first.
  async function writeWords() {
    setWriting(true);
    setProblem(null);
    try {
      change({ description: await generate('description') });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setWriting(false);
    }
  }

  const parcel = parcelFor(eView);
  const firstBlock = (c) => gl.checks[c]?.find((x) => x.hard && !x.ok) ?? null;
  const lockNote = working === 'ebay' ? 'eBay is publishing. Your shop waits until it is done.'
    : queued ? 'In the eBay queue. Your shop waits until it is live, or until you take it out.'
      : working === 'shop' ? 'Adding to your shop. eBay waits until it is done.' : null;

  const ebayLeft = gl.left.includes('ebay');
  const shopLeft = gl.left.includes('shop');
  const shopFirst = shopLeft && !ebayLeft;
  const shopButton = shopLeft && !(both && view === 'ebay') ? (
    <button type="button" className={shopFirst ? styles.primary : styles.ghost}
      disabled={shopping || busy || queued || whole.goods == null || !gl.can.shop}
      title={busy || queued ? lockNote : !gl.can.shop ? `Before your shop: ${firstBlock('shop')?.text ?? 'a check fails'}` : undefined}
      onClick={sendToShop}>
      <Icon name="IconShop" className={styles.btnIcon} />
      {shopping ? 'Adding' : shopKeep != null ? `Add to your shop, keep ${formatGbp(shopKeep)}` : 'Add to your shop'}
    </button>
  ) : null;
  const ebayButton = ebayLeft && (!both || view === 'ebay') ? (
    <button type="button" className={styles.primary}
      disabled={busy || shopping || queued || eView.keep == null || eView.keep < 0 || !gl.can.ebay}
      title={shopping ? lockNote : !gl.can.ebay ? `Before eBay: ${firstBlock('ebay')?.text ?? 'a check fails'}` : undefined}
      onClick={() => review()}>
      <Icon name="IconTag" className={styles.btnIcon} />
      {busy ? 'Checking with eBay' : `List on eBay at ${formatGbp(eView.price)}`}
    </button>
  ) : null;

  // The sentence under the kicker: what is left, in the order it matters.
  const sentence = (() => {
    const done = gl.started.map((c) => (c === 'ebay' ? `live on eBay${row.ebay?.published_at ? ` since ${when(row.ebay.published_at)}` : ''}` : `on your shop as a ${gl.state.shop === 'onSale' ? 'product on sale' : 'draft'}`));
    const lead = done.length ? `${done.join(' and ').replace(/^./, (x) => x.toUpperCase())}. ` : '';
    if (gl.complete) return `${lead}Everything checks for ${gl.left.map((c) => (c === 'ebay' ? 'eBay' : 'your shop')).join(' and ')}.`;
    const parts = gl.left.map((c) => {
      const hard = gl.checks[c].filter((x) => x.hard && !x.ok);
      const soft = gl.checks[c].filter((x) => !x.hard && !x.ok);
      if (hard.length) return `Before ${c === 'ebay' ? 'eBay' : 'your shop'}: ${joinFixes(hard)}.`;
      if (soft.length) return `${c === 'ebay' ? 'eBay' : 'Your shop'} can go now, with ${soft.length === 1 ? 'one thing' : `${soft.length} things`} to weigh.`;
      return `${c === 'ebay' ? 'eBay' : 'Your shop'} is ready.`;
    });
    return `${lead}${parts.join(' ')}`;
  })();

  // Against the shelf product's own market once she chose to list it as it is, else the card's.
  const rowPos = ownMarket(a.price, draft) ?? a.position;
  // Moved to another product's listing, the shelf is the old product's: nothing to compare it with.
  const packOpen = !eView.store && !eView.moved && !(eView.costConfirmed && !eView.packCheck) && eView.m?.shelf && ebayLeft;
  const pack = packOpen ? confirmSource(row, eView) : null;
  const shelf = a.m?.shelf ?? null;
  const product = a.store ? a.m.cost_from?.product : a.costFrom?.basis === 'supplier' ? 'Your supplier' : shelf?.product;
  const labelState = a.costFrom?.basis === 'supplier' ? 'confirmed' : a.store ? 'page' : a.costConfirmed ? 'confirmed' : 'estimate';
  // The shops that stock the research's product, not the one the card moved to.
  const alts = whole.moved ? [] : [...new Set((a.shops ?? a.m.shops ?? []).map(shopName))]
    .filter((n) => n && n !== 'eBay' && n !== shopName(a.best?.supplier));
  const others = (row.sources ?? []).filter((src) => src.matched_on !== 'shelf');
  // The page the listing is written from, and her suppliers' pages she could write it from instead: the product
  // she will actually send, when it is not the one the card was costed from.
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const possessive = (n) => (/s$/i.test(n) ? `${n}'` : `${n}'s`);
  // Moved to another product, the card's own page is the old product's: there is no going back to it for words.
  const cardPage = whole.moved ? null : row.margin?.shelf?.url ?? row.margin?.cost_from?.url ?? null;
  const writtenFrom = pageOf(row, draft);
  const pageChoices = [...new Map(others.filter((src) => /^https?:\/\//.test(src.url ?? '') && src.url !== writtenFrom)
    .map((src) => [src.url, src])).values()].slice(0, 3);

  return (
    <article ref={cardRef} className={`${styles.pack} ${open ? styles.packOpen : ''}`} data-status={status}
      data-selected={selected || undefined} data-candidate={row.id}>
      {zoomed && <ImageLightbox src={hero} alt={a.title} onClose={() => setZoomed(false)} />}

      <div className={styles.top} role="button" tabIndex={0} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
        }}>
        <label className={styles.check} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={selected} readOnly
            onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSelect(e.shiftKey); } }}
            aria-label={`Select ${draft.title || base.title}`} />
        </label>

        {hero
          ? (
            <button type="button" className={styles.thumb} aria-label={`View ${base.title} larger`}
              onClick={(e) => { e.stopPropagation(); setZoomed(true); }}>
              <img src={(draft.images ?? [])[0] ? hero : thumb(hero)} alt="" loading="lazy" />
            </button>
          )
          : <span className={`${styles.thumb} ${styles.thumbEmpty}`} aria-hidden="true" />}

        <div className={styles.subject}>
          <h2 className={styles.name}>{draft.title || base.title}</h2>
          <p className={styles.evidence}>
            {base.store
              ? <><Icon name="IconCheck" className={styles.evIcon} />{base.g.rank != null ? <>Google best seller <b data-num>#{base.g.rank.toLocaleString('en-GB')}</b></> : 'Sells on Google'}{base.onEbay && ', and on eBay'}</>
              : base.entry?.proved
                ? <><Icon name="IconCheck" className={styles.evIcon} />Small seller converting at <b data-num>{formatGbp(base.entry.price)}</b></>
                : <><Icon name="IconInfo" className={styles.evIconWarn} />No small seller converting</>}
          </p>
          <span className={styles.flags}>
            <ChannelStates gl={gl} working={working} queued={queued} />
            {refusedJob ? (
              <span className={styles.flag} data-tone="block" title={`eBay: ${refusedJob.error ?? 'refused'}`}>
                <Icon name="IconFlag" className={styles.flagIcon} />eBay refused it: {refusedJob.error ?? 'no reason given'}
              </span>
            ) : !queued && gl.first && (
              <span className={styles.flag} data-tone={gl.first.hard ? 'block' : 'warning'} title={`${CHANNEL[gl.first.channel].label}: ${gl.first.text}`}>
                <Icon name="IconFlag" className={styles.flagIcon} />{gl.first.text}
                {gl.open.length > 1 && <span className={styles.flagMore}>+{gl.open.length - 1}</span>}
              </span>
            )}
            {edited && <span className={styles.editedTag}>Edited</span>}
          </span>
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>List at</span>
          <span className={styles.fig} data-num>{a.price != null ? formatGbp(a.price) : '--'}</span>
          {rowPos && (
            <span className={styles.status} data-tone={rowPos.inMarket ? 'positive' : 'warning'}>
              <i />{rowPos.inMarket ? 'In the market' : <><span data-num>{formatGbp(rowPos.over)}</span> over</>}
            </span>
          )}
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>You keep</span>
          <span className={`${styles.fig} ${styles.keepFig}`} data-tone={a.keep == null ? undefined : a.keep < 0 ? 'negative' : a.target != null && a.keep < a.target ? 'short' : a.costConfirmed ? 'positive' : 'estimate'} data-num>
            {a.keep != null ? formatGbp(a.keep) : '--'}
          </span>
          <span className={styles.sub}>{a.keep == null ? 'no cost yet' : a.keep < 0 ? 'loses money' : a.target != null && a.keep < a.target ? `under your ${formatGbp(a.target)}` : a.costConfirmed ? 'confirmed' : 'estimate'}</span>
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
            tone={gl.ready ? 'positive' : 'warning'}
            icon={gl.ready ? 'IconCheck' : 'IconInfo'}
            kicker={<>{gl.complete ? 'Ready to go live' : gl.ready ? `Ready for ${gl.readyOn.map((c) => (c === 'ebay' ? 'eBay' : 'your shop')).join(' and ')}` : 'Needs a look'}{row.decision?.decided_at && <span className={styles.stripWhen}> · approved {when(row.decision.decided_at)}</span>}</>}
            checks={a.warnings.map((w) => ({ tone: /^Loses money/.test(w) ? 'negative' : 'info', text: w }))}
            action={!confirm && (
              <span className={styles.actions}>
                {canReady && (
                  <button type="button" className={styles.ghost} disabled={readying || rebuilding || busy || shopping} onClick={() => getReady()}>
                    <Icon name="IconSpark" className={styles.btnIcon} />{rebuilding ? 'Writing it for the new product' : readying ? 'Getting it ready' : 'Get it ready'}
                  </button>
                )}
                {shopButton}
                {ebayButton}
                {lockNote && <span className={styles.lockNote}>{lockNote}</span>}
              </span>
            )}>
            {sentence}
            {(base.chosen?.url ?? row.reference_url) && <> <a className={styles.reference} href={base.chosen?.url ?? row.reference_url} target="_blank" rel="noreferrer noopener">{base.chosen ? 'See the listing it prices from' : 'See the listing this came from'}</a></>}
          </BriefStrip>

          {(queued || refusedJob) && (
            <div className={styles.jobNote} data-tone={refusedJob ? 'negative' : undefined}>
              <Icon name={refusedJob ? 'IconFlag' : 'IconClock'} className={styles.jobIcon} />
              <span className={styles.jobText}>
                {refusedJob ? (
                  <><b>eBay refused it{refusedJob.finished_at ? ` on ${when(refusedJob.finished_at)}` : ''}.</b> {refusedJob.error ?? 'No reason given.'} Fix it here, then list it on its own or put it back in the queue.</>
                ) : job.state === 'working' ? (
                  <><b>Publishing on eBay now.</b> It leaves this page once it is live{gl.left.includes('shop') ? ', or stays with your shop still to do' : ''}.</>
                ) : (
                  <><b>In the eBay queue{job.created_at ? ` since ${when(job.created_at)}` : ''}.</b> It goes up at your daily pace, with the portal open or closed.{job.error ? ` Last try: ${job.error}` : ''}</>
                )}
              </span>
              {refusedJob ? (
                <button type="button" className={styles.goFix} disabled={jobBusy || !gl.can.ebay}
                  title={!gl.can.ebay ? `Before eBay: ${firstBlock('ebay')?.text ?? 'a check fails'}` : undefined}
                  onClick={requeue}>{jobBusy ? 'Queueing' : 'Back in the queue'}</button>
              ) : job.state === 'queued' && (
                <button type="button" className={styles.goFix} disabled={jobBusy}
                  onClick={() => jobAct(() => onCancelJob(job.id))}>{jobBusy ? 'Taking it out' : 'Take it out of the queue'}</button>
              )}
            </div>
          )}

          <GoLiveList gl={gl} row={row} onGo={goTo} parcel={parcel} onParcel={(box) => change({ package: box })}
            onWrite={writeWords} writing={writing} onPrice={setPrice} eView={eView}
            onFind={() => findPhotos()} finding={finding}
            onShowBoth={() => onShowIds([row.id, row.duplicate_of.id], 'Approved twice')}
            onCheckEbay={checkWithEbay} checkingEbay={checkingEbay} />

          {readyNote && (readyNote.lead || readyNote.done.length > 0 || readyNote.short.length > 0) && (
            <div className={styles.readyNote} role="status" data-tone={readyNote.short.length ? 'warning' : 'positive'}>
              <Icon name={readyNote.short.length ? 'IconInfo' : 'IconCheck'} className={styles.btnIcon} />
              <span>
                {readyNote.lead && <span className={styles.readyShort}>{readyNote.lead}</span>}
                {readyNote.done.length > 0 && <>Written and found: {readyNote.done.join(', ')}. Read them over before it goes live.</>}
                {readyNote.short.map((x) => <span key={x} className={styles.readyShort}>{x}</span>)}
              </span>
              <button type="button" className={styles.revert} onClick={() => setReadyNote(null)}>Dismiss</button>
            </div>
          )}

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
                  note="Checked with eBay: the category, the details it needs, and anything that stops it. Nothing is live until Publish." />

                <div className={styles.confirmGrid}>
                  <ConfirmItem label="Category" words value={confirm.category?.name ?? `#${confirm.category?.id ?? '?'}`}
                    sub={confirm.category ? `#${confirm.category.id}, ${{ card: 'where the proving listing sits', ebay: 'eBay\'s suggestion', chosen: 'your choice' }[confirm.category.source]}` : null} />
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
                  <ConfirmItem label="Photographs" value={confirm.images}
                    sub={{ catalogue: 'from eBay\'s catalogue', shop: 'the shop\'s, checked', mixed: 'yours and the shop\'s', hers: 'yours' }[confirm.image_source] ?? null} />
                  <ConfirmItem label="You keep" value={formatGbp(eView.keep)} tone="positive" />
                  {(() => {
                    const box = parcelOf(eView, draft);
                    const size = box.length_cm && box.width_cm && box.height_cm ? `${box.length_cm} x ${box.width_cm} x ${box.height_cm}cm` : null;
                    return (
                      <ConfirmItem label="Parcel" value={Number(box.weight_kg) > 0 ? `${box.weight_kg}kg` : size ?? '--'}
                        words={!(Number(box.weight_kg) > 0)}
                        sub={Number(box.weight_kg) > 0 ? size : 'no weight: fine for flat or free postage'} />
                    );
                  })()}
                  {confirm.gtin && <ConfirmItem label="Barcode" value={confirm.gtin} sub={confirm.catalogue ? `in eBay's catalogue, ePID ${confirm.catalogue.epid}` : 'sent with the listing'} />}
                </div>

                {confirm.category_differs && confirm.suggested && (
                  <div className={styles.confirmNote} data-tone="warning">
                    <Icon name="IconInfo" className={styles.btnIcon} />
                    <span>eBay would file it under <b>{confirm.suggested.name}</b> (#{confirm.suggested.id}) from the title. The one above is where the listing that proves the market sits.</span>
                    {confirm.category?.id !== confirm.suggested.id && (
                      <button type="button" className={styles.goFix} disabled={busy}
                        onClick={() => {
                          setCategoryChoice(confirm.suggested.id);
                          change({ ebay_category: { id: confirm.suggested.id, name: confirm.suggested.name ?? null, source: 'chosen', required: [] } });
                          review({ category_id: confirm.suggested.id });
                        }}>
                        Use eBay's
                      </button>
                    )}
                  </div>
                )}

                {confirm.missing?.length > 0 && (
                  <div className={styles.details}>
                    <span className={styles.confirmLabel}>eBay needs these for this category</span>
                    <div className={styles.detailFields}>
                      {confirm.missing.map((m) => (
                        <label key={m.name} className={styles.parcelField}>
                          <span>{m.name}</span>
                          {m.mode === 'SELECTION_ONLY' && m.values?.length ? (
                            <select className={styles.detailInput} value={draft.aspects?.[m.name] ?? ''}
                              onChange={(e) => change({ aspects: { ...(draft.aspects ?? {}), [m.name]: e.target.value } })}>
                              <option value="">Choose</option>
                              {m.values.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input className={styles.detailInput} list={`${row.id}-${m.name}`} value={draft.aspects?.[m.name] ?? ''}
                              onChange={(e) => change({ aspects: { ...(draft.aspects ?? {}), [m.name]: e.target.value } })} />
                          )}
                          {m.mode !== 'SELECTION_ONLY' && m.values?.length > 0 && (
                            <datalist id={`${row.id}-${m.name}`}>{m.values.map((v) => <option key={v} value={v} />)}</datalist>
                          )}
                        </label>
                      ))}
                    </div>
                    <button type="button" className={styles.ghost} disabled={busy} onClick={() => review()}>Check again</button>
                  </div>
                )}

                {confirm.problems?.length > 0 && (
                  <ul className={styles.confirmProblems}>
                    {confirm.problems.map((x) => <li key={x}><Icon name="IconX" className={styles.btnIcon} />{x}</li>)}
                  </ul>
                )}

                {confirm.limits && (
                  <p className={styles.confirmLimit}>
                    This month: <b data-num>{confirm.limits.monthUsed}</b> of <span data-num>{confirm.limits.monthly}</span> listed on eBay.
                  </p>
                )}

                <p className={styles.confirmTitle}>{confirm.title ?? draft.title}</p>

                <div className={styles.confirmActions}>
                  <button type="button" className={styles.ghost} onClick={() => setConfirm(null)}>Back</button>
                  <button type="button" className={styles.primary} disabled={busy || confirm.problems?.length > 0}
                    title={confirm.problems?.length ? confirm.problems[0] : undefined}
                    onClick={async () => {
                      setBusy(true);
                      setProblem(null);
                      try {
                        await onList(listing({ price: confirm.price }));
                        setConfirm(null);
                      } catch (e) {
                        setProblem(e.message);
                      } finally {
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
              {draft.as_shelf && ebayLeft && !eView.store && (
                <div data-part="pack" className={styles.ownMarket} data-tone="set">
                  <Icon name="IconCheck" className={styles.btnIcon} />
                  <span>
                    <b>Listed as the shelf product itself.</b> {draft.market?.query} on eBay UK: median {formatGbp(draft.market?.median)} of {draft.market?.n} new listings{draft.market?.at ? `, checked ${when(draft.market.at)}` : ''}.
                  </span>
                  <button type="button" className={styles.revert} onClick={() => change({ as_shelf: false, market: null })}>Undo</button>
                </div>
              )}

              {packOpen && !draft.as_shelf && (
                <div data-part="pack" className={styles.packPanel}>
                  <ComparePanel base={eView} image={row.image_url} />
                  {pack && (
                    <div className={styles.packActions}>
                      <button type="button" className={styles.ghost} onClick={() => goTo('buy')}>
                        <Icon name="IconX" className={styles.btnIcon} />Different pack, find the right one
                      </button>
                      <button type="button" className={styles.ghost} disabled={checkingMkt} onClick={checkOwnMarket}>
                        <Icon name="IconSearch" className={styles.btnIcon} />{checkingMkt ? 'Checking eBay' : 'List the shelf product as it is'}
                      </button>
                      <button type="button" className={eView.packCheck ? styles.ghost : styles.primary}
                        onClick={() => onSource(pack)}>
                        <Icon name="IconCheck" className={styles.btnIcon} />Same item and pack, confirm {formatGbp(pack.unit_cost)}
                      </button>
                    </div>
                  )}

                  {ownMkt && (
                    <div className={styles.ownMarket} data-tone={!ownMkt.n ? 'none' : keepAt(ownMkt.median) < 0 ? 'loss' : 'ok'}>
                      {!ownMkt.n ? (
                        <span>No new listings of <b>{ownMkt.query}</b> from UK sellers on eBay right now, so there is no market to price it from. Reject it, or find the right pack.</span>
                      ) : (
                        <>
                          <span>
                            <b>{ownMkt.query}</b> on eBay UK now: {ownMkt.n} new {ownMkt.n === 1 ? 'listing' : 'listings'}, {formatGbp(ownMkt.low)} to {formatGbp(ownMkt.high)}, median {formatGbp(ownMkt.median)}, postage in.
                            {' '}At {formatGbp(ownMkt.median)} you keep <b data-num>{formatGbp(keepAt(ownMkt.median))}</b>
                            {keepAt(ownMkt.median) < 0 ? '. It loses money at its own price: reject it, or find it cheaper.' : keepAt(ownMkt.median) < (eView.target ?? 0) ? `, under your ${formatGbp(eView.target)} profit.` : '.'}
                          </span>
                          <ul className={styles.ownList}>
                            {ownMkt.listings.slice(0, 3).map((x) => (
                              <li key={x.url ?? x.title}>
                                {x.url ? <a href={x.url} target="_blank" rel="noreferrer noopener">{x.title}</a> : x.title}
                                <span data-num>{formatGbp(x.total)}</span>
                              </li>
                            ))}
                          </ul>
                          <span className={styles.pageButtons}>
                            <button type="button" className={styles.goFix} disabled={keepAt(ownMkt.median) < 0} onClick={() => listAsShelf(ownMkt.median)}>
                              List it as the shelf product at {formatGbp(ownMkt.median)}
                            </button>
                            {eView.floor != null && eView.floor > ownMkt.median && (
                              <button type="button" className={styles.goFix} onClick={() => listAsShelf(eView.floor)}>
                                At your floor, {formatGbp(eView.floor)}
                              </button>
                            )}
                            <button type="button" className={styles.revert} onClick={() => setOwnMkt(null)}>Close</button>
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <section className={styles.panel} aria-label="Price" data-part="price">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconTag" className={styles.panelIcon} />Price</span>
                  <span className={styles.panelNote}>{a.store ? 'Against Google\'s prices, where buyers compare' : 'Against what is selling, not the middle of the field'}</span>
                </header>
                {draft.entry_suggestion && !a.store && (
                  <KeeprSuggestion s={draft.entry_suggestion} busy={Boolean(using) || asking || readying}
                    onUse={() => afterMove(draft.entry_suggestion, `Now pricing from ${draft.entry_suggestion.entry.title}, ${formatGbp(draft.entry_suggestion.entry.price)}.`)}
                    onDismiss={() => change({ entry_suggestion: null, entry_dismissed: [...(draft.entry_dismissed ?? []), draft.entry_suggestion.entry.item_id] })} />
                )}
                {/* Keyed on the listing it prices from: a move redraws the chart on the new product's market. */}
                <PriceSetter key={a.entry?.item_id ?? 'none'} a={a} market={a.competition ?? row.competition} listings={a.marketRead?.listings ?? []}
                  medianLabel={a.marketRead?.basis === 'selling' && a.marketRead.sellingSeen ? `median of ${a.marketRead.sellingSeen} selling` : 'median'}
                  onChange={setPrice}
                  choose={{ onUse: useListing, onSwitchBack: switchBack, onAsk: () => askKeepr(), asking, using }} />
              </section>

              <section className={styles.panel} aria-label="The listing" data-part="listing">
                <header className={styles.panelHead}>
                  <span className={styles.panelTitle}><Icon name="IconNote" className={styles.panelIcon} />The listing</span>
                  <span className={styles.panelNote}>
                    {[a.l?.brand ?? (a.moved ? draft.item_facts?.brand : null), (a.moved ? draft.item_facts?.category?.split('|').join(' > ') : breadcrumb(row.ebay_category_path)) || a.l?.shop_category, band(a.m.headroom_band)].filter(Boolean).join(' · ')}
                    {edited && (
                      <span className={styles.draftState}>
                        {saving ? 'Saving' : 'Saved'}
                        <button type="button" className={styles.revert} onClick={revert}>Clear my edits</button>
                      </span>
                    )}
                  </span>
                </header>
                <ListingComposer listing={a.moved ? a.l : a.l ?? row.listing} draft={draft} onChange={change}
                  onGenerate={generate} onUpload={upload}
                  judge={(src) => sourceOf(src, row, draft, gl.left.includes('ebay') ? 'ebay' : 'shop')}
                  checks={freshChecks(row, draft)} onCheck={() => findPhotos({ again: true, apply: false })} checking={finding}
                  onWider={() => findPhotos({ wider: true, apply: false })} />
                {draft.catalogue?.epid && (
                  <div className={styles.catalogue}>
                    {draft.catalogue.images?.[0] && <img src={draft.catalogue.images[0]} alt="" loading="lazy" />}
                    <span className={styles.catalogueText}>
                      <b>eBay's catalogue</b>, ePID {draft.catalogue.epid}{draft.catalogue.title ? `: ${draft.catalogue.title}` : ''}.{' '}
                      {(draft.images ?? []).some((u) => isHers(u, draft))
                        ? 'Your own photos go up on eBay instead.'
                        : `${(draft.catalogue.images?.length ?? 0) === 1 ? 'Its photo goes' : `Its ${draft.catalogue.images?.length ?? ''} photos go`} up on eBay. ${(draft.images ?? []).length ? 'The photos above go on your shop.' : 'Your shop still needs photos.'}`}
                    </span>
                    <button type="button" className={styles.revert} onClick={() => change({ catalogue: null })}>Remove</button>
                  </div>
                )}
                <Parcel box={draft.package} suggest={parcel} onChange={(box) => change({ package: box })} />
              </section>
            </div>

            <aside className={styles.side}>
              <TillRoll a={a} />

              <section className={styles.panel} aria-label="Where to buy it" data-part="buy">
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
                {(pageChoices.length > 0 || draft.page) && (
                  <div className={styles.pageFrom}>
                    <span className={styles.pageFromHead}>
                      The listing is written from <b>{writtenFrom ? host(writtenFrom) : 'no page'}</b>
                      {draft.page && cardPage && (
                        <button type="button" className={styles.revert} onClick={() => setPendingPage({ url: null, label: host(cardPage) })}>Back to {host(cardPage)}</button>
                      )}
                    </span>
                    {pendingPage ? (
                      <span className={styles.pageConfirm}>
                        Writing from {pendingPage.label} clears the title, description, photos and item details written from {writtenFrom ? host(writtenFrom) : 'the old page'}. Your own photos stay.
                        <span className={styles.pageButtons}>
                          <button type="button" className={styles.goFix} onClick={() => usePage(pendingPage.url)}>Write from {pendingPage.label}</button>
                          <button type="button" className={styles.revert} onClick={() => setPendingPage(null)}>Cancel</button>
                        </span>
                      </span>
                    ) : pageChoices.map((src) => (unreadable(src.url) ? (
                      // Amazon refuses to be read by a machine: writing from its page would fail, so paste instead.
                      <button key={src.url} type="button" className={styles.goFix} onClick={() => setPasting(true)}>
                        Paste {possessive(src.supplier || host(src.url))} product details
                      </button>
                    ) : (
                      <button key={src.url} type="button" className={styles.goFix} onClick={() => setPendingPage({ url: src.url, label: src.supplier || host(src.url) })}>
                        Write it from {possessive(src.supplier || host(src.url))} page
                      </button>
                    )))}
                  </div>
                )}
                {/*
                  * What her supplier's page says, pasted by her. Some suppliers (Amazon Business) cannot be read by
                  * a machine, and without it the writing falls back on another eBay seller's details, which are
                  * often wrong. Pasted, it is the first source the title, description and item details trust.
                  */}
                {pasting || (draft.supplier_text ?? '').trim() ? (
                  <label className={styles.supplierText}>
                    <span className={styles.supplierHead}>
                      What your supplier's page says
                      <span className={styles.supplierHint}>Pasted here, it is what the listing is written from first.</span>
                    </span>
                    <textarea rows={5} value={draft.supplier_text ?? ''} placeholder="Paste the title, the bullet points and the product details from the page you buy it from."
                      onChange={(e) => change({ supplier_text: e.target.value })} />
                    <SendButtonHint />
                  </label>
                ) : (
                  <button type="button" className={styles.cheaper} onClick={() => setPasting(true)}>
                    <Icon name="IconNote" className={styles.btnIcon} />Paste your supplier's product details
                  </button>
                )}
                {alts.length > 0 && (
                  <p className={styles.alts}>
                    <span className={styles.altsLabel}>Also stocked by</span>
                    {alts.map((n) => <span key={n} className={styles.alt}>{n}</span>)}
                  </p>
                )}
                {others.length > 1 && (
                  <SourceList candidate={row} onAdd={onSource} suppliers={suppliers} compact canAdd={false}
                    keepOf={(src) => assess({ ...row, draft }, {
                      tryCost: Number(src.landed_unit_cost), tryPosted: src.fulfilment === 'stock' ? 'you' : 'supplier', holdPrice: true,
                    }).keep} />
                )}
                {cheaper ? (
                  <div className={styles.tryIn}>
                    <CostTry onTry={onTry} base={a} view={a} suppliers={suppliers} onSave={addSupplier} hideStep />
                  </div>
                ) : (
                  <button type="button" className={styles.cheaper} onClick={() => setCheaper(true)}>
                    <Icon name="IconPlus" className={styles.btnIcon} />Found it cheaper?
                  </button>
                )}
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
                    <Proof icon="IconLayers" value={(a.moved ? a.competition?.competitors : row.active_listings) ?? 'Unknown'}
                      label="listings competing on the same search" />
                  </div>
                )}
              </section>

              {!a.store && (
                <section className={styles.panel} aria-label="In search results">
                  <header className={styles.panelHead}>
                    <span className={styles.panelTitle}><Icon name="IconSearch" className={styles.panelIcon} />In search results</span>
                    <span className={styles.panelNote}>All a buyer sees before opening it</span>
                  </header>
                  <SearchTile title={draft.title || a.title} image={(draft.images ?? [])[0] ?? null} price={a.price}
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

// The go-live checklist: one column per channel the card is meant for. A channel already started says so; one
// still to do lists its checks, green when met, amber when it is hers to weigh, red when it holds the button, each
// with the one thing that fixes it.
/*
 * The Send to Cart & Keep bookmark, offered where she would otherwise paste. React will not render a javascript:
 * address, so it is set on the element after it mounts.
 */
function SendButtonHint() {
  const ref = useRef(null);
  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '') + window.location.search;
    ref.current?.setAttribute('href', bookmarkletFor(window.location.origin, path));
  }, []);
  return (
    <span className={styles.sendHint}>
      Faster: drag <a ref={ref} className={styles.sendButton} onClick={(e) => e.preventDefault()} draggable="true">Send to Cart &amp; Keep</a> to
      your bookmarks bar once. On the supplier's product page, press it: the details and photos come straight here.
    </span>
  );
}

// Pages that refuse to be read by a machine. Writing from one would fail; her pasted details stand in for it.
const unreadable = (url) => /(^|\.)amazon\.[a-z.]+$/i.test((() => { try { return new URL(url).hostname; } catch { return ''; } })());

function GoLiveList({ gl, row, onGo, parcel, onParcel, onWrite, writing, onPrice, eView, onFind, finding, onShowBoth, onCheckEbay, checkingEbay }) {
  return (
    <section className={styles.golive} aria-label="Going live">
      {gl.wants.map((c) => (
        <div key={c} className={styles.goCol} data-channel={c}>
          <header className={styles.goHead}>
            <Icon name={CHANNEL[c].icon} className={styles.goIcon} />
            <span className={styles.goName}>{CHANNEL[c].label}</span>
            <span className={styles.goState} data-state={gl.state[c]}>{STATE_WORD[c][gl.state[c]]}</span>
            {gl.checks[c] && (
              <span className={styles.goCount} data-num>{gl.checks[c].filter((x) => x.ok).length} of {gl.checks[c].length}</span>
            )}
          </header>
          {gl.state[c] !== 'todo' ? (
            <p className={styles.goDone}>
              {c === 'ebay'
                ? <>Live at <b data-num>{formatGbp(row.ebay?.price)}</b>. {row.ebay?.listing_id && <a href={`https://www.ebay.co.uk/itm/${row.ebay.listing_id}`} target="_blank" rel="noreferrer noopener">View listing</a>} Revise it from Listings.</>
                : gl.state.shop === 'draft'
                  ? <>A draft on your shop. It goes on sale from <a href={portalPath('/products')}>Products</a> once its returns and hazard details are confirmed.</>
                  : <>On sale on your shop.</>}
            </p>
          ) : (
            <ul className={styles.goList}>
              {gl.checks[c].map((x) => (
                <li key={x.key} className={styles.goItem} data-ok={x.ok || undefined} data-hard={(!x.ok && x.hard) || undefined}>
                  <span className={styles.goMark} aria-hidden="true">
                    {x.ok
                      ? <svg viewBox="0 0 12 12"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" /></svg>
                      : x.hard ? <svg viewBox="0 0 12 12"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" /></svg> : <i />}
                  </span>
                  <span className={styles.goText}>{x.text}</span>
                  {!x.ok && x.fix && (
                    x.key === 'parcel' && parcel?.weight_kg ? (
                      <button type="button" className={styles.goFix} onClick={() => onParcel({ weight_kg: parcel.weight_kg, length_cm: parcel.length_cm, width_cm: parcel.width_cm, height_cm: parcel.height_cm })}>
                        Use {parcel.weight_kg}kg{parcel.label ? `, ${parcel.label}` : ''}
                      </button>
                    ) : x.ebaycheck ? (
                      <button type="button" className={styles.goFix} disabled={checkingEbay} onClick={onCheckEbay}>{checkingEbay ? 'Checking with eBay' : x.fix}</button>
                    ) : x.dupe ? (
                      <button type="button" className={styles.goFix} onClick={onShowBoth}>{x.fix}</button>
                    ) : x.find ? (
                      <button type="button" className={styles.goFix} disabled={finding} onClick={onFind}>{finding ? 'Checking photos' : x.fix}</button>
                    ) : x.write ? (
                      <button type="button" className={styles.goFix} disabled={writing} onClick={onWrite}>{writing ? 'Writing' : 'Write it'}</button>
                    ) : x.key === 'price' && x.match != null ? (
                      <button type="button" className={styles.goFix} onClick={() => onPrice(x.match)}>Match £{x.match.toFixed(2)}</button>
                    ) : (
                      <button type="button" className={styles.goFix} onClick={() => onGo(x.to)}>{x.fix}</button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

// The parcel as packed, which eBay's tracked services price by. Filled from the card's postage band when she agrees.
// The parcel as packed, which eBay's calculated postage prices by. Until she changes it, it is the card's postage
// band: shown as real values, and what goes up.
function Parcel({ box = null, suggest, onChange }) {
  const { label, ...band } = suggest ?? {};
  const v = { ...band, ...(box ?? {}) };
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  return (
    <div className={styles.parcel} data-part="parcel">
      <span className={styles.parcelHead}>
        <span className={styles.parcelTitle}>Parcel, as packed</span>
        {suggest && (box ? (
          <button type="button" className={styles.goFix} onClick={() => onChange(null)}>
            Back to the {label ?? 'postage band'}
          </button>
        ) : (
          <span className={styles.parcelFrom}>From the {label ?? 'postage band'}. Change it if it packs differently.</span>
        ))}
      </span>
      <div className={styles.parcelFields}>
        {[['weight_kg', 'Weight', 'kg'], ['length_cm', 'Length', 'cm'], ['width_cm', 'Width', 'cm'], ['height_cm', 'Height', 'cm']].map(([k, name, unit]) => (
          <label key={k} className={styles.parcelField}>
            <span>{name}</span>
            <span className={styles.parcelControl}>
              <input inputMode="decimal" data-num value={v[k] ?? ''} onChange={set(k)} placeholder={k === 'weight_kg' ? 'Optional' : ''} />
              <span className={styles.parcelUnit}>{unit}</span>
            </span>
          </label>
        ))}
      </div>
      {!(Number(v.weight_kg) > 0) && (
        <p className={styles.parcelNote}>No weight needed for flat or free postage. If your eBay postage works the cost out by weight, eBay's check will ask for it.</p>
      )}
    </div>
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

function ConfirmItem({ label, value, sub, tone, words = false }) {
  return (
    <div className={styles.confirmItem}>
      <span className={styles.confirmLabel}>{label}</span>
      <span className={`${styles.confirmValue} ${tone ? styles[tone] : ''}`} data-num={words ? undefined : true}>{value}</span>
      {sub && <span className={styles.confirmSub}>{sub}</span>}
    </div>
  );
}
