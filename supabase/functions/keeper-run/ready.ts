// Keeper task 03 (Joseey, 4 October): an approved card got ready for eBay, the work Get it ready did on the Approved
// page, done here in Keeper's office. For each card, in order, only what is missing:
//
//   amazon  her Amazon page read again when the reading is more than 48 hours old (supplier-read), else the saved
//           reading; Amazon's facts into an empty supplier box;
//   match   eBay cards: Keepr asked to match (ebay-match), as "Ask Keepr to match" on the card. The card moves to the
//           eBay listing that sells what she buys when Keepr is sure enough (keeper_ready_move, 0139); otherwise the
//           listing is suggested on the card for her;
//   photos  the photo check (photo-check) of her Amazon gallery, else of the shop page and eBay's catalogue; the
//           photos that passed go in, plain shots first, up to 12;
//   words   the title and the description (ebay-compose);
//   ebay    eBay's category and the item details it asks for, filled from the facts (ebay-list, a dry run);
//   parcel  the size and the weight from Amazon's package, else its product size, else the page's words.
//
// A card meant for her shop only (the Google research's store cards) skips eBay's step and is judged as a shop draft:
// photos and a description of her own (Joseey, 4 October: "keep them for shop... ebay cards first").
//
// It never lists. Every write goes through keeper_ready_fill (0138), which fills a field only while it is still
// empty, so nothing she wrote is replaced. A card takes a few calls of the worker: each call does the steps it has
// time for and keeps its place (the job's result.progress), so no call runs past the function's limit.

import { asSent, asinOf, costFollow, isAmazon, supplierPageOf } from '../_shared/amazon.ts';
import { parcelFromRead, parcelPatch, productSize, sizeAspects, sensibleParcel } from '../_shared/parcel.ts';
import { parcelFromFacts, productOf, type SizeFacts } from '../_shared/parcel-read.ts';
import { lessonText, lessonsFor } from './review.ts';
import { productKey, swappedTo } from '../_shared/product.ts';
import { OutOfCredit, creditOf, isCredit } from '../_shared/credit.ts';
import { addUsage, metering, noUsage, pence, tallied } from '../_shared/usage.ts';

type Json = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Client = any;

export type ReadyOutcome =
  | { state: 'done'; result: Json; cost: number }
  | { again: true; result: Json; cost: number }
  // Claude or Apify refused for want of credit: the card goes back where it got to and the run pauses (credit.ts).
  | { credit: string; service: string; result: Json; cost: number }
  | { error: string; cost: number };

// Another of our functions, called as the service: (name, body, extra headers) to its JSON answer.
export type Call = (fn: string, body: Json, headers?: Record<string, string>) => Promise<Json>;

export type ReadyDeps = {
  call: Call;
  // The scheduler secret, for supplier-read: it reads for the schedule or for a member, and Keeper is neither.
  secret: () => Promise<string>;
  // Reads the size and weight off her Amazon page, in any units it is written (parcel-read.ts). Without it, or when it
  // fails, the pattern reader in parcel.ts is used.
  size?: (read: Json) => Promise<SizeFacts | null>;
  // What Keeper has learned for this shop (keeper_lessons, 0140): read once a batch, the ones for each card used.
  lessons?: Json[];
  // Pounds to the dollar, for what Claude's tokens cost (KEEPER_GBP_PER_USD).
  gbpPerUsd?: number;
  now?: () => number;
};

// A reading older than this is read again before the card is written from it (Joseey, 4 October).
export const FRESH_MS = 48 * 3600 * 1000;
// Each call stops starting new steps after this long on one card; the next call carries on.
const STEP_BUDGET_MS = 30_000;
export const STEPS = ['amazon', 'match', 'photos', 'words', 'ebay', 'parcel'] as const;

/*
 * What each step costs, in pence, roughly: Apify's page read, and Claude for the photo check, each piece of writing
 * and the item details. About 5p a card when every step runs (keepr-agent-04: about $0.05 a card).
 */
