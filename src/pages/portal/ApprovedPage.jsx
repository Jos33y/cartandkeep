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
import { isBladed } from '@lib/blades';
import { OVER_OK_TEXT, STATE_WORD, goLive, ownMarket, parcelFor, parcelOf, viewsOf, withinOver } from '@lib/golive';
import { freshChecks, isHers, noShopPhotos, pageOf, photosAdded, photosToAdd, sourceOf } from '@lib/photos';
import { PRODUCT_FIELDS, sameListing } from '@lib/product';
import { bookmarkletFor, likelyCard, readSent } from '@lib/sendToCart';
import { amazonPageOf, amazonWeight, costedNow, isAmazonUk, packedKg, readOf, sentOf, supplierPatch, warningsOf, weightKg } from '@lib/supplierWatch';
import { SupplierWatch } from '@components/ui/portal/SupplierWatch';
import { CostEdit } from '@components/ui/portal/CostEdit';
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
import { supabase } from '@lib/supabase';
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
  const agentName = tenant?.store?.agent?.name || 'Your assistant';

  const {
    status, rows, month, jobs, reload, addSource, updateSource, removeSource, list, addToShop, queue, cancel, retry, noteDraft, noteListing, saveAspects, patchDraft, checkPhotos, marketCheck, matchListing, readSupplier,
  } = useApproved(tenant?.id);
  const { suppliers, remember } = useSuppliers(tenant?.id);
  const [find, setFind] = useState('');
  // A link can open one tab: Keeper's report sends ?only=keeper, so the cards it just approved are what she sees.
  // Keeper's office sends ?only=ready (cards it got ready), and ?card=<id> for one card from its log.
  const asked = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [only, setOnly] = useState(() => (asked.get('card') ? 'held' : ['keeper', 'ready', 'check', 'readyEbay', 'readyShop', 'noAmazonPrice', 'supplierWarn'].includes(asked.get('only')) ? asked.get('only') : null));
  /*
   * One channel at a time (Joseey, 5 October: "no way to see the ones we want to add to shop and the ones for ebay",
   * "for the ebay we can't know live and not live"). eBay: not listed, or live and waiting only for the shop. Your
   * shop: to add, or already in it. Every tab, count and quick pick below reads within the channel picked.
   */
  const [side, setSide] = useState(() => (['ebay', 'shop'].includes(asked.get('side')) ? asked.get('side') : null));
  const [where, setWhere] = useState(() => (asked.get('where') === 'done' ? 'done' : 'todo'));
  const [listed, setListed] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const anchor = useRef(null);
  // The cards eBay is checking before they are queued; the cards it held back, to look at next.
  const [sheetFor, setSheetFor] = useState(null);
  const [held, setHeld] = useState(() => (asked.get('card') ? { ids: new Set([asked.get('card')]), label: 'From the office' } : null));
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
        if (add?.images) { await patchDraft(row.id, add); added = photosAdded(add, row.draft); }
      }
      setNotice({
        title: `Sent from ${sent.shop || "your supplier's page"}`,
        body: `${row.draft?.title || row.title}: the product details are in, and ${sent.images?.length ? `${passed} of ${sent.images.length} photos passed the check${added ? `, ${added} added` : ''}` : 'no photos came with it'}. ${agentName} writes from them when it gets the card ready.`,
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
  useEffect(() => { setStay(new Set()); }, [only, side, where]);
  // A bulk action running from the bar: adding to the shop, or finding photos. One at a time.
  const [busy, setBusy] = useState(null);
  const stopBusy = useRef(false);

  /*
   * Amazon read again for the cards showing no Amazon price (Joseey, 5 October: "most already have everything filled
   * jst the cost"). Apify only, no Claude, 20 cards a call. A reading with no price is always read again, whatever its
   * age. Where Amazon's price becomes the supplier's cost and it is the cheapest, the card prices from Amazon, as ZURU
   * did; nothing she wrote or set changes.
   */
  const [rereading, setRereading] = useState(null);
  const stopRead = useRef(false);
  async function readAgainAll(ids) {
    stopRead.current = false;
    const tally = { done: 0, total: ids.length, priced: 0, moved: 0, failed: 0 };
    setRereading({ ...tally });
    for (let i = 0; i < ids.length && !stopRead.current; i += 20) {
      const part = ids.slice(i, i + 20);
      try {
        const got = await readSupplier(part);
        tally.priced += Object.values(got.reads).filter((r) => r?.offer?.price != null).length;
        tally.moved += Object.keys(got.moved).length;
      } catch {
        tally.failed += part.length;
      }
      tally.done += part.length;
      setRereading({ ...tally });
    }
    setRereading(null);
    const left = tally.done - tally.priced - tally.failed;
    setNotice({
      title: `Read ${tally.done} on Amazon`,
      body: `${tally.priced} now ${tally.priced === 1 ? 'shows' : 'show'} a price, and ${tally.moved} ${tally.moved === 1 ? 'card is' : 'cards are'} now costed from it.${left > 0 ? ` ${left} still ${left === 1 ? 'shows' : 'show'} no price on Amazon: no Buy Box, or not sold new.` : ''}${tally.failed ? ` ${tally.failed} could not be read; try again in a minute.` : ''}`,
      tone: tally.failed ? 'warning' : 'positive',
    });
  }

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

  const onSide = useCallback(({ gl }) => !side
    || (gl.wants.includes(side) && (where === 'todo' ? gl.state[side] === 'todo' : gl.state[side] !== 'todo')), [side, where]);
  const sided = useMemo(() => assessed.filter(onSide), [assessed, onSide]);
  const sides = useMemo(() => {
    const of = (c, todo) => assessed.filter(({ gl }) => gl.wants.includes(c) && (todo ? gl.state[c] === 'todo' : gl.state[c] !== 'todo')).length;
    return { ebay: { todo: of('ebay', true), done: of('ebay', false) }, shop: { todo: of('shop', true), done: of('shop', false) } };
  }, [assessed]);
  // Ready and Needs a look for the channel picked: a card ready for her shop is not ready for eBay.
  const readyHere = useCallback(({ gl }) => (side ? gl.readyOn.includes(side) : gl.ready), [side]);
  const checkHere = useCallback(({ gl }) => (side ? gl.left.includes(side) && !gl.readyOn.includes(side) : !gl.ready), [side]);

  // Where the eBay queue has each card: waiting, publishing, or refused with eBay's words.
  const jobOf = useCallback((id) => jobs[id] ?? null, [jobs]);
  const refused = ({ row, gl }) => jobOf(row.id)?.state === 'failed' && gl.state.ebay === 'todo';

  const counts = useMemo(() => ({
    ready: sided.filter(readyHere).length,
    check: sided.filter(checkHere).length,
    // Of the Ready ones, which channel each is ready for, for the tab's own count.
    readyShopAll: sided.filter(({ gl }) => gl.readyOn.includes('shop')).length,
    readyEbayAll: sided.filter(({ gl }) => gl.readyOn.includes('ebay')).length,
    half: sided.filter(({ gl }) => gl.started.length > 0).length,
    edited: sided.filter(({ a }) => a.edited).length,
    // Approved by Keeper from Amazon (keeper-task-02), not by her.
    keeper: sided.filter(({ row }) => row.decision?.made_by === 'keeper').length,
    queued: sided.filter(({ row }) => jobOpen(jobOf(row.id))).length,
    refused: sided.filter((x) => refused(x)).length,
    readyEbay: sided.filter(({ row, gl }) => readyFor(gl, 'ebay') && !jobOpen(jobOf(row.id))).length,
    readyShop: sided.filter(({ row, gl, a }) => readyFor(gl, 'shop') && a.goods != null && !jobOpen(jobOf(row.id))).length,
  }), [sided, jobOf, readyHere, checkHere]);

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
  // Ticked cards Keeper can get ready: still to list on eBay or to add to her shop, not in the eBay queue, not approved
  // twice. eBay's first: they matter most (Joseey, 4 October).
  const forKeeper = useMemo(() => picked
    .filter(({ row, gl }) => (gl.left.includes('ebay') || gl.left.includes('shop')) && !jobOpen(jobOf(row.id)) && !row.duplicate_of)
    .sort((x, y) => Number(y.gl.left.includes('ebay')) - Number(x.gl.left.includes('ebay'))),
  [picked, jobOf]);
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
   * Her Amazon supplier's page, read through Apify for one card. What came back is on the card as supplier_read;
   * an answer with no facts is said as the reason, so the card can show it.
   */
  async function amazonRead(row, { url = null, again = false } = {}) {
    const { reads, skipped } = await readSupplier([row.id], { url, again });
    const r = reads[row.id];
    if (!r) throw new Error(skipped[row.id] ?? 'Amazon did not answer. Try again in a minute.');
    if (!r.facts) throw new Error(r.found === false ? 'The Amazon page has gone.' : (r.error ?? 'Amazon did not answer. Try again in a minute.'));
    return r;
  }

  /*
   * Keeper gets cards ready in its office (keeper-task-03, 4 October): what was Get it ready here. The cards go to
   * Keeper's queue; it fills only what is missing and stops at Ready to go live. Sent while Keeper is already going,
   * they join that run. `again` sends a card Keeper got ready before (ticked by her, or moved to another product).
   */
  const [withKeeper, setWithKeeper] = useState(() => new Set());
  const readWithKeeper = useCallback(async () => {
    if (!tenant?.id) return null;
    const { data, error } = await supabase.from('keeper_jobs').select('candidate_id').eq('tenant_id', tenant.id)
      .eq('kind', 'get_ready').in('state', ['queued', 'working']).limit(2000);
    if (error) return null;
    const next = new Set((data ?? []).map((j) => j.candidate_id));
    setWithKeeper(next);
    return next;
  }, [tenant?.id]);
  useEffect(() => { readWithKeeper(); }, [readWithKeeper]);
  // While Keeper works, its queue is looked at now and then; when cards come back from Keeper, the list is read again
  // so they show what Keeper wrote. Only then, so a card she is editing is not read over for nothing.
  const keeperIds = useRef(withKeeper);
  keeperIds.current = withKeeper;
  useEffect(() => {
    if (!withKeeper.size) return undefined;
    const t = setInterval(async () => {
      const before = keeperIds.current;
      const next = await readWithKeeper();
      if (next && [...before].some((id) => !next.has(id))) reload();
    }, 20000);
    return () => clearInterval(t);
  }, [withKeeper.size, readWithKeeper, reload]);

  async function sendToKeeper(ids, { again = false, quiet = false } = {}) {
    if (!ids.length) return false;
    const { error } = await supabase.rpc('start_ready_run', {
      p_tenant: tenant.id, p_ids: ids, p_pace: 'normal', p_cap_pence: Math.max(100, ids.length * 8), p_again: again,
    });
    if (error) {
      if (!quiet) setNotice({ title: 'Not sent to ' + agentName, body: error.message, tone: 'warning' });
      return false;
    }
    supabase.functions.invoke('keeper-run', { body: { queue: true, tenant_id: tenant.id } }).catch(() => {});
    await readWithKeeper();
    setSelected(new Set());
    if (!quiet) {
      setNotice({
        title: `${ids.length} sent to ${agentName}`,
        body: 'Titles, descriptions, photos, eBay\'s details and the parcel, only where a card has none. Each card comes back here ready, or saying what it needs.',
        to: portalPath('/keeper/ready'),
        toLabel: `${agentName}'s office`,
        tone: 'positive',
      });
    }
    return true;
  }

  /*
   * The cards Keeper can get ready by itself (Joseey, 4 October), eBay's first:
   *   eBay cards  still to list on eBay and missing something, up to 100% over the market (the price check), the pack
   *               confirmed;
   *   shop cards  meant for her shop only (the Google research's), still to add and missing something, not at a loss.
   * Both: in stock on Amazon, no pack or bundle doubt, not approved twice, not got ready by Keeper before. A card she
   * ticks goes whatever it is.
   */
  const keeperOk = useCallback(({ row }) => {
    if (jobOpen(jobOf(row.id)) || row.duplicate_of || isBladed(row) || withKeeper.has(row.id) || row.draft?.keeper_ready) return false;
    const said = warningsOf(readOf(row), row.sources).map((w) => w.short);
    return !said.some((w) => w === 'out of stock' || w === 'page gone' || w === 'check the pack' || w === 'a bundle');
  }, [jobOf, withKeeper]);
  const keeperEbay = useMemo(() => assessed.filter((x) => {
    const { gl } = x;
    if (!gl.left.includes('ebay') || readyFor(gl, 'ebay') || !keeperOk(x)) return false;
    const ebay = gl.checks.ebay ?? [];
    if (!ebay.find((c) => c.key === 'price')?.ok) return false;
    const pack = ebay.find((c) => c.key === 'pack');
    return !(pack && !pack.ok);
  }), [assessed, keeperOk]);
  const keeperShop = useMemo(() => assessed.filter((x) => {
    const { gl } = x;
    if (gl.wants.includes('ebay') || !gl.left.includes('shop') || readyFor(gl, 'shop') || !keeperOk(x)) return false;
    const price = (gl.checks.shop ?? []).find((c) => c.key === 'price');
    return !(price && price.hard && !price.ok);
  }), [assessed, keeperOk]);
  const keeperPicks = useMemo(() => [...keeperEbay, ...keeperShop], [keeperEbay, keeperShop]);

  /*
   * A card moved to another product's eBay listing is written again for it. The draft is passed in as saved, so the
   * work reads the card as it now is, not as the list last drew it. What it did lands on the card and in a notice.
   */
  const [rebuilt, setRebuilt] = useState({});
  async function rebuild(row, draft, lead) {
    setStay((x) => new Set(x).add(row.id));
    const sentOk = await sendToKeeper([row.id], { again: true, quiet: true });
    const note = {
      lead,
      done: [],
      short: [sentOk ? `${agentName} is writing the title, description and photos for the new product. It shows here when done.` : `Not sent to ${agentName}: try Get ready with ${agentName} on the card.`],
      at: Date.now(),
    };
    setRebuilt((m) => ({ ...m, [row.id]: note }));
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

  // Amazon read, its page found, and no price on it (no Buy Box, or read while Apify was out): the cost cannot follow
  // Amazon until it is read again (Joseey, 4 October). Keeper reads these again whatever their age.
  const noAmazonPriceTest = ({ row }) => {
    const r = readOf(row);
    // Only low-rated sellers is an answer already (a red warning on the card), so it is not read again for nothing.
    return Boolean(r?.found) && r?.offer?.price == null && r?.offer?.others == null && !row.ebay?.listing_id;
  };
  const noAmazonPrice = sided.filter(noAmazonPriceTest).length;
  // Her Amazon supplier says something to settle before listing: out of stock, gone, dearer than her cost, a pack to
  // check. The Alerts page sends her here with it picked (Joseey, 5 October).
  const supplierWarnTest = ({ row }) => !row.ebay?.listing_id
    && warningsOf(readOf(row), row.sources).some((w) => w.level === 'stop' || w.level === 'warn');
  const supplierWarn = sided.filter(supplierWarnTest).length;
  const readyEbayTest = ({ row, gl }) => readyFor(gl, 'ebay') && !jobOpen(jobOf(row.id));
  const readyShopTest = ({ row, gl, a }) => readyFor(gl, 'shop') && a.goods != null && !jobOpen(jobOf(row.id));
  const match = (x) => {
    const { gl, a, row } = x;
    switch (only) {
      case null: return true;
      case 'ready': return readyHere(x);
      case 'check': return checkHere(x);
      case 'half': return gl.started.length > 0;
      case 'edited': return a.edited;
      case 'keeper': return row.decision?.made_by === 'keeper';
      case 'queued': return jobOpen(jobOf(row.id));
      case 'refused': return refused(x);
      case 'held': return held?.ids.has(row.id);
      // Ready for one channel alone (Joseey, 4 October: "how do I see the ones ready for eBay alone"), as the quick
      // picks count them, so the list and the number agree.
      case 'readyEbay': return readyEbayTest(x);
      case 'readyShop': return readyShopTest(x);
      case 'noAmazonPrice': return noAmazonPriceTest(x);
      case 'supplierWarn': return supplierWarnTest(x);
      default: return true;
    }
  };
  const shown = sided
    .filter((x) => match(x) || stay.has(x.row.id))
    .filter(({ a, row }) => !find.trim() || `${row.draft?.title ?? ''} ${a.title}`.toLowerCase().includes(find.trim().toLowerCase()));
  const shownIds = shown.map(({ row }) => row.id);
  const allShown = shown.length > 0 && shown.every(({ row }) => selected.has(row.id));
  const selectWhere = (test) => setSelected(new Set(sided.filter(test).map(({ row }) => row.id)));

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

      {/* Which channel: every card, eBay's, or her shop's. Then where each stands on it. */}
      <div className={styles.chanRow}>
        <div className={styles.chanSwitch} role="group" aria-label="Channel">
          {[[null, 'Every card', assessed.length], ['ebay', 'eBay', sides.ebay.todo + sides.ebay.done], ['shop', 'Your shop', sides.shop.todo + sides.shop.done]].map(([id, label, n]) => (
            <button key={label} type="button" className={styles.chan} aria-pressed={side === id}
              onClick={() => { setSide(id); setWhere('todo'); setSelected(new Set()); }}>
              {label} <span data-num>{n}</span>
            </button>
          ))}
        </div>
        {side && (
          <div className={styles.standSwitch} role="group" aria-label={side === 'ebay' ? 'On eBay' : 'On your shop'}>
            {[['todo', side === 'ebay' ? 'Not listed' : 'To add', sides[side].todo], ['done', side === 'ebay' ? 'Live' : 'In your shop', sides[side].done]].map(([id, label, n]) => (
              <button key={id} type="button" className={styles.stand} aria-pressed={where === id}
                onClick={() => { setWhere(id); setSelected(new Set()); }}>
                <i data-where={id} aria-hidden="true" />{label} <span data-num>{n}</span>
              </button>
            ))}
            <span className={styles.standNote}>
              {side === 'ebay'
                ? where === 'todo' ? 'Approved, not on eBay yet.' : 'Live on eBay, still to add to your shop.'
                : where === 'todo' ? 'Not on your shop yet.' : 'A draft or on sale on your shop, still to list on eBay.'}
            </span>
          </div>
        )}
      </div>

      {/* The state of the queue, and the way into it. At four rows it is a
          summary; at a hundred it is the only way to find anything. */}
      <div className={styles.states} role="tablist" aria-label="Filter">
        <StateTab id={null} only={only} setOnly={setOnly} icon="IconLayers"
          label="All" count={sided.length} />
        {!(side && where === 'done') && <><StateTab id="ready" only={only} setOnly={setOnly} icon="IconCheck"
          label="Ready to go live" count={counts.ready} tone="positive"
          detail={!side && counts.ready > 0 && counts.readyShopAll !== counts.readyEbayAll ? `Shop ${counts.readyShopAll} · eBay ${counts.readyEbayAll}` : null} />
        <StateTab id="check" only={only} setOnly={setOnly} icon="IconInfo"
          label="Needs a look" count={counts.check} tone="warning" /></>}
        {counts.half > 0 && (
          <StateTab id="half" only={only} setOnly={setOnly} icon="IconShop"
            label="One channel left" count={counts.half} />
        )}
        {counts.edited > 0 && (
          <StateTab id="edited" only={only} setOnly={setOnly} icon="IconNote"
            label="Edited" count={counts.edited} />
        )}
        {counts.keeper > 0 && (
          <StateTab id="keeper" only={only} setOnly={setOnly} icon="IconKeeper"
            label={`From ${agentName}`} count={counts.keeper} />
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

      {/* Keeper's offer is about cards still to go somewhere, so not on Live or In your shop. */}
      {!(side && where === 'done') && (keeperPicks.length > 0 || withKeeper.size > 0) && (
        <section className={styles.keeperStrip} aria-label={`${agentName} gets cards ready`}>
          <Icon name="IconKeeper" className={styles.keeperStripIcon} />
          <div className={styles.keeperStripText}>
            {withKeeper.size > 0 && (
              <p className={styles.keeperStripHead}>
                {agentName} is getting <span data-num>{withKeeper.size}</span> {withKeeper.size === 1 ? 'card' : 'cards'} ready. Each comes back here when done.
              </p>
            )}
            {keeperPicks.length > 0 && (
              <p className={withKeeper.size ? styles.keeperStripMeta : styles.keeperStripHead}>
                {agentName} can get <span data-num>{keeperPicks.length}</span> more {keeperPicks.length === 1 ? 'card' : 'cards'} ready
                {keeperEbay.length > 0 && keeperShop.length > 0
                  ? <>: <span data-num>{keeperEbay.length}</span> for eBay first, then <span data-num>{keeperShop.length}</span> for your shop.</>
                  : keeperEbay.length > 0 ? ' for eBay.' : ' for your shop.'}
              </p>
            )}
            <p className={styles.keeperStripMeta}>
              {keeperEbay.length > 0
                ? `eBay cards up to ${OVER_OK_TEXT} over the market, in stock, the pack confirmed. `
                : 'Cards for your shop, in stock and not at a loss. '}
              Photos, the title, the description and the parcel{keeperEbay.length > 0 ? ', and eBay\'s details and listing match for eBay cards' : ''}, only where a card has none.
              {keeperEbay.length > 0 ? ' Nothing goes live until you list it or add it.' : ' Each is then ready to add to your shop as a draft; nothing goes on sale until you add it.'}
            </p>
          </div>
          <span className={styles.keeperStripActions}>
            {keeperPicks.length > 0 && (
              <button type="button" className={styles.primary} onClick={() => sendToKeeper(keeperPicks.map(({ row }) => row.id))}>
                Get {keeperPicks.length} ready
              </button>
            )}
            {keeperPicks.length > 0 && (
              <button type="button" className={styles.revert}
                onClick={() => { setHeld({ ids: new Set(keeperPicks.map(({ row }) => row.id)), label: `For ${agentName}` }); setOnly('held'); }}>
                See them
              </button>
            )}
            {withKeeper.size > 0 && <a className={styles.revert} href={portalPath('/keeper/ready')}>Open the office</a>}
          </span>
        </section>
      )}

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
          {/* Each shows its cards alone and ticks them for the bulk bar; pressed again, back to every card. */}
          {(counts.readyEbay > 0 || only === 'readyEbay') && (
            <button type="button" className={styles.pickQuick} aria-pressed={only === 'readyEbay'}
              onClick={() => {
                if (only === 'readyEbay') { setOnly(null); setSelected(new Set()); return; }
                setOnly('readyEbay');
                selectWhere(readyEbayTest);
              }}>
              <Icon name="IconTag" className={styles.pickIcon} />Ready for eBay <span data-num>{counts.readyEbay}</span>
            </button>
          )}
          {(counts.readyShop > 0 || only === 'readyShop') && (
            <button type="button" className={styles.pickQuick} aria-pressed={only === 'readyShop'}
              onClick={() => {
                if (only === 'readyShop') { setOnly(null); setSelected(new Set()); return; }
                setOnly('readyShop');
                selectWhere(readyShopTest);
              }}>
              <Icon name="IconShop" className={styles.pickIcon} />Ready for your shop <span data-num>{counts.readyShop}</span>
            </button>
          )}
          {(noAmazonPrice > 0 || only === 'noAmazonPrice') && (
            <button type="button" className={styles.pickQuick} aria-pressed={only === 'noAmazonPrice'}
              title={`Amazon was read and showed no price. Get them ready with ${agentName} to read them again.`}
              onClick={() => {
                if (only === 'noAmazonPrice') { setOnly(null); setSelected(new Set()); return; }
                setOnly('noAmazonPrice');
                selectWhere(noAmazonPriceTest);
              }}>
              <Icon name="IconFlag" className={styles.pickIcon} />No Amazon price <span data-num>{noAmazonPrice}</span>
            </button>
          )}
          {only === 'noAmazonPrice' && (noAmazonPrice > 0 || rereading) && (
            rereading ? (
              <span className={styles.queueNote} role="status">
                <i aria-hidden="true" />
                <span>Reading Amazon: <b data-num>{rereading.done}</b> of <b data-num>{rereading.total}</b>.</span>
                <button type="button" className={styles.revert} onClick={() => { stopRead.current = true; }}>Stop</button>
              </span>
            ) : (
              <button type="button" className={styles.pickRead}
                title="Reads each Amazon page again for its price. Apify only, no Claude, under a penny a card. Nothing you wrote or set changes."
                onClick={() => readAgainAll(sided.filter(noAmazonPriceTest).map(({ row }) => row.id))}>
                <Icon name="IconRefresh" className={styles.pickIcon} />Read {noAmazonPrice} again on Amazon
              </button>
            )
          )}
          {(supplierWarn > 0 || only === 'supplierWarn') && (
            <button type="button" className={styles.pickQuick} aria-pressed={only === 'supplierWarn'}
              title="Out of stock, gone, dearer than your cost, or a pack to check on Amazon. Settle these before listing."
              onClick={() => {
                setSelected(new Set());
                setOnly(only === 'supplierWarn' ? null : 'supplierWarn');
              }}>
              <Icon name="IconFlag" className={styles.pickIcon} />Supplier warnings <span data-num>{supplierWarn}</span>
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
            agentName={agentName}
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
            onAmazon={(opts) => amazonRead(row, opts)}
            onMarket={() => marketCheck(row.id)}
            onMatch={(itemId) => matchListing(row.id, itemId)}
            onRebuild={(draft, lead) => rebuild(row, draft, lead)}
            rebuilt={rebuilt[row.id] ?? null}
            withKeeper={withKeeper.has(row.id)}
            onKeeper={() => sendToKeeper([row.id], { again: true })}
            onStay={() => setStay((x) => (x.has(row.id) ? x : new Set(x).add(row.id)))}
            onShowIds={(ids, label) => { setHeld({ ids: new Set(ids), label }); setOnly('held'); }}
            onCost={(sourceId, fields) => updateSource(row.id, sourceId, fields)}
            onRemoveSource={(sourceId) => removeSource(row.id, sourceId)}
            onSource={async (fields) => {
              await addSource({ candidateId: row.id, tenantId: tenant.id, ...fields });
              await remember({ tenantId: tenant.id, name: fields.supplier, country: fields.ships_from });
            }}
          />
        ))}

        {shown.length === 0 && <p className={styles.quiet}>Nothing here.</p>}
      </div>

      {selected.size > 0 && !sheetFor && (
        <BulkBar count={selected.size} ebay={forEbay} shop={forShop} ready={forKeeper} busy={busy} agentName={agentName}
          onReady={() => sendToKeeper(forKeeper.map(({ row }) => row.id), { again: true })}
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
  tenantId, fees, suppliers, onSource, onCost, onRemoveSource, onList, onShop, onCheckPhotos, onAmazon, onShowIds, onMarket, onMatch,
  onRebuild, rebuilt = null, onStay, agentName = 'Your assistant', withKeeper = false, onKeeper,
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
  // What happened on the card, said once: a move to another product, what Amazon's page gave, what Keeper is doing.
  // Getting the card ready itself is Keeper's, in its office (keeper-task-03).
  const readying = false;
  const [readyNote, setReadyNote] = useState(null);
  const [sendingKeeper, setSendingKeeper] = useState(false);
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
  // Her Amazon supplier: the page the card is checked against, and what it said when last read.
  const amazonPage = amazonPageOf({ ...row, draft });
  const amazonRead = readOf({ ...row, draft });
  // Her Amazon page, read already (on add or by the morning check): its facts go in an empty supplier box once the
  // card is opened, so the writing has them. Never over words she pasted or edited.
  useEffect(() => {
    if (!open || !amazonRead?.facts || (draft.supplier_text ?? '').trim()) return;
    const fill = supplierPatch(draft, amazonRead);
    if (fill) change(fill);
  }, [open, amazonRead?.read_at]); // eslint-disable-line react-hooks/exhaustive-deps
  // Photos that passed and are not in the draft yet go in when the card is opened, plain shots first. She takes out
  // the ones she does not want; those stay out.
  useEffect(() => {
    if (!open || queued || working || row.ebay?.listing_id) return;
    const add = photosToAdd(row, draft);
    if (add?.images) change({ images: add.images, photos_offered: add.photos_offered });
  }, [open, row.photo_checks]); // eslint-disable-line react-hooks/exhaustive-deps
  const supplierFlag = useMemo(() => warningsOf(readOf(row), row.sources).find((w) => w.level !== 'note') ?? null, [row]);

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
        // Keeper's note and parcel were the old product's: it writes new ones when it gets this one ready.
        keeper_ready: null, parcel_from: null,
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
    setReadyNote({ done: [], short: [`The listing now comes from ${url ? host(url) : 'the card\'s own page'}. ${agentName} writes it from there when it gets the card ready.`] });
    // Her supplier's product may not be the one the card prices from: Keepr checks, once the page is saved.
    // Only a card going to eBay prices from an eBay listing; a shop card has none to match.
    if (url && gl.wants.includes('ebay')) flush().then(() => askKeepr({ quiet: true }));
  }

  // A supplier with a link: Keepr checks the card prices from the eBay listing for that product. An Amazon UK link
  // is read first, so Keepr matches on its barcode and the listing is written from it.
  async function addSupplier(fields) {
    await onSource(fields);
    const url = fields?.url ?? '';
    if (isAmazonUk(url)) {
      try {
        const got = await fromAmazon({ url });
        setReadyNote({ done: [], short: [got.filled
          ? `Amazon's product details are in${got.added ? `, with ${got.added} ${got.added === 1 ? 'photo' : 'photos'}` : ''}. ${agentName} writes from them when it gets the card ready.`
          : 'Amazon\'s page is read. Your own supplier details stay as you wrote them.'] });
      } catch (e) {
        setProblem(`Amazon's page: ${e.message}`);
      }
    }
    if (/^https?:\/\//.test(url) && !draft.entry && gl.wants.includes('ebay')) askKeepr({ quiet: true });
  }

  /*
   * Her Amazon supplier's page, read and put to use: its facts into her supplier box (never over words of hers),
   * its photos through the photo check and into her draft where she has none. `photos` false leaves the photos for
   * Keeper, which checks them alongside the writing when it gets the card ready.
   */
  const [readingAmazon, setReadingAmazon] = useState(false);
  async function fromAmazon({ url = null, again = false, photos = missing.photos } = {}) {
    setReadingAmazon(true);
    try {
      const r = await onAmazon({ url, again });
      const fill = supplierPatch(draft, r);
      if (fill) { change(fill); await flush(); }
      let added = 0;
      const sent = sentOf(r);
      if (photos && sent?.images?.length) {
        const pc = await onCheckPhotos({ supplied: sent });
        const add = photosToAdd({ ...row, photo_checks: pc }, { ...draft, ...(fill ?? {}) });
        if (add) { change(add); added = photosAdded(add, draft); }
      }
      return { r, filled: Boolean(fill), added };
    } finally {
      setReadingAmazon(false);
    }
  }
  async function readAmazon(url = null) {
    setProblem(null);
    try {
      const got = await fromAmazon({ url, again: true });
      setReadyNote({ done: [], short: [got.filled
        ? `Amazon's product details are in${got.added ? `, with ${got.added} ${got.added === 1 ? 'photo' : 'photos'}` : ''}. ${agentName} writes from them when it gets the card ready.`
        : 'Amazon\'s page is read again. Your own supplier details stay as you wrote them.'] });
    } catch (e) {
      setProblem(`Amazon's page: ${e.message}`);
    }
  }

  // Keepr's photo check, then what passed into her draft, never over photos she already has: the shop's checked
  // photos, and eBay's catalogue entry for eBay. `again` looks afresh; otherwise an earlier check is used.
  async function findPhotos({ again = false, apply = true, wider = false } = {}) {
    setFinding(true);
    setProblem(null);
    try {
      // Her Amazon page's photos, read but not yet looked at, go through the check first.
      const amazonSent = amazonRead?.facts ? sentOf(amazonRead) : null;
      const checks = amazonSent && (again || unchecked(row, amazonSent))
        ? await onCheckPhotos({ again, wider, supplied: amazonSent })
        : !again && !wider && freshChecks(row, draft) ? freshChecks(row, draft) : await onCheckPhotos({ again, wider });
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
  // An Amazon UK page is read in the supplier box below (SupplierWatch), not offered here.
  const pageChoices = [...new Map(others.filter((src) => /^https?:\/\//.test(src.url ?? '') && src.url !== writtenFrom && !isAmazonUk(src.url))
    .map((src) => [src.url, src])).values()].slice(0, 3);

  return (
    <article ref={cardRef} className={`${styles.pack} ${open ? styles.packOpen : ''}`} data-status={status}
      data-selected={selected || undefined} data-candidate={row.id}>
      {zoomed && ((draft.images ?? []).length
        ? <ImageLightbox images={draft.images} alt={a.title} note="Going up on eBay in this order. The first is the search tile." onClose={() => setZoomed(false)} />
        : <ImageLightbox src={hero} alt={a.title} onClose={() => setZoomed(false)} />)}

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
            {/* Her Amazon supplier this morning: first when she could not buy it at the price she costed. */}
            {supplierFlag && (
              <span className={styles.flag} data-tone={supplierFlag.level === 'stop' ? 'block' : 'warning'} title={`Amazon: ${supplierFlag.text}`}>
                <Icon name="IconFlag" className={styles.flagIcon} />Amazon: {supplierFlag.short}
              </span>
            )}
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
            {row.decision?.made_by === 'keeper' && (
              <span className={styles.keeperTag} role="img" aria-label={`Approved by ${agentName}`}
                title={`${agentName} found it on Amazon by its barcode and approved it`}>
                <Icon name="IconKeeper" className={styles.keeperIcon} />
              </span>
            )}
          </span>
        </div>

        <div className={styles.cell}>
          <span className={styles.cellLabel}>List at</span>
          <span className={styles.fig} data-num>{a.price != null ? formatGbp(a.price) : '--'}</span>
          {rowPos && (
            <span className={styles.status} data-tone={rowPos.inMarket || withinOver(rowPos.over, rowPos.ref) ? 'positive' : 'warning'}
              title={rowPos.inMarket ? undefined : withinOver(rowPos.over, rowPos.ref) ? `Within ${OVER_OK_TEXT} of the market: fine to list` : `More than ${OVER_OK_TEXT} over the market`}>
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
            kicker={<>{gl.complete ? 'Ready to go live' : gl.ready ? `Ready for ${gl.readyOn.map((c) => (c === 'ebay' ? 'eBay' : 'your shop')).join(' and ')}` : 'Needs a look'}{row.decision?.decided_at && <span className={styles.stripWhen}> · approved {when(row.decision.decided_at)}{row.decision.made_by === 'keeper' ? ` by ${agentName}` : ''}</span>}</>}
            checks={a.warnings.map((w) => ({ tone: /^Loses money/.test(w) ? 'negative' : 'info', text: w }))}
            action={!confirm && (
              <span className={styles.actions}>
                {withKeeper ? (
                  <span className={styles.lockNote}><Icon name="IconKeeper" className={styles.btnIcon} />With {agentName}, getting it ready</span>
                ) : canReady && (gl.left.includes('ebay') || gl.left.includes('shop')) && !queued && (
                  <button type="button" className={styles.ghost} disabled={sendingKeeper || busy || shopping}
                    onClick={async () => { setSendingKeeper(true); try { await flush(); await onKeeper(); } finally { setSendingKeeper(false); } }}>
                    <Icon name="IconKeeper" className={styles.btnIcon} />{sendingKeeper ? 'Sending' : `Get ready with ${agentName}`}
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

          {!readyNote && draft.keeper_ready && (
            <div className={styles.readyNote} role="status" data-tone={draft.keeper_ready.need?.length ? 'warning' : 'positive'}>
              <Icon name="IconKeeper" className={styles.btnIcon} />
              <span>
                {agentName} got it ready{draft.keeper_ready.at ? ` on ${when(draft.keeper_ready.at)}` : ''}
                {draft.keeper_ready.done?.length > 0 ? `, adding ${draft.keeper_ready.done.join(', ')}.` : '.'}
                {' '}{draft.keeper_ready.need?.length > 0 ? `Still needs ${draft.keeper_ready.need.join(', ')}.` : 'Read it over before it goes live.'}
                {(draft.keeper_ready.short ?? []).map((x) => <span key={x} className={styles.readyShort}>{String(x).replace(/\.$/, '')}.</span>)}
              </span>
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
                  <ComparePanel base={eView} image={whole.store ? null : row.image_url} query={row.external_ref} />
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
                    {[a.l?.brand ?? (a.moved ? draft.item_facts?.brand : null), draft.ebay_category?.name || (a.moved ? draft.item_facts?.category?.split('|').join(' > ') : breadcrumb(row.ebay_category_path)) || a.l?.shop_category, band(a.m.headroom_band)].filter(Boolean).join(' · ')}
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
                  checks={freshChecks(row, draft)} onCheck={() => findPhotos({ again: true })} checking={finding}
                  onWider={() => findPhotos({ wider: true })} />
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
                <Parcel box={draft.package} suggest={parcel} onChange={(box) => change({ package: box })} itemKg={amazonWeight(amazonRead)} />
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
                {/* The supplier the card prices from: its cost can be changed here, and is then hers. */}
                {a.best?.id && others.length <= 1 && (row.sources ?? []).some((src) => src.id === a.best.id) && (
                  <CostEdit source={a.best} onSave={(fields) => onCost(a.best.id, fields)} />
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
                      // Another Amazon is not read: it prices in another currency. Paste instead.
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
                {amazonPage && (
                  <SupplierWatch page={amazonPage} read={amazonRead} costed={costedNow(row.sources, amazonRead)}
                    reading={readingAmazon} onRead={() => readAmazon(amazonPage.uk ? null : amazonPage.url)}
                    source={(row.sources ?? []).find((src) => src.id === amazonRead?.source_id) ?? null} onCost={onCost} />
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
                    onCost={onCost} onRemove={onRemoveSource}
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
      your bookmarks bar once. Then open your supplier's product page, on any shop, and press it there: the details and photos come straight here.
    </span>
  );
}

// Pages that refuse to be read by a machine. Writing from one would fail; her pasted details stand in for it.
// Photos from her Amazon page not looked at yet: the photo check is asked to look at them.
const unchecked = (row, sent) => Boolean(sent?.images?.length) && !(row.photo_checks?.others ?? []).some((o) => o.sent && o.url === sent.url);
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
function Parcel({ box = null, suggest, onChange, itemKg = null }) {
  const { label, ...band } = suggest ?? {};
  const v = { ...band, ...(box ?? {}) };
  /*
   * What she types, kept as typed until it is a number: "0." on its way to "0.5" stays "0.", and "500g" or
   * "1.2 kg" is read in its unit. Saved as kilograms and centimetres.
   */
  const [typed, setTyped] = useState({});
  const shown = (k) => (typed[k] ?? (v[k] ?? ''));
  const set = (k) => (e) => {
    const raw = e.target.value;
    setTyped((t) => ({ ...t, [k]: raw }));
    const text = raw.trim();
    if (text === '') { onChange({ ...v, [k]: '' }); return; }
    const value = k === 'weight_kg' && /[a-z]/i.test(text) ? weightKg(text) : /^\d+(\.\d+)?$/.test(text) ? Number(text) : null;
    if (value != null) onChange({ ...v, [k]: value });
  };
  const settle = (k) => () => setTyped((t) => { const { [k]: _gone, ...rest } = t; return rest; });
  const packed = packedKg(itemKg);
  const weightNow = Number(v.weight_kg) || null;
  return (
    <div className={styles.parcel} data-part="parcel">
      <span className={styles.parcelHead}>
        <span className={styles.parcelTitle}>Parcel, as packed</span>
        {suggest && (box ? (
          <button type="button" className={styles.goFix} onClick={() => { setTyped({}); onChange(null); }}>
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
              <input inputMode="decimal" data-num value={shown(k)} onChange={set(k)} onBlur={settle(k)}
                placeholder={k === 'weight_kg' ? (packed ? String(packed) : 'Optional') : ''}
                aria-label={k === 'weight_kg' ? 'Weight in kilograms, or type it in grams, for example 500g' : `${name} in centimetres`} />
              <span className={styles.parcelUnit}>{unit}</span>
            </span>
          </label>
        ))}
      </div>
      {packed && weightNow !== packed && (
        <p className={styles.parcelNote}>
          Amazon gives the item as {itemKg < 1 ? `${Math.round(itemKg * 1000)}g` : `${itemKg}kg`}. Packed, about {packed}kg.{' '}
          <button type="button" className={styles.goFix} onClick={() => { setTyped({}); onChange({ ...v, weight_kg: packed }); }}>Use {packed}kg</button>
        </p>
      )}
      {!weightNow && !packed && (
        <p className={styles.parcelNote}>No weight needed for flat or free postage. If your eBay postage works the cost out by weight, eBay's check will ask for it. Type it in kg, or in grams as 500g.</p>
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