export const COST = { read: 0.12, match: 1, photos: 2, title: 0.6, description: 0.9, details: 0.8, size: 0.4 };

// The photo check's version and page rules, as src/lib/photos.js has them, so Keeper and the page agree.
const PHOTO_CHECK_VERSION = 2;
const MAX_IMAGES = 12;
const ANOTHER_SELLER = /^https?:\/\/i\.ebayimg\.com\//i;

export const pageOf = (c: Json) => (swappedTo(c)
  ? c.draft?.page ?? null
  : c.draft?.page ?? c.margin?.shelf?.url ?? c.margin?.cost_from?.url ?? null);

export function freshChecks(c: Json) {
  const pc = c.photo_checks;
  if (!pc || (pc.version ?? 1) < PHOTO_CHECK_VERSION) return null;
  if ((pc.product ?? null) !== productKey(c)) return null;
  if (pc.page && pageOf(c) && pc.page !== pageOf(c)) return null;
  return pc;
}

const checkedPhotos = (pc: Json) => [
  ...(pc?.images ?? []),
  ...((pc?.others ?? []) as Json[]).filter((o) => o.ok).flatMap((o) => o.images ?? []),
];

export function passedPhotos(c: Json): string[] {
  const pc = freshChecks(c);
  if (!pc || pc.brand_rule) return [];
  return (checkedPhotos(pc) as Json[]).filter((i) => i.ok)
    .sort((x, y) => Number(Boolean(x.extra)) - Number(Boolean(y.extra)))
    .map((i) => String(i.copy ?? i.url))
    .filter((u) => !ANOTHER_SELLER.test(u));
}

// Every passed photo after hers, up to twelve, and eBay's catalogue entry when she has none. As photosToAdd.
export function photosToAdd(c: Json): Json | null {
  const pc = freshChecks(c);
  if (!pc) return null;
  const d = c.draft ?? {};
  const patch: Json = {};
  const have: string[] = d.images ?? [];
  const offered = new Set<string>(d.photos_offered ?? []);
  const fresh = passedPhotos(c).filter((u) => !have.includes(u) && !offered.has(u));
  const room = Math.max(0, MAX_IMAGES - have.length);
  if (fresh.length && room) {
    const adding = fresh.slice(0, room);
    patch.images = [...have, ...adding];
    patch.photos_offered = [...offered, ...have, ...adding];
  }
  if (!d.catalogue?.epid && pc.catalogue?.epid) patch.catalogue = { epid: pc.catalogue.epid, title: pc.catalogue.title, images: pc.catalogue.images ?? [] };
  return Object.keys(patch).length ? patch : null;
}

// Her Amazon gallery not checked yet (as ApprovedPage's unchecked).
export const unchecked = (c: Json, sent: Json | null) =>
  Boolean(sent?.images?.length) && !((c.photo_checks?.others ?? []) as Json[]).some((o) => o.sent && o.url === sent!.url);

// The facts into an empty supplier box, or one still holding the last reading's words (as supplierPatch).
export function supplierPatch(d: Json, r: Json | null): Json | null {
  const text = r?.facts?.text;
  if (!text) return null;
  const have = String(d?.supplier_text ?? '');
  if (have.trim() && have !== d?.supplier_auto) return null;
  if (have === text) return null;
  return { supplier_text: text, supplier_auto: text, ...(d?.supplier_url ? {} : { supplier_url: r!.url }) };
}

// eBay's category and Keepr's item details from a dry run, never over hers (as fromEbayCheck).
export function fromEbayCheck(dry: Json | null, d: Json = {}): Json | null {
  if (!dry?.category) return null;
  const aspects: Json = { ...(dry.filled ?? {}) };
  for (const [k, v] of Object.entries(d.aspects ?? {})) if (v) aspects[k] = v;
  return {
    ebay_category: { id: dry.category.id, name: dry.category.name ?? null, source: dry.category.source, required: ((dry.missing ?? []) as Json[]).map((a) => a.name) },
    aspects,
  };
}

const blank = (v: unknown) => !String(v ?? '').trim();
const London = { timeZone: 'Europe/London' } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...London });

// The item details eBay still needs for the category on her draft.
export function lacking(d: Json): string[] {
  const cat = d.ebay_category;
  if (!cat) return [];
  const have = new Set(Object.entries(d.aspects ?? {}).filter(([, v]) => v && String(v).trim()).map(([k]) => k.toLowerCase()));
  return ((cat.required ?? []) as string[]).filter((n) => !have.has(String(n).toLowerCase()));
}

// Whether a card is meant for eBay, as channelsOf (src/lib/assess.js): a card from the eBay route always is; a store
// card only when the import recommended eBay too.
export const forEbay = (c: Json) => c.margin?.channel !== 'store' || ((c.recommended_channels ?? []) as string[]).includes('ebay');

/*
 * Where a card stands once Keeper has done what it can: ready, or what still needs her. The page's own checklist
 * (src/lib/golive.js) has the last word; these are the parts Keeper can fill. A shop-only card needs no eBay details.
 */
export function verdict(d: Json, ebay = true, different: string | null = null) {
  const need: string[] = [];
  // Amazon's page is another product than the card: written from Amazon, but hers to check first.
  if (different) need.push(`a check: ${different}`);
  if (blank(d.title)) need.push('a title');
  else if (ebay && String(d.title).length > 80) need.push('a title of 80 characters or fewer');
  if (blank(d.description)) need.push('a description');
  if (!(d.images ?? []).length) need.push('photos');
  if (!ebay) return need;
  if (!d.ebay_category) need.push("eBay's category");
  const still = lacking(d);
  if (still.length) need.push(`eBay's ${still.join(', ')}`);
  return need;
}

/*
 * A cost she pays, for an eBay card: a supplier with a price, or the price the card was costed from when that is
 * still her product. As assess.js reads it (cheapestCost, shelfRuledOut): a card moved to another product, or a shelf
 * known to be another product or pack, has only her suppliers. Without one, what it keeps is the market's guess, and
 * the card is not ready (the Salus, 4 October).
 */
export function costKnown(c: Json, sources: Json[]) {
  if (sources.some((s) => Number(s.landed_unit_cost ?? s.price_at_moq ?? s.unit_cost) > 0 && s.matched_on !== 'shelf')) return true;
  if (c.draft?.entry?.new_product) return false;
  const m = c.margin ?? {};
  if (m.channel === 'store') return Number(m.cost) > 0;
  const ruledOut = ['different_product', 'same_product_different_pack', 'different_barcode'].includes(m.match?.level);
  return !ruledOut && Number(m.shelf?.price) > 0;
}

// As supplier-read reads a supplier, so Amazon's price is followed by the same rule (costFollow).
const SOURCE_FIELDS = 'id, candidate_id, url, unit_cost, landed_unit_cost, price_at_moq, supplier_shipping, inbound_freight_per_unit, duty_pct, fulfilment, cost_by, status';
const CARD = 'id, tenant_id, title, image_url, external_ref, draft, supplier_read, photo_checks, listing, margin, ebay, recommended_channels, decisions ( action )';

async function load(client: Client, id: string) {
  const [{ data: c, error: e1 }, { data: sources, error: e2 }] = await Promise.all([
    client.from('candidates').select(CARD).eq('id', id).maybeSingle(),
    client.from('candidate_sources').select(SOURCE_FIELDS).eq('candidate_id', id),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  return c ? { c: c as Json, sources: (sources ?? []) as Json[] } : null;
}

const approved = (c: Json) => (Array.isArray(c.decisions) ? c.decisions : c.decisions ? [c.decisions] : []).some((d: Json) => d.action === 'approve');

/*
 * One card, as far as this call has time for. `progress` is where the last call got to: the next step, what was
 * done and what was left for her, and what was spent. A step that fails outright comes back as an error, so the job
 * is tried again (three times in all) from the step it was on.
 */
export async function readyOne(client: Client, job: Json, deps: ReadyDeps): Promise<ReadyOutcome> {
  const now = deps.now ?? Date.now;
  const started = now();
  const progress: Json = { step: 0, done: [], short: [], spent: 0, used: [], ...(job.result?.progress ?? {}) };
  let cost = 0;
  const base = () => ({ title: card?.c.draft?.title || card?.c.title || null, image: (card?.c.draft?.images ?? [])[0] ?? card?.c.image_url ?? null });
  let card: { c: Json; sources: Json[] } | null = await load(client, job.candidate_id);

  const finish = (result: Json): ReadyOutcome => ({ state: 'done', result: { ...base(), ...result, spent: progress.spent + cost }, cost });
  if (!card) return finish({ tray: 'skipped', line: 'This card is no longer there.' });
  if (!approved(card.c)) return finish({ tray: 'skipped', line: 'No longer approved. Left as it is.' });
  if (card.c.ebay?.listing_id) return finish({ tray: 'skipped', line: 'Already live on eBay. Left as it is.' });
  // Two Amazon products on one card would mix their photos and words (6 October: a Christmas Stories Tonie with a
  // Sleepy Friends supplier beside it). Nothing is written until she keeps the one she sells.
  const amazonAsins = [...new Set((card.sources ?? []).filter((s: Json) => isAmazon(s.url)).map((s: Json) => asinOf(s.url)).filter(Boolean))];
  if (amazonAsins.length > 1) {
    return finish({
      tray: 'choose',
      line: `Two Amazon products are on this card (${amazonAsins.join(' and ')}). Remove the one you do not sell under Where to buy it, then get it ready again.`,
      need: ['one Amazon supplier'],
    });
  }

  // Her draft written only through keeper_ready_fill; what came back is the card as it is now.
  const fill = async (patch: Json | null) => {
    if (!patch || !Object.keys(patch).length) return [] as string[];
    const { data, error } = await client.rpc('keeper_ready_fill', { p_candidate: card!.c.id, p_patch: patch });
    if (error) throw new Error(error.message);
    if (data?.status !== 'ok') throw Object.assign(new Error(data?.status ?? 'not written'), { status: data?.status });
    card!.c.draft = data.draft;
    return (data.applied ?? []) as string[];
  };
  /*
   * Every call to another function goes through here: a refusal for want of credit stops the card where it is, and
   * the cost is what Claude reported for the call (the function's x-claude-usage, usage.ts). A function that reported
   * nothing (not yet redeployed) is counted at the old estimate, set aside by `est` just before the call.
   */
  let pending = 0;
  const est = (n: number) => { pending += n; };
  const call: Call = async (fn, body, headers) => {
    const out = await deps.call(fn, body, headers);
    cost += out?._usage ? pence(out._usage, deps.gbpPerUsd) : pending;
    pending = 0;
    // Where the tokens went, by function, kept on the job (6 October): input sent fresh, cached, and written, so the
    // next cost cut is aimed at the step that spends, not guessed.
    if (out?._usage) {
      progress.usage = progress.usage ?? {};
      const was = progress.usage[fn] ?? { ...noUsage(), calls: 0 };
      progress.usage[fn] = { ...addUsage(was, out._usage), calls: (was.calls ?? 0) + 1 };
    }
    const said = out?.error ?? out?.fill_error;
    if (said && isCredit(said)) throw new OutOfCredit(creditOf(fn), String(said));
    return out;
  };
  const done = (s: string) => { if (!progress.done.includes(s)) progress.done.push(s); };
  const short = (s: string) => { if (!progress.short.includes(s)) progress.short.push(s); };
  const save = async (step: string) => {
    await client.from('keeper_jobs').update({ result: { phase: step, progress: { ...progress, spent: progress.spent + cost } } }).eq('id', job.id);
  };
  const reading = () => {
    const page = supplierPageOf(card!.c, card!.sources);
    const r = card!.c.supplier_read;
    return 'asin' in page && page.asin && r?.asin === page.asin && r?.facts ? r : null;
  };

  try {
    while (progress.step < STEPS.length) {
      if (progress.step > 0 && now() - started > STEP_BUDGET_MS) {
        return { again: true, result: { ...base(), phase: STEPS[progress.step], progress: { ...progress, spent: progress.spent + cost } }, cost };
      }
      const step = STEPS[progress.step];
      await save(step);
      const c: Json = card.c;
      const d: Json = c.draft ?? {};
      // What Keeper has learned that fits this card now (its brand and category can change as it goes).
      const learned = lessonsFor(deps.lessons ?? [], c);
      const use = (areas: string[]) => {
        const text = lessonText(learned, areas);
        if (text) for (const l of learned.filter((x) => areas.includes(x.area))) if (!progress.used.includes(l.key)) progress.used.push(l.key);
        return text;
      };

      if (step === 'amazon') {
        const page = supplierPageOf(c, card.sources);
        if ('asin' in page && page.asin) {
          const r = c.supplier_read;
          // No price in the reading: read again, whatever its age, as supplier-read does.
          const fresh = r?.asin === page.asin && r?.facts && r?.offer?.price != null && r?.read_at && now() - Date.parse(r.read_at) < FRESH_MS;
          if (!fresh) {
            cost += COST.read;
            const said = await call('supplier-read', { tenant_id: c.tenant_id, candidate_ids: [c.id] }, { 'x-scheduler-secret': await deps.secret() })
              .catch((e) => {
                if (e instanceof OutOfCredit) throw e;
                return { error: e instanceof Error ? e.message : String(e) };
              });
            card = (await load(client, c.id)) ?? card;
            if (said?.error) short(`Amazon not read: ${said.error}`);
          }
          const now2 = reading();
          if (now2) {
            if (now() - Date.parse(now2.read_at) >= FRESH_MS) short(`Amazon could not be read today, so the reading from ${day(now2.read_at)} was used`);
            const applied = await fill(supplierPatch(card.c.draft ?? {}, now2));
            if (applied.includes('supplier_text')) done("Amazon's product details");
            /*
             * Amazon's price as the cost, when the Amazon supplier has none or an old one (Joseey, 4 October: a dearer
             * shop's price stayed on a card while Amazon was cheaper, and she had to add Amazon by hand). The same rule
             * as the morning read (costFollow): a cost she set herself, or an import's, is never moved.
             */
            const pageNow = supplierPageOf(card.c, card.sources);
            const src = 'source_id' in pageNow ? card.sources.find((x) => x.id === pageNow.source_id) ?? null : null;
            const follow = src ? costFollow(null, now2, src) : null;
            if (follow && src) {
              const { error: e } = await client.from('candidate_sources').update({
                unit_cost: follow.to, price_at_moq: follow.to, supplier_shipping: follow.shipping, inbound_freight_per_unit: follow.freight,
                cost_by: 'amazon', quoted_on: String(now2.read_at ?? new Date(now()).toISOString()).slice(0, 10), status: 'quoted',
              }).eq('id', src.id).eq('tenant_id', c.tenant_id);
              if (e) short(`Amazon's price not put on the supplier: ${e.message}`);
              else done(`Amazon's price as the cost (£${follow.to.toFixed(2)}${follow.from != null ? `, was £${follow.from.toFixed(2)}` : ''})`);
            }
            // The size and weight, read once and kept with the job for eBay's item details and the parcel.
            if (deps.size && progress.size === undefined) {
              // Read here, so counted for the card by readyBatch; the estimate only where nothing is counted.
              if (!metering()) cost += COST.size;
              progress.size = await deps.size(now2).catch((e) => {
                if (isCredit(e)) throw new OutOfCredit('Claude', e instanceof Error ? e.message : String(e));
                return null;
              });
            }
          } else short("Amazon's page could not be read, so the card was written from the shop's page");
        }
      }

      // Keepr matches the eBay listing to the product she buys, once, on a card whose listing nobody has chosen.
      if (step === 'match' && forEbay(c) && !c.draft?.entry && !c.draft?.entry_suggestion) {
        est(COST.match);
        const matchLessons = use(['match']);
        const m = await call('ebay-match', { tenant_id: c.tenant_id, candidate_id: c.id, ...(matchLessons ? { lessons: matchLessons } : {}) });
        const pct = (v: number) => `${Math.round(v * 100)}% sure`;
        if (m?.error) short(`Keepr could not match the eBay listing: ${m.error}`);
        else if (!m?.best) short(`Keepr looked at ${m?.considered ?? 0} eBay listings and none sells the product you buy`);
        else if (m.keep_proved) {
          short(`Kept the eBay listing that sells${m.keep_proved.title ? ` (${m.keep_proved.title})` : ''}: Keepr's find, ${m.best.entry.title}, is the same product and has not sold yet`);
        } else if (!m.already) {
          const sure = Number(m.best.entry?.sure ?? 0);
          if (sure >= Number(m.auto ?? 0.95)) {
            const { data, error } = await client.rpc('keeper_ready_move', {
              p_candidate: c.id, p_entry: m.best.entry, p_facts: m.best.facts ?? null, p_other: Boolean(m.best.new_product), p_market: m.market ?? null,
            });
            if (error) throw new Error(error.message);
            if (data?.status === 'moved') {
              card.c.draft = data.draft;
              done(`the eBay listing that sells your product (${m.best.entry.title}, ${pct(sure)})`);
              if (data.other) short('That listing is another product than the card was, so the card was written again for it');
            }
          } else {
            await fill({ entry_suggestion: { ...m.best, market: m.market ?? null, at: new Date(now()).toISOString() } });
            short(`Keepr suggests the eBay listing ${m.best.entry.title}, ${pct(sure)}: yours to choose on the card`);
          }
        }
      }

      if (step === 'photos' && !(card.c.draft?.images ?? []).length) {
        const r = reading();
        const sent = r ? asSent(r) : null;
        const check = async (body: Json) => {
          est(COST.photos);
          const out = await call('photo-check', { tenant_id: c.tenant_id, candidate_id: c.id, ...body });
          if (out?.error) throw new Error(`photo check: ${out.error}`);
          card!.c.photo_checks = out.photo_checks;
        };
        // Learned: this brand's photos rarely pass, so eBay's catalogue photos first, for an eBay card.
        if (forEbay(c) && learned.some((l) => l.action === 'catalogue_photos_first')) {
          learned.filter((l) => l.action === 'catalogue_photos_first').forEach((l) => { if (!progress.used.includes(l.key)) progress.used.push(l.key); });
          if (!freshChecks(c)?.catalogue) await check({});
          const first = freshChecks(card.c)?.catalogue;
          if ((first?.images ?? []).length) {
            const before0 = (card.c.draft?.images ?? []).length;
            await fill({ images: (first.images as string[]).slice(0, MAX_IMAGES), catalogue: { epid: first.epid, title: first.title, images: first.images } });
            const n0 = (card.c.draft?.images ?? []).length - before0;
            if (n0 > 0) done(`${n0} of eBay's catalogue photos`);
          }
        }
        // A check made while the brand list still skipped a brand's photos (before 4 October) is made again.
        const skipped = Boolean(freshChecks(c)?.brand_rule);
        // With the catalogue's photos in already, the rest is not needed.
        if (!(card.c.draft?.images ?? []).length) {
          if (sent && (skipped || unchecked(c, sent))) await check({ supplied: sent });
          else if (!freshChecks(c) || skipped) await check({ again: skipped });
          let add = photosToAdd(card.c);
          // Nothing passed from her Amazon page: the shop's page, other UK shops and eBay's catalogue, once.
          if (!add?.images?.length && sent && !progress.wider) {
            progress.wider = true;
            await check({ wider: true });
            add = photosToAdd(card.c);
          }
          // Still none, on a card for eBay: eBay's own catalogue photos for the product, which eBay lets any seller use.
          const cat = freshChecks(card.c)?.catalogue;
          if (!add?.images?.length && forEbay(c) && (cat?.images ?? []).length) {
            add = { ...(add ?? {}), images: (cat.images as string[]).slice(0, MAX_IMAGES),
              catalogue: { epid: cat.epid, title: cat.title, images: cat.images } };
          }
          const before = (card.c.draft?.images ?? []).length;
          const applied = await fill(add);
          const n = (card.c.draft?.images ?? []).length - before;
          if (n > 0) done(`${n} ${n === 1 ? 'photo' : 'photos'}`);
          if (applied.includes('catalogue')) done("eBay's catalogue");
          if (!(card.c.draft?.images ?? []).length) short('No photos passed the check: add your own');
        }
      }

      if (step === 'words') {
        const want = { title: blank(d.title), words: blank(d.description) };
        // Keeper's mode: it writes, from her supplier's page where the sources disagree (ebay-compose KEEPER_MODE). An
        // answer that came back empty is asked for once more.
        const write = async (kind: string) => {
          const lessons = use(['writing', 'general']);
          const ask = () => call('ebay-compose', { tenant_id: c.tenant_id, candidate_id: c.id, kind, keeper: true, ...(lessons ? { lessons } : {}) });
          est(kind === 'title' ? COST.title : COST.description);
          const first = await ask();
          if (kind === 'title' ? first?.titles?.[0] : first?.description) return first;
          est(kind === 'title' ? COST.title : COST.description);
          return ask();
        };
        const [t, w] = await Promise.all([want.title ? write('title') : null, want.words ? write('description') : null]);
        const differs = t?.different ?? w?.different ?? null;
        if (differs) {
          progress.different = differs;
          short(`Amazon's page is not quite the card's product: ${differs}. Written from Amazon; check it before it goes live`);
        }
        const patch: Json = {};
        if (want.title) {
          if (t?.titles?.[0]) patch.title = t.titles[0];
          else short(t?.conflict ? `No title: the sources disagree, ${t.conflict}` : `No title: ${t?.error ?? 'none came back'}`);
        }
        if (want.words) {
          if (w?.description) patch.description = w.description;
          else short(w?.conflict ? `No description: the sources disagree, ${w.conflict}` : `No description: ${w?.error ?? 'none came back'}`);
        }
        const applied = await fill(patch);
        if (applied.includes('title')) done('a title');
        if (applied.includes('description')) done('the description');
      }

      if (step === 'ebay' && forEbay(c)) {
        const now3 = card.c.draft ?? {};
        if (blank(now3.title)) short("eBay's category waits for a title");
        else if (!now3.ebay_category || lacking(now3).length) {
          const dry = await call('ebay-list', {
            tenant_id: c.tenant_id, candidate_id: c.id, dry: true, fill: true, quantity: 5,
            ...(use(['details', 'general']) ? { lessons: use(['details', 'general']) } : {}),
            title: now3.title, description: now3.description, images: now3.images ?? [], aspects: now3.aspects ?? {},
            use_catalogue: Boolean(now3.catalogue?.epid), package: now3.package ?? undefined,
            ...(now3.ebay_category?.id ? { category_id: now3.ebay_category.id } : {}),
          });
          if (dry?.error) short(`eBay's check: ${dry.error}`);
          else {
            if (!dry?._usage && Object.keys(dry?.filled ?? {}).length) cost += COST.details;
            const found = fromEbayCheck(dry, now3);
            // The size and weight eBay asks for, from Amazon's own figures for the product.
            if (found) {
              const asked = ((dry.missing ?? []) as Json[]).map((a) => String(a.name)).filter((n) => !found.aspects[n]);
              Object.assign(found.aspects, sizeAspects(asked, productOf(progress.size ?? null) ?? productSize(reading())));
            }
            const applied = await fill(found);
            if (applied.includes('ebay_category')) done(`the eBay category (${found!.ebay_category.name ?? found!.ebay_category.id})`);
            const details = applied.filter((a) => a.startsWith('aspects.')).length;
            if (details) done(`${details} item ${details === 1 ? 'detail' : 'details'}`);
            if (dry?.fill_error) short(`Item details not filled: ${dry.fill_error}`);
          }
        }
      }

      if (step === 'parcel') {
        const p = sensibleParcel(parcelFromFacts(progress.size ?? null) ?? parcelFromRead(reading()), card.c.draft?.title || card.c.title);
        const add = parcelPatch(card.c.draft?.package, p);
        if (add) {
          const applied = await fill({ package: add, parcel_from: p!.from });
          if (applied.some((a) => a.startsWith('package.'))) done(p!.from.replace(/^From /, 'the parcel from '));
        }
        if (p?.note) short(p.note);
      }

      progress.step += 1;
    }
  } catch (e) {
    if (e instanceof OutOfCredit) {
      const result = { ...base(), phase: STEPS[progress.step], progress: { ...progress, spent: progress.spent + cost } };
      await client.from('keeper_jobs').update({ result }).eq('id', job.id);
      return { credit: e.message, service: e.service, result, cost };
    }
    const status = (e as { status?: string })?.status;
    if (status === 'live') return finish({ tray: 'skipped', line: 'Went live on eBay meanwhile. Left as it is.' });
    if (status === 'decided' || status === 'gone') return finish({ tray: 'skipped', line: 'No longer approved. Left as it is.' });
    // Kept where it got to, so the next try starts from this step, with what was spent counted.
    await save(STEPS[progress.step]).catch(() => {});
    return { error: `${STEPS[progress.step]}: ${e instanceof Error ? e.message : String(e)}`, cost };
  }

  // Keeper's own note on the card: what it did, and what is left for her.
  const ebay = forEbay(card.c);
  const need = verdict(card.c.draft ?? {}, ebay, progress.different ?? null);
  if (ebay && !costKnown(card.c, card.sources)) need.push('what you pay for it: no cost on the card yet');
  // What the fields held when Keeper finished, so the portal can tell her later changes from Keeper's work (Edited).
  const d = card.c.draft ?? {};
  const wrote = Object.fromEntries(['title', 'description', 'images', 'aspects', 'package', 'ebay_category', 'catalogue'].map((k) => [k, d[k] ?? null]));
  await fill({ keeper_ready: { at: new Date(now()).toISOString(), run_id: job.run_id ?? null, done: progress.done, short: progress.short, need, wrote } });
  const did = progress.done.length ? `Keeper added ${progress.done.join(', ')}.` : 'Nothing was missing.';
  return finish({
    tray: need.length ? 'choose' : 'ready',
    line: need.length ? `${did} Still needs ${need.join(', ')}.` : `${did} ${ebay ? 'Ready to list.' : 'Ready to add to your shop.'}`,
    channel: ebay ? 'ebay' : 'shop',
    done: progress.done,
    short: progress.short,
    need,
    // The lessons Keeper used on this card, by key.
    lessons: progress.used,
    // Claude's tokens by function for this card (the size reader runs here and is not in it).
    usage: progress.usage ?? null,
  });
}

// A batch: each card on its own, side by side. A card that fails is tried again by the worker from where it got to.
export async function readyBatch(client: Client, jobs: Json[], deps: ReadyDeps): Promise<ReadyOutcome[]> {
  // Each card's own Claude use here (the size reader) counted for it, beside what the functions it called reported.
  const outs = await Promise.allSettled(jobs.map(async (j) => {
    const [o, used] = await tallied(() => readyOne(client, j, deps));
    return { ...o, cost: (o.cost ?? 0) + pence(used, deps.gbpPerUsd) } as ReadyOutcome;
  }));
  return outs.map((o) => (o.status === 'fulfilled' ? o.value : { error: o.reason instanceof Error ? o.reason.message : String(o.reason), cost: 0 }));
}
